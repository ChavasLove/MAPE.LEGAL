#!/usr/bin/env node
// ---------------------------------------------------------------------------
// actualizar-factor-compra.mjs
//
// Actualiza el factor de compra de Inversiones Zekaii, S. de R.L. al productor
// (fracción de la referencia internacional del oro) en el código, de forma
// quirúrgica, idempotente y auditable.
//
// Modelo B (10-nov-2026): Inversiones Zekaii es la dueña de la plataforma
// MAPE.LEGAL y la compradora del oro. El factor de compra al productor NO está
// definido (FACTOR_COMPRA_ZEKAII = null = pendiente). Este script es la ÚNICA
// vía prevista para pasar de `null` a una cifra — y solo con instrucción
// escrita de Willis. Su revisión posterior se rige por la cláusula 4 de la
// Política de Precios: toda revisión es una nueva versión publicada con al
// menos 15 días calendario de anticipación.
//
// Ubicación: scripts/actualizar-factor-compra.mjs — ejecutar desde la raíz.
//
// Fuente de verdad que toca:
//   A) lib/precio/factores.ts      ->  FACTOR_COMPRA_ZEKAII   (null | número)
//        FUENTE ÚNICA del factor. De aquí derivan MAPE_GOLD_BUY_FACTOR
//        (services/pricingService.ts → María WhatsApp + web, boletín diario,
//        /api/precios/live, /api/precios/historial) y
//        FACTOR_COMERCIALIZACION_VIGENTE (lib/precio/calculo.ts → panel de
//        fijación /dashboard/precio y POST /api/precio). No hay un segundo
//        objetivo numérico: cambiar aquí mueve todo.
//   B) lib/precio/calculo.ts       ->  VERSION_POLITICA_PRECIOS +
//                                      FECHA_VIGENCIA_POLITICA
//        Dato PUBLICADO en /precio y /politica-de-precios. Cambiarlos es un
//        acto de política de precios; por eso es opt-in y exige versión +
//        vigencia explícitas (--sincronizar-politica).
//
// Diseño deliberado (regla: no incrustar decisiones sin autorización):
//   - Por defecto SIMULA (dry-run): imprime el diff y no escribe nada.
//   - Por defecto mueve SOLO el factor (factores.ts).
//   - Sincronizar la política publicada requiere --sincronizar-politica
//     junto con --version y --vigencia explícitos en la línea de comando.
//   - No toca la tabla precios_diarios / precios_referencia: el número
//     publicado del día se fija por el panel /dashboard/precio.
//   - No hace un reemplazo ciego de "0.8": ancla por identificador para no
//     tocar opacidades CSS, el objetivo de recuperación >= 80 % ni
//     FACTOR_VENTA_REFINERIA_LBMA (interno — NO es el factor de compra).
//
// Uso:
//   node scripts/actualizar-factor-compra.mjs 0.78                 (simula, solo factor)
//   node scripts/actualizar-factor-compra.mjs 78%  --aplicar       (escribe, solo factor)
//   node scripts/actualizar-factor-compra.mjs 0.78 --sincronizar-politica \
//        --version 1.2 --vigencia 2026-XX-XX --aplicar             (escribe factor + política)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- Objetivos de edición (anclados por identificador, nunca por valor) -----
const OBJETIVOS = {
  factor: {
    archivo: 'lib/precio/factores.ts',
    identificador: 'FACTOR_COMPRA_ZEKAII',
    tipo: 'numero',
    // Captura: (prefijo con la anotación de tipo)(null | numero)(sufijo hasta el ;)
    patron: /(export const FACTOR_COMPRA_ZEKAII\s*:\s*number\s*\|\s*null\s*=\s*)(null|[0-9]*\.?[0-9]+)(\s*;)/,
  },
  politicaVersion: {
    archivo: 'lib/precio/calculo.ts',
    identificador: 'VERSION_POLITICA_PRECIOS',
    tipo: 'texto',
    patron: /(export const VERSION_POLITICA_PRECIOS\s*=\s*")([^"]*)("\s*;)/,
  },
  politicaVigencia: {
    archivo: 'lib/precio/calculo.ts',
    identificador: 'FECHA_VIGENCIA_POLITICA',
    tipo: 'texto',
    patron: /(export const FECHA_VIGENCIA_POLITICA\s*=\s*")([^"]*)("\s*;)/,
  },
  // Flag booleano que acompaña a FECHA_VIGENCIA_POLITICA: `true` mientras la
  // fecha sea un marcador de texto ([CONFIRMAR]); al sincronizar con una
  // fecha real pasa a `false`.
  politicaVigenciaPendiente: {
    archivo: 'lib/precio/calculo.ts',
    identificador: 'FECHA_VIGENCIA_POLITICA_PENDIENTE',
    tipo: 'booleano',
    patron: /(export const FECHA_VIGENCIA_POLITICA_PENDIENTE\s*=\s*)(true|false)(\s*;)/,
  },
};

// --- Parseo de argumentos ---------------------------------------------------
// Flags con valor: consumen el token siguiente (no es posicional).
// Flags booleanas: no consumen nada.
const argv = process.argv.slice(2);
const FLAGS_CON_VALOR = new Set(['--version', '--vigencia']);
const flags = new Set();
const valores = {};
const posicionales = [];
for (let i = 0; i < argv.length; i++) {
  const tok = argv[i];
  if (FLAGS_CON_VALOR.has(tok)) {
    valores[tok] = argv[i + 1] ?? null;
    i++; // saltar el valor consumido
  } else if (tok.startsWith('--')) {
    flags.add(tok);
  } else {
    posicionales.push(tok);
  }
}

function opcion(nombre) {
  return valores[nombre] ?? null;
}

const APLICAR = flags.has('--aplicar');
const SINCRONIZAR = flags.has('--sincronizar-politica');
const raiz = process.cwd();

function abortar(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

// --- Validación del nuevo factor -------------------------------------------
if (posicionales.length !== 1) {
  abortar('Indicá exactamente un factor. Ej.: node scripts/actualizar-factor-compra.mjs 0.78');
}
let bruto = posicionales[0].trim();
let nuevoFactor;
if (bruto.endsWith('%')) {
  nuevoFactor = Number(bruto.slice(0, -1)) / 100;
} else {
  const n = Number(bruto);
  // Aceptar "78" como 0.78 y "0.78" como 0.78. Solo un ENTERO entre 2 y 100
  // se interpreta como porcentaje; un decimal mayor que 1 ("1.2") es casi
  // seguro un error de tipeo y NO se adivina (antes se convertía en 0.012).
  if (Number.isFinite(n) && n > 1) {
    if (!Number.isInteger(n) || n > 100) {
      abortar(`Factor ambiguo: "${bruto}". Usá una fracción (0.78), un porcentaje explícito (78%) o un entero 2-100 (78).`);
    }
    nuevoFactor = n / 100;
  } else {
    nuevoFactor = n;
  }
}
if (!Number.isFinite(nuevoFactor) || nuevoFactor <= 0 || nuevoFactor > 1) {
  abortar(`Factor inválido: "${bruto}". Debe resolver a un número en (0, 1]. Ej.: 0.78 o 78%.`);
}
const nuevoFactorStr = String(nuevoFactor); // 0.78

// --- Motor de reemplazo -----------------------------------------------------
const cambios = []; // { archivo, identificador, antes, despues }

function aplicarObjetivo(obj, nuevoValor) {
  const ruta = resolve(raiz, obj.archivo);
  let contenido;
  try {
    contenido = readFileSync(ruta, 'utf8');
  } catch {
    abortar(`No se encontró ${obj.archivo}. ¿Ejecutás desde la raíz del repositorio?`);
  }
  const coincidencias = contenido.match(new RegExp(obj.patron, 'g'));
  if (!coincidencias) {
    abortar(`No se localizó la constante ${obj.identificador} en ${obj.archivo} (posible drift). Revisá el árbol antes de continuar.`);
  }
  if (coincidencias.length !== 1) {
    abortar(`Se esperaba 1 ocurrencia de ${obj.identificador} en ${obj.archivo}, se hallaron ${coincidencias.length}. Abortado por seguridad.`);
  }
  const m = contenido.match(obj.patron);
  const antes = m[2];
  if (antes === nuevoValor) {
    console.log(`  = ${obj.archivo} :: ${obj.identificador} ya está en ${nuevoValor}. Sin cambios.`);
    return { archivo: obj.archivo, ruta, nuevoContenido: contenido, sinCambios: true };
  }
  const nuevoContenido = contenido.replace(obj.patron, `$1${nuevoValor}$3`);
  cambios.push({ archivo: obj.archivo, identificador: obj.identificador, antes, despues: nuevoValor });
  return { archivo: obj.archivo, ruta, nuevoContenido, sinCambios: false };
}

// --- Guardas de política ----------------------------------------------------
let version = null;
let vigencia = null;
if (SINCRONIZAR) {
  version = opcion('--version');
  vigencia = opcion('--vigencia');
  if (!version) abortar('--sincronizar-politica exige --version <x.y> (nueva versión de la Política de Precios).');
  if (!vigencia || !/^\d{4}-\d{2}-\d{2}$/.test(vigencia)) {
    abortar('--sincronizar-politica exige --vigencia <YYYY-MM-DD> (fecha de entrada en vigencia).');
  }
}

// --- Ejecución (recolecta, luego escribe) -----------------------------------
console.log('\n──────────────────────────────────────────────────────────────');
console.log(`  Factor de compra al productor objetivo: ${nuevoFactorStr}  (${(nuevoFactor * 100).toFixed(2).replace(/\.00$/, '')}% de la referencia internacional)`);
console.log(`  Comprador: Inversiones Zekaii, S. de R.L.`);
console.log(`  Modo: ${APLICAR ? 'APLICAR (escribe en disco)' : 'SIMULACIÓN (no escribe)'}`);
console.log(`  Alcance: ${SINCRONIZAR ? 'factor (factores.ts) + política publicada (calculo.ts)' : 'solo factor (lib/precio/factores.ts)'}`);
console.log('──────────────────────────────────────────────────────────────\n');

const pendientes = [];
const resultadoFactor = aplicarObjetivo(OBJETIVOS.factor, nuevoFactorStr);
const veniaPendiente = cambios.some(
  (c) => c.identificador === OBJETIVOS.factor.identificador && c.antes === 'null',
);
pendientes.push(resultadoFactor);

if (SINCRONIZAR) {
  // Versión, vigencia y flag de vigencia pendiente viven en calculo.ts; el
  // factor ya NO (deriva de factores.ts). Se editan sobre un único contenido
  // en memoria y se escriben una sola vez.
  const objCalc = OBJETIVOS.politicaVersion;
  const rutaCalc = resolve(raiz, objCalc.archivo);
  let contenidoCalc;
  try {
    contenidoCalc = readFileSync(rutaCalc, 'utf8');
  } catch {
    abortar(`No se encontró ${objCalc.archivo}. ¿Ejecutás desde la raíz del repositorio?`);
  }
  const contenidoCalcAntes = contenidoCalc;
  const edicionesCalc = [
    ['politicaVersion', version],
    ['politicaVigencia', vigencia],
    ['politicaVigenciaPendiente', 'false'],
  ];
  for (const [key, valor] of edicionesCalc) {
    const obj = OBJETIVOS[key];
    const m = contenidoCalc.match(obj.patron);
    if (!m) abortar(`No se localizó ${obj.identificador} en ${obj.archivo}.`);
    if (m[2] !== valor) {
      cambios.push({ archivo: obj.archivo, identificador: obj.identificador, antes: m[2], despues: valor });
      contenidoCalc = contenidoCalc.replace(obj.patron, `$1${valor}$3`);
    }
  }
  pendientes.push({
    archivo: objCalc.archivo,
    ruta: rutaCalc,
    nuevoContenido: contenidoCalc,
    sinCambios: contenidoCalc === contenidoCalcAntes,
  });
}

// --- Reporte de cambios -----------------------------------------------------
if (cambios.length === 0) {
  console.log('No hay nada que cambiar. El sistema ya está en el estado solicitado.\n');
  process.exit(0);
}
console.log('Cambios previstos:\n');
for (const c of cambios) {
  console.log(`  ${c.archivo}`);
  console.log(`    ${c.identificador}:  ${c.antes}  ->  ${c.despues}`);
}
console.log('');

// --- Escritura --------------------------------------------------------------
if (APLICAR) {
  for (const p of pendientes) {
    if (!p.sinCambios) writeFileSync(p.ruta, p.nuevoContenido, 'utf8');
  }
  console.log('Escrito en disco.\n');
} else {
  console.log('SIMULACIÓN: no se escribió nada. Repetí con --aplicar para persistir.\n');
}

// --- Advertencias y pasos obligatorios --------------------------------------
console.log('Pasos obligatorios (no automatizados por diseño):');
if (veniaPendiente) {
  console.log('  [0] PRIMERA DEFINICIÓN: el factor pasa de PENDIENTE (null) a una cifra. Esto exige');
  console.log('      instrucción escrita de Willis y la publicación de la nueva versión de la Política');
  console.log('      de Precios de Inversiones Zekaii (hoy en BORRADOR) — sin ella, la cifra queda');
  console.log('      visible en María, el boletín y /precios sin respaldo publicado.');
}
if (!SINCRONIZAR) {
  console.log('  [1] COHERENCIA: moviste solo el factor. FACTOR_COMERCIALIZACION_VIGENTE y');
  console.log('      MAPE_GOLD_BUY_FACTOR ya derivan de factores.ts (se mueven solos), pero');
  console.log('      VERSION_POLITICA_PRECIOS / FECHA_VIGENCIA_POLITICA siguen en su valor anterior:');
  console.log('      /precio y /politica-de-precios publicarán el factor nuevo bajo la versión vieja.');
  console.log('      Decisión de Willis: formalizar como revisión (v-nueva + aviso 15 días +');
  console.log('      --sincronizar-politica) o asumir desviación documentada.');
} else {
  console.log(`  [1] AVISO: la cláusula 4 de la Política de Precios prevé publicación con 15 días`);
  console.log('      calendario de anticipación. Confirmá que la vigencia indicada respeta ese plazo');
  console.log('      o que la desviación queda documentada por decisión de Willis.');
}
console.log('  [2] FIJACIÓN DIARIA: el número publicado en /precio se fija por el panel');
console.log('      /dashboard/precio (deja de responder 409 factor_compra_pendiente tras el deploy).');
console.log('      María, el boletín y /precios cotizan tras el deploy; la página /precio solo cambia');
console.log('      en la próxima fijación. Fijá el precio del día con el nuevo factor para que no diverjan.');
console.log('  [3] GATE INSTITUCIONAL: sin cambios — María sigue sin cotizar precio a contactos');
console.log('      institucionales (esInstitucional). Verificado, no requiere acción.');
console.log('  [4] NO TOCADO (correcto): FACTOR_VENTA_REFINERIA_LBMA es el precio de venta de Zekaii');
console.log('      a la refinería de destino — interno, no es el factor de compra al productor.');
console.log('  [5] Commit sugerido:');
console.log(`      "precio: factor de compra Zekaii ${nuevoFactorStr}${SINCRONIZAR ? ` (Política v${version}, vig. ${vigencia})` : ' (solo factor, interino)'}"`);
console.log('');
