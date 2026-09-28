create table if not exists auth_login_attempts (
  attempt_key text primary key,
  failure_count integer not null default 0 check (failure_count >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists auth_login_attempts_updated_idx on auth_login_attempts (updated_at);
