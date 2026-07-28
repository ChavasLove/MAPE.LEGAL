-- ============================================================
-- 029 — Bucket de Storage para imágenes del Mercado de Equipos
-- ============================================================
-- Correr en Supabase Studio → SQL Editor (Vercel NO aplica migraciones).
-- Idempotente.
--
-- Bucket PÚBLICO `equipos-imagenes`: las láminas/fotos subidas desde
-- /admin/equipos se sirven directo por el CDN de Supabase
-- (https://<ref>.supabase.co/storage/v1/object/public/equipos-imagenes/...).
-- La subida es server-mediated vía el cliente service-role tras
-- requireRole('admin' | 'abogado') — el browser nunca escribe directo, así
-- que basta la policy service_role sobre storage.objects (patrón 026).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipos-imagenes',
  'equipos-imagenes',
  true,
  10485760,  -- 10 MB por archivo
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists "equipos_imagenes_service_all" on storage.objects;
create policy "equipos_imagenes_service_all" on storage.objects
  for all to service_role
  using (bucket_id = 'equipos-imagenes')
  with check (bucket_id = 'equipos-imagenes');
