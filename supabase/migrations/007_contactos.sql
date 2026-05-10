-- 007: Persistent contact log from landing page form
-- Every submission is stored here first; email delivery is secondary.

create table if not exists contactos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  correo      text not null,
  empresa     text,
  mensaje     text not null,
  email_sent  boolean default false,
  created_at  timestamp with time zone default now()
);

-- Admin reads only; no public access
alter table contactos enable row level security;

create policy "Solo admin puede leer contactos"
  on contactos for select
  using (false);   -- service role bypasses RLS, anon/user cannot read
