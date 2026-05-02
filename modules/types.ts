// Domain entities use Spanish names to mirror the DB schema and legal domain.
// Engineering structures (NextActionsResult, BlockingReason) stay in English.

export interface Fase {
  id: string;
  nombre: string;
  orden: number;
}

// JSONB shape stored in transiciones_fase.condicion
export interface CondicionTransicion {
  requiere_pago?: boolean;
  requiere_documentos?: string[];
}

export interface TransicionFase {
  id: string;
  fase_origen_id: string;
  fase_destino_id: string;
  condicion: CondicionTransicion;
  fase_destino?: Fase;
}

export interface Expediente {
  id: string;
  nombre: string;
  fase_actual_id: string | null;
  created_at?: string;
  fase?: Fase;
}

export interface ExpedienteFase {
  id: string;
  expediente_id: string;
  fase_id: string;
  entrada_en: string;
  salida_en: string | null;
  ingresado_por: string | null;
}

export type EstadoPago = 'pendiente' | 'completado' | 'fallido';

export interface Pago {
  id: string;
  expediente_id: string;
  fase_id: string;
  monto: number;
  estado: EstadoPago;
  created_at?: string;
}

export type AccionAuditoria =
  | 'TRANSICION_FASE'
  | 'PAGO_REGISTRADO'
  | 'EXPEDIENTE_CREADO';

export interface RegistroAuditoria {
  id: string;
  expediente_id: string;
  user_id: string | null;
  accion: AccionAuditoria | string;
  metadata: Record<string, unknown>;
  created_at?: string;
}

// Engineering types — returned by the workflow engine, not stored in DB
export interface BlockingReason {
  type: 'pago' | 'documento';
  status: 'missing' | 'pending';
  name?: string;
}

export interface NextActionsResult {
  can_advance: boolean;
  is_final: boolean;
  blocking: BlockingReason[];
  available_transitions: Array<{
    transition_id: string;
    fase: Fase;
  }>;
}
