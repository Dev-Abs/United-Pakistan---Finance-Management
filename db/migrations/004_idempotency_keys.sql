create table if not exists idempotency_keys (
  id bigint generated always as identity primary key,
  actor_user_id bigint not null references users(id) on delete cascade,
  sector_id bigint references sectors(id) on delete cascade,
  route text not null,
  key text not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, sector_id, route, key)
);
create index if not exists idempotency_keys_created_idx on idempotency_keys (created_at);
