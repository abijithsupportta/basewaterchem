import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import { invoiceSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';
import { canCreateOrEdit, type StaffRole } from '@/lib/authz';
import { sendServiceScheduledEmail } from '@/lib/email';
import { sendScheduledServiceWhatsApp } from '@/lib/whatsapp';
import {
  applyStockLines,
  normalizeIntegerQuantity,
  normalizeStockLines,
  validateStockAvailabilityForLines,
} from '@/lib/stock-ledger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new InvoiceRepository(supabase);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const customerId = searchParams.get('customer_id') || undefined;

    const data = await repo.findAll({ status, customerId });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');
    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only superadmin/manager/staff can create invoices.' }, { status: 403 });
    }

    // Get staff details for tracking
    let staffId: string | null = null;
    let staffName: string | null = null;
    if (user) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      
      if (staffData) {
        staffId = staffData.id;
        staffName = staffData.full_name;
      }
    }

    const repo = new InvoiceRepository(supabase);
    const body = await request.json();
    const validated = invoiceSchema.parse(body);
    const { items, invoice_number, amc_enabled, amc_period_months, ...invoiceData } = validated;
    const sanitizedInvoiceNumber = typeof invoice_number === 'string' ? invoice_number.trim() : '';

    // Calculate totals via domain service
    const calculated = InvoiceCalculator.calculate(
      items,
      invoiceData.tax_percent ?? 0,
      invoiceData.discount_amount ?? 0
    );

    // Normalize items
    const normalizedItems = (items || []).map((item: any) => ({
      ...item,
      quantity: normalizeIntegerQuantity(item.quantity),
      unit_price: Math.max(0, Number(item.unit_price) || 0),
    }));

    // Check stock availability (throws if insufficient)
    const stockLines = normalizeStockLines(
      normalizedItems.map((item: any) => ({
        productId: item.inventory_product_id,
        quantity: item.quantity,
        label: item.item_name,
      }))
    );
    await validateStockAvailabilityForLines(supabase, stockLines);

    // Create the invoice
    const invoice = await repo.create({ 
      ...invoiceData, 
      invoice_number: sanitizedInvoiceNumber || undefined,
      ...calculated,
      amc_enabled: amc_enabled || false,
      amc_period_months: amc_enabled ? amc_period_months : null,
      created_by_staff_id: staffId,
      created_by_staff_name: staffName,
    });

    // Create invoice items
    if (normalizedItems.length > 0) {
      await repo.createItems(
        normalizedItems.map((item, idx) => ({
          invoice_id: invoice.id,
          item_name: item.item_name || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          inventory_product_id: item.inventory_product_id || null,
          sort_order: idx,
        }))
      );
    }

    // Background execution of side effects: stock deduction, AMC scheduling, notifications.
    void (async () => {
      try {
        const serviceRoleSupabase = await createServiceRoleClient();
        
        // Background stock deduction
        if (stockLines.length > 0) {
          await applyStockLines(serviceRoleSupabase, {
            lines: stockLines,
            transactionType: 'sale',
            referenceType: 'invoice',
            referenceId: invoice.id,
            referenceLabel: `Sold via Invoice ${invoice.invoice_number || invoice.id}`,
            createdBy: staffId,
          });
        }

        // Background AMC contract and Service generation
        if (amc_enabled && amc_period_months) {
          const invoiceDate = new Date(invoiceData.invoice_date || new Date());
          const firstServiceDate = new Date(invoiceDate);
          firstServiceDate.setMonth(firstServiceDate.getMonth() + amc_period_months);
          const freeServiceValidUntil = new Date(invoiceDate);
          freeServiceValidUntil.setDate(freeServiceValidUntil.getDate() + 365);

          const { data: amcContract, error: amcError } = await serviceRoleSupabase.from('amc_contracts').insert({
            customer_id: invoiceData.customer_id,
            invoice_id: invoice.id,
            start_date: invoiceDate.toISOString().split('T')[0],
            end_date: firstServiceDate.toISOString().split('T')[0],
            service_interval_months: amc_period_months,
            total_services_included: 1,
            services_completed: 0,
            amount: calculated.total_amount,
            is_paid: false,
            status: 'active',
            next_service_date: firstServiceDate.toISOString().split('T')[0],
          }).select('id').single();
          
          if (amcError) throw amcError;

          const { data: createdService, error: srvError } = await serviceRoleSupabase.from('services').insert({
            customer_id: invoiceData.customer_id,
            amc_contract_id: amcContract.id,
            service_type: 'amc_service',
            status: 'scheduled',
            scheduled_date: firstServiceDate.toISOString().split('T')[0],
            description: `AMC service - Invoice ${invoice.invoice_number || 'N/A'}`,
            is_under_amc: true,
            payment_status: 'not_applicable',
            free_service_valid_until: freeServiceValidUntil.toISOString().split('T')[0],
          }).select('id, service_number').single();

          if (srvError) throw srvError;

          // Fetch customer for notification details
          const { data: customer } = await serviceRoleSupabase
            .from('customers')
            .select('full_name, email, phone')
            .eq('id', invoiceData.customer_id)
            .single();

          if (customer?.email || customer?.phone) {
            const notificationParams = {
              serviceId: createdService.id,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              customerName: customer.full_name,
              serviceNumber: createdService.service_number || invoice.invoice_number || 'New Service',
              serviceType: 'Recurring Service',
              scheduledDate: firstServiceDate.toISOString().split('T')[0],
              description: `Recurring service scheduled from Invoice ${invoice.invoice_number || ''}`,
            };

            // Send scheduled service email
            await sendServiceScheduledEmail(notificationParams);

            // Send scheduled service WhatsApp
            if (customer.phone) {
              const waResult = await sendScheduledServiceWhatsApp({
                customerName: customer.full_name || 'Customer',
                customerPhone: customer.phone,
                scheduledDate: firstServiceDate.toISOString().split('T')[0],
              });
              
              const updateData: Record<string, any> = {
                whatsapp_scheduled_status: waResult.success ? 'sent' : 'failed',
                whatsapp_scheduled_error: waResult.success ? null : waResult.error || 'Failed to send WhatsApp message',
              };
              if (waResult.success) {
                updateData.whatsapp_scheduled_sent_at = new Date().toISOString();
              }
              await serviceRoleSupabase
                .from('services')
                .update(updateData)
                .eq('id', createdService.id);
            }
          }
        }
      } catch (bgError: any) {
        console.error('[Background Invoice Actions] Error:', bgError);
      }
    })();

    return apiSuccess(invoice, 201);
  } catch (error: any) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505' &&
      /invoice_number/i.test(String((error as { message?: string }).message || ''))
    ) {
      return NextResponse.json(
        { error: 'Invoice number already exists. Please use a unique invoice number.' },
        { status: 409 }
      );
    }
    return apiError(error);
  }
}
