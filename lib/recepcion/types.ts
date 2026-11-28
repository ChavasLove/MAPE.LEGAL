// lib/recepcion/types.ts — contrato de la recepción física y la custodia hasta
// el laboratorio (migración 047). Nombres compartidos por la base, la API, la
// UI y los tests.
//
// En el código NO se nombra a ninguna empresa: operador de recepción, parte
// compradora configurada y laboratorio de destino son PAPELES que se asignan a
// organizaciones en `partes_flujo`. Aquí no hay pagos, recibos ni montos.

export const MODOS_ENTREGA = ['en_persona', 'encargo_expreso', 'dhl', 'otro'] as const;
export type ModoEntrega = (typeof MODOS_ENTREGA)[number];

export const ESTADOS_EMBALAJE = ['integro', 'danado', 'abierto', 'no_aplica'] as const;
export type EstadoEmbalaje = (typeof ESTADOS_EMBALAJE)[number];

export const TIPOS_PUNTO = ['centro_acopio', 'oficina'] as const;
export type TipoPunto = (typeof TIPOS_PUNTO)[number];

export const ESTADOS_RECEPCION = ['registrada', 'anulada'] as const;
export type EstadoRecepcion = (typeof ESTADOS_RECEPCION)[number];

export const ESTADOS_SOBRE = ['abierto', 'empacado', 'anulado'] as const;
export type EstadoSobre = (typeof ESTADOS_SOBRE)[number];

export const ESTADOS_CAJA = ['abierta', 'cerrada', 'enviada', 'recibida', 'anulada'] as const;
export type EstadoCaja = (typeof ESTADOS_CAJA)[number];

export const PAPELES_FLUJO = ['operador_recepcion', 'parte_compradora', 'laboratorio_destino'] as const;
export type PapelFlujo = (typeof PAPELES_FLUJO)[number];

export const ESTADOS_CONCILIACION_LAB = ['conciliada', 'discrepancia', 'incompleto', 'umbral_no_configurado'] as const;
export type EstadoConciliacionLab = (typeof ESTADOS_CONCILIACION_LAB)[number];

export interface PuntoRecepcion { id: string; organizacion_id: string; tipo: TipoPunto; nombre: string; activo: boolean }

export interface Recepcion {
  id: string; codigo: string; punto_id: string; lote_id: string; titular_cliente_id: string; mina_id: string;
  modo_entrega: ModoEntrega; guia: string | null; fecha_llegada: string; receptor_user_id: string;
  estado_embalaje: EstadoEmbalaje; observaciones: string | null; estado: EstadoRecepcion; created_at: string;
}

export interface Sobre {
  id: string; recepcion_id: string; lote_id: string; mina_id: string; titular_cliente_id: string;
  peso_bruto_g: string | number | null; peso_neto_g: string | number | null; instrumento: string | null;
  calibracion_fecha: string | null; ley_fino: string | number | null; certificado_id: string | null;
  numero_sello: string | null; etiqueta: string | null; caja_id: string | null; estado: EstadoSobre;
}

export interface Caja {
  id: string; codigo: string; punto_id: string; titular_cliente_id: string; laboratorio_org_id: string;
  precinto: string | null; estado: EstadoCaja; manifiesto: Record<string, unknown> | null;
  manifiesto_canonico: string | null; manifiesto_hash: string | null; cerrada_en: string | null; created_at: string;
}

export const MODO_ENTREGA_ETIQUETA: Record<ModoEntrega, string> = {
  en_persona: 'En persona', encargo_expreso: 'Encargo expreso', dhl: 'DHL', otro: 'Otro',
};
export const EMBALAJE_ETIQUETA: Record<EstadoEmbalaje, string> = {
  integro: 'Íntegro', danado: 'Dañado', abierto: 'Abierto', no_aplica: 'No aplica',
};
export const TIPO_PUNTO_ETIQUETA: Record<TipoPunto, string> = { centro_acopio: 'Centro de acopio', oficina: 'Oficina' };
export const ESTADO_CAJA_ETIQUETA: Record<EstadoCaja, string> = {
  abierta: 'Abierta', cerrada: 'Cerrada con manifiesto', enviada: 'Enviada al laboratorio', recibida: 'Recibida en laboratorio', anulada: 'Anulada',
};
export const PAPEL_FLUJO_ETIQUETA: Record<PapelFlujo, string> = {
  operador_recepcion: 'Operador de recepción designado',
  parte_compradora: 'Parte compradora configurada',
  laboratorio_destino: 'Laboratorio de destino',
};
export const CONCILIACION_LAB_ETIQUETA: Record<EstadoConciliacionLab, string> = {
  conciliada: 'Conciliada',
  discrepancia: 'Con discrepancia',
  incompleto: 'Incompleta (faltan pesos)',
  umbral_no_configurado: 'Sin conciliar: umbral no configurado',
};

/** Mensajes para los códigos de regla que devuelven la base y los predicados. */
export const REGLA_MENSAJE: Record<string, string> = {
  perfil_no_aprobado: 'El titular de origen no tiene un perfil aprobado.',
  sin_perfil: 'El titular de origen no tiene perfil cargado.',
  mina_de_otro_titular: 'La mina no pertenece al titular de origen: no se mezclan expedientes.',
  titular_no_coincide: 'El titular de origen no es el del lote.',
  lote_no_disponible: 'El lote está bloqueado o cerrado.',
  punto_inactivo: 'El punto de recepción no está activo.',
  sobre_de_otra_mina: 'El sobre debe ser de la mina de su recepción.',
  mezcla_de_titulares: 'La caja es de otro titular de origen. Los lotes de titulares distintos no se mezclan.',
  sobre_sin_pesar: 'El sobre no tiene peso neto registrado.',
  sobre_sin_etiquetar: 'El sobre no tiene etiqueta y número de sello.',
  sobre_anulado: 'El sobre está anulado.',
  sobre_ya_empacado: 'El sobre ya está en una caja.',
  caja_no_abierta: 'La caja ya no está abierta.',
  caja_vacia: 'La caja no tiene sobres.',
  sobres_incompletos: 'Hay sobres sin pesar o sin etiquetar.',
  sin_precinto: 'Falta el número de precinto.',
  sin_manifiesto: 'No se puede cerrar una caja sin manifiesto.',
  hash_no_coincide: 'La huella del manifiesto no coincide.',
  manifiesto_no_corresponde: 'El manifiesto no corresponde al contenido actual de la caja.',
  caja_no_cerrada: 'Solo se envía una caja cerrada con manifiesto.',
  caja_no_enviada: 'Solo se recibe en laboratorio una caja enviada.',
  destino_no_es_laboratorio: 'El destino debe ser una organización activa de tipo laboratorio.',
  recepcion_anulada: 'La recepción está anulada.',
  ya_anulada: 'La recepción ya estaba anulada.',
  motivo_obligatorio: 'El motivo es obligatorio (mínimo 5 caracteres).',
  sobres_en_caja_cerrada: 'Hay sobres de esta recepción en una caja ya cerrada.',
  sobre_en_caja_cerrada: 'El contenido de una caja cerrada no se modifica.',
  sobre_empacado: 'Saque el sobre de la caja antes de corregir su pesaje o etiqueta.',
  evento_reservado: 'Los eventos de recepción los registra el personal.',
  medio_invalido: 'Medio de envío inválido.',
  datos_invalidos: 'Datos inválidos.',
};
