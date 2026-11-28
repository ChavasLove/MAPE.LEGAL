// tests/otp.test.ts — acceso por OTP (Fase 2 de la reestructura 2026-11-28).
// Sin base de datos: almacén en memoria y dobles del emisor / canje.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_CONFIG, OTP_MENSAJES, controlAlEmitir, controlTrasIntento, esCodigoBienFormado,
  evaluarSolicitud, evaluarVerificacion, generarCodigo, hashCorreo, igualesTiempoConstante, normalizarCorreo,
} from '@/lib/auth/otp';
import {
  AlmacenOtpEnMemoria, solicitarOtp, verificarOtp,
  type AuditoriaOtp, type DependenciasOtp,
} from '@/lib/auth/otpServicio';

const PEPPER = 'pepper-de-prueba-solo-para-tests-0001';
const CON_CUENTA = 'minero@ejemplo.test';
const SIN_CUENTA = 'nadie@ejemplo.test';

function armar(opts: { limitar?: DependenciasOtp['limitar'] } = {}) {
  let reloj = Date.parse('2026-11-28T15:00:00.000Z');
  const enviados: Array<{ correo: string; codigo: string }> = [];
  const auditoria: AuditoriaOtp[] = [];
  const vigentes = new Map<string, string>(); // correo → código vigente del "proveedor"
  const almacen = new AlmacenOtpEnMemoria();
  const deps: DependenciasOtp = {
    almacen,
    pepper: PEPPER,
    ahora: () => new Date(reloj),
    limitar: opts.limitar ?? (() => ({ ok: true, retryAfterSec: 0 })),
    emitir: async (correo) => {
      if (correo !== CON_CUENTA) return null;
      const codigo = generarCodigo();
      vigentes.set(correo, codigo); // emitir reemplaza (invalida) el anterior
      return { codigo };
    },
    enviar: async (correo, codigo) => { enviados.push({ correo, codigo }); },
    canjear: async (correo, codigo) => {
      const v = vigentes.get(correo);
      if (!v || !igualesTiempoConstante(v, codigo)) return null;
      vigentes.delete(correo); // un solo uso también del lado del proveedor
      return { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, userId: 'u-1' };
    },
    auditar: (e) => { auditoria.push(e); },
  };
  return {
    deps, enviados, auditoria, almacen,
    avanzar: (ms: number) => { reloj += ms; },
    ultimo: () => enviados[enviados.length - 1]?.codigo ?? '',
  };
}

const otroCodigo = (c: string) => (c === '000000' ? '000001' : '000000');

describe('OTP — utilidades puras', () => {
  test('normaliza correos y rechaza formatos inválidos', () => {
    assert.equal(normalizarCorreo('  Minero@Ejemplo.TEST '), 'minero@ejemplo.test');
    assert.equal(normalizarCorreo('sin-arroba'), null);
    assert.equal(normalizarCorreo(42), null);
  });

  test('código: longitud configurada, solo dígitos', () => {
    for (let i = 0; i < 50; i++) assert.ok(esCodigoBienFormado(generarCodigo()));
    assert.equal(generarCodigo().length, OTP_CONFIG.longitud);
    assert.equal(esCodigoBienFormado('12345'), false);
    assert.equal(esCodigoBienFormado('12345a'), false);
    assert.equal(esCodigoBienFormado(123456), false);
  });

  test('hash del correo: determinista, depende del pepper y lo exige', () => {
    const h = hashCorreo(CON_CUENTA, PEPPER);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, hashCorreo(CON_CUENTA, PEPPER));
    assert.notEqual(h, hashCorreo(CON_CUENTA, PEPPER + 'x'));
    assert.ok(!h.includes('minero'));
    assert.throws(() => hashCorreo(CON_CUENTA, ''));
    assert.throws(() => hashCorreo(CON_CUENTA, 'corto'));
  });

  test('comparación en tiempo constante', () => {
    assert.equal(igualesTiempoConstante('123456', '123456'), true);
    assert.equal(igualesTiempoConstante('123456', '123457'), false);
    assert.equal(igualesTiempoConstante('123456', '12345'), false);
  });

  test('máquina de decisiones: espera, expiración, uso, intentos y bloqueo', () => {
    const t0 = new Date('2026-11-28T15:00:00.000Z');
    const c = controlAlEmitir('h', t0);
    assert.deepEqual(evaluarSolicitud(null, t0), { emitir: true });
    assert.deepEqual(evaluarSolicitud(c, new Date(t0.getTime() + 10_000)), { emitir: false, motivo: 'espera_reenvio', esperaSeg: 50 });
    assert.deepEqual(evaluarSolicitud(c, new Date(t0.getTime() + OTP_CONFIG.esperaReenvioMs)), { emitir: true });

    assert.deepEqual(evaluarVerificacion(null, t0), { proceder: false, motivo: 'sin_codigo' });
    assert.deepEqual(evaluarVerificacion(c, t0), { proceder: true });
    assert.deepEqual(evaluarVerificacion(c, new Date(t0.getTime() + OTP_CONFIG.expiraMs)), { proceder: false, motivo: 'expirado' });
    assert.deepEqual(evaluarVerificacion({ ...c, usado_en: t0.toISOString() }, t0), { proceder: false, motivo: 'usado' });

    let k = c;
    for (let i = 0; i < OTP_CONFIG.maxIntentos; i++) k = controlTrasIntento(k, t0);
    assert.equal(k.intentos, OTP_CONFIG.maxIntentos);
    assert.ok(k.bloqueado_hasta);
    assert.deepEqual(evaluarVerificacion(k, t0), { proceder: false, motivo: 'bloqueado' });
    assert.equal(evaluarSolicitud(k, new Date(t0.getTime() + 5 * 60_000)).emitir, false);
    assert.deepEqual(evaluarSolicitud(k, new Date(t0.getTime() + OTP_CONFIG.bloqueoMs)), { emitir: true });
  });
});

describe('OTP — flujo de servidor', () => {
  test('código válido → sesión; el correo lleva el código, no un enlace', async () => {
    const s = armar();
    const sol = await solicitarOtp(s.deps, ' Minero@Ejemplo.test ', '1.1.1.1');
    assert.equal(sol.ok, true);
    assert.equal(s.enviados.length, 1);
    assert.equal(s.enviados[0].correo, CON_CUENTA);
    const ver = await verificarOtp(s.deps, CON_CUENTA, s.ultimo(), '1.1.1.1');
    assert.equal(ver.ok, true);
    if (ver.ok) assert.equal(ver.sesion.userId, 'u-1');
  });

  test('un solo uso: el mismo código no vuelve a servir', async () => {
    const s = armar();
    await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    const codigo = s.ultimo();
    assert.equal((await verificarOtp(s.deps, CON_CUENTA, codigo, 'ip')).ok, true);
    const otra = await verificarOtp(s.deps, CON_CUENTA, codigo, 'ip');
    assert.deepEqual(otra, { ok: false, status: 401, mensaje: OTP_MENSAJES.invalido });
  });

  test('expirado: pasado el plazo propio no se canjea aunque el proveedor lo aceptara', async () => {
    const s = armar();
    await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    s.avanzar(OTP_CONFIG.expiraMs + 1);
    const r = await verificarOtp(s.deps, CON_CUENTA, s.ultimo(), 'ip');
    assert.deepEqual(r, { ok: false, status: 401, mensaje: OTP_MENSAJES.invalido });
  });

  test('intentos agotados: bloqueo, y el código correcto ya no entra', async () => {
    const s = armar();
    await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    const bueno = s.ultimo();
    for (let i = 1; i <= OTP_CONFIG.maxIntentos; i++) {
      const r = await verificarOtp(s.deps, CON_CUENTA, otroCodigo(bueno), 'ip');
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.mensaje, i < OTP_CONFIG.maxIntentos ? OTP_MENSAJES.invalido : OTP_MENSAJES.bloqueado);
    }
    const r = await verificarOtp(s.deps, CON_CUENTA, bueno, 'ip');
    assert.deepEqual(r, { ok: false, status: 401, mensaje: OTP_MENSAJES.bloqueado });
    // Durante el bloqueo tampoco se emite un código nuevo (respuesta idéntica).
    const sol = await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    assert.equal(sol.ok, true);
    assert.equal(s.enviados.length, 1);
  });

  test('reenvío antes de tiempo: misma respuesta, sin correo nuevo; después emite e invalida el anterior', async () => {
    const s = armar();
    const a = await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    const primero = s.ultimo();
    s.avanzar(OTP_CONFIG.esperaReenvioMs - 1000);
    const b = await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    assert.deepEqual(b, a);
    assert.equal(s.enviados.length, 1);

    s.avanzar(1000);
    await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    assert.equal(s.enviados.length, 2);
    const segundo = s.ultimo();
    if (primero !== segundo) {
      assert.equal((await verificarOtp(s.deps, CON_CUENTA, primero, 'ip')).ok, false);
    }
    assert.equal((await verificarOtp(s.deps, CON_CUENTA, segundo, 'ip')).ok, true);
  });

  test('sin enumeración: respuesta idéntica con y sin cuenta, en solicitud y en verificación', async () => {
    const s = armar();
    const conCuenta = await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    const sinCuenta = await solicitarOtp(s.deps, SIN_CUENTA, 'ip');
    assert.deepEqual(sinCuenta, conCuenta);
    assert.equal(s.enviados.length, 1); // al correo sin cuenta no se le envía nada

    const malo = await verificarOtp(s.deps, CON_CUENTA, otroCodigo(s.ultimo()), 'ip');
    const inexistente = await verificarOtp(s.deps, SIN_CUENTA, '123456', 'ip');
    assert.deepEqual(inexistente, malo);
    // El reenvío en espera también es indistinguible.
    assert.deepEqual(await solicitarOtp(s.deps, SIN_CUENTA, 'ip'), await solicitarOtp(s.deps, CON_CUENTA, 'ip'));
  });

  test('límite de frecuencia por IP → 429 en solicitud y en verificación', async () => {
    const s = armar({
      limitar: (clave) => (clave.includes(':ip:') ? { ok: false, retryAfterSec: 120 } : { ok: true, retryAfterSec: 0 }),
    });
    const sol = await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    assert.deepEqual(sol, { ok: false, status: 429, mensaje: OTP_MENSAJES.frecuencia, retryAfterSec: 120 });
    const ver = await verificarOtp(s.deps, CON_CUENTA, '123456', 'ip');
    assert.equal(ver.ok, false);
    if (!ver.ok) assert.equal(ver.status, 429);
    assert.equal(s.enviados.length, 0);
  });

  test('límite por correo en la solicitud: no emite y no cambia la respuesta', async () => {
    const libre = armar();
    const base = await solicitarOtp(libre.deps, CON_CUENTA, 'ip');
    const s = armar({
      limitar: (clave) => (clave.includes(':correo:') ? { ok: false, retryAfterSec: 60 } : { ok: true, retryAfterSec: 0 }),
    });
    assert.deepEqual(await solicitarOtp(s.deps, CON_CUENTA, 'ip'), base);
    assert.equal(s.enviados.length, 0);
  });

  test('formato inválido → 400 sin tocar el almacén', async () => {
    const s = armar();
    assert.deepEqual(await solicitarOtp(s.deps, 'no-es-correo', 'ip'), { ok: false, status: 400, mensaje: OTP_MENSAJES.formato });
    assert.deepEqual(await verificarOtp(s.deps, CON_CUENTA, 'abc', 'ip'), { ok: false, status: 400, mensaje: OTP_MENSAJES.formato });
    assert.equal(s.auditoria.length, 0);
  });

  test('auditoría: registra cada intento y jamás contiene el código ni el correo', async () => {
    const s = armar();
    await solicitarOtp(s.deps, CON_CUENTA, 'ip');
    const codigo = s.ultimo();
    await verificarOtp(s.deps, CON_CUENTA, otroCodigo(codigo), 'ip');
    await verificarOtp(s.deps, CON_CUENTA, codigo, 'ip');
    assert.deepEqual(s.auditoria.map((e) => e.evento), ['solicitud_emitida', 'verificacion_fallida', 'verificacion_ok']);
    const volcado = JSON.stringify(s.auditoria);
    assert.ok(!volcado.includes(codigo));
    assert.ok(!volcado.includes(CON_CUENTA));
    // El almacén tampoco guarda el código.
    const control = await s.almacen.obtener(hashCorreo(CON_CUENTA, PEPPER));
    assert.ok(control && !JSON.stringify(control).includes(codigo));
  });
});
