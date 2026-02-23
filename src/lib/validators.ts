import { z } from 'zod';

export const customerSchema = z.object({
  branch_id: z.string().uuid('Select a branch'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  alt_phone: z.string().optional().refine((value) => {
    if (!value) return true;
    return /^\d{10}$/.test(value);
  }, 'Alt phone must be exactly 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address_line1: z.string().min(5, 'Address is required'),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  location_landmark: z.string().optional(),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  branch_id: z.string().uuid('Select a branch'),
  amc_contract_id: z.string().uuid().optional(),
  service_type: z.enum(['amc_service', 'paid_service', 'installation', 'free_service']),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  scheduled_time_slot: z.string().optional(),
  description: z.string().optional(),
  is_under_amc: z.boolean().optional(),
});

export const serviceCompleteSchema = z.object({
  completed_date: z.string().min(1, 'Completed date is required'),
  work_done: z.string().min(5, 'Please describe the work done'),
  parts_cost: z.coerce.number().min(0).optional(),
  service_charge: z.coerce.number().min(0).optional(),
  tax_percent: z.coerce.number().min(0).optional(),
  tax_amount: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  payment_status: z.enum(['not_applicable', 'pending', 'partial', 'paid']).optional(),
  technician_notes: z.string().optional(),
});

export const amcSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  invoice_id: z.string().uuid().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  service_interval_months: z.coerce.number().min(1).optional(),
  total_services_included: z.coerce.number().min(1).optional(),
  amount: z.coerce.number().min(0, 'Amount is required'),
  notes: z.string().optional(),
});

export const invoiceItemSchema = z.object({
  item_name: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1),
  unit_price: z.coerce.number().min(0),
});

export const invoiceSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  branch_id: z.string().uuid('Select a branch'),
  service_id: z.string().uuid().optional(),
  invoice_date: z.string().optional(),
  tax_percent: z.coerce.number().min(0).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  amc_enabled: z.boolean().optional(),
  amc_period_months: z.coerce.number().min(1).optional(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
