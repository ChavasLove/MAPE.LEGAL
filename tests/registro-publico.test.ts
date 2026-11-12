// tests/registro-publico.test.ts — flag NEXT_PUBLIC_REGISTRO_PUBLICO.
// Corre con: npm test  (node --experimental-strip-types --test, ver package.json)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registroPublicoHabilitado } from '@/lib/registroPublico';

describe('registroPublicoHabilitado', () => {
  test('solo "true" exacto enciende el flag', () => {
    assert.equal(registroPublicoHabilitado({ NEXT_PUBLIC_REGISTRO_PUBLICO: 'true' }), true);
    assert.equal(registroPublicoHabilitado({}), false);
    assert.equal(registroPublicoHabilitado({ NEXT_PUBLIC_REGISTRO_PUBLICO: undefined }), false);
    assert.equal(registroPublicoHabilitado({ NEXT_PUBLIC_REGISTRO_PUBLICO: 'false' }), false);
    assert.equal(registroPublicoHabilitado({ NEXT_PUBLIC_REGISTRO_PUBLICO: 'TRUE' }), false);
    assert.equal(registroPublicoHabilitado({ NEXT_PUBLIC_REGISTRO_PUBLICO: '1' }), false);
  });
});

describe('GET /api/concesiones/buscar', () => {
  // La ruta lee process.env en cada request, así que se puede alternar el flag
  // sobre el mismo módulo importado. Nunca llega al RPC de Supabase: con el flag
  // apagado responde 404 antes de leer la query; con el flag encendido y sin
  // `q` responde 400 antes de consultar.
  const url = 'http://localhost/api/concesiones/buscar';

  test('flag apagado (unset) → 404, aunque la consulta sea válida', async () => {
    delete process.env.NEXT_PUBLIC_REGISTRO_PUBLICO;
    const { GET } = await import('@/app/api/concesiones/buscar/route');
    const res = await GET(new Request(`${url}?q=mochito`));
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  });

  test('flag en "false" → 404', async () => {
    process.env.NEXT_PUBLIC_REGISTRO_PUBLICO = 'false';
    const { GET } = await import('@/app/api/concesiones/buscar/route');
    const res = await GET(new Request(`${url}?q=mochito`));
    assert.equal(res.status, 404);
  });

  test('flag en "true" → la ruta vuelve a atender (400 sin q, no 404)', async () => {
    process.env.NEXT_PUBLIC_REGISTRO_PUBLICO = 'true';
    const { GET } = await import('@/app/api/concesiones/buscar/route');
    const res = await GET(new Request(url));
    assert.equal(res.status, 400);
    delete process.env.NEXT_PUBLIC_REGISTRO_PUBLICO;
  });
});
