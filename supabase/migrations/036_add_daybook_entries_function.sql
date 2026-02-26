-- Server-side paginated Day Book entries with all-time cap
create or replace function public.get_daybook_entries(
  p_from date default null,
  p_to date default null,
  p_offset integer default 0,
  p_limit integer default 20,
  p_cap_days integer default 180
)
returns table (
  entry_key text,
  entry_date date,
  entry_type text,
  reference text,
  description text,
  amount numeric,
  dues numeric,
  status text,
  source_id uuid,
  expense_date date,
  expense_title text,
  expense_category text,
  expense_amount numeric,
  expense_payment_method text,
  expense_reference_no text,
  expense_description text,
  total_count bigint,
  capped_from date
)
language sql
stable
as $$
  with bounds as (
    select
      case
        when p_from is not null then p_from
        when p_to is null then (current_date - (greatest(p_cap_days, 1) - 1))
        else null
      end as effective_from,
      p_to as effective_to,
      case
        when p_from is null and p_to is null then (current_date - (greatest(p_cap_days, 1) - 1))
        else null
      end as capped_from
  ),
  entries as (
    select
      ('inv-' || i.id::text) as entry_key,
      i.invoice_date as entry_date,
      'Sales'::text as entry_type,
      coalesce(i.invoice_number, '-')::text as reference,
      coalesce(c.full_name, '-')::text as description,
      coalesce(i.total_amount, 0)::numeric as amount,
      coalesce(i.balance_due, 0)::numeric as dues,
      coalesce(i.status::text, '-') as status,
      i.id as source_id,
      null::date as expense_date,
      null::text as expense_title,
      null::text as expense_category,
      null::numeric as expense_amount,
      null::text as expense_payment_method,
      null::text as expense_reference_no,
      null::text as expense_description
    from public.invoices i
    left join public.customers c on c.id = i.customer_id
    cross join bounds b
    where (b.effective_from is null or i.invoice_date >= b.effective_from)
      and (b.effective_to is null or i.invoice_date <= b.effective_to)

    union all

    select
      ('srv-' || s.id::text) as entry_key,
      coalesce(s.completed_date::date, s.scheduled_date) as entry_date,
      'Service'::text as entry_type,
      coalesce(s.service_number, '-')::text as reference,
      coalesce(c.full_name, '-')::text as description,
      coalesce(s.total_amount, 0)::numeric as amount,
      case when s.payment_status in ('pending', 'partial') then coalesce(s.total_amount, 0)::numeric else 0::numeric end as dues,
      coalesce(s.status::text, '-') as status,
      s.id as source_id,
      null::date as expense_date,
      null::text as expense_title,
      null::text as expense_category,
      null::numeric as expense_amount,
      null::text as expense_payment_method,
      null::text as expense_reference_no,
      null::text as expense_description
    from public.services s
    left join public.customers c on c.id = s.customer_id
    cross join bounds b
    where (b.effective_from is null or coalesce(s.completed_date::date, s.scheduled_date) >= b.effective_from)
      and (b.effective_to is null or coalesce(s.completed_date::date, s.scheduled_date) <= b.effective_to)

    union all

    select
      ('exp-' || e.id::text) as entry_key,
      e.expense_date as entry_date,
      'Expense'::text as entry_type,
      coalesce(e.category, '-')::text as reference,
      coalesce(e.title, '-')::text as description,
      (0 - coalesce(e.amount, 0))::numeric as amount,
      0::numeric as dues,
      coalesce(e.payment_method::text, '-') as status,
      e.id as source_id,
      e.expense_date,
      e.title,
      e.category,
      coalesce(e.amount, 0)::numeric as expense_amount,
      e.payment_method,
      e.reference_no,
      e.description
    from public.expenses e
    cross join bounds b
    where (b.effective_from is null or e.expense_date >= b.effective_from)
      and (b.effective_to is null or e.expense_date <= b.effective_to)
  ),
  total as (
    select count(*)::bigint as total_count from entries
  ),
  paged as (
    select *
    from entries
    order by entry_date desc, entry_type asc, reference asc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  )
  select
    p.entry_key,
    p.entry_date,
    p.entry_type,
    p.reference,
    p.description,
    p.amount,
    p.dues,
    p.status,
    p.source_id,
    p.expense_date,
    p.expense_title,
    p.expense_category,
    p.expense_amount,
    p.expense_payment_method,
    p.expense_reference_no,
    p.expense_description,
    t.total_count,
    b.capped_from
  from paged p
  cross join total t
  cross join bounds b;
$$;