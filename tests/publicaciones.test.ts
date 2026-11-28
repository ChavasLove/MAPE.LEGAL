// tests/publicaciones.test.ts — reglas puras del marketplace de publicaciones
// (lib/publicaciones/types.ts ↔ CHECK y policies de la migración 044, que NO
// se aplica). Sin base de datos.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validarPublicacion,
  esVigente,
  transicionPermitida,
  puedeEscribir,
  LIMITE_PUBLICACIONES_POR_24H,
  PUBLICACION_ESTADOS,
  PUBLICACION_TIPOS,
  PARTICIPANTE_TIPOS,
  MONEDAS,
  PRODUCCION_UNIDADES,
  PRECIO_UNIDADES,
  type PublicacionInput,
} from '@/lib/publicaciones/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const base: PublicacionInput = {
  participante_nombre: 'Cooperativa de prueba',
  participante_tipo: 'productor',
  tipo: 'mixta',
  produccion_estimada: 120,
  produccion_unidad: 'g',
  precio_venta: 3000,
  moneda: 'HNL',
  precio_unidad: 'g_fino',
  vigente_desde: '2026-11-27',
  vigente_hasta: '2026-12-04',
};

describe('validarPublicacion', () => {
  test('publicación completa → sin errores', () => {
    assert.deepEqual(validarPublicacion(base), []);
  });
  test('al menos un dato (producción, compra o venta)', () => {
    const e = validarPublicacion({ ...base, produccion_estimada: null, precio_venta: null, tipo: 'mixta' });
    assert.ok(e.some((m) => m.includes('al menos un dato')));
  });
  test('precios no positivos y producción negativa se rechazan', () => {
    assert.ok(validarPublicacion({ ...base, precio_venta: 0 }).some((m) => m.includes('precio_venta')));
    assert.ok(validarPublicacion({ ...base, precio_compra: -5, tipo: 'compra' }).some((m) => m.includes('precio_compra')));
    assert.ok(validarPublicacion({ ...base, produccion_estimada: -1 }).some((m) => m.includes('produccion_estimada')));
    assert.ok(validarPublicacion({ ...base, precio_venta: NaN }).some((m) => m.includes('precio_venta')));
  });
  test('unidades obligatorias con el dato correspondiente', () => {
    assert.ok(validarPublicacion({ ...base, produccion_unidad: null }).some((m) => m.includes('produccion_unidad')));
    assert.ok(validarPublicacion({ ...base, precio_unidad: null }).some((m) => m.includes('precio_unidad')));
  });
  test('vigencia: formato y orden', () => {
    assert.ok(validarPublicacion({ ...base, vigente_hasta: '2026-11-26' }).some((m) => m.includes('anterior')));
    assert.ok(validarPublicacion({ ...base, vigente_desde: '27/11/2026' }).some((m) => m.includes('vigente_desde')));
  });
  test('nombre entre 2 y 120, ley 0–24, tipo coherente', () => {
    assert.ok(validarPublicacion({ ...base, participante_nombre: 'A' }).some((m) => m.includes('participante_nombre')));
    assert.ok(validarPublicacion({ ...base, ley_kilates: 25 }).some((m) => m.includes('ley_kilates')));
    assert.ok(validarPublicacion({ ...base, tipo: 'compra', precio_compra: null }).some((m) => m.includes('exige precio_compra')));
    assert.deepEqual(validarPublicacion({ ...base, tipo: 'compra', precio_compra: 2900 }), []);
  });
});

describe('vigencia y transiciones', () => {
  test('esVigente solo con estado publicada dentro del rango', () => {
    const p = { estado: 'publicada' as const, vigente_desde: '2026-11-27', vigente_hasta: '2026-12-04' };
    assert.ok(esVigente(p, '2026-11-27'));
    assert.ok(esVigente(p, '2026-12-04'));
    assert.ok(!esVigente(p, '2026-12-05'));
    assert.ok(!esVigente({ ...p, estado: 'borrador' }, '2026-11-28'));
    assert.ok(!esVigente({ ...p, estado: 'retirada' }, '2026-11-28'));
  });
  test('el autor retira; pasar a publicada solo con la función del moderador', () => {
    assert.ok(!transicionPermitida('borrador', 'publicada'));
    assert.ok(transicionPermitida('borrador', 'publicada', { porModerador: true }));
    assert.ok(!transicionPermitida('borrador', 'publicada', { porModerador: false }));
    assert.ok(transicionPermitida('borrador', 'retirada'));
    assert.ok(transicionPermitida('publicada', 'retirada'));
    assert.ok(!transicionPermitida('publicada', 'borrador'));
    assert.ok(!transicionPermitida('retirada', 'publicada'));
    assert.ok(!transicionPermitida('retirada', 'publicada', { porModerador: true }));
    assert.ok(!transicionPermitida('retirada', 'borrador'));
  });
  test('escribe solo el autor y nunca el personal de CHT', () => {
    assert.ok(puedeEscribir({ autorUserId: 'u1', userId: 'u1', esStaffCht: false }));
    assert.ok(!puedeEscribir({ autorUserId: 'u1', userId: 'u2', esStaffCht: false }));
    assert.ok(!puedeEscribir({ autorUserId: 'u1', userId: 'u1', esStaffCht: true }));
    assert.ok(!puedeEscribir({ autorUserId: 'u1', userId: null, esStaffCht: false }));
  });
});

describe('contrato con la migración 044 (sin aplicarla)', () => {
  const sql = readFileSync(join(ROOT, 'supabase', 'migrations', '044_publicaciones_marketplace.sql'), 'utf8');
  test('la cabecera dice NO APLICAR y no se reutilizan 026/027', () => {
    assert.match(sql, /NO APLICAR/);
    assert.ok(!/project_documents|equipos_mercado/.test(sql.replace(/^--.*$/gm, '')), 'no referencia tablas de 026/027 fuera de comentarios');
  });
  test('los CHECK de la 044 coinciden con las constantes de TypeScript', () => {
    const lista = (arr: readonly string[]) => arr.map((v) => `'${v}'`).join(', ');
    assert.ok(sql.includes(`check (estado in (${lista(PUBLICACION_ESTADOS)}))`));
    assert.ok(sql.includes(`check (tipo in (${lista(PUBLICACION_TIPOS)}))`));
    assert.ok(sql.includes(`check (participante_tipo in (${lista(PARTICIPANTE_TIPOS)}))`));
    assert.ok(sql.includes(`check (moneda in (${lista(MONEDAS)}))`));
    assert.ok(sql.includes(`produccion_unidad in (${lista(PRODUCCION_UNIDADES)})`));
    assert.ok(sql.includes(`precio_unidad in (${lista(PRECIO_UNIDADES)})`));
  });
  test('RLS: anon solo lee lo público; nadie borra; staff de CHT no escribe', () => {
    assert.match(sql, /grant select on table public\.publicaciones_marketplace to authenticated;/);
    assert.ok(!/grant select on table public\.publicaciones_marketplace to anon\b/.test(sql), 'anon sin SELECT de tabla');
    assert.ok(!/grant select \([^)]*\) on (?:table )?public\.publicaciones_marketplace to anon/i.test(sql), 'anon sin SELECT por columna');
    assert.match(sql, /grant select on public\.publicaciones_marketplace_publicas to anon, authenticated;/);
    assert.match(sql, /security_invoker = false/);
    const inicioVista = sql.lastIndexOf('create or replace view public.publicaciones_marketplace_publicas');
    const finVista = sql.indexOf('comment on view public.publicaciones_marketplace_publicas');
    const vista = sql.slice(inicioVista, finVista);
    assert.ok(!/\bautor_user_id\b|\bnotas\b/.test(vista), 'la vista no proyecta autor_user_id ni notas');
    assert.match(sql, /anon no lee autor_user_id/);
    assert.ok(!/grant (insert|update|all)[^;]*to anon/i.test(sql), 'nada de escritura a anon');
    assert.match(sql, /revoke delete, truncate on table public\.publicaciones_marketplace from public, anon, authenticated, service_role;/);
    assert.ok(!/for delete/i.test(sql), 'sin policy de DELETE');
    assert.match(sql, /with check \(autor_user_id = auth\.uid\(\) and not public\.is_internal_staff\(\)\)/);
    assert.match(sql, /and estado = 'borrador'/);
    assert.match(sql, /new\.estado := 'borrador'/);
    assert.match(sql, /create or replace function public\.publicar_publicacion_marketplace\(p_id uuid\)/);
    assert.match(sql, /revoke all on function public\.publicar_publicacion_marketplace\(uuid\) from public, anon, authenticated, service_role;/);
    assert.match(sql, /grant execute on function public\.publicar_publicacion_marketplace\(uuid\) to moderador_publicaciones;/);
    assert.ok(!/grant moderador_publicaciones to/i.test(sql), 'la migración no asigna el rol moderador');
    assert.match(sql, /create role moderador_publicaciones nologin/);
    assert.equal(LIMITE_PUBLICACIONES_POR_24H, 10);
    assert.match(sql, />= 10/);
    assert.match(sql, /interval '24 hours'/);
    assert.match(sql, /create policy publicaciones_staff_read[\s\S]*for select to authenticated[\s\S]*using \(public\.is_internal_staff\(\)\);/);
  });
  test('toda función SECURITY DEFINER fija search_path', () => {
    const defs = sql.match(/security definer[\s\S]{0,80}/g) ?? [];
    assert.ok(defs.length >= 1);
    for (const d of defs) assert.match(d, /set search_path = public/);
  });
});
