-- High-impact indexes for dashboard list and calendar performance
-- Services (calendar + service list)
create index if not exists idx_services_scheduled_date_status
  on public.services (scheduled_date, status);

create index if not exists idx_services_completed_date_status
  on public.services (completed_date, status);

create index if not exists idx_services_branch_scheduled_date
  on public.services (branch_id, scheduled_date desc);

-- Invoices (invoice list + date filters)
create index if not exists idx_invoices_invoice_date
  on public.invoices (invoice_date desc);

create index if not exists idx_invoices_branch_invoice_date
  on public.invoices (branch_id, invoice_date desc);

-- Customers (customer list search/sort/filter)
create index if not exists idx_customers_branch_created_at
  on public.customers (branch_id, created_at desc);

create index if not exists idx_customers_is_active_created_at
  on public.customers (is_active, created_at desc);
