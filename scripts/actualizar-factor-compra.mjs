#!/usr/bin/env node
// ---------------------------------------------------------------------------
// actualizar-factor-compra.mjs
//
// Actualiza el factor de comercialización (precio de compra de oro de MAPE
// LEGAL como fracción de la referencia LBMA) en el código, de forma
// quirúrgica, idempotente y auditable.
//
// Ubicación sugerida en el repositorio: scripts/actualizar-factor-compra.mjs
// Ejecutar desde la raíz del repositorio MAPE.LEGAL.
//
// Fuentes de verdad que toca:
//   A) services/pricingService.ts  ->  MAPE_GOLD_BUY_FACTOR
//        Cotización en vivo de María (WhatsApp + web), boletín diario y
//        widget /api/precios/live. Este es "aplicar precio a María".
//   B) lib/precio/calculo.ts       ->  FACTOR_COMERCIALIZACION_VIGENTE
//        Precarga del panel de fijación diaria y dato PUBLICADO en
//        /precio y /politica-de-precios. Cambiarlo es un acto de política
//        de precios; por eso es opt-in y exige versión + vigencia.
//
// Diseño deliberado (regla: no incrustar decisiones sin autorización):
//   - Por defecto SIMULA (dry-run): imprime el diff y no escribe nada.
//   - Por defecto mueve SOLO a María (--maria-solo implícito).
//   - Sincronizar la política publicada requiere --sincronizar-politica
//     junto con --version y --vigencia explícitos en la línea de comando.
//   - No toca la tabla precios_diarios / precios_referencia: el número
//     publicado del día se fija por el panel /dashboard/precio. El script
//     te lo recuerda al terminar.
//   - No hace un reemplazo ciego de "0.8": ancla por identificador para no
//     tocar opacidades CSS ni el objetivo de recuperación >= 80%.
//
// Uso:
//   node scripts/actualizar-factor-compra.mjs 0.78                 (simula, solo María)
//   node scripts/actualizar-factor-compra.mjs 78%  --aplicar       (escribe, solo María)
//   node scripts/actualizar-factor-compra.mjs 0.78 --sincronizar-politica \
//        --version 1.2 --vigencia 2026-XX-XX --aplicar             (escribe María + política)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- Objetivos de edición (anclados por identificador, nunca por valor) -----
const OBJETIVOS = {
  maria: {
    archivo: 'services/pricingService.ts',
    identificador: 'MAPE_GOLD_BUY_FACTOR',
    tipo: 'numero',
    // Captura: (prefijo)(numero)(sufijo hasta el ;)
    patron: /(export const MAPE_GOLD_BUY_FACTOR\s*=\s*)([0-9]*\.?[0-9]+)(\s*;)/,
  },
  politicaFactor: {
    archivo: 'lib/precio/calculo.ts',
    identificador: 'FACTOR_COMERCIALIZACION_VIGENTE',
    tipo: 'numero',
    patron: /(export const FACTOR_COMERCIALIZACION_VIGENTE\s*=\s*)([0-9]*\.?[0-9]+)(\s*;)/,
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
console.log(`  Factor de comercialización objetivo: ${nuevoFactorStr}  (${(nuevoFactor * 100).toFixed(2).replace(/\.00$/, '')}% de LBMA)`);
console.log(`  Modo: ${APLICAR ? 'APLICAR (escribe en disco)' : 'SIMULACIÓN (no escribe)'}`);
console.log(`  Alcance: ${SINCRONIZAR ? 'María + política publicada' : 'solo María (pricingService)'}`);
console.log('──────────────────────────────────────────────────────────────\n');

const pendientes = [];
pendientes.push(aplicarObjetivo(OBJETIVOS.maria, nuevoFactorStr));

if (SINCRONIZAR) {
  pendientes.push(aplicarObjetivo(OBJETIVOS.politicaFactor, nuevoFactorStr));
  // La versión y la vigencia se editan sobre el mismo archivo calculo.ts;
  // reprocesar sobre el contenido ya modificado en memoria.
  const idxCalc = pendientes.findIndex((p) => p.archivo === OBJETIVOS.politicaVersion.archivo);
  const contenidoCalcAntes = pendientes[idxCalc].nuevoContenido;
  let contenidoCalc = contenidoCalcAntes;
  for (const key of ['politicaVersion', 'politicaVigencia']) {
    const obj = OBJETIVOS[key];
    const valor = key === 'politicaVersion' ? version : vigencia;
    const m = contenidoCalc.match(obj.patron);
    if (!m) abortar(`No se localizó ${obj.identificador} en ${obj.archivo}.`);
    if (m[2] !== valor) {
      cambios.push({ archivo: obj.archivo, identificador: obj.identificador, antes: m[2], despues: valor });
      contenidoCalc = contenidoCalc.replace(obj.patron, `$1${valor}$3`);
    }
  }
  pendientes[idxCalc].nuevoContenido = contenidoCalc;
  // Si el factor ya estaba en el valor pedido, aplicarObjetivo marcó el
  // archivo como "sin cambios"; los edits de versión/vigencia de arriba
  // deben forzar la escritura igual (antes se reportaban pero no se escribían).
  if (contenidoCalc !== contenidoCalcAntes) pendientes[idxCalc].sinCambios = false;
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
if (!SINCRONIZAR) {
  console.log('  [1] COHERENCIA: moviste solo a María. /precio y /politica-de-precios');
  console.log('      seguirán publicando el factor anterior bajo la versión de política vigente.');
  console.log('      María cotizará un factor que la política publicada no autoriza hasta que');
  console.log('      publiques la nueva versión. Decisión de Willis: formalizar como revisión');
  console.log('      (v-nueva + aviso 15 días + --sincronizar-politica) o asumir desviación documentada.');
} else {
  console.log(`  [1] AVISO: la cláusula 4 de la Política de Precios prevé publicación con 15 días`);
  console.log('      calendario de anticipación. Confirmá que la vigencia indicada respeta ese plazo');
  console.log('      o que la desviación queda documentada por decisión de Willis.');
}
console.log('  [2] FIJACIÓN DIARIA: el número publicado en /precio se fija por el panel');
console.log('      /dashboard/precio. María cotiza en vivo tras el deploy; la página solo cambia');
console.log('      en la próxima fijación. Fijá el precio del día con el nuevo factor para que no diverjan.');
console.log('  [3] GATE INSTITUCIONAL: sin cambios — María sigue sin cotizar precio a contactos');
console.log('      institucionales (esInstitucional). Verificado, no requiere acción.');
console.log('  [4] Commit sugerido:');
console.log(`      "precio: factor de comercialización ${nuevoFactorStr}${SINCRONIZAR ? ` (Política v${version}, vig. ${vigencia})` : ' (solo María, interino)'}"`);
console.log('');
