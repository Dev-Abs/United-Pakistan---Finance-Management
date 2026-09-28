alter table users add column if not exists active boolean not null default true;
alter table users add column if not exists session_version integer not null default 0;
create index if not exists users_sector_active_idx on users (sector_id, active);
