-- Register Pay Guard migrations as already applied (schema exists via SQL Editor).
-- CLI versions are numeric prefixes (001, 002, …) and timestamp (20260615110800).
-- Run once in Supabase SQL Editor when supabase db push fails with "already exists".

insert into supabase_migrations.schema_migrations (version, name, statements)
select v, v, array[]::text[]
from (
  values
    ('001'),
    ('002'),
    ('003'),
    ('004'),
    ('005'),
    ('006'),
    ('007'),
    ('008'),
    ('009'),
    ('20260615110800')
) as t(v)
where not exists (
  select 1 from supabase_migrations.schema_migrations m where m.version = t.v
);

select version from supabase_migrations.schema_migrations order by version;
