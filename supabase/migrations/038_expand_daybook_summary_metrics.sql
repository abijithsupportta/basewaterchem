-- Expanded Day Book summary metrics for dashboard reporting
create or replace function public.get_daybook_summary(
  p_from date default null,
  p_to date default null
)
returns table (
  invoice_sales numeric,
  collected numeric,
  dues numeric,
  service_revenue numeric,
  total_revenue numeric,
  expenses_total numeric,
  total_invoices bigint,
  total_sales_done bigint,
  total_services bigint,
  total_expenses bigint
)
language sql
stable
as $$
  with inv as (
    select
      coalesce(sum(i.total_amount), 0) as invoice_sales,
      coalesce(sum(i.amount_paid), 0) as collected,
      coalesce(sum(i.balance_due), 0) as dues,
      count(*)::bigint as total_invoices,
      count(*) filter (where coalesce(i.total_amount, 0) > 0)::bigint as total_sales_done
    from public.invoices i
    where (p_from is null or i.invoice_date >= p_from)
      and (p_to is null or i.invoice_date <= p_to)
  ),
  srv as (
    select
      coalesce(sum(s.total_amount), 0) as service_revenue,
      count(*)::bigint as total_services
    from public.services s
    where s.status = 'completed'
      and (p_from is null or coalesce(s.completed_date::date, s.scheduled_date) >= p_from)
      and (p_to is null or coalesce(s.completed_date::date, s.scheduled_date) <= p_to)
  ),
  exp as (
    select
      coalesce(sum(e.amount), 0) as expenses_total,
      count(*)::bigint as total_expenses
    from public.expenses e
    where (p_from is null or e.expense_date >= p_from)
      and (p_to is null or e.expense_date <= p_to)
  )
  select
    inv.invoice_sales,
    inv.collected,
    inv.dues,
    srv.service_revenue,
    (inv.invoice_sales + srv.service_revenue) as total_revenue,
    exp.expenses_total,
    inv.total_invoices,
    inv.total_sales_done,
    srv.total_services,
    exp.total_expenses
  from inv
  cross join srv
  cross join exp;
$$;
