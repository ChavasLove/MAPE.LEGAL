#!/usr/bin/env node
// ---------------------------------------------------------------------------
// actualizar-factor-referencia.mjs
//
// Actualiza el factor del PRECIO REFERENCIAL público (fracción de la
// referencia internacional del oro; hoy 0.75 → "Precio referencial (75%)")
// en el código, de forma quirúrgica, idempotente y auditable.
//
// Modelo público (hotfix de neutralidad, 11-nov-2026): la plataforma no
// interviene en la transacción del mineral; el precio publicado es referencial, estimado e
// informativo. Su revisión se rige por la cláusula 4 de la Política de
// Precios: toda revisión es una nueva versión publicada con al menos 15 días
// calendario de anticipación.
//
// Ubicación: scripts/actualizar-factor-referencia.mjs — ejecutar desde la raíz.
//
// Fuente de verdad que toca:
//   A) lib/precio/factores.ts      ->  FACTOR_REFERENCIA   (número en (0, 1])
//        FUENTE ÚNICA del factor. De aquí derivan FACTOR_REFERENCIA_PCT y
//        ROTULO_PRECIO_REFERENCIAL (mismo archivo), FACTOR_REFERENCIA_PUBLICO
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
//   - No hace un reemplazo ciego de "0.75": ancla por identificador para no
//     tocar opacidades CSS, umbrales de recuperación metalúrgica ni
//     FACTOR_VENTA_REFINERIA_LBMA (interno — NO es el factor referencial).
//   - NO toca el texto literal de FORMULA_PRECIO_REFERENCIAL ni de
//     AVISO_PRECIO_REFERENCIAL (lib/content/copy-legal.ts): si el factor
//     cambia, esos textos legales se revisan a mano (ver pasos obligatorios).
//
// Uso:
//   node scripts/actualizar-factor-referencia.mjs 0.78                 (simula, solo factor)
//   node scripts/actualizar-factor-referencia.mjs 78%  --aplicar       (escribe, solo factor)
//   node scripts/actualizar-factor-referencia.mjs 0.78 --sincronizar-politica \
//        --version 1.3 --vigencia 2026-XX-XX --aplicar                 (escribe factor + política)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- Objetivos de edición (anclados por identificador, nunca por valor) -----
const OBJETIVOS = {
  factor: {
    archivo: 'lib/precio/factores.ts',
    identificador: 'FACTOR_REFERENCIA',
    tipo: 'numero',
    // Captura: (prefijo, con o sin anotación de tipo)(numero)(sufijo hasta el ;)
    patron: /(export const FACTOR_REFERENCIA\s*(?::\s*number\s*)?=\s*)([0-9]*\.?[0-9]+)(\s*;)/,
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
  abortar('Indicá exactamente un factor. Ej.: node scripts/actualizar-factor-referencia.mjs 0.78');
}
const bruto = posicionales[0].trim();
let nuevoFactor;
if (bruto.endsWith('%')) {
  nuevoFactor = Number(bruto.slice(0, -1)) / 100;
} else {
  const n = Number(bruto);
  // Aceptar "78" como 0.78 y "0.78" como 0.78. Solo un ENTERO entre 2 y 100
  // se interpreta como porcentaje; un decimal mayor que 1 ("1.2") es casi
  // seguro un error de tipeo y NO se adivina.
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
const nuevoPct = (nuevoFactor * 100).toFixed(2).replace(/\.00$/, '');

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
console.log(`  Factor referencial objetivo: ${nuevoFactorStr}  (${nuevoPct}% de la referencia internacional del oro)`);
console.log(`  Rótulo público resultante: "Precio referencial (${Math.round(nuevoFactor * 100)}%)"`);
console.log(`  Modo: ${APLICAR ? 'APLICAR (escribe en disco)' : 'SIMULACIÓN (no escribe)'}`);
console.log(`  Alcance: ${SINCRONIZAR ? 'factor (factores.ts) + política publicada (calculo.ts)' : 'solo factor (lib/precio/factores.ts)'}`);
console.log('──────────────────────────────────────────────────────────────\n');

const pendientes = [];
pendientes.push(aplicarObjetivo(OBJETIVOS.factor, nuevoFactorStr));

if (SINCRONIZAR) {
  // Versión, vigencia y flag de vigencia pendiente viven en calculo.ts; el
  // factor NO (deriva de factores.ts). Se editan sobre un único contenido en
  // memoria y se escriben una sola vez.
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
console.log('  [0] TEXTO LEGAL: FORMULA_PRECIO_REFERENCIAL y AVISO_PRECIO_REFERENCIAL en');
console.log('      lib/content/copy-legal.ts citan el porcentaje de forma literal ("75%", "× 0.75").');
console.log('      Este script NO los toca: revisarlos a mano con el nuevo factor antes de desplegar.');
if (!SINCRONIZAR) {
  console.log('  [1] COHERENCIA: moviste solo el factor. FACTOR_COMERCIALIZACION_VIGENTE,');
  console.log('      FACTOR_REFERENCIA_PUBLICO y ROTULO_PRECIO_REFERENCIAL ya derivan de factores.ts');
  console.log('      (se mueven solos), pero VERSION_POLITICA_PRECIOS / FECHA_VIGENCIA_POLITICA siguen');
  console.log('      en su valor anterior: /precio y /politica-de-precios publicarán el factor nuevo');
  console.log('      bajo la versión vieja. Formalizar como revisión (v-nueva + aviso 15 días +');
  console.log('      --sincronizar-politica) o asumir desviación documentada.');
} else {
  console.log('  [1] AVISO: la cláusula 4 de la Política de Precios prevé publicación con 15 días');
  console.log('      calendario de anticipación. Confirmá que la vigencia indicada respeta ese plazo');
  console.log('      o que la desviación queda documentada.');
}
console.log('  [2] FIJACIÓN DIARIA: el número publicado en /precio se fija por el panel');
console.log('      /dashboard/precio (el factor precargado cambia tras el deploy). María, el boletín y');
console.log('      /precios cotizan con el factor nuevo tras el deploy; la página /precio solo cambia');
console.log('      en la próxima fijación. Fijá el precio del día con el nuevo factor para que no diverjan.');
console.log('  [3] GATE INSTITUCIONAL: sin cambios — María sigue sin cotizar precio a contactos');
console.log('      institucionales (esInstitucional). Verificado, no requiere acción.');
console.log('  [4] NO TOCADO (correcto): FACTOR_VENTA_REFINERIA_LBMA es interno — no es el factor');
console.log('      referencial público y no se publica.');
console.log('  [5] Commit sugerido:');
console.log(`      "precio: factor referencial ${nuevoFactorStr}${SINCRONIZAR ? ` (Política v${version}, vig. ${vigencia})` : ' (solo factor, interino)'}"`);
console.log('');
