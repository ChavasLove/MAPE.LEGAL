// lib/precio/escalera.ts
// ---------------------------------------------------------------------------
// Escalera de precios por eslabón — tipada sobre lib/precio/factores.ts.
//
// Modelo B (10-nov-2026): Inversiones Zekaii, S. de R.L. es la dueña de la
// plataforma MAPE.LEGAL y la compradora del oro a los productores. La escalera
// tiene exactamente DOS eslabones:
//   - minero            : lo que Zekaii PAGA al productor. Naturaleza 'origen'.
//                         Cotizable por María a un contacto externo — PERO su
//                         factor (FACTOR_COMPRA_ZEKAII) está PENDIENTE de
//                         definición por Willis. Mientras sea null no hay cifra
//                         que cotizar: María declara el precio como pendiente de
//                         la Política de Precios de Inversiones Zekaii.
//   - refineria_destino : lo que la refinería de destino le paga a Zekaii
//                         (FACTOR_VENTA_REFINERIA_LBMA). Naturaleza 'venta',
//                         INTERNO: nunca cotizable por María a un externo, nunca
//                         publicado como precio de compra.
//
// Eslabones eliminados respecto a la versión anterior (ya no existen en el
// modelo B): `cooperativa` (la cooperativa financiera aliada paga, no compra) y
// `mape_venta` ("MAPE LEGAL" no revende — Zekaii compra directamente).
//
// Ningún factor se escribe aquí: todo deriva de factores.ts. La cotización en
// Lps/gramo de oro fino se calcula con calcularPrecioLempirasGramoFino() de
// lib/precio/calculo.ts. Este archivo define QUÉ factor aplica según la
// contraparte; aquel, CÓMO.
// ---------------------------------------------------------------------------

import {
  FACTOR_COMPRA_ZEKAII,
  FACTOR_COMPRA_ZEKAII_PENDIENTE,
  FACTOR_VENTA_REFINERIA_LBMA,
  factorCompraDefinido,
} from './factores';

export type NaturalezaPrecio = 'origen' | 'venta';

export type ActorPrecio = 'minero' | 'refineria_destino';

export interface EslabonPrecio {
  /** Identificador de contraparte. */
  actor: ActorPrecio;
  /** Etiqueta para prompt / UI interna. */
  etiqueta: string;
  /**
   * Fracción de la referencia internacional del oro. `null` = PENDIENTE
   * (el factor no ha sido definido por Willis).
   */
  factor: number | null;
  naturaleza: NaturalezaPrecio;
  /** Si María puede citarlo a un contacto externo por WhatsApp/web. */
  cotizableExterno: boolean;
  /** Nota de encuadre que María debe respetar al citar. */
  encuadre?: string;
}

export const ESCALERA_PRECIOS: Record<ActorPrecio, EslabonPrecio> = {
  minero: {
    actor: 'minero',
    etiqueta: 'Precio de compra de Inversiones Zekaii al productor',
    factor: FACTOR_COMPRA_ZEKAII,
    naturaleza: 'origen',
    cotizableExterno: true,
    encuadre:
      'Precio de compra al productor. Lo publica Inversiones Zekaii, S. de R.L. en su ' +
      'Política de Precios. Si el factor está pendiente, decir que está pendiente de ' +
      'publicación — nunca estimar ni inventar un porcentaje o una cifra en lempiras.',
  },
  refineria_destino: {
    actor: 'refineria_destino',
    etiqueta: 'Precio de venta de Zekaii a la refinería de destino',
    factor: FACTOR_VENTA_REFINERIA_LBMA,
    naturaleza: 'venta',
    cotizableExterno: false, // INTERNO — María no lo cita jamás a externos.
  },
};

/** Eslabón por defecto para María cuando no hay identificación de actor. */
export const ESLABON_POR_DEFECTO = ESCALERA_PRECIOS.minero;

/**
 * Resultado de la compuerta de cotización externa. `pendiente: true` cuando el
 * eslabón es cotizable pero su factor aún no ha sido definido — el caller debe
 * tratarlo como "sin cifra", no como factor 0.
 */
export interface EslabonCotizable {
  eslabon: EslabonPrecio;
  /** `true` si el factor del eslabón está definido y es cotizable con cifra. */
  cotizable: boolean;
  /** `true` si el eslabón es cotizable externamente pero su factor es null. */
  pendiente: boolean;
  /** Texto a usar en lugar de la cifra mientras `pendiente` sea true. */
  textoPendiente: string | null;
}

/**
 * Devuelve el eslabón que María puede cotizar a un contacto externo.
 * Cae al minero si el actor es desconocido o si el eslabón pedido no es
 * cotizable externamente (venta). Es la compuerta de seguridad: por
 * construcción no puede devolver el factor de venta a la refinería a un
 * externo, y mientras FACTOR_COMPRA_ZEKAII sea null señala `pendiente`.
 */
export function eslabonCotizableExterno(actor?: ActorPrecio | null): EslabonCotizable {
  const pedido = actor ? ESCALERA_PRECIOS[actor] : undefined;
  const eslabon = pedido && pedido.cotizableExterno ? pedido : ESLABON_POR_DEFECTO;
  const definido = factorCompraDefinido(eslabon.factor);
  return {
    eslabon,
    cotizable: definido,
    pendiente: !definido,
    textoPendiente: definido ? null : FACTOR_COMPRA_ZEKAII_PENDIENTE,
  };
}
