'use client';

// components/cadena/shared.tsx — piezas comunes de la UI privada del estándar
// de debida diligencia (Etapa 2). Tokens del Color Manual v1.0 únicamente
// (cero hex nuevos). Ninguna organización se nombra aquí: los nombres vienen
// de la API (`organizaciones.nombre`) y los roles se etiquetan de forma
// genérica. La UI nunca habla de "compra": los pagos son "pagos del lote".

import type React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  type EstadoLote,
  type TipoEvento,
  type TipoAlerta,
  type MedioPago,
  type EstadoClpi,
  type AlcanceConsentimiento,
  type TipoOrganizacion,
  type Organizacion,
} from '@/lib/cadena/types';

/* ── Estilos (tokens) ─────────────────────────────────────────────────── */

export const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
};
export const LABEL: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 };
export const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--t1)',
};
export const MONO_INPUT: React.CSSProperties = { ...INPUT, fontFamily: 'var(--font-mono)' };
export const HELP: React.CSSProperties = { fontSize: 12, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 };
export const TH: React.CSSProperties = {
  background: 'var(--ink)', color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
};
export const TD: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13, color: 'var(--t1)', background: 'var(--bg)',
  whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
};
export const TD_WRAP: React.CSSProperties = { ...TD, whiteSpace: 'normal', minWidth: 160 };
export const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12 };
export const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'var(--slate)',
};
export const BTN_PRIMARY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8,
  background: 'var(--ink)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
};
export const BTN_MOSS: React.CSSProperties = { ...BTN_PRIMARY, background: 'var(--moss)' };
export const BTN_GHOST: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8,
  background: 'transparent', color: 'var(--t2)', fontSize: 14, fontWeight: 500,
  border: '1px solid var(--border)', cursor: 'pointer',
};
export const BTN_SMALL: React.CSSProperties = { ...BTN_GHOST, padding: '6px 10px', fontSize: 13 };

/* ── Etiquetas genéricas (nunca nombres de empresas) ──────────────────── */

export const ROL_LABEL_CADENA: Record<string, string> = {
  admin: 'Administrador',
  abogado: 'Abogado CHT',
  tecnico_ambiental: 'Técnico Ambiental',
  cliente: 'Productor',
  comercializador: 'Comercializador',
  planta: 'Planta de beneficio participante',
  auditor: 'Auditor externo',
};

export const TIPO_ORG_LABEL: Record<TipoOrganizacion, string> = {
  comercializador: 'Comercializador',
  planta: 'Planta de beneficio participante',
  auditor: 'Auditor externo',
};

export const ESTADO_LOTE_LABEL: Record<EstadoLote, string> = {
  abierto: 'Abierto',
  bloqueado: 'Bloqueado',
  conciliado: 'Conciliado',
  cerrado: 'Cerrado',
};

export const ESTADO_LOTE_TOKEN: Record<EstadoLote, string> = {
  abierto: 'var(--blue)',
  bloqueado: 'var(--red)',
  conciliado: 'var(--green)',
  cerrado: 'var(--slate)',
};

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  origen_mina: 'Origen en mina',
  acopio: 'Acopio',
  transporte: 'Transporte',
  recepcion_planta: 'Recepción en planta',
  laboratorio: 'Laboratorio',
  fundicion: 'Fundición',
  refinado: 'Refinado',
  pago: 'Pago del lote',
  correccion: 'Corrección',
  nota: 'Nota',
};

export const TIPO_ALERTA_LABEL: Record<TipoAlerta, string> = {
  conciliacion_peso: 'Diferencia de peso entre puntos',
  umbral_no_configurado: 'Umbral de conciliación no configurado',
  pago_invalido: 'Pago inválido (lote bloqueado)',
  fuente_no_elegible: 'Fuente no elegible',
  mercurio: 'Sin declaración de mercurio cero',
  clpi: 'Consulta previa pendiente',
  fundicion_rechazada: 'Fundición rechazada',
};

export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  transferencia: 'Transferencia bancaria',
  deposito: 'Depósito bancario',
  cheque_bancario: 'Cheque bancario',
};

export const CLPI_LABEL: Record<EstadoClpi, string> = {
  no_aplica: 'No aplica',
  documentado: 'Documentado (consta acta)',
  pendiente: 'Pendiente',
};

export const ALCANCE_LABEL: Record<AlcanceConsentimiento, string> = {
  expediente: 'Expediente',
  documentos: 'Documentos',
  lotes: 'Lotes',
};

export const MOTIVO_VERIFICACION_LABEL: Record<string, string> = {
  secuencia_no_consecutiva: 'secuencia no consecutiva',
  hash_previo_no_coincide: 'el hash previo no coincide con el eslabón anterior',
  hash_alterado: 'el hash recalculado no coincide con el almacenado',
};

export const MOTIVO_ELEGIBILIDAD_LABEL: Record<string, string> = {
  permiso_municipal_no_vigente: 'Permiso municipal no vigente',
  fuera_de_area_inhgeomin: 'Fuera de un área delimitada por INHGEOMIN',
  clpi_pendiente: 'Consulta previa exigible sin documento',
  sin_declaracion_mercurio_cero: 'Sin declaración de mercurio cero (no bloquea)',
};

export const MOTIVO_PAGO_LABEL: Record<string, string> = {
  efectivo_prohibido: 'El efectivo no es un medio admitido',
  sin_referencia_bancaria: 'Falta la referencia bancaria',
  medio_no_admitido: 'Medio de pago no admitido',
};

/* ── Formato ──────────────────────────────────────────────────────────── */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-HN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa', hour12: false,
  });
}

export function fmtNum(v: string | number | null | undefined, decimals = 3): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('es-HN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtLps(v: string | number | null | undefined): string {
  const s = fmtNum(v, 2);
  return s === '—' ? s : `L ${s}`;
}

export function shortHash(h: string | null | undefined, head = 8, tail = 6): string {
  if (!h) return '—';
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function orgNombre(orgs: ReadonlyArray<Organizacion>, id: string | null | undefined): string {
  if (!id) return '—';
  const o = orgs.find((x) => x.id === id);
  return o ? o.nombre : shortId(id);
}

/* ── Fetch con manejo de "pendiente de migración" ─────────────────────── */

export class ApiError extends Error {
  status: number;
  code: string | null;
  payload: Record<string, unknown>;
  constructor(status: number, code: string | null, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
  get migracionPendiente(): boolean {
    return this.status === 503 && this.code === 'MIGRATION_PENDING';
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  if (!res.ok) {
    const code = typeof json.error === 'string' ? json.error : null;
    const motivo = typeof json.motivo === 'string' ? ` — ${json.motivo}` : '';
    const msg =
      res.status === 503 && code === 'MIGRATION_PENDING'
        ? 'Pendiente de migración: la base de datos aún no tiene las tablas del estándar (migración 043).'
        : res.status === 401
        ? 'Sesión no válida. Vuelva a iniciar sesión.'
        : res.status === 403
        ? `Acceso no autorizado${motivo}`
        : `${code ?? `HTTP ${res.status}`}${motivo}`;
    throw new ApiError(res.status, code, msg, json);
  }
  return json as T;
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

/* ── Piezas visuales ──────────────────────────────────────────────────── */

export function Pill({ token, children }: { token: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600,
      fontFamily: 'var(--font-body)', color: token, whiteSpace: 'nowrap',
      background: `color-mix(in oklch, ${token} 14%, white)`,
      border: `1px solid color-mix(in oklch, ${token} 30%, white)`,
    }}>
      {children}
    </span>
  );
}

export function EstadoLotePill({ estado }: { estado: EstadoLote | string }) {
  const e = (estado in ESTADO_LOTE_TOKEN ? estado : 'cerrado') as EstadoLote;
  return <Pill token={ESTADO_LOTE_TOKEN[e]}>{ESTADO_LOTE_LABEL[e] ?? estado}</Pill>;
}

export function Notice({
  tone, children, role = 'status',
}: { tone: 'amber' | 'red' | 'green' | 'blue'; children: React.ReactNode; role?: 'status' | 'alert' }) {
  const token = `var(--${tone})`;
  return (
    <div
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
      style={{
        background: `color-mix(in oklch, ${token} 10%, white)`,
        border: `1px solid color-mix(in oklch, ${token} 30%, white)`,
        borderRadius: 12, padding: 14, fontSize: 14, color: 'var(--t1)', lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

export function MigracionPendiente() {
  return (
    <Notice tone="amber" role="alert">
      <strong>Pendiente de migración.</strong> Las tablas del estándar privado de debida diligencia (migración
      043) no existen todavía en la base de datos. Esta pantalla quedará operativa cuando un humano aplique la
      migración en Supabase Studio tras la aprobación correspondiente.
    </Notice>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <Notice tone="red" role="alert">{error}</Notice>;
}

export interface VerificacionCadena {
  ok: boolean;
  total: number;
  primeraRotura: number | null;
  motivo: string | null;
}

export function VerificacionBadge({ v }: { v: VerificacionCadena | null | undefined }) {
  if (!v) return null;
  const token = v.ok ? 'var(--green)' : 'var(--red)';
  const Icon = v.ok ? CheckCircle2 : AlertTriangle;
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8,
        color: token, fontSize: 13, fontWeight: 600,
        background: `color-mix(in oklch, ${token} 10%, white)`,
        border: `1px solid color-mix(in oklch, ${token} 30%, white)`,
      }}
    >
      <Icon size={16} strokeWidth={1.5} />
      {v.ok
        ? `Cadena de hash verificada · ${v.total} ${v.total === 1 ? 'evento' : 'eventos'}`
        : `Rotura en el eslabón ${v.primeraRotura ?? '?'} de ${v.total}: ${MOTIVO_VERIFICACION_LABEL[v.motivo ?? ''] ?? v.motivo ?? 'motivo no informado'}`}
    </div>
  );
}

export function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
      {help && <p style={HELP}>{help}</p>}
    </div>
  );
}

export function Section({ eyebrow, title, lead, actions, children }: {
  eyebrow?: string; title: string; lead?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section style={CARD}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          {eyebrow && <div style={EYEBROW}>{eyebrow}</div>}
          <h2 style={{ fontSize: 20, margin: '6px 0 4px', color: 'var(--ink)' }}>{title}</h2>
          {lead && <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, maxWidth: 760 }}>{lead}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} style={{ ...TD, whiteSpace: 'normal', textAlign: 'center', color: 'var(--t3)', padding: 24 }}>
        {children}
      </td>
    </tr>
  );
}

export function Forbidden({ detalle }: { detalle: string }) {
  return (
    <div
      role="alert"
      style={{
        background: 'color-mix(in oklch, var(--red) 8%, white)',
        border: '1px solid color-mix(in oklch, var(--red) 28%, white)',
        borderRadius: 12, padding: 24, maxWidth: 560,
      }}
    >
      <div style={{ ...EYEBROW, color: 'var(--red)', letterSpacing: '0.14em', fontSize: 12, marginBottom: 8 }}>
        403 — Acceso restringido
      </div>
      <p style={{ fontSize: 15, color: 'var(--t1)', lineHeight: 1.6 }}>{detalle}</p>
    </div>
  );
}
