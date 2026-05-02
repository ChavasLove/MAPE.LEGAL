// Domain entities use Spanish names to mirror the DB schema and legal domain.
// Engineering structures (NextActionsResult, BlockingReason) stay in English.

// ─── CLIENTES ────────────────────────────────────────────────────────────────

export type TipoCliente = 'minero' | 'propietario' | 'ambos';

export interface Cliente {
  id: string;
  tipo: TipoCliente;
  nombre_completo: string;
  rtn?: string | null;
  dpi?: string | null;
  telefono?: string | null;
  correo?: string | null;
  municipio?: string | null;
  departamento?: string | null;
  notas?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── MINAS ───────────────────────────────────────────────────────────────────

export type CategoriaAmbiental = 'SLAS-1' | 'SLAS-2' | 'SLAS-3';
export type EstadoILO = 'pendiente' | 'en_proceso' | 'completado';

export interface Mina {
  id: string;
  nombre: string;
  cliente_id?: string | null;
  municipio?: string | null;
  departamento?: string | null;
  zona?: string | null;
  coordenadas_utm_x?: number | null;
  coordenadas_utm_y?: number | null;
  zona_utm: string;
  hectareas?: number | null;
  tipo_mineral: string;
  categoria_ambiental: CategoriaAmbiental;
  estado_ilo_169: EstadoILO;
  activo: boolean;
  foto_url?: string | null;
  created_at?: string;
  updated_at?: string;
  cliente?: Cliente;
}

// ─── ASIGNACIONES ─────────────────────────────────────────────────────────────

export interface Asignacion {
  id: string;
  expediente_id: string;
  abogado_id?: string | null;
  psa_id?: string | null;
  fecha_asignacion?: string;
  activo: boolean;
  created_at?: string;
}

// ─── PLANTILLAS DE TAREAS ─────────────────────────────────────────────────────

export type ProcesoTramite = 'formalizacion' | 'titulacion' | 'sociedad_minera';
export type RolResponsable = 'admin' | 'abogado' | 'tecnico_ambiental' | 'cliente' | 'externo';

export interface PlantillaTarea {
  id: string;
  proceso: ProcesoTramite;
  fase_numero: number;
  numero_paso: number;
  nombre: string;
  descripcion?: string | null;
  rol_responsable: RolResponsable;
  plazo_dias: number;
  evidencia_requerida: boolean;
  evidencia_descripcion?: string | null;
  activo: boolean;
}

// ─── TAREAS ───────────────────────────────────────────────────────────────────

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completado' | 'bloqueado';

export interface Tarea {
  id: string;
  expediente_id: string;
  plantilla_id?: string | null;
  proceso: ProcesoTramite;
  fase_numero: number;
  numero_paso: number;
  nombre: string;
  descripcion?: string | null;
  rol_responsable: RolResponsable;
  estado: EstadoTarea;
  plazo_dias?: number | null;
  fecha_limite?: string | null;
  evidencia_requerida: boolean;
  evidencia_descripcion?: string | null;
  evidencia_url?: string | null;
  completado_por_id?: string | null;
  completado_en?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── CONTRATOS ───────────────────────────────────────────────────────────────

export type EstadoContrato = 'borrador' | 'firmado' | 'activo' | 'completado' | 'cancelado';

export interface Contrato {
  id: string;
  expediente_id?: string | null;
  tipo: ProcesoTramite;
  fecha_firma?: string | null;
  monto_total?: number | null;
  moneda: string;
  estado: EstadoContrato;
  notas?: string | null;
  documento_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────

export type TipoNotificacion = 'wa' | 'sistema' | 'email' | 'tarea';

export interface Notificacion {
  id: string;
  expediente_id?: string | null;
  tarea_id?: string | null;
  usuario_id?: string | null;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string | null;
  leida: boolean;
  created_at?: string;
}

// ─── TRANSACCIONES DE ORO ────────────────────────────────────────────────────

export type EstadoTransaccion = 'pendiente' | 'verificado' | 'rechazado';

export interface TransaccionOro {
  id: string;
  expediente_id?: string | null;
  mina_id?: string | null;
  cliente_id?: string | null;
  fecha_transaccion: string;
  peso_gramos: number;
  ley_quilates?: number | null;
  precio_por_gramo?: number | null;
  monto_total?: number | null;
  moneda: string;
  coordenadas_utm_x?: number | null;
  coordenadas_utm_y?: number | null;
  foto_url?: string | null;
  numero_serie?: string | null;
  estado: EstadoTransaccion;
  verificado_por_id?: string | null;
  verificado_en?: string | null;
  created_at?: string;
}

// ─── PERFILES PROFESIONALES ──────────────────────────────────────────────────

export type RolProfesional = 'abogado' | 'tecnico_ambiental' | 'admin';

export interface PerfilProfesional {
  id: string;
  nombre: string;
  iniciales: string;
  rol: RolProfesional;
  especialidad?: string | null;
  email?: string | null;
  telefono?: string | null;
  activo: boolean;
  usuario_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── EXPEDIENTE (extended) ───────────────────────────────────────────────────

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
  cliente_id?: string | null;
  mina_id?: string | null;
  created_at?: string;
  fase?: Fase;
  cliente?: Cliente;
  mina?: Mina;
}

// ─── ÍNDICE DE LEGALIDAD ─────────────────────────────────────────────────────
// Computed at runtime from tareas, not stored as a table row.

export interface IndiceComponente {
  key: string;
  label: string;
  completado: boolean;
  peso: number;
}

export interface IndiceLegalidad {
  expediente_id: string;
  score: number;          // 0–100
  componentes: IndiceComponente[];
  computed_at: string;
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
  blocking: BlockingReason[];
  available_transitions: Array<{
    transition_id: string;
    fase: Fase;
  }>;
}
