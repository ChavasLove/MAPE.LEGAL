-- 036_certificados_hash_sha256.sql
-- Interoperabilidad Fase 1 (T2.3): huella criptográfica del documento del
-- Certificado de Origen.
--
-- hash_sha256 = SHA-256 (hex) del DOCUMENTO almacenado del certificado (el
-- archivo que el portador puede tener en mano). Es distinto de
-- hash_verificacion (migración 020), que la Fase 2B define como hash del
-- cuerpo canónico del registro. El cálculo vive en lib/certificados/hash.ts
-- y se engancha al flujo de emisión/almacenamiento documental cuando la
-- Fase 2B lo construya — hoy no existe generación de PDF ni flujo de
-- emisión en el código (solo lecturas), por lo que la columna queda NULL
-- hasta entonces (documentado en el reporte de la orden 2026-08).
--
-- La vista pública se re-crea para exponer la huella y el id del certificado
-- (uuid, no-PII — necesario para asociar la última fila de
-- verificaciones_fuente en /verificar/[numero]). CREATE OR REPLACE VIEW solo
-- permite AGREGAR columnas al final — no reordenar las existentes.
--
-- Idempotente: re-ejecutable sin efectos secundarios.

alter table public.certificados_origen
  add column if not exists hash_sha256 text null;

comment on column public.certificados_origen.hash_sha256 is
  'SHA-256 (hex) del documento almacenado del certificado. Se calcula al almacenar el documento (lib/certificados/hash.ts); NULL hasta que exista el flujo de emisión (Fase 2B).';

create or replace view public.certificados_origen_publicos as
select
  c.numero_certificado,
  c.fecha_emision,
  c.peso_oro_g,
  c.estado,
  c.valido_hasta,
  c.hash_verificacion,
  m.nombre        as mina_nombre,
  m.codigo        as mina_codigo,
  m.municipio     as mina_municipio,
  m.departamento  as mina_departamento,
  c.hash_sha256,
  c.id            as certificado_id
from public.certificados_origen c
left join public.minas m on m.id = c.mina_id;

grant select on public.certificados_origen_publicos to anon, authenticated;
