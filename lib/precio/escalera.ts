// lib/precio/escalera.ts
// ---------------------------------------------------------------------------
// Escalera de precios por eslabón — fuente única tipada.
//
// Cada factor es la fracción de la referencia LBMA que corresponde a ese
// eslabón. Dos naturalezas distintas, marcadas en el tipo:
//   - origen  : lo que MAPE LEGAL PAGA al vendedor (minero, cooperativa).
//               Cotizable por María a un contacto externo.
//   - venta   : lo que le PAGAN a MAPE / a la refinería de destino. Precio interno de reventa.
//               NUNCA cotizable por María a un contacto externo — revelarlo
//               expone la escalera de margen y la parte relacionada (refinería de destino).
//
// La frontera vive en el tipo (`cotizableExterno`), no en el prompt: María
// solo puede citar eslabones con cotizableExterno === true. 80% y 88% quedan
// fuera de su alcance por construcción, no por memoria del modelo.
//
// La cotización efectiva en Lps/gramo se calcula con
// calcularPrecioLempirasGramoFino(lbma, tc, factor) de lib/precio/calculo.ts.
// Este archivo define QUÉ factor aplica según la contraparte; aquel, CÓMO.
// ---------------------------------------------------------------------------

export type NaturalezaPrecio = 'origen' | 'venta';

export interface EslabonPrecio {
  /** Identificador de contraparte. */
  actor: 'minero' | 'cooperativa' | 'mape_venta' | 'refineria_destino';
  /** Etiqueta para prompt / UI interna. */
  etiqueta: string;
  /** Fracción de LBMA. */
  factor: number;
  naturaleza: NaturalezaPrecio;
  /** Si María puede citarlo a un contacto externo por WhatsApp/web. */
  cotizableExterno: boolean;
  /** Nota de encuadre que María debe respetar al citar. */
  encuadre?: string;
}

export const ESCALERA_PRECIOS: Record<EslabonPrecio['actor'], EslabonPrecio> = {
  minero: {
    actor: 'minero',
    etiqueta: 'Minero artesanal',
    // Debe coincidir con MAPE_GOLD_BUY_FACTOR (services/pricingService.ts),
    // que es lo que María cotiza en vivo. Moverlos juntos.
    factor: 0.75,
    naturaleza: 'origen',
    cotizableExterno: true,
    encuadre: 'Precio de compra al minero. Es la primera opción por defecto.',
  },
  cooperativa: {
    actor: 'cooperativa',
    etiqueta: 'Cooperativa minera',
    factor: 0.77,
    naturaleza: 'origen',
    cotizableExterno: true,
    encuadre:
      'Referencia / primera oferta a una cooperativa, sujeta a negociación. ' +
      'No es un factor impuesto: la cooperativa negocia el precio.',
  },
  mape_venta: {
    actor: 'mape_venta',
    etiqueta: 'Precio de venta MAPE LEGAL',
    factor: 0.8,
    naturaleza: 'venta',
    cotizableExterno: false, // INTERNO — María no lo cita jamás a externos.
  },
  refineria_destino: {
    actor: 'refineria_destino',
    etiqueta: 'Precio de venta refinería de destino',
    factor: 0.88,
    naturaleza: 'venta',
    cotizableExterno: false, // INTERNO — parte relacionada; pendiente PLA/FT.
  },
};

/** Eslabón por defecto para María cuando no hay identificación de actor. */
export const ESLABON_POR_DEFECTO = ESCALERA_PRECIOS.minero;

/**
 * Devuelve el eslabón que María puede cotizar a un contacto externo.
 * Cae al minero (75%) si el actor es desconocido o si el eslabón pedido no
 * es cotizable externamente (venta). Es la compuerta de seguridad: por
 * construcción no puede devolver 80% ni 88% a un externo.
 */
export function eslabonCotizableExterno(
  actor?: EslabonPrecio['actor'] | null,
): EslabonPrecio {
  if (!actor) return ESLABON_POR_DEFECTO;
  const e = ESCALERA_PRECIOS[actor];
  if (!e || !e.cotizableExterno) return ESLABON_POR_DEFECTO;
  return e;
}
