alter table public.invoices
  add column if not exists payment_method text not null default 'Not recorded'
  check (payment_method in ('Not recorded', 'Cash', 'EFT', 'Mobile money', 'Other'));

grant select, update on public.invoices to anon, authenticated;
