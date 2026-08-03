-- 037_conversaciones_tipo_interlocutor.sql
-- Blindaje institucional de María (orden 2026-08, T1.2).
--
-- Marca persistente de interlocutor institucional en el historial de
-- conversaciones: una vez que un número se identifica como funcionario,
-- técnico o autoridad, TODOS los turnos siguientes se tratan como
-- institucionales (un funcionario no se "convierte" en prospecto comercial
-- en el turno siguiente). El webhook consulta la existencia de cualquier
-- fila institucional previa por número antes del onboarding.
--
-- Append-only e idempotente: solo ADD COLUMN IF NOT EXISTS + índice parcial;
-- sin DROP, sin DELETE, sin modificación de filas existentes (el DEFAULT
-- 'comercial' cubre el historial completo).

alter table public.conversaciones_whatsapp
  add column if not exists tipo_interlocutor text not null default 'comercial';

comment on column public.conversaciones_whatsapp.tipo_interlocutor is
  'Valores: ''comercial'' | ''institucional''. Marcado por el gate determinístico del webhook (lib/maria/institutional.ts); institucional es pegajoso por número.';

-- CHECK defensivo, idempotente (ADD CONSTRAINT IF NOT EXISTS no existe en
-- PostgreSQL — patrón DO $$ como en migraciones previas).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conversaciones_wa_tipo_interlocutor_chk'
      and conrelid = 'public.conversaciones_whatsapp'::regclass
  ) then
    alter table public.conversaciones_whatsapp
      add constraint conversaciones_wa_tipo_interlocutor_chk
      check (tipo_interlocutor in ('comercial', 'institucional'));
  end if;
end $$;

-- La consulta caliente del gate: "¿este número tiene alguna fila
-- institucional?" — índice parcial, minúsculo, solo filas institucionales.
create index if not exists idx_conversaciones_wa_institucional
  on public.conversaciones_whatsapp (numero_whatsapp)
  where tipo_interlocutor = 'institucional';
