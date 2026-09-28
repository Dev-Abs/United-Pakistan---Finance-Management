create table sectors (
  id bigint generated always as identity primary key,
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  created_by bigint,
  active boolean not null default true
);

create table users (
  id bigint generated always as identity primary key,
  sector_id bigint references sectors(id),
  email text not null check (btrim(email) <> ''),
  password_hash text not null check (password_hash <> ''),
  role text not null check (role in ('super_admin', 'secretary', 'read_only')),
  must_change_password boolean not null default false,
  created_by bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint users_role_sector_check check (
    (role = 'super_admin' and sector_id is null)
    or (role in ('secretary', 'read_only') and sector_id is not null)
  )
);

create unique index users_email_unique on users (lower(btrim(email)));
create index users_sector_id_idx on users (sector_id);

alter table sectors
  add constraint sectors_created_by_fkey
  foreign key (created_by) references users(id) on delete set null;

create table months (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create unique index months_sector_name_unique
  on months (sector_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

create table members (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  name text not null check (btrim(name) <> ''),
  phone_number text not null default '',
  designation text not null default '',
  member_category text not null default 'Fellow Member (FM)',
  created_at timestamptz not null default now()
);

create index members_sector_id_idx on members (sector_id);
create index members_sector_phone_idx on members (sector_id, phone_number);
create index members_sector_name_idx on members (sector_id, lower(name));

create table monthly_payments (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  month_id bigint not null references months(id),
  member_id bigint not null references members(id),
  monthly_fund numeric(14, 2) not null default 0,
  previous_balance numeric(14, 2) not null default 0,
  total_payable numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  remaining_balance numeric(14, 2) not null default 0,
  payment_status text not null default 'Pending'
    check (payment_status in ('Pending', 'Partially Paid', 'Paid')),
  payment_date date,
  receipt_link text not null default '',
  remarks text not null default '',
  receipt_no text not null default '',
  increment numeric(14, 2) not null default 0,
  special_fund numeric(14, 2) not null default 0,
  recovery numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (sector_id, month_id, member_id),
  unique (sector_id, id)
);

create index monthly_payments_sector_month_idx on monthly_payments (sector_id, month_id);
create index monthly_payments_member_idx on monthly_payments (member_id);

create table expenses (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  month_id bigint not null references months(id),
  expense_date date,
  category text not null default '',
  description text not null default '',
  amount numeric(14, 2) not null default 0,
  paid_by text not null default '',
  remarks text not null default '',
  created_at timestamptz not null default now(),
  unique (sector_id, id)
);

create index expenses_sector_month_idx on expenses (sector_id, month_id);

create table follow_ups (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  month_id bigint not null references months(id),
  member_id bigint references members(id) on delete set null,
  member_name text not null,
  phone_number text not null default '',
  member_category text not null default '',
  event_type text not null default 'Note',
  reminder_number integer,
  event_date timestamptz,
  reply_status text not null default '',
  reason_reply text not null default '',
  next_reminder_date date,
  created_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (sector_id, id)
);

create index follow_ups_sector_month_idx on follow_ups (sector_id, month_id);
create index follow_ups_member_idx on follow_ups (member_id);

create table special_fund_campaigns (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  campaign_key text not null check (btrim(campaign_key) <> ''),
  name text not null default '',
  event_timing text not null default '',
  event_venue text not null default '',
  jp_minimum numeric(14, 2) not null default 0,
  sc_minimum numeric(14, 2) not null default 0,
  fm_minimum numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (sector_id, campaign_key),
  unique (sector_id, id)
);

create table special_fund_contributions (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  campaign_id bigint not null references special_fund_campaigns(id),
  member_id bigint references members(id) on delete set null,
  member_name text not null,
  phone_number text not null default '',
  member_category text not null default '',
  minimum_amount numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null,
  payment_date date,
  receipt_link text not null default '',
  remarks text not null default '',
  recorded_at timestamptz not null default now(),
  unique (sector_id, id)
);

create index special_fund_contributions_sector_campaign_idx
  on special_fund_contributions (sector_id, campaign_id);
create index special_fund_contributions_member_idx
  on special_fund_contributions (member_id);

create table message_templates (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  template_key text not null check (btrim(template_key) <> ''),
  content text not null,
  unique (sector_id, template_key)
);

create table settings (
  id bigint generated always as identity primary key,
  sector_id bigint not null references sectors(id),
  setting_key text not null check (btrim(setting_key) <> ''),
  setting_value jsonb not null,
  unique (sector_id, setting_key)
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_user_id bigint references users(id) on delete set null,
  sector_id bigint references sectors(id),
  action text not null check (btrim(action) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on audit_log (created_at desc);
create index audit_log_sector_created_at_idx on audit_log (sector_id, created_at desc);
create index audit_log_actor_created_at_idx on audit_log (actor_user_id, created_at desc);

-- Composite foreign keys guarantee that cross-table references cannot cross sectors,
-- even before optional row-level security is introduced.
alter table months add constraint months_sector_id_id_unique unique (sector_id, id);
alter table members add constraint members_sector_id_id_unique unique (sector_id, id);

alter table monthly_payments
  add constraint monthly_payments_month_sector_fkey
    foreign key (sector_id, month_id) references months(sector_id, id),
  add constraint monthly_payments_member_sector_fkey
    foreign key (sector_id, member_id) references members(sector_id, id);

alter table expenses
  add constraint expenses_month_sector_fkey
    foreign key (sector_id, month_id) references months(sector_id, id);

alter table follow_ups
  add constraint follow_ups_month_sector_fkey
    foreign key (sector_id, month_id) references months(sector_id, id),
  add constraint follow_ups_member_sector_fkey
    foreign key (sector_id, member_id) references members(sector_id, id);

alter table special_fund_contributions
  add constraint special_fund_contributions_campaign_sector_fkey
    foreign key (sector_id, campaign_id) references special_fund_campaigns(sector_id, id),
  add constraint special_fund_contributions_member_sector_fkey
    foreign key (sector_id, member_id) references members(sector_id, id);
