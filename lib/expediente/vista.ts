// lib/expediente/vista.ts — vista de SOLO LECTURA del expediente de un titular
// (minero/productor): perfil, minas, licencias, trámites y documentos. PURO.
//
// DOS GARANTÍAS, ambas probadas:
//   1. Lista cerrada de campos: lo que no está aquí no sale, aunque la fila
//      tenga más columnas (llaves institucionales internas, notas, rutas de
//      almacenamiento, identidad).
//   2. No se mezclan expedientes: toda fila se filtra por el titular pedido;
//      una fila de otro titular se descarta y se cuenta en `descartados`.

export interface FilaPerfil { id: string; cliente_id: string | null; estado: string; version: number; updated_at?: string | null }
export interface FilaMina { id: string; cliente_id: string | null; nombre?: string | null; codigo?: string | null; municipio?: string | null; departamento?: string | null; tipo_mineral?: string | null; estado?: string | null; [k: string]: unknown }
export interface FilaLicencia { id: string; mina_id: string; tipo: string; numero?: string | null; estado: string; vigente_desde?: string | null; vigente_hasta?: string | null; [k: string]: unknown }
export interface FilaExpediente { id: string; cliente_id: string | null; numero_expediente?: string | null; tipo?: string | null; estado?: string | null; fase_numero?: number | null; paso?: string | number | null; inicio?: string | null; cierre_estimado?: string | null; [k: string]: unknown }
export interface FilaDocumento { id: string; expediente_id: string | null; nombre?: string | null; tipo?: string | null; estado?: string | null; created_at?: string | null; [k: string]: unknown }
export interface FilaRespaldo { documento_id: string; version: number; sha256: string; vigente: boolean }

export interface VistaExpediente {
  titular_id: string;
  perfil: { estado: string; version: number; actualizado: string | null } | null;
  minas: Array<{
    id: string; nombre: string | null; codigo: string | null; municipio: string | null; departamento: string | null;
    tipo_mineral: string | null; estado: string | null;
    licencias: Array<{ tipo: string; numero: string | null; estado: string; vigente_desde: string | null; vigente_hasta: string | null }>;
  }>;
  tramites: Array<{
    id: string; numero: string | null; tipo: string | null; estado: string | null; fase: number | null; paso: string | null;
    inicio: string | null; cierre_estimado: string | null;
    documentos: Array<{ id: string; nombre: string | null; tipo: string | null; estado: string | null; fecha: string | null; respaldo: RespaldoVista }>;
  }>;
  /** Filas recibidas que no pertenecían al titular (defensa: debería ser 0). */
  descartados: number;
  solo_lectura: true;
}

export type RespaldoVista =
  | { estado: 'respaldado'; version: number; huella: string }
  | { estado: 'en_implementacion' };

/** Texto que ve el titular cuando el documento aún no tiene respaldo digital. */
export const RESPALDO_EN_IMPLEMENTACION = 'Respaldo en implementación';

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function armarVistaExpediente(input: {
  titularId: string;
  perfil: FilaPerfil | null;
  minas: ReadonlyArray<FilaMina>;
  licencias: ReadonlyArray<FilaLicencia>;
  expedientes: ReadonlyArray<FilaExpediente>;
  documentos: ReadonlyArray<FilaDocumento>;
  respaldos?: ReadonlyArray<FilaRespaldo>;
}): VistaExpediente {
  const { titularId } = input;
  let descartados = 0;

  const perfil = input.perfil && input.perfil.cliente_id === titularId ? input.perfil : null;
  if (input.perfil && !perfil) descartados++;

  const minas = input.minas.filter((m) => {
    const propia = m.cliente_id === titularId;
    if (!propia) descartados++;
    return propia;
  });
  const minaIds = new Set(minas.map((m) => m.id));
  const licencias = input.licencias.filter((l) => {
    const propia = minaIds.has(l.mina_id);
    if (!propia) descartados++;
    return propia;
  });

  const expedientes = input.expedientes.filter((e) => {
    const propio = e.cliente_id === titularId;
    if (!propio) descartados++;
    return propio;
  });
  const expIds = new Set(expedientes.map((e) => e.id));
  const documentos = input.documentos.filter((d) => {
    const propio = d.expediente_id !== null && expIds.has(d.expediente_id);
    if (!propio) descartados++;
    return propio;
  });

  const respaldoPorDoc = new Map<string, FilaRespaldo>();
  for (const r of input.respaldos ?? []) {
    if (!r.vigente) continue;
    const previo = respaldoPorDoc.get(r.documento_id);
    if (!previo || r.version > previo.version) respaldoPorDoc.set(r.documento_id, r);
  }

  return {
    titular_id: titularId,
    perfil: perfil ? { estado: perfil.estado, version: perfil.version, actualizado: texto(perfil.updated_at) } : null,
    minas: minas.map((m) => ({
      id: m.id,
      nombre: texto(m.nombre),
      codigo: texto(m.codigo),
      municipio: texto(m.municipio),
      departamento: texto(m.departamento),
      tipo_mineral: texto(m.tipo_mineral),
      estado: texto(m.estado),
      licencias: licencias.filter((l) => l.mina_id === m.id).map((l) => ({
        tipo: l.tipo,
        numero: texto(l.numero),
        estado: l.estado,
        vigente_desde: texto(l.vigente_desde),
        vigente_hasta: texto(l.vigente_hasta),
      })),
    })),
    tramites: expedientes.map((e) => ({
      id: e.id,
      numero: texto(e.numero_expediente),
      tipo: texto(e.tipo),
      estado: texto(e.estado),
      fase: typeof e.fase_numero === 'number' ? e.fase_numero : null,
      paso: e.paso === null || e.paso === undefined ? null : String(e.paso),
      inicio: texto(e.inicio),
      cierre_estimado: texto(e.cierre_estimado),
      documentos: documentos.filter((d) => d.expediente_id === e.id).map((d) => {
        const r = respaldoPorDoc.get(d.id);
        return {
          id: d.id,
          nombre: texto(d.nombre),
          tipo: texto(d.tipo),
          estado: texto(d.estado),
          fecha: texto(d.created_at),
          respaldo: r ? { estado: 'respaldado', version: r.version, huella: r.sha256 } : { estado: 'en_implementacion' },
        };
      }),
    })),
    descartados,
    solo_lectura: true,
  };
}
