// tests/documentos-maria.test.ts — Fase 6: respaldo de documentos (interfaz y
// adaptador en memoria), ACL por documento aplicada ANTES de recuperar,
// enmascarado de datos personales en la ingesta, María de solo lectura con
// citas, y ausencia de secretos en el repositorio.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DRIVE_ALCANCE_MINIMO, RESPALDO_ENV, RespaldoEnMemoria, RespaldoGoogleDrive, RespaldoNoDisponibleError, obtenerRespaldo, sha256Bytes,
} from '@/lib/documentos/respaldo';
import { IndiceEnMemoria, puedeLeerDocumento, type Fragmento, type LectorDocumentos } from '@/lib/documentos/acl';
import { contienePII, enmascararPII } from '@/lib/documentos/pii';
import { fragmentar, prepararIngesta } from '@/lib/documentos/ingesta';
import {
  BLOQUE_SOLO_LECTURA, HERRAMIENTAS_MARIA, RESPUESTA_SOLO_LECTURA, ROTULO_ORIENTACION, SIN_FUENTE, asegurarCita, bloqueContextoExpediente,
  canalConsultaExpedientes, formatearCita, pideEscritura, puedeConsultarExpedientes, tieneCita,
} from '@/lib/maria/soloLectura';
import { MARIA_SYSTEM_PROMPT } from '@/lib/maria/systemPrompt';
import { leerMigracion, sinComentarios, verificarMigracion } from '@/tests/migraciones-estaticas';
import { guardasDeRuta, ROLES_EXTERNOS } from '@/tests/guardas-rutas';
import { ROOT } from '@/tests/pg-efimero';

const u = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TITULAR_A = u(1);
const TITULAR_B = u(2);
const ORG_X = u(11);
const ORG_Y = u(12);
const bytes = (s: string) => new TextEncoder().encode(s);

describe('respaldo de documentos — interfaz y adaptador en memoria', () => {
  const doc = (n: number, extra: Record<string, unknown> = {}) => ({
    documento_id: u(100 + n), expediente_id: u(200), mina_id: u(300), nivel_acceso: 'titular' as const, subido_por: u(9),
    nombre: `doc-${n}.pdf`, tipo_mime: 'application/pdf', contenido: bytes(`contenido ${n}`), ...extra,
  });

  test('subir guarda referencia, huella, nivel, autor, fecha y versión — no el contenido en la referencia', async () => {
    const r = new RespaldoEnMemoria(() => new Date('2026-11-28T15:00:00Z'));
    const ref = await r.subir(doc(1));
    assert.equal(ref.sha256, sha256Bytes(bytes('contenido 1')));
    assert.deepEqual(
      { v: ref.version, vig: ref.vigente, nivel: ref.nivel_acceso, por: ref.subido_por, fecha: ref.fecha, exp: ref.expediente_id, mina: ref.mina_id },
      { v: 1, vig: true, nivel: 'titular', por: u(9), fecha: '2026-11-28T15:00:00.000Z', exp: u(200), mina: u(300) });
    assert.ok(!JSON.stringify(ref).includes('contenido 1'));
    assert.deepEqual(await r.obtenerReferencia(u(101)), ref);
    assert.equal(await r.obtenerReferencia(u(999)), null);
  });

  test('versiones: la nueva deja sin vigencia a la anterior; listar devuelve solo vigentes', async () => {
    const r = new RespaldoEnMemoria();
    await r.subir(doc(1));
    const v2 = await r.subir(doc(1, { contenido: bytes('corregido') }));
    await r.subir(doc(2));
    assert.equal(v2.version, 2);
    assert.equal((await r.obtenerReferencia(u(101)))?.version, 2);
    assert.equal((await r.obtenerReferencia(u(101), 1))?.vigente, false);
    assert.deepEqual((await r.listarPorExpediente(u(200))).map((x) => `${x.documento_id.slice(-3)}v${x.version}`).sort(), ['101v2', '102v1']);
    assert.deepEqual(await r.listarPorExpediente(u(201)), []);
  });

  test('verificarIntegridad detecta un archivo alterado', async () => {
    const r = new RespaldoEnMemoria();
    const ref = await r.subir(doc(1));
    assert.deepEqual(await r.verificarIntegridad(ref), { integro: true, sha256_actual: ref.sha256 });
    r.corromper(ref.referencia_externa);
    const tras = await r.verificarIntegridad(ref);
    assert.equal(tras.integro, false);
    assert.notEqual(tras.sha256_actual, ref.sha256);
    assert.deepEqual(await r.verificarIntegridad({ referencia_externa: 'no-existe', sha256: ref.sha256 }), { integro: false, sha256_actual: null });
  });

  test('rechaza documentos vacíos y el nivel "organizacion" sin organización', async () => {
    const r = new RespaldoEnMemoria();
    await assert.rejects(r.subir(doc(1, { contenido: new Uint8Array() })));
    await assert.rejects(r.subir(doc(1, { nivel_acceso: 'organizacion' })));
    assert.equal((await r.subir(doc(1, { nivel_acceso: 'organizacion', organizacion_id: ORG_X }))).organizacion_id, ORG_X);
  });

  test('el adaptador de Drive está APAGADO por defecto y no se invoca', () => {
    const antes = RespaldoGoogleDrive.instancias;
    assert.deepEqual(obtenerRespaldo({}), { disponible: false, motivo: 'apagado' });
    // Aunque haya configuración, sin la bandera en 'true' exacto no se crea.
    for (const valor of [undefined, '', 'false', 'TRUE', '1', 'si']) {
      const e = { [RESPALDO_ENV.habilitado]: valor, [RESPALDO_ENV.carpeta]: 'carpeta-de-prueba', [RESPALDO_ENV.cuentaServicio]: 'e30=' };
      assert.deepEqual(obtenerRespaldo(e), { disponible: false, motivo: 'apagado' }, String(valor));
    }
    assert.equal(RespaldoGoogleDrive.instancias, antes);
    assert.deepEqual(obtenerRespaldo({ [RESPALDO_ENV.habilitado]: 'true' }), { disponible: false, motivo: 'sin_configuracion' });
    assert.equal(RespaldoGoogleDrive.instancias, antes);
    assert.deepEqual(obtenerRespaldo(process.env), { disponible: false, motivo: 'apagado' }); // el entorno real de pruebas
  });

  test('encendido a propósito: el esqueleto declara "en implementación" y no finge subir', async () => {
    const r = obtenerRespaldo({ [RESPALDO_ENV.habilitado]: 'true', [RESPALDO_ENV.carpeta]: 'carpeta-de-prueba', [RESPALDO_ENV.cuentaServicio]: 'e30=' });
    assert.ok(r.disponible);
    if (!r.disponible) return;
    assert.equal(r.adaptador.almacen, 'google_drive');
    await assert.rejects(r.adaptador.subir(doc(1)), RespaldoNoDisponibleError);
    await assert.rejects(r.adaptador.listarPorExpediente(u(200)), RespaldoNoDisponibleError);
    assert.equal(DRIVE_ALCANCE_MINIMO, 'https://www.googleapis.com/auth/drive.file');
  });
});

describe('ACL por documento — el filtro se aplica ANTES de recuperar', () => {
  const frag = (id: number, extra: Partial<Fragmento> = {}): Fragmento => ({
    id, documento_id: u(400 + id), expediente_id: u(500), titulo: `Documento ${id}`, version: 1, fecha_documento: '2026-11-01',
    contenido: 'La licencia ambiental fue otorgada y está vigente.', nivel_acceso: 'titular', organizacion_id: null, titular_cliente_id: TITULAR_A, vigente: true, ...extra,
  });
  const lector = (rol: LectorDocumentos['rol'], extra: Partial<LectorDocumentos> = {}): LectorDocumentos => ({ rol, userId: u(900), organizacionId: null, clienteId: null, ...extra });
  const indice = () => {
    const i = new IndiceEnMemoria();
    i.agregar(frag(1));                                                                  // titular A
    i.agregar(frag(2, { titular_cliente_id: TITULAR_B }));                               // titular B
    i.agregar(frag(3, { nivel_acceso: 'personal' }));                                    // solo personal (de A)
    i.agregar(frag(4, { nivel_acceso: 'organizacion', organizacion_id: ORG_X }));        // organización X
    return i;
  };

  test('un usuario sin acceso NUNCA recupera el fragmento, ni siquiera llega a evaluarse', () => {
    const i = indice();
    const a = i.buscar(lector('cliente', { clienteId: TITULAR_A }), 'licencia ambiental');
    assert.deepEqual(a.map((f) => f.fragmento_id), [1]);
    assert.equal(i.ultimosEvaluados, 1); // los otros tres no entraron a la búsqueda
    assert.deepEqual(i.buscar(lector('cliente', { clienteId: TITULAR_B }), 'licencia ambiental').map((f) => f.fragmento_id), [2]);
    // Sin titular vinculado, o un rol sin ningún alcance: nada.
    assert.deepEqual(i.buscar(lector('cliente'), 'licencia ambiental'), []);
    assert.equal(i.ultimosEvaluados, 0);
  });

  test('matriz por rol', () => {
    const i = indice();
    const ids = (l: LectorDocumentos) => i.buscar(l, 'licencia ambiental', 10).map((f) => f.fragmento_id).sort();
    for (const rol of ['admin', 'abogado', 'tecnico_ambiental', 'verificador'] as const) assert.deepEqual(ids(lector(rol)), [1, 2, 3, 4], rol);
    assert.deepEqual(ids(lector('planta', { organizacionId: ORG_X })), [4]);
    assert.deepEqual(ids(lector('planta', { organizacionId: ORG_Y })), []);
    assert.deepEqual(ids(lector('comercializador', { organizacionId: ORG_X })), [4]);
    assert.deepEqual(ids(lector('auditor', { organizacionId: null })), []);
  });

  test('un punto de recepción solo ve lo de su punto', () => {
    const i = indice();
    const ids = (l: LectorDocumentos) => i.buscar(l, 'licencia ambiental', 10).map((f) => f.fragmento_id).sort();
    assert.deepEqual(ids(lector('recepcion', { organizacionId: ORG_X, titularesDelPunto: new Set([TITULAR_A]) })), [1, 3, 4]);
    assert.deepEqual(ids(lector('recepcion', { organizacionId: ORG_X, titularesDelPunto: new Set([TITULAR_B]) })), [2]);
    assert.deepEqual(ids(lector('recepcion', { organizacionId: ORG_X, titularesDelPunto: new Set() })), []);
    assert.deepEqual(ids(lector('recepcion', { organizacionId: null, titularesDelPunto: new Set([TITULAR_A]) })), []);
  });

  test('revocar un documento lo excluye: sale del índice y deja de ser legible', () => {
    const i = indice();
    const l = lector('cliente', { clienteId: TITULAR_A });
    assert.equal(i.buscar(l, 'licencia').length, 1);
    assert.equal(i.retirarDocumento(u(401)), 1);
    assert.deepEqual(i.buscar(l, 'licencia'), []);
    assert.equal(i.total, 3);
    // Un documento no vigente no es legible por nadie, ni se puede indexar.
    assert.equal(puedeLeerDocumento(lector('admin'), { ...frag(9), vigente: false }), false);
    assert.throws(() => i.agregar(frag(9, { vigente: false })));
  });
});

describe('ingesta: solo documentos aprobados y sin datos personales innecesarios', () => {
  test('enmascara identidad, RTN, cuenta, teléfono y correo', () => {
    const original = [
      'El titular, con identidad 0801-1990-12345, RTN 08011990123456,',
      'teléfono +504 9988-7766 y correo persona@ejemplo.test,',
      'recibe en la cuenta 2001-0045-778899 del banco. Otra identidad: 0801199012345.',
      'La licencia ambiental n.º 2026-15 sigue vigente hasta 2027.',
    ].join(' ');
    const { texto, omitidos } = enmascararPII(original);
    for (const dato of ['0801-1990-12345', '08011990123456', '9988-7766', 'persona@ejemplo.test', '2001-0045-778899', '0801199012345']) {
      assert.ok(!texto.includes(dato), `quedó sin enmascarar: ${dato}`);
    }
    assert.deepEqual(omitidos, { identidad: 2, rtn: 1, cuenta: 1, telefono: 1, correo: 1 });
    assert.equal(contienePII(texto), false);
    // Lo que no es dato personal se conserva.
    assert.ok(texto.includes('La licencia ambiental n.º 2026-15 sigue vigente hasta 2027.'));
  });

  test('no toca fechas, pesos, códigos ni años', () => {
    const limpio = 'Recepción REC-2026-0001 del 2026-11-28: 1250.500 g, ley 0.9165, caja CAJA-2026-0003, expediente EXP-2026-0042.';
    assert.deepEqual(enmascararPII(limpio), { texto: limpio, omitidos: { identidad: 0, rtn: 0, cuenta: 0, telefono: 0, correo: 0 } });
    assert.equal(contienePII(limpio), false);
  });

  test('prepararIngesta: solo documento verificado con respaldo vigente; el texto sale enmascarado', () => {
    const base = {
      documento: { id: u(1), estado: 'verificado', nombre: 'Escritura' },
      respaldo: { id: u(2), version: 3, vigente: true, nivel_acceso: 'titular' as const },
      fecha_documento: '2026-10-01',
      texto: 'Párrafo uno con identidad 0801-1990-12345.\n\nPárrafo dos sobre el permiso municipal vigente.',
    };
    const r = prepararIngesta(base);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.fragmentos.length, 1);
      assert.ok(!r.fragmentos[0].contenido.includes('0801-1990-12345'));
      assert.match(r.fragmentos[0].contenido, /\[IDENTIDAD OMITIDA\]/);
      assert.deepEqual({ t: r.fragmentos[0].titulo, o: r.fragmentos[0].orden, f: r.fragmentos[0].fecha_documento, r: r.fragmentos[0].documento_respaldo_id }, { t: 'Escritura', o: 1, f: '2026-10-01', r: u(2) });
      assert.equal(r.omitidos.identidad, 1);
    }
    for (const estado of ['pendiente', 'rechazado', null]) {
      assert.deepEqual(prepararIngesta({ ...base, documento: { ...base.documento, estado } }), { ok: false, motivo: 'documento_no_aprobado' });
    }
    assert.deepEqual(prepararIngesta({ ...base, respaldo: { ...base.respaldo, vigente: false } }), { ok: false, motivo: 'respaldo_no_vigente' });
    assert.deepEqual(prepararIngesta({ ...base, texto: '   ' }), { ok: false, motivo: 'texto_vacio' });
  });

  test('fragmentar respeta el tamaño y no pierde texto', () => {
    const texto = Array.from({ length: 40 }, (_, i) => `Párrafo ${i} ${'palabra '.repeat(30)}`).join('\n\n');
    const partes = fragmentar(texto, 500);
    assert.ok(partes.length > 5);
    assert.ok(partes.every((p) => p.length <= 500));
    assert.equal(partes.join(' ').replace(/\s+/g, ' ').trim(), texto.replace(/\s+/g, ' ').trim());
  });
});

describe('María: solo lectura, citas y humano en el ciclo', () => {
  test('María no tiene herramientas, y ninguna ruta de María pasa `tools` al modelo', () => {
    assert.equal(HERRAMIENTAS_MARIA.length, 0);
    for (const f of ['app/api/maria/chat/route.ts', 'app/api/whatsapp/route.js']) {
      assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /\btools\s*:/, f);
    }
    const src = readFileSync(join(ROOT, 'app/api/maria/expediente/route.ts'), 'utf8');
    assert.match(src, /HERRAMIENTAS_MARIA\.length > 0/); // única mención de tools: condicionada a una lista vacía
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/); // la ruta no escribe tablas de negocio
  });

  test('María rechaza escribir: un pedido de escritura no llega al modelo', () => {
    for (const pedido of [
      'Registrá la recepción del lote de hoy', 'Aprobá el perfil de este minero', 'aprueba el perfil pendiente', 'Cerrá el lote LOTE-2026-0003',
      'Editá el documento de la escritura', 'borra esa recepción', 'Anulá la recepción REC-2026-0004', 'Subí este documento al expediente',
      'creame un perfil nuevo', 'cambiá el peso del sobre', 'dame de alta en la organización', 'Rechazá ese perfil', 'actualizá la licencia de la mina',
    ]) assert.equal(pideEscritura(pedido), true, pedido);
    for (const consulta of [
      '¿Cómo se registra una recepción?', '¿Quién aprueba el perfil?', '¿Qué documentos tiene el expediente?', '¿Está aprobado el perfil?',
      '¿Cuándo se envió la caja al laboratorio?', 'Mostrame el estado de la licencia ambiental', '¿Ya se cerró el lote?', '¿Cuál es el peso del sobre ETQ-1?',
    ]) assert.equal(pideEscritura(consulta), false, consulta);
    assert.match(RESPUESTA_SOLO_LECTURA, /solo consulto/);
    assert.match(RESPUESTA_SOLO_LECTURA, /lo hace el personal/);
  });

  test('formato de cita presente: documento con versión y fecha, o número de recepción', () => {
    assert.equal(formatearCita({ tipo: 'documento', titulo: 'Licencia ambiental', version: 2, fecha: '2026-10-01' }), '[Fuente: documento «Licencia ambiental», versión 2, 2026-10-01]');
    assert.equal(formatearCita({ tipo: 'documento', titulo: 'Escritura', version: 1, fecha: null }), '[Fuente: documento «Escritura», versión 1]');
    assert.equal(formatearCita({ tipo: 'recepcion', codigo: 'REC-2026-0007' }), '[Fuente: recepción REC-2026-0007]');
    assert.equal(formatearCita({ tipo: 'perfil', version: 3, estado: 'aprobado' }), '[Fuente: perfil, versión 3, estado aprobado]');
    for (const c of [
      formatearCita({ tipo: 'documento', titulo: 'X', version: 1, fecha: '2026-01-01' }), formatearCita({ tipo: 'documento', titulo: 'X', version: 1, fecha: null }),
      formatearCita({ tipo: 'recepcion', codigo: 'REC-2026-0007' }), formatearCita({ tipo: 'perfil', version: 3, estado: 'aprobado' }),
    ]) assert.ok(tieneCita(`La licencia está vigente. ${c}`), c);
    assert.equal(tieneCita('La licencia está vigente.'), false);
    assert.equal(tieneCita('Según el documento, sí. [Fuente: me lo dijeron]'), false);
  });

  test('sin fuente → "No tengo ese dato en el expediente"; con fuente pero sin cita → se anexa', () => {
    const f = [{ titulo: 'Licencia ambiental', version: 2, fecha_documento: '2026-10-01', contenido: 'Vigente hasta 2027.' }];
    assert.equal(SIN_FUENTE, 'No tengo ese dato en el expediente.');
    assert.equal(asegurarCita('La licencia está vigente.', []), SIN_FUENTE);
    assert.equal(asegurarCita('   ', f), SIN_FUENTE);
    const anexada = asegurarCita('La licencia está vigente hasta 2027.', f);
    assert.ok(tieneCita(anexada));
    assert.match(anexada, /\[Fuente: documento «Licencia ambiental», versión 2, 2026-10-01\]$/);
    const ya = 'Vigente hasta 2027. [Fuente: documento «Licencia ambiental», versión 2, 2026-10-01]';
    assert.equal(asegurarCita(ya, f), ya);
    assert.equal(asegurarCita(SIN_FUENTE, f), SIN_FUENTE);
  });

  test('el bloque de contexto antepone a cada fragmento su cita y ordena no inventar', () => {
    const bloque = bloqueContextoExpediente([
      { titulo: 'Escritura', version: 1, fecha_documento: null, contenido: 'Texto A' },
      { titulo: 'Licencia', version: 2, fecha_documento: '2026-10-01', contenido: 'Texto B' },
    ]);
    assert.match(bloque, /\[Fuente: documento «Escritura», versión 1\]\nTexto A/);
    assert.match(bloque, /\[Fuente: documento «Licencia», versión 2, 2026-10-01\]\nTexto B/);
    assert.ok(bloque.includes(SIN_FUENTE));
    assert.equal(bloqueContextoExpediente([]), '');
  });

  test('canal: por WhatsApp y en el chat público NO se consultan expedientes', () => {
    assert.equal(canalConsultaExpedientes('whatsapp'), false);
    assert.equal(canalConsultaExpedientes('web_publica'), false);
    assert.equal(canalConsultaExpedientes('panel_autenticado'), true);
    for (const f of ['app/api/whatsapp/route.js', 'app/api/maria/chat/route.ts']) {
      assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /buscar_fragmentos_acl|documentos_fragmentos|documentos_respaldo/, f);
    }
    assert.ok(puedeConsultarExpedientes('recepcion') && puedeConsultarExpedientes('cliente'));
    for (const r of ['comercializador', 'planta', 'auditor'] as const) assert.equal(puedeConsultarExpedientes(r), false);
    const g = guardasDeRuta('app/api/maria/expediente/route.ts');
    assert.deepEqual(g.map((x) => x.metodo), ['POST']);
    assert.deepEqual(g[0].roles, ['abogado', 'admin', 'cliente', 'recepcion', 'tecnico_ambiental', 'verificador']);
  });

  test('el prompt compartido incluye las reglas y respeta el modelo vigente', () => {
    assert.ok(MARIA_SYSTEM_PROMPT.includes(BLOQUE_SOLO_LECTURA));
    assert.match(BLOQUE_SOLO_LECTURA, /SOLO CONSULTA/);
    assert.ok(BLOQUE_SOLO_LECTURA.includes(SIN_FUENTE) && BLOQUE_SOLO_LECTURA.includes(ROTULO_ORIENTACION));
    assert.match(BLOQUE_SOLO_LECTURA, /Recepción:/);
    assert.match(BLOQUE_SOLO_LECTURA, /Perfil:/);
    assert.match(ROTULO_ORIENTACION, /La decisión y el registro los hace el personal/);
    assert.doesNotMatch(BLOQUE_SOLO_LECTURA, /mercurio|margen|\b\d{2}\s?%|certificad[oa] por|zekaii|chiopa|liopa/i);
  });
});

describe('rutas de respaldo', () => {
  test('subir y revocar: solo personal; leer exige sesión y pasa por la ACL', () => {
    const subir = guardasDeRuta('app/api/respaldo/route.ts').find((g) => g.metodo === 'POST');
    assert.deepEqual(subir?.roles, ['abogado', 'admin', 'recepcion', 'tecnico_ambiental']);
    assert.deepEqual(guardasDeRuta('app/api/respaldo/[id]/revocar/route.ts')[0].roles, ['abogado', 'admin']);
    for (const r of ROLES_EXTERNOS) assert.ok(!subir!.roles.includes(r));
    const leer = readFileSync(join(ROOT, 'app/api/respaldo/[id]/route.ts'), 'utf8');
    assert.match(leer, /puedeLeerDocumento\(lector, doc\)/);
    assert.match(leer, /registrarAcceso\(/);
    assert.ok(leer.indexOf('puedeLeerDocumento(lector, doc)') < leer.indexOf('enlaceTemporal('), 'el acceso se comprueba antes de pedir el enlace');
  });
});

describe('migración 049 (estática)', () => {
  test('cabecera, RLS y search_path', () => {
    verificarMigracion('049_documentos_respaldo_rag_acl.sql', { appendOnly: [] });
  });

  test('el índice no tiene lectura directa; la búsqueda filtra por acceso dentro del WHERE; maria_knowledge no se toca', () => {
    const sql = sinComentarios(leerMigracion('049_documentos_respaldo_rag_acl.sql'));
    assert.doesNotMatch(sql, /grant [a-z, ]+ on table public\.documentos_fragmentos to (anon|authenticated)/);
    assert.doesNotMatch(sql, /create policy [a-z_]+ on public\.documentos_fragmentos\s+for [a-z]+ to authenticated/);
    const fn = sql.slice(sql.indexOf('create or replace function public.buscar_fragmentos_acl'), sql.indexOf('alter function public.buscar_fragmentos_acl'));
    assert.ok(fn.indexOf('where public.puede_leer_fragmento(') > 0);
    assert.ok(fn.indexOf('where public.puede_leer_fragmento(') < fn.indexOf('order by relevancia'));
    assert.match(sql, /grant execute on function public\.buscar_fragmentos_acl\(text, uuid, integer\) to service_role/);
    assert.doesNotMatch(sql, /maria_knowledge|match_maria_knowledge|search_maria_knowledge_fts/);
    const grant = /grant select \(([^)]*)\)\s+on table public\.documentos_respaldo to authenticated/.exec(sql);
    assert.ok(grant && !grant[1].includes('referencia_externa') && !grant[1].includes('sha256'));
  });
});

describe('sin secretos ni credenciales en el repositorio', () => {
  // Se buscan FORMAS de clave; nunca se imprime el valor, solo el archivo.
  const PATRONES = [
    '-----BEGIN [A-Z ]*PRIVATE KEY-----', '"private_key"\\s*:\\s*"', '"type"\\s*:\\s*"service_account"', 'AIza[0-9A-Za-z_-]{35}',
    'sk-ant-[A-Za-z0-9_-]{20,}', 'sbp_[a-f0-9]{30,}', 'SG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}', 'eyJhbGciOi[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}',
    'ya29\\.[0-9A-Za-z_-]{20,}', 'GOCSPX-[0-9A-Za-z_-]{20,}',
  ];
  const archivosCon = (patron: string): string[] => {
    try {
      return execFileSync('git', ['grep', '-l', '-I', '-E', '-e', patron, '--', '.', ':!package-lock.json', ':!tests/documentos-maria.test.ts'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch (e) {
      if ((e as { status?: number }).status === 1) return []; // sin coincidencias
      throw e;
    }
  };

  test('ningún archivo versionado contiene una clave con forma reconocible', () => {
    for (const p of PATRONES) assert.deepEqual(archivosCon(p), [], `patrón de clave presente: ${p.slice(0, 12)}…`);
  });

  test('no hay archivos .env versionados; de Drive solo se conocen NOMBRES de variables', () => {
    const versionados = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
    assert.deepEqual(versionados.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f)), []);
    assert.deepEqual(RESPALDO_ENV, { habilitado: 'RESPALDO_DRIVE_HABILITADO', carpeta: 'GOOGLE_DRIVE_RESPALDO_FOLDER_ID', cuentaServicio: 'GOOGLE_SERVICE_ACCOUNT_JSON_B64' });
    const src = readFileSync(join(ROOT, 'lib/documentos/respaldo.ts'), 'utf8');
    // Ningún valor con forma de identificador o clave (mezcla de minúsculas y dígitos); los NOMBRES en mayúsculas sí.
    assert.doesNotMatch(src, /process\.env\.GOOGLE_[A-Z_]+\s*=|[:=]\s*['"](?=[^'"]*[a-z])(?=[^'"]*\d)[0-9A-Za-z_-]{25,}['"]/);
  });
});
