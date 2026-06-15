-- Income categories + flexible expense categories (custom slugs)

alter table public.recurring_incomes
  add column if not exists category text not null default 'other';

alter table public.recurring_incomes drop constraint if exists recurring_incomes_category_check;
alter table public.recurring_incomes add constraint recurring_incomes_category_len
  check (char_length(category) between 1 and 50);

comment on column public.recurring_incomes.category is
  'Income category preset slug or custom:label (profiles.currency amounts).';

alter table public.recurring_expenses drop constraint if exists recurring_expenses_category_check;
alter table public.recurring_expenses add constraint recurring_expenses_category_len
  check (char_length(category) between 1 and 50);
