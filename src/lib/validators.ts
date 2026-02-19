import { z } from 'zod';

export const customerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15),
  alt_phone: z.string().optional(),
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

export const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  category: z.enum(['water_purifier', 'water_filter', 'water_softener', 'spare_part', 'consumable', 'accessory', 'other']),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be positive'),
  warranty_months: z.coerce.number().min(0).optional(),
  amc_interval_months: z.coerce.number().min(1).optional(),
});

export const customerProductSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  serial_number: z.string().optional(),
  installation_date: z.string(),
  purchase_price: z.coerce.number().min(0).optional(),
  location_in_premises: z.string().optional(),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  customer_product_id: z.string().uuid().optional(),
  amc_contract_id: z.string().uuid().optional(),
  complaint_id: z.string().uuid().optional(),
  service_type: z.enum(['amc_service', 'paid_service', 'installation', 'complaint_service', 'warranty_service']),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  scheduled_time_slot: z.string().optional(),
  assigned_technician_id: z.string().uuid().optional(),
  description: z.string().optional(),
  is_under_warranty: z.boolean().optional(),
  is_under_amc: z.boolean().optional(),
});

export const serviceCompleteSchema = z.object({
  completed_date: z.string().min(1, 'Completed date is required'),
  work_done: z.string().min(5, 'Please describe the work done'),
  parts_cost: z.coerce.number().min(0).optional(),
  service_charge: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  payment_status: z.enum(['not_applicable', 'pending', 'partial', 'paid']).optional(),
  technician_notes: z.string().optional(),
});

export const amcSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  customer_product_id: z.string().uuid('Select a product'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  service_interval_months: z.coerce.number().min(1).optional(),
  total_services_included: z.coerce.number().min(1).optional(),
  amount: z.coerce.number().min(0, 'Amount is required'),
  notes: z.string().optional(),
});

export const complaintSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  customer_product_id: z.string().uuid().optional(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(10, 'Please describe the issue in detail'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  is_under_warranty: z.boolean().optional(),
  assigned_to: z.string().uuid().optional(),
});

export const quotationItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(1),
  unit_price: z.coerce.number().min(0),
});

export const quotationSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  title: z.string().min(3, 'Title is required'),
  valid_until: z.string().optional(),
  tax_percent: z.coerce.number().min(0).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, 'Add at least one item'),
});

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(1),
  unit_price: z.coerce.number().min(0),
});

export const invoiceSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  service_id: z.string().uuid().optional(),
  quotation_id: z.string().uuid().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  tax_percent: z.coerce.number().min(0).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
});

export const staffSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'staff', 'technician']),
  is_active: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
