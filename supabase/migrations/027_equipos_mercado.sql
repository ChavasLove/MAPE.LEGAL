-- Migration 027: Equipment Marketplace (Mercado de Equipos)
-- Gold washing equipment catalog for artisanal miners.
-- Idempotent — safe to re-run in Supabase Studio → SQL Editor.
-- NOTE: numbered 027 because 026 is taken by 026_marketplace_documents.sql.

CREATE TABLE IF NOT EXISTS equipos_mercado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  descripcion_corta text,
  categoria text NOT NULL CHECK (categoria IN (
    'planta_lavado_oro',
    'trommel',
    'sluice_box',
    'mesa_concentracion',
    'chancadora',
    'bomba_agua',
    'generador',
    'criba_vibratoria',
    'caja_esclusa',
    'equipo_portatil'
  )),
  proveedor text NOT NULL,
  precio_min_usd integer NOT NULL CHECK (precio_min_usd > 0),
  precio_max_usd integer CHECK (precio_max_usd IS NULL OR precio_max_usd >= precio_min_usd),
  moq integer NOT NULL DEFAULT 1 CHECK (moq > 0),
  unidad_moq text NOT NULL DEFAULT 'Pieza',
  capacidad text,   -- e.g., "50-100 toneladas/hora"
  potencia text,    -- e.g., "15 HP"
  peso text,        -- e.g., "3,500 kg"
  dimensiones text,
  imagen_url text NOT NULL,
  galeria_urls text[] DEFAULT '{}',
  especificaciones jsonb DEFAULT '{}',
  destacado boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_equipos_categoria ON equipos_mercado(categoria);
CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos_mercado(activo);
CREATE INDEX IF NOT EXISTS idx_equipos_destacado ON equipos_mercado(destacado);
CREATE INDEX IF NOT EXISTS idx_equipos_precio ON equipos_mercado(precio_min_usd);
CREATE INDEX IF NOT EXISTS idx_equipos_slug ON equipos_mercado(slug);

-- FTS for search
ALTER TABLE equipos_mercado ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(descripcion_corta, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(proveedor, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(descripcion, '')), 'D')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_equipos_search ON equipos_mercado USING GIN(search_vector);

-- RLS: Public can read active equipment
ALTER TABLE equipos_mercado ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop existing policies to avoid conflicts (CREATE POLICY IF NOT EXISTS
  -- does not exist in PostgreSQL — same pattern as migration 018)
  DROP POLICY IF EXISTS "Public read active equipos" ON equipos_mercado;
  DROP POLICY IF EXISTS "Admin full access equipos" ON equipos_mercado;
  DROP POLICY IF EXISTS "Service role all equipos" ON equipos_mercado;

  CREATE POLICY "Public read active equipos"
    ON equipos_mercado FOR SELECT
    TO anon, authenticated
    USING (activo = true);

  CREATE POLICY "Admin full access equipos"
    ON equipos_mercado FOR ALL
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

  -- The service_role of this project does NOT have BYPASSRLS (see migrations
  -- 024/025/026) — an explicit FOR ALL policy is required for admin writes.
  CREATE POLICY "Service role all equipos"
    ON equipos_mercado FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$;

-- Drop-before-create so re-runs can change return types without hitting
-- 42P13 "cannot change return type" (lesson from the migration 024 saga).
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('search_equipos_mercado', 'get_equipo_by_slug', 'equipos_categoria_stats')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', fn.signature);
  END LOOP;
END $$;

-- RPC for searching equipment (SECURITY DEFINER pattern from migration 019 —
-- bypasses RLS without depending on service_role BYPASSRLS; safe to expose to
-- anon because it only ever returns activo = true rows).
CREATE FUNCTION public.search_equipos_mercado(
  p_query text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_precio_min integer DEFAULT NULL,
  p_precio_max integer DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  nombre text,
  descripcion_corta text,
  categoria text,
  proveedor text,
  precio_min_usd integer,
  precio_max_usd integer,
  moq integer,
  unidad_moq text,
  capacidad text,
  imagen_url text,
  destacado boolean,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  -- Count total
  SELECT COUNT(*) INTO v_total
  FROM equipos_mercado e
  WHERE e.activo = true
    AND (p_categoria IS NULL OR e.categoria = p_categoria)
    AND (p_precio_min IS NULL OR e.precio_min_usd >= p_precio_min)
    AND (p_precio_max IS NULL OR (e.precio_max_usd IS NOT NULL AND e.precio_max_usd <= p_precio_max) OR
         (e.precio_max_usd IS NULL AND e.precio_min_usd <= p_precio_max))
    AND (
      p_query IS NULL
      OR p_query = ''
      OR e.search_vector @@ plainto_tsquery('spanish', p_query)
      OR e.nombre ILIKE '%' || p_query || '%'
      OR e.proveedor ILIKE '%' || p_query || '%'
    );

  -- Return paginated results
  RETURN QUERY
  SELECT
    e.id,
    e.slug,
    e.nombre,
    e.descripcion_corta,
    e.categoria,
    e.proveedor,
    e.precio_min_usd,
    e.precio_max_usd,
    e.moq,
    e.unidad_moq,
    e.capacidad,
    e.imagen_url,
    e.destacado,
    v_total AS total_count
  FROM equipos_mercado e
  WHERE e.activo = true
    AND (p_categoria IS NULL OR e.categoria = p_categoria)
    AND (p_precio_min IS NULL OR e.precio_min_usd >= p_precio_min)
    AND (p_precio_max IS NULL OR (e.precio_max_usd IS NOT NULL AND e.precio_max_usd <= p_precio_max) OR
         (e.precio_max_usd IS NULL AND e.precio_min_usd <= p_precio_max))
    AND (
      p_query IS NULL
      OR p_query = ''
      OR e.search_vector @@ plainto_tsquery('spanish', p_query)
      OR e.nombre ILIKE '%' || p_query || '%'
      OR e.proveedor ILIKE '%' || p_query || '%'
    )
  ORDER BY e.destacado DESC, e.orden ASC, e.precio_min_usd ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_equipos_mercado TO anon, authenticated, service_role;

-- RPC to get single equipo by slug (only active rows — public detail page)
CREATE FUNCTION public.get_equipo_by_slug(p_slug text)
RETURNS SETOF equipos_mercado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM equipos_mercado
  WHERE slug = p_slug AND activo = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_equipo_by_slug TO anon, authenticated, service_role;

-- RPC to get equipment categories with counts
CREATE FUNCTION public.equipos_categoria_stats()
RETURNS TABLE (categoria text, count bigint, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.categoria,
    COUNT(*)::bigint AS count,
    CASE e.categoria
      WHEN 'planta_lavado_oro' THEN 'Planta de Lavado de Oro'
      WHEN 'trommel' THEN 'Trommel / Criba Rotativa'
      WHEN 'sluice_box' THEN 'Sluice Box / Canaletas'
      WHEN 'mesa_concentracion' THEN 'Mesa de Concentración'
      WHEN 'chancadora' THEN 'Chancadora / Molino'
      WHEN 'bomba_agua' THEN 'Bomba de Agua'
      WHEN 'generador' THEN 'Generador Eléctrico'
      WHEN 'criba_vibratoria' THEN 'Criba Vibratoria'
      WHEN 'caja_esclusa' THEN 'Caja de Esclusa'
      WHEN 'equipo_portatil' THEN 'Equipo Portátil'
      ELSE e.categoria
    END AS label
  FROM equipos_mercado e
  WHERE e.activo = true
  GROUP BY e.categoria
  -- COUNT(*) instead of the alias: "count" is also a RETURNS TABLE OUT
  -- variable and plpgsql errors on the ambiguous reference.
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipos_categoria_stats TO anon, authenticated, service_role;
