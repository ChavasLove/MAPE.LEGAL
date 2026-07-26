'use client';

// Admin editor for Honduras fuel prices (precios_combustibles). Diesel and the
// other SEN-set fuels are edited here; the gold/silver/FX metals are live feeds
// (precios_diarios) and shown read-only. Update the fuel prices every Monday
// when the new SEN structure takes effect.

import { useMemo, useState } from 'react';
import {
  COMBUSTIBLE_LABELS,
  TIPOS_COMBUSTIBLE,
  type Combustible,
  type TipoCombustible,
} from '@/lib/types/combustible';

export interface MetalsSnapshot {
  fecha: string | null;
  oro: number | null;
  plata: number | null;
  usd_hnl: number | null;
  fuente: string | null;
  fetched_at: string | null;
}

interface RowState {
  precio_hnl: string;
  unidad: string;
  zona: string;
  vigente_desde: string;
  fuente: string;
  activo: boolean;
  exists: boolean;
}

interface Props {
  initialCombustibles: Combustible[];
  metals: MetalsSnapshot | null;
}

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
};

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--slate)',
  marginBottom: 6,
  display: 'block',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildRows(existing: Combustible[]): Record<TipoCombustible, RowState> {
  const byKey = new Map(existing.map((c) => [c.combustible, c]));
  const out = {} as Record<TipoCombustible, RowState>;
  for (const tipo of TIPOS_COMBUSTIBLE) {
    const row = byKey.get(tipo);
    out[tipo] = {
      precio_hnl: row ? String(row.precio_hnl) : '',
      unidad: row?.unidad ?? 'galón',
      zona: row?.zona ?? 'Tegucigalpa',
      vigente_desde: row?.vigente_desde ?? todayISO(),
      fuente: row?.fuente ?? 'Secretaría de Energía (SEN)',
      activo: row?.activo ?? true,
      exists: Boolean(row),
    };
  }
  return out;
}

function fmt(n: number | null, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-HN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function AdminPreciosClient({ initialCombustibles, metals }: Props) {
  const [rows, setRows] = useState<Record<TipoCombustible, RowState>>(() =>
    buildRows(initialCombustibles),
  );
  const [busy, setBusy] = useState<TipoCombustible | null>(null);
  const [status, setStatus] = useState<{ tipo: TipoCombustible; ok: boolean; msg: string } | null>(
    null,
  );

  const setField = (tipo: TipoCombustible, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } }));
  };

  const save = async (tipo: TipoCombustible) => {
    if (busy) return;
    const row = rows[tipo];
    const precio = Number(row.precio_hnl);
    if (!Number.isFinite(precio) || precio <= 0) {
      setStatus({ tipo, ok: false, msg: 'El precio debe ser un número mayor a 0.' });
      return;
    }
    setBusy(tipo);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/precios/combustibles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          combustible: tipo,
          precio_hnl: precio,
          unidad: row.unidad,
          zona: row.zona,
          vigente_desde: row.vigente_desde,
          fuente: row.fuente,
          activo: row.activo,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setField(tipo, { exists: true });
      setStatus({ tipo, ok: true, msg: 'Guardado.' });
    } catch (e) {
      setStatus({ tipo, ok: false, msg: (e as Error).message || 'No se pudo guardar.' });
    } finally {
      setBusy(null);
    }
  };

  const metalRows = useMemo(
    () => [
      { label: 'Oro internacional', value: metals?.oro != null ? `$${fmt(metals.oro)} USD/oz` : '—' },
      { label: 'Plata internacional', value: metals?.plata != null ? `$${fmt(metals.plata)} USD/oz` : '—' },
      { label: 'Tipo de cambio', value: metals?.usd_hnl != null ? `L ${fmt(metals.usd_hnl, 4)}/USD` : '—' },
    ],
    [metals],
  );

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, color: 'var(--ink)', marginBottom: 6 }}>Precios · Diésel y combustibles</h1>
      <p style={{ color: 'var(--t2)', fontSize: 15, lineHeight: 1.6, marginBottom: 24, maxWidth: 640 }}>
        El diésel y los demás combustibles se administran aquí (precio oficial de la SEN, fijado
        semanalmente). Actualiza el precio cada lunes cuando entra en vigor la nueva estructura. Los
        metales (oro, plata, tipo de cambio) son feeds en vivo y no se editan.
      </p>

      {/* Live metals — read only */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ ...LABEL, marginBottom: 12 }}>Metales en vivo (solo lectura)</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
          }}
        >
          {metalRows.map((m) => (
            <div key={m.label}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--earth)',
                  marginTop: 4,
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t3)' }}>
          {metals?.fecha ? `Registro del ${metals.fecha}` : 'Sin registro de metales cargado.'}
          {metals?.fuente ? ` · Fuente: ${metals.fuente}` : ''}
        </div>
      </div>

      {/* Fuel editors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {TIPOS_COMBUSTIBLE.map((tipo) => {
          const row = rows[tipo];
          const isBusy = busy === tipo;
          const st = status?.tipo === tipo ? status : null;
          return (
            <div key={tipo} style={CARD}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
                  {COMBUSTIBLE_LABELS[tipo]}
                  {!row.exists && (
                    <span
                      style={{
                        marginLeft: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--amber)',
                        background: 'color-mix(in oklch, var(--amber) 14%, white)',
                        border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
                        padding: '2px 8px',
                        borderRadius: 20,
                      }}
                    >
                      Sin registrar
                    </span>
                  )}
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)' }}>
                  <input
                    type="checkbox"
                    checked={row.activo}
                    onChange={(e) => setField(tipo, { activo: e.target.checked })}
                  />
                  Visible al público
                </label>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 14,
                }}
              >
                <div>
                  <label style={LABEL} htmlFor={`precio-${tipo}`}>Precio (L)</label>
                  <input
                    id={`precio-${tipo}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.precio_hnl}
                    onChange={(e) => setField(tipo, { precio_hnl: e.target.value })}
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={LABEL} htmlFor={`unidad-${tipo}`}>Unidad</label>
                  <input
                    id={`unidad-${tipo}`}
                    type="text"
                    value={row.unidad}
                    onChange={(e) => setField(tipo, { unidad: e.target.value })}
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={LABEL} htmlFor={`vigente-${tipo}`}>Vigente desde</label>
                  <input
                    id={`vigente-${tipo}`}
                    type="date"
                    value={row.vigente_desde}
                    onChange={(e) => setField(tipo, { vigente_desde: e.target.value })}
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={LABEL} htmlFor={`zona-${tipo}`}>Zona</label>
                  <input
                    id={`zona-${tipo}`}
                    type="text"
                    value={row.zona}
                    onChange={(e) => setField(tipo, { zona: e.target.value })}
                    style={INPUT}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={LABEL} htmlFor={`fuente-${tipo}`}>Fuente</label>
                <input
                  id={`fuente-${tipo}`}
                  type="text"
                  value={row.fuente}
                  onChange={(e) => setField(tipo, { fuente: e.target.value })}
                  style={INPUT}
                />
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => save(tipo)}
                  disabled={isBusy}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    background: 'var(--ink)',
                    color: '#fff',
                    border: 'none',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  {isBusy ? 'Guardando…' : 'Guardar'}
                </button>
                {st && (
                  <span
                    role={st.ok ? 'status' : 'alert'}
                    aria-live="polite"
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: st.ok ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {st.msg}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
