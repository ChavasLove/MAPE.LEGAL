import { supabase } from '@/services/supabase';

// ─── Date helpers ────────────────────────────────────────────────────────────

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtInicio(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00Z');
  return `${dt.getUTCDate()} ${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function fmtCierre(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00Z');
  return `${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function fmtVence(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00Z');
  return `${dt.getUTCDate()} ${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

// ─── Types matching what dashboard.html expects ───────────────────────────────

export interface DashHito {
  id: number;
  monto: number;
  pct: number;
  trigger: string;
  estado: string;
  ref?: string;
  fecha?: string;
}

export interface DashDoc {
  id: string;
  nombre: string;
  estado: string;
  info: string;
}

export interface DashSubpaso {
  nombre: string;
  estado: string;
}

export interface DashFase {
  nombre: string;
  estado: string;
  pasos: number;
  totalPasos: number;
  responsable?: string;
  vence?: string;
  subpasos: DashSubpaso[];
}

export interface DashLegalidadItem {
  nombre: string;
  estado: string;
}

export interface DashExpediente {
  id: string;
  cliente: string;
  tipo: string;
  municipio: string;
  fase: number;
  paso: number;
  totalPasos: number;
  estado: string;
  inicio: string;
  cierreEst: string;
  abogado: { nombre: string; initials: string };
  psa: { nombre: string; initials: string };
  legalidad: number;
  hitos: DashHito[];
  documentos: DashDoc[];
  fases: DashFase[];
  legalidadItems: DashLegalidadItem[];
}

export interface DashMensaje {
  id: string;
  expId: string;
  cliente: string;
  hora: string;
  archivo: string;
  tipo: string;
  docTipo: string;
  estado: string;
  docId: string;
  campos: Array<{ label: string; valor: string; confianza: string; nota?: string }>;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getDashExpedientes(): Promise<DashExpediente[]> {
  const { data, error } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, cliente, tipo, municipio, estado,
      fase_numero, paso, total_pasos,
      abogado_nombre, abogado_iniciales, psa_nombre, psa_iniciales,
      legalidad, inicio, cierre_estimado,
      hitos(id, numero, monto, porcentaje, trigger_evento, estado, referencia, fecha_cobro),
      documentos(id, nombre, estado, info),
      legalidad_items(nombre, estado, orden),
      progress_fases(
        id, nombre, estado, pasos, total_pasos, responsable, fecha_vencimiento, orden,
        progress_subpasos(nombre, estado, orden)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(transformExpediente);
}

export async function getDashExpedienteById(
  numeroExpediente: string
): Promise<DashExpediente | null> {
  const { data, error } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, cliente, tipo, municipio, estado,
      fase_numero, paso, total_pasos,
      abogado_nombre, abogado_iniciales, psa_nombre, psa_iniciales,
      legalidad, inicio, cierre_estimado,
      hitos(id, numero, monto, porcentaje, trigger_evento, estado, referencia, fecha_cobro),
      documentos(id, nombre, estado, info),
      legalidad_items(nombre, estado, orden),
      progress_fases(
        id, nombre, estado, pasos, total_pasos, responsable, fecha_vencimiento, orden,
        progress_subpasos(nombre, estado, orden)
      )
    `)
    .eq('numero_expediente', numeroExpediente)
    .single();

  if (error) return null;
  return transformExpediente(data);
}

export async function getDashMensajes(): Promise<DashMensaje[]> {
  const { data, error } = await supabase
    .from('mensajes_wa')
    .select(`
      id, cliente, hora, archivo, tipo, doc_tipo, estado, documento_id, campos,
      expediente:expedientes!expediente_id(numero_expediente)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((m) => {
    const exp = Array.isArray(m.expediente) ? m.expediente[0] : m.expediente;
    return {
      id:      m.id,
      expId:   exp?.numero_expediente ?? '',
      cliente: m.cliente ?? '',
      hora:    m.hora ?? '',
      archivo: m.archivo ?? '',
      tipo:    m.tipo ?? '',
      docTipo: m.doc_tipo ?? '',
      estado:  m.estado ?? 'listo',
      docId:   m.documento_id ?? '',
      campos:  Array.isArray(m.campos) ? m.campos : [],
    } as DashMensaje;
  });
}

export interface CreateExpedienteInput {
  cliente: string;
  tipo: string;
  municipio: string;
  abogado_nombre: string;
  abogado_iniciales: string;
  psa_nombre: string;
  psa_iniciales: string;
}

export async function createDashExpediente(
  input: CreateExpedienteInput
): Promise<DashExpediente> {
  // Generate numero_expediente from the highest existing number for the
  // current year. Using COUNT collided after deletes and raced under
  // concurrent creates; parsing the latest numero tolerates gaps. The unique
  // constraint on numero_expediente will still reject any genuine collision.
  const year   = new Date().getFullYear();
  const prefix = `EXP-${year}-`;

  const { data: latest } = await supabase
    .from('expedientes')
    .select('numero_expediente')
    .like('numero_expediente', `${prefix}%`)
    .order('numero_expediente', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = latest?.numero_expediente
    ? parseInt(latest.numero_expediente.slice(prefix.length), 10) || 0
    : 0;
  const num    = String(lastNum + 1).padStart(3, '0');
  const numero = `${prefix}${num}`;

  const { data: exp, error: expErr } = await supabase
    .from('expedientes')
    .insert({
      numero_expediente:  numero,
      nombre:             `${input.cliente.split(' ').slice(-1)[0]} — ${input.tipo}`,
      cliente:            input.cliente,
      tipo:               input.tipo,
      municipio:          input.municipio,
      estado:             'nuevo',
      fase_numero:        0,
      paso:               1,
      total_pasos:        6,
      abogado_nombre:     input.abogado_nombre,
      abogado_iniciales:  input.abogado_iniciales,
      psa_nombre:         input.psa_nombre,
      psa_iniciales:      input.psa_iniciales,
      legalidad:          0,
      inicio:             new Date().toISOString().split('T')[0],
    })
    .select('id, numero_expediente')
    .single();

  if (expErr || !exp) throw expErr ?? new Error('Failed to create expediente');

  const eid = exp.id;

  // Default hitos, documentos, legalidad_items, progress_fases
  await supabase.from('hitos').insert([
    { expediente_id: eid, numero: 1, monto: 320000, porcentaje: 30, trigger_evento: 'Firma del contrato',           estado: 'pendiente' },
    { expediente_id: eid, numero: 2, monto: 480000, porcentaje: 40, trigger_evento: 'Constancia INHGEOMIN emitida', estado: 'bloqueado' },
    { expediente_id: eid, numero: 3, monto: 800000, porcentaje: 30, trigger_evento: 'Lic. ambiental + permiso',     estado: 'bloqueado' },
  ]);

  await supabase.from('documentos').insert([
    { expediente_id: eid, nombre: 'RTN autenticado',           estado: 'faltante', info: 'Pendiente del cliente' },
    { expediente_id: eid, nombre: 'Documento de identidad (DPI)', estado: 'faltante', info: 'Pendiente del cliente' },
    { expediente_id: eid, nombre: 'Escritura del terreno',     estado: 'faltante', info: 'Pendiente del cliente' },
    { expediente_id: eid, nombre: 'Garantía bancaria',         estado: 'faltante', info: 'Pendiente del cliente' },
  ]);

  await supabase.from('legalidad_items').insert([
    { expediente_id: eid, nombre: 'Tierra',    estado: 'pendiente', orden: 1 },
    { expediente_id: eid, nombre: 'INHGEO',    estado: 'pendiente', orden: 2 },
    { expediente_id: eid, nombre: 'Ambiental', estado: 'pendiente', orden: 3 },
    { expediente_id: eid, nombre: 'Municipal', estado: 'pendiente', orden: 4 },
    { expediente_id: eid, nombre: 'Registro',  estado: 'pendiente', orden: 5 },
  ]);

  const { data: pf } = await supabase.from('progress_fases').insert({
    expediente_id:    eid,
    nombre:           'Fase 0 · Onboarding',
    estado:           'activa',
    pasos:            1,
    total_pasos:      6,
    responsable:      input.abogado_nombre,
    fecha_vencimiento: null,
    orden:            0,
  }).select('id').single();

  if (pf) {
    await supabase.from('progress_subpasos').insert({
      progress_fase_id: pf.id,
      nombre: 'Paso 1 · Consulta SIMHON/INHGEOMIN',
      estado: 'activo',
      orden: 1,
    });
  }

  const result = await getDashExpedienteById(numero);
  if (!result) throw new Error('Created expediente not found');
  return result;
}

export async function updateDocumentoEstado(
  docId: string,
  estado: string,
  info?: string
): Promise<void> {
  const updates: Record<string, unknown> = { estado, updated_at: new Date().toISOString() };
  if (info) updates.info = info;

  const { error } = await supabase
    .from('documentos')
    .update(updates)
    .eq('id', docId);

  if (error) throw error;
}

export async function updateMensajeEstado(
  mensajeId: string,
  estado: string
): Promise<void> {
  const { error } = await supabase
    .from('mensajes_wa')
    .update({ estado })
    .eq('id', mensajeId);

  if (error) throw error;
}

// ─── Transformer ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformExpediente(row: any): DashExpediente {
  const hitos: DashHito[] = (row.hitos ?? [])
    .sort((a: { numero: number }, b: { numero: number }) => a.numero - b.numero)
    .map((h: {
      numero: number; monto: number; porcentaje: number;
      trigger_evento: string; estado: string; referencia?: string; fecha_cobro?: string
    }) => ({
      id:      h.numero,
      monto:   h.monto,
      pct:     h.porcentaje,
      trigger: h.trigger_evento,
      estado:  h.estado,
      ref:     h.referencia ?? undefined,
      fecha:   h.fecha_cobro ? fmtInicio(h.fecha_cobro) : undefined,
    }));

  const documentos: DashDoc[] = (row.documentos ?? []).map((d: {
    id: string; nombre: string; estado: string; info?: string
  }) => ({
    id:     d.id,
    nombre: d.nombre,
    estado: d.estado,
    info:   d.info ?? '',
  }));

  const fases: DashFase[] = (row.progress_fases ?? [])
    .sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)
    .map((f: {
      nombre: string; estado: string; pasos: number; total_pasos: number;
      responsable?: string; fecha_vencimiento?: string;
      progress_subpasos?: Array<{ nombre: string; estado: string; orden: number }>
    }) => ({
      nombre:     f.nombre,
      estado:     f.estado,
      pasos:      f.pasos,
      totalPasos: f.total_pasos,
      responsable: f.responsable ?? undefined,
      vence:      f.fecha_vencimiento ? fmtVence(f.fecha_vencimiento) : undefined,
      subpasos: (f.progress_subpasos ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map((sp) => ({ nombre: sp.nombre, estado: sp.estado })),
    }));

  const legalidadItems: DashLegalidadItem[] = (row.legalidad_items ?? [])
    .sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)
    .map((li: { nombre: string; estado: string }) => ({
      nombre: li.nombre,
      estado: li.estado,
    }));

  return {
    id:         row.numero_expediente ?? row.id,
    cliente:    row.cliente ?? row.nombre ?? '',
    tipo:       row.tipo ?? '',
    municipio:  row.municipio ?? '',
    fase:       row.fase_numero ?? 0,
    paso:       row.paso ?? 1,
    totalPasos: row.total_pasos ?? 6,
    estado:     row.estado ?? 'activo',
    inicio:     fmtInicio(row.inicio),
    cierreEst:  fmtCierre(row.cierre_estimado),
    abogado: {
      nombre:  row.abogado_nombre ?? '',
      initials: row.abogado_iniciales ?? '',
    },
    psa: {
      nombre:  row.psa_nombre ?? '',
      initials: row.psa_iniciales ?? '',
    },
    legalidad:     row.legalidad ?? 0,
    hitos,
    documentos,
    fases,
    legalidadItems,
  };
}
