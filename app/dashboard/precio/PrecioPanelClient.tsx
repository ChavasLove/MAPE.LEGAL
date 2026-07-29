'use client';

// Client island del panel de fijación diaria del Precio de Referencia.
//
// Flujo en dos pasos (la fijación es un acto con consecuencias comerciales,
// nunca un solo clic): (1) capturar insumos y "Calcular y revisar" — muestra
// la previsualización del precio resultante en L por gramo de oro fino con
// los tres insumos; (2) "Confirmar fijación" — envía a POST /api/precio,
// donde el servidor recalcula (nunca acepta el precio del cliente) y aplica
// la idempotencia por fecha. Si ya existe vigente para hoy, el campo
// motivo_reemplazo es obligatorio antes de habilitar la confirmación.
//
// Sin botón de eliminar. Sin excepciones. La cadena de reemplazos
// (reemplaza_a + motivo) es evidencia de auditoría y se muestra completa.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  calcularPrecioLempirasGramoFino,
  redondearAlmacenamiento,
  FACTOR_COMERCIALIZACION_VIGENTE,
  VERSION_POLITICA_PRECIOS,
} from '@/lib/precio/calculo';
import type { PrecioReferenciaRow } from '@/lib/precio/consulta';

interface Props {
  hoy: string;
  vigenteHoy: PrecioReferenciaRow | null;
  historial: PrecioReferenciaRow[];
  migracionPendiente: boolean;
}

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink)',
  marginBottom: 6,
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  fontFamily: 'var(--font-mono)',
  fontSize: 14,
  color: 'var(--t1)',
};

const TH: React.CSSProperties = {
  background: 'var(--ink)',
  color: '#fff',
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--t1)',
  background: 'var(--bg)',
  fontFamily: 'var(--font-mono)',
  whiteSpace: 'nowrap',
};

function fmtL(n: number, decimals = 2): string {
  return n.toLocaleString('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function shortId(id: string | null): string {
  return id ? `${id.slice(0, 8)}…` : '—';
}

function EstadoPill({ estado }: { estado: PrecioReferenciaRow['estado'] }) {
  const vigente = estado === 'vigente';
  const token = vigente ? 'var(--green)' : 'var(--slate)';
  return (
    <span
      style={{
        display: 'inline-block',
        borderRadius: 9999,
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        color: token,
        background: `color-mix(in oklch, ${token} 14%, white)`,
        border: `1px solid color-mix(in oklch, ${token} 30%, white)`,
      }}
    >
      {vigente ? 'Vigente' : 'Reemplazado'}
    </span>
  );
}

export default function PrecioPanelClient({ hoy, vigenteHoy, historial, migracionPendiente }: Props) {
  const router = useRouter();

  const [lbma, setLbma] = useState('');
  const [tc, setTc] = useState('');
  const [factor, setFactor] = useState(String(FACTOR_COMERCIALIZACION_VIGENTE));
  const [motivo, setMotivo] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  const lbmaNum = Number(lbma);
  const tcNum = Number(tc);
  const factorNum = Number(factor);

  const insumosValidos =
    Number.isFinite(lbmaNum) && lbmaNum > 0 &&
    Number.isFinite(tcNum) && tcNum > 0 &&
    Number.isFinite(factorNum) && factorNum > 0 && factorNum <= 1;

  const previsualizacion = useMemo(() => {
    if (!insumosValidos) return null;
    return redondearAlmacenamiento(calcularPrecioLempirasGramoFino(lbmaNum, tcNum, factorNum));
  }, [insumosValidos, lbmaNum, tcNum, factorNum]);

  const requiereMotivo = vigenteHoy !== null;
  const motivoOk = !requiereMotivo || motivo.trim().length > 0;

  // Cualquier edición de insumos invalida la revisión: obliga a volver a
  // previsualizar antes de poder confirmar.
  const editar = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setRevisando(false);
    setStatus(null);
  };

  const confirmar = async () => {
    if (enviando || !revisando || !insumosValidos || !motivoOk) return;
    setEnviando(true);
    setStatus(null);
    try {
      const res = await fetch('/api/precio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia_lbma_usd_oz: lbmaNum,
          tipo_cambio_bch: tcNum,
          factor_comercializacion: factorNum,
          ...(motivo.trim() ? { motivo_reemplazo: motivo.trim() } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string; precio_lempiras_gramo_fino?: number };
      if (!res.ok) {
        setStatus({ kind: 'error', msg: json.error ?? `Error ${res.status}` });
        return;
      }
      setStatus({
        kind: 'ok',
        msg: `Precio fijado: L ${fmtL(json.precio_lempiras_gramo_fino ?? 0)} por gramo de oro fino (${hoy}).`,
      });
      setRevisando(false);
      setMotivo('');
      router.refresh();
    } catch {
      setStatus({ kind: 'error', msg: 'No se pudo enviar la fijación. Intente de nuevo.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          Precio de Referencia — fijación diaria
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
          Fecha de fijación: <span style={{ fontFamily: 'var(--font-mono)' }}>{hoy}</span> (hora de
          Honduras). El precio se publica en /precio y no varía durante el día. Las correcciones se
          registran por reemplazo con motivo — los registros no se eliminan.
        </p>
      </div>

      {migracionPendiente && (
        <div
          role="alert"
          style={{
            background: 'color-mix(in oklch, var(--amber) 14%, white)',
            border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
            borderRadius: 12,
            padding: 16,
            fontSize: 14,
            color: 'var(--amber)',
            fontWeight: 600,
          }}
        >
          La tabla precios_referencia no existe todavía. Aplicar la migración
          030_precios_referencia.sql en Supabase Studio → SQL Editor.
        </div>
      )}

      {/* Registro vigente de hoy (si existe) */}
      {vigenteHoy && (
        <div
          style={{
            ...CARD,
            background: 'color-mix(in oklch, var(--moss) 7%, white)',
            border: '1px solid color-mix(in oklch, var(--moss) 28%, white)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--moss)',
              marginBottom: 8,
            }}
          >
            Ya existe un precio vigente para hoy
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 32,
                color: 'var(--earth)',
              }}
            >
              L {fmtL(vigenteHoy.precio_lempiras_gramo_fino)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--slate)' }}>
              por gramo de oro fino
            </span>
          </div>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
            LBMA USD {fmtL(vigenteHoy.referencia_lbma_usd_oz)} / oz · TC L{' '}
            {fmtL(vigenteHoy.tipo_cambio_bch, 4)} · Factor {fmtL(vigenteHoy.factor_comercializacion, 4)} ·
            Política v{vigenteHoy.version_politica}. Una nueva fijación de hoy lo reemplazará y
            exige motivo.
          </p>
        </div>
      )}

      {/* Paso 1 — insumos */}
      <div style={CARD}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
          Paso 1 — Insumos del cálculo
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label htmlFor="pr-lbma" style={LABEL}>Referencia LBMA (USD por onza troy)</label>
            <input
              id="pr-lbma"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={lbma}
              onChange={(e) => editar(setLbma)(e.target.value)}
              style={INPUT}
              placeholder="3350.00"
            />
          </div>
          <div>
            <label htmlFor="pr-tc" style={LABEL}>Tipo de cambio BCH (L por USD)</label>
            <input
              id="pr-tc"
              type="number"
              min="0"
              step="0.0001"
              inputMode="decimal"
              value={tc}
              onChange={(e) => editar(setTc)(e.target.value)}
              style={INPUT}
              placeholder="26.5000"
            />
          </div>
          <div>
            <label htmlFor="pr-factor" style={LABEL}>Factor de comercialización (0–1)</label>
            <input
              id="pr-factor"
              type="number"
              min="0"
              max="1"
              step="0.0001"
              inputMode="decimal"
              value={factor}
              onChange={(e) => editar(setFactor)(e.target.value)}
              style={INPUT}
            />
            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--t3)' }}>
              Política de Precios v{VERSION_POLITICA_PRECIOS}: {FACTOR_COMERCIALIZACION_VIGENTE}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => insumosValidos && setRevisando(true)}
          disabled={!insumosValidos || revisando}
          style={{
            marginTop: 18,
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--ink)',
            color: '#fff',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            cursor: !insumosValidos || revisando ? 'not-allowed' : 'pointer',
            opacity: !insumosValidos || revisando ? 0.5 : 1,
          }}
        >
          Calcular y revisar
        </button>
      </div>

      {/* Paso 2 — previsualización + confirmación */}
      {revisando && previsualizacion !== null && (
        <div
          style={{
            ...CARD,
            border: '1px solid var(--border-2)',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
            Paso 2 — Revisar y confirmar
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(30px, 5vw, 44px)',
                lineHeight: 1,
                color: 'var(--earth)',
              }}
            >
              L {fmtL(previsualizacion)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--slate)' }}>
              por gramo de oro fino
            </span>
          </div>
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
            ( {fmtL(lbmaNum)} USD/oz ÷ 31.1035 ) × {fmtL(factorNum, 4)} × L {fmtL(tcNum, 4)}.
            El servidor recalcula este valor al confirmar — la previsualización es informativa.
          </p>

          {requiereMotivo && (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="pr-motivo" style={LABEL}>
                Motivo del reemplazo (obligatorio — ya existe un precio vigente para hoy)
              </label>
              <textarea
                id="pr-motivo"
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setStatus(null);
                }}
                rows={2}
                maxLength={500}
                style={{ ...INPUT, fontFamily: 'var(--font-body)', resize: 'vertical' }}
                placeholder="Ej.: corrección de la referencia LBMA por error de captura"
              />
            </div>
          )}

          <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={confirmar}
              disabled={enviando || !motivoOk}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--moss)',
                color: '#fff',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                cursor: enviando || !motivoOk ? 'not-allowed' : 'pointer',
                opacity: enviando || !motivoOk ? 0.5 : 1,
              }}
            >
              {enviando
                ? 'Enviando…'
                : requiereMotivo
                  ? 'Confirmar reemplazo del precio de hoy'
                  : 'Confirmar fijación'}
            </button>
            <button
              type="button"
              onClick={() => setRevisando(false)}
              disabled={enviando}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--t2)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                cursor: enviando ? 'not-allowed' : 'pointer',
              }}
            >
              Volver a editar
            </button>
          </div>
        </div>
      )}

      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          style={{
            borderRadius: 12,
            padding: 16,
            fontSize: 14,
            fontWeight: 600,
            color: status.kind === 'error' ? 'var(--red)' : 'var(--green)',
            background: `color-mix(in oklch, ${status.kind === 'error' ? 'var(--red)' : 'var(--green)'} 10%, white)`,
            border: `1px solid color-mix(in oklch, ${status.kind === 'error' ? 'var(--red)' : 'var(--green)'} 28%, white)`,
          }}
        >
          {status.msg}
        </div>
      )}

      {/* Histórico completo — evidencia de auditoría, incluye reemplazados */}
      <div style={CARD}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
          Histórico (incluye reemplazos)
        </h2>
        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 14, lineHeight: 1.6 }}>
          La cadena de reemplazos (columna «Reemplaza a») es evidencia de auditoría. No existe
          acción de borrado.
        </p>
        {historial.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>Sin registros todavía.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  {['Fecha', 'Estado', 'L/g oro fino', 'LBMA USD/oz', 'TC BCH', 'Factor', 'Política', 'Registro', 'Reemplaza a', 'Motivo'].map((th) => (
                    <th key={th} scope="col" style={TH}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={TD}>{r.fecha}</td>
                    <td style={{ ...TD, fontFamily: 'var(--font-body)' }}>
                      <EstadoPill estado={r.estado} />
                    </td>
                    <td style={TD}>L {fmtL(r.precio_lempiras_gramo_fino)}</td>
                    <td style={TD}>{fmtL(r.referencia_lbma_usd_oz)}</td>
                    <td style={TD}>{fmtL(r.tipo_cambio_bch, 4)}</td>
                    <td style={TD}>{fmtL(r.factor_comercializacion, 4)}</td>
                    <td style={TD}>v{r.version_politica}</td>
                    <td style={{ ...TD, color: 'var(--t3)' }} title={r.id}>{shortId(r.id)}</td>
                    <td style={{ ...TD, color: 'var(--t3)' }} title={r.reemplaza_a ?? undefined}>
                      {shortId(r.reemplaza_a)}
                    </td>
                    <td style={{ ...TD, fontFamily: 'var(--font-body)', whiteSpace: 'normal', minWidth: 180, color: 'var(--t2)' }}>
                      {r.motivo_reemplazo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
