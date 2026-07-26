-- Migration 028: Precios de combustibles (Honduras)
--
-- Fuel prices in Honduras are NOT a live market feed — the Secretaría de Energía
-- (SEN) fixes them by decree WEEKLY (effective 6 AM every Monday), with a
-- government subsidy absorbing 50% of the international increase for diesel and
-- regular gasoline. So the honest model is a small "current official price" table
-- with an effective date (`vigente_desde`) + source, editable from the admin
-- panel, NOT a per-second tick. The live gold/silver/FX tick lives in
-- `precios_diarios` (migration 009); this table is its diesel/gasolina companion.
--
-- Idempotent — safe to re-run in Supabase Studio → SQL Editor.
-- NOTE: numbered 028 because 027 is taken by 027_equipos_mercado.sql.

CREATE TABLE IF NOT EXISTS precios_combustibles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One current row per fuel (unique). Historical values are not retained here —
  -- edits overwrite via upsert on this key. History, if ever needed, belongs in a
  -- separate append-only table.
  combustible   text NOT NULL UNIQUE CHECK (combustible IN (
    'diesel',
    'gasolina_regular',
    'gasolina_superior',
    'kerosene',
    'glp'
  )),
  precio_hnl    numeric(10, 2) NOT NULL CHECK (precio_hnl > 0),   -- por unidad
  unidad        text NOT NULL DEFAULT 'galón',
  zona          text NOT NULL DEFAULT 'Tegucigalpa',
  vigente_desde date NOT NULL DEFAULT current_date,
  fuente        text NOT NULL DEFAULT 'Secretaría de Energía (SEN)',
  notas         text,
  activo        boolean NOT NULL DEFAULT true,
  updated_by    text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precios_combustibles_activo ON precios_combustibles(activo);

-- ─── RLS: public reads active rows, admin/abogado/tecnico write, service all ──
ALTER TABLE precios_combustibles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- CREATE POLICY IF NOT EXISTS does not exist in PostgreSQL — drop + create
  -- (same idempotent pattern as migrations 018 / 027).
  DROP POLICY IF EXISTS "Public read active combustibles" ON precios_combustibles;
  DROP POLICY IF EXISTS "Staff manage combustibles"       ON precios_combustibles;
  DROP POLICY IF EXISTS "Service role all combustibles"    ON precios_combustibles;

  CREATE POLICY "Public read active combustibles"
    ON precios_combustibles FOR SELECT
    TO anon, authenticated
    USING (activo = true);

  CREATE POLICY "Staff manage combustibles"
    ON precios_combustibles FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND rol IN ('admin', 'abogado', 'tecnico_ambiental')
          AND activo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND rol IN ('admin', 'abogado', 'tecnico_ambiental')
          AND activo = true
      )
    );

  -- The service_role of this project does NOT reliably have BYPASSRLS
  -- (see migrations 024/025/026/027) — an explicit FOR ALL policy is required
  -- for admin writes made through the service-role client.
  CREATE POLICY "Service role all combustibles"
    ON precios_combustibles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$;

-- ─── Seed current SEN structure ──────────────────────────────────────────────
-- Effective 2026-07-27 (Tegucigalpa reference), per the SEN weekly structure.
-- DO NOTHING on conflict: the first apply seeds these values; after that the
-- admin owns them via /admin/precios, so a re-run of this migration must never
-- clobber an edit. Admins update the price every Monday when the new SEN
-- structure takes effect (the widget shows the `vigente_desde` date so a stale
-- value is visible, not silent).
INSERT INTO precios_combustibles (combustible, precio_hnl, unidad, zona, vigente_desde, fuente)
VALUES
  ('diesel',            124.26, 'galón', 'Tegucigalpa', '2026-07-27', 'Secretaría de Energía (SEN)'),
  ('gasolina_regular',  123.73, 'galón', 'Tegucigalpa', '2026-07-27', 'Secretaría de Energía (SEN)'),
  ('gasolina_superior', 135.16, 'galón', 'Tegucigalpa', '2026-07-27', 'Secretaría de Energía (SEN)'),
  ('kerosene',          109.39, 'galón', 'Tegucigalpa', '2026-07-27', 'Secretaría de Energía (SEN)')
ON CONFLICT (combustible) DO NOTHING;
