-- 012: Manual Operativo 2026 — paso-by-paso reference for María's lookups
--
-- Each row represents one operational step in the mining formalization process.
-- María queries this table before responding to questions that mention a specific
-- paso, role, or reference the Manual Operativo, ensuring authoritative answers
-- without requiring system-prompt edits.

create table if not exists documentos_referencia (
  id            uuid primary key default gen_random_uuid(),
  paso_numero   integer not null,
  titulo_paso   text    not null,
  rol           text,              -- who is responsible for this step
  acciones      text,              -- what actions the responsible party must take
  documentos    text,              -- required documents / inputs
  plazo         text,              -- time limit / deadline
  deliverable   text,              -- expected output / entregable
  advertencias  text,              -- warnings and common mistakes
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- Unique index on paso_numero for fast point lookups ("paso 5", "paso 12")
create unique index if not exists idx_documentos_referencia_paso
  on documentos_referencia (paso_numero);

-- GIN index for full-text searches on titulo_paso (keyword queries)
create index if not exists idx_documentos_referencia_titulo
  on documentos_referencia using gin(to_tsvector('spanish', titulo_paso));

alter table documentos_referencia enable row level security;

-- Service-role client (María's context in route.js) bypasses RLS automatically.
-- Dashboard staff and authenticated users can read reference data.
create policy "Authenticated users can read manual"
  on documentos_referencia for select
  using (auth.role() = 'authenticated');

-- Admins can insert, update, and delete steps
create policy "Admins manage manual"
  on documentos_referencia for all
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo
  ));
