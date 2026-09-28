-- Apply only through `npm run db:apply-finance-rls`. That command requires an
-- explicit confirmation token and a validated non-superuser/non-BYPASSRLS
-- DATABASE_RLS_ROLE that the connection role is permitted to SET.

begin;

create or replace function public.app_current_sector_id()
returns bigint
language sql
stable
as $$
  select nullif(current_setting('app.current_sector_id', true), '')::bigint
$$;

create or replace function public.app_current_role()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.current_role', true), '')
$$;

-- Super admins may query across sectors only when their authenticated role was
-- explicitly installed in the current transaction. Sector users remain bound
-- to the transaction-local sector for both reads and writes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'months',
    'members',
    'monthly_payments',
    'expenses',
    'follow_ups',
    'special_fund_campaigns',
    'special_fund_contributions',
    'message_templates',
    'settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('drop policy if exists tenant_isolation on public.%I', table_name);
    execute format(
      'create policy tenant_isolation on public.%I using (public.app_current_role() = ''super_admin'' or sector_id = public.app_current_sector_id()) with check (public.app_current_role() = ''super_admin'' or sector_id = public.app_current_sector_id())',
      table_name
    );
  end loop;
end
$$;

commit;
