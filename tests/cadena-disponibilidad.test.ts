// tests/cadena-disponibilidad.test.ts — guardia "Módulo en preparación" de las
// páginas del estándar privado cuando la migración 043 no está aplicada.
//
// (1) La sonda clasifica bien los errores de PostgREST (sin BD: cliente falso).
// (2) Cada página server de /dashboard/cadena/* y /portal/lotes consulta la
//     sonda y renderiza <ModuloEnPreparacion /> (verificación sobre el fuente,
//     para que una página nueva o un refactor no pierdan la guardia).
// (3) /estandar y /politica-de-cadena NO tocan la base de datos (solo
//     lib/content/*), así que no pueden fallar por la 043 — el test fija esa
//     invariante.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clasificarErrorSonda,
  sondearTablasCadena,
  TABLA_SONDA_043,
  type ClienteSonda,
  type ErrorSonda,
} from '@/lib/cadena/disponibilidad';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function clienteFalso(error: ErrorSonda | null, registrar?: (tabla: string, cols: string) => void): ClienteSonda {
  return {
    from(tabla) {
      return {
        select(cols) {
          registrar?.(tabla, cols);
          return Promise.resolve({ error });
        },
      };
    },
  };
}

describe('clasificarErrorSonda', () => {
  test('sin error → módulo disponible', () => {
    assert.deepEqual(clasificarErrorSonda(null), { disponible: true });
    assert.deepEqual(clasificarErrorSonda(undefined), { disponible: true });
  });

  test('tabla inexistente (42P01) y fuera del schema cache (PGRST205) → migracion_pendiente', () => {
    for (const code of ['42P01', 'PGRST205', '42703', '42883', 'PGRST202']) {
      const r = clasificarErrorSonda({ code, message: `relation "public.lotes" does not exist (${code})` });
      assert.equal(r.disponible, false);
      assert.equal(!r.disponible && r.motivo, 'migracion_pendiente', code);
      assert.ok(!r.disponible && r.detalle.includes(code));
    }
  });

  test('otros errores (permisos, red, desconocidos) → error, nunca migracion_pendiente', () => {
    for (const error of [
      { code: '42501', message: 'permission denied' },
      { code: 'PGRST301', message: 'JWT expired' },
      { message: 'fetch failed' },
      { code: '', message: '' },
    ]) {
      const r = clasificarErrorSonda(error);
      assert.equal(r.disponible, false);
      assert.equal(!r.disponible && r.motivo, 'error', JSON.stringify(error));
    }
  });
});

describe('sondearTablasCadena', () => {
  test('consulta HEAD sobre la tabla de la 043 y devuelve disponible cuando existe', async () => {
    const llamadas: string[] = [];
    const r = await sondearTablasCadena(clienteFalso(null, (t, c) => llamadas.push(`${t}:${c}`)));
    assert.deepEqual(r, { disponible: true });
    assert.deepEqual(llamadas, [`${TABLA_SONDA_043}:id`]);
    assert.equal(TABLA_SONDA_043, 'lotes');
  });

  test('tabla ausente → migracion_pendiente con el detalle del error', async () => {
    const r = await sondearTablasCadena(
      clienteFalso({ code: 'PGRST205', message: "Could not find the table 'public.lotes' in the schema cache" }),
    );
    assert.equal(r.disponible, false);
    assert.equal(!r.disponible && r.motivo, 'migracion_pendiente');
    assert.ok(!r.disponible && r.detalle.includes('schema cache'));
  });

  test('una excepción del cliente no se propaga: se reporta como error', async () => {
    const roto: ClienteSonda = {
      from() {
        throw new Error('[Supabase] Missing environment variables at runtime');
      },
    };
    const r = await sondearTablasCadena(roto);
    assert.equal(r.disponible, false);
    assert.equal(!r.disponible && r.motivo, 'error');
    assert.ok(!r.disponible && r.detalle.includes('Missing environment variables'));
  });
});

describe('páginas server del estándar privado', () => {
  const PAGINAS_PROTEGIDAS = [
    'app/dashboard/cadena/page.tsx',
    'app/dashboard/cadena/[id]/page.tsx',
    'app/dashboard/cadena/bitacora/page.tsx',
    'app/dashboard/cadena/consentimientos/page.tsx',
    'app/dashboard/cadena/exportar/page.tsx',
    'app/dashboard/cadena/fuentes/page.tsx',
    'app/portal/lotes/page.tsx',
  ];

  for (const rel of PAGINAS_PROTEGIDAS) {
    test(`${rel} sondea la 043 y muestra "Módulo en preparación" si falta`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      assert.match(src, /moduloCadenaDisponible\(\)/, 'debe llamar a moduloCadenaDisponible()');
      assert.match(src, /modulo\.motivo === 'migracion_pendiente'/, 'debe distinguir migracion_pendiente de otros errores');
      assert.match(src, /<ModuloEnPreparacion\s*\/>/, 'debe renderizar <ModuloEnPreparacion />');
      // La guardia va después del redirect a /login: un anónimo no debe ver ni el aviso.
      assert.ok(src.indexOf("redirect('/login')") < src.indexOf('<ModuloEnPreparacion'), 'auth antes que el aviso');
    });
  }

  test('el aviso se titula "Módulo en preparación"', () => {
    // El .tsx no se importa (node --test no lo transpila): se verifica el fuente.
    const src = readFileSync(join(ROOT, 'components/cadena/ModuloEnPreparacion.tsx'), 'utf8');
    assert.match(src, /MODULO_EN_PREPARACION_TITULO = 'Módulo en preparación'/);
    assert.doesNotMatch(src, /'use client'/, 'debe poder renderizarse desde un server component');
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,6}\b/, 'cero hex literales (Color Manual v1.0)');
  });

  for (const rel of ['app/estandar/page.tsx', 'app/politica-de-cadena/page.tsx']) {
    test(`${rel} es estática: no consulta Supabase ni tablas de la 043`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      assert.doesNotMatch(src, /supabase|getAdminClient|\.from\(|\/api\/cadena/i);
      assert.match(src, /@\/lib\/content\/estandar/);
    });
  }
});
