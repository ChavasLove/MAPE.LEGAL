create table expedientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  created_at timestamp default now()
);

create table phases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid references expedientes(id),
  amount numeric,
  status text default 'pending',
  created_at timestamp default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid,
  action text,
  metadata jsonb,
  created_at timestamp default now()
);
