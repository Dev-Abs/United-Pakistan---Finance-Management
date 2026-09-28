create table if not exists sector_onboarding_requests (
  id bigint generated always as identity primary key,
  sector_name text not null check (btrim(sector_name) <> ''),
  requester_email text not null check (btrim(requester_email) <> ''),
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by bigint references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sector_onboarding_status_idx on sector_onboarding_requests(status, created_at desc);
