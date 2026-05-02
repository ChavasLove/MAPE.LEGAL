-- Link expedientes to clientes (nullable for backward compatibility)
alter table expedientes
  add column if not exists cliente_id uuid references clientes(id) on delete set null;

create index if not exists idx_expedientes_cliente_id on expedientes(cliente_id);
