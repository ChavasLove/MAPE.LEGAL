-- 009: Patch missing columns on clientes and transacciones_pendientes
-- Aligns schema with column names used by app/api/whatsapp/route.js

alter table clientes
  add column if not exists telefono_whatsapp text unique,
  add column if not exists situacion_tierra  text,
  add column if not exists tipo_mineral      text not null default 'oro',
  add column if not exists fecha_registro    timestamp with time zone default now();

create index if not exists idx_clientes_telefono_whatsapp
  on clientes (telefono_whatsapp);

alter table transacciones_pendientes
  add column if not exists mensaje_original    text,
  add column if not exists respuesta_asistente text;
