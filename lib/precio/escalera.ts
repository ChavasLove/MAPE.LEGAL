// lib/precio/escalera.ts
// ---------------------------------------------------------------------------
// Escalera de precios por eslabón — tipada sobre lib/precio/factores.ts.
//
// Modelo público vigente (DEC-2026-11-26-1 / DEC-2026-11-27-2): la plataforma
// no interviene en la transacción del mineral. La escalera tiene DOS eslabones:
//   - informativo        : el precio PÚBLICO, solo informativo = precio
//                          internacional del oro × tipo de compra del BCH ÷
//                          31.1034768, SIN factor (factor 1). Cotizable por
//                          María a un contacto externo, SIEMPRE con el aviso
//                          literal AVISO_PRECIO_INFORMATIVO.
//   - refineria_destino  : factor de venta a la refinería de destino
//                          (FACTOR_VENTA_REFINERIA_LBMA). INTERNO: nunca
//                          cotizable por María a un externo, nunca publicado.
//
// Ningún factor se escribe aquí: todo deriva de factores.ts. La cotización en
// L/g de oro fino se calcula con calcularPrecioLempirasGramoFino() de
// lib/precio/calculo.ts. Este archivo define QUÉ factor aplica según el
// eslabón; aquel, CÓMO.
//
// Nadie importa este módulo hoy (verificado con grep); se conserva como
// definición tipada de los eslabones para futuros consumidores.
// ---------------------------------------------------------------------------

import { FACTOR_VENTA_REFINERIA_LBMA, factorDefinido } from './factores';
import { FACTOR_SIN_RECORTE } from './calculo';

export type NaturalezaPrecio = 'informativo' | 'venta';

export type EslabonId = 'informativo' | 'refineria_destino';

export interface EslabonPrecio {
  /** Identificador del eslabón. */
  id: EslabonId;
  /** Etiqueta para prompt / UI interna. */
  etiqueta: string;
  /** Fracción de la referencia internacional del oro (1 = sin recorte). */
  factor: number;
  naturaleza: NaturalezaPrecio;
  /** Si María puede citarlo a un contacto externo por WhatsApp/web. */
  cotizableExterno: boolean;
  /** Nota de encuadre que María debe respetar al citar. */
  encuadre?: string;
}

export const ESCALERA_PRECIOS: Record<EslabonId, EslabonPrecio> = {
  informativo: {
    id: 'informativo',
    etiqueta: 'Precio internacional del oro en lempiras por gramo de oro fino',
    factor: FACTOR_SIN_RECORTE,
    naturaleza: 'informativo',
    cotizableExterno: true,
    encuadre:
      'Precio solo informativo, sin factor de compra. No es una oferta, ni un ' +
      'precio oficial, ni una garantía de pago. Citar siempre con el aviso ' +
      'literal AVISO_PRECIO_INFORMATIVO, con fuente y fecha/hora; nunca nombrar ' +
      'contrapartes ni prometer pago.',
  },
  refineria_destino: {
    id: 'refineria_destino',
    etiqueta: 'Factor de venta a la refinería de destino',
    factor: FACTOR_VENTA_REFINERIA_LBMA,
    naturaleza: 'venta',
    cotizableExterno: false, // INTERNO — María no lo cita jamás a externos.
  },
};

/** Eslabón por defecto para María cuando no hay identificación de eslabón. */
export const ESLABON_POR_DEFECTO = ESCALERA_PRECIOS.informativo;

/** Resultado de la compuerta de cotización externa. */
export interface EslabonCotizable {
  eslabon: EslabonPrecio;
  /** `true` si el factor del eslabón es un número válido y es cotizable. */
  cotizable: boolean;
}

/**
 * Devuelve el eslabón que María puede cotizar a un contacto externo.
 * Cae al informativo si el eslabón es desconocido o si el pedido no es
 * cotizable externamente (venta). Es la compuerta de seguridad: por
 * construcción no puede devolver el factor de venta a la refinería a un
 * externo.
 */
export function eslabonCotizableExterno(id?: EslabonId | null): EslabonCotizable {
  const pedido = id ? ESCALERA_PRECIOS[id] : undefined;
  const eslabon = pedido && pedido.cotizableExterno ? pedido : ESLABON_POR_DEFECTO;
  return { eslabon, cotizable: factorDefinido(eslabon.factor) };
}
