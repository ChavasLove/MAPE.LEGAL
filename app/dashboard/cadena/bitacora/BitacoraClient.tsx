'use client';

// Client island de /dashboard/cadena/bitacora — tabla de accesos con filtro
// por tipo de recurso y exportación JSON/CSV (la descarga la sirve la API y
// deja a su vez una fila de exportación en esta misma bitácora).

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import type { BitacoraAcceso } from '@/lib/cadena/types';
import {
  CARD, EYEBROW, INPUT, MONO, TH, TD, TD_WRAP, BTN_GHOST, BTN_PRIMARY,
  ErrorBox, MigracionPendiente, TableWrap, EmptyRow, Pill,
  apiFetch, ApiError, fmtDateTime, shortId, ROL_LABEL_CADENA,
} from '@/components/cadena/shared';

const RECURSOS_SUGERIDOS = ['lote', 'lote_evento', 'pago_lote', 'fuente', 'consentimiento', 'expediente', 'exportacion'];
const LIMITES = [50, 100, 200, 500];

export default function BitacoraClient() {
  const [rows, setRows] = useState<BitacoraAcceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);
  const [recurso, setRecurso] = useState('');
  const [limit, setLimit] = useState(100);

  const load = useCallback((signal?: AbortSignal) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (recurso.trim()) qs.set('recurso_tipo', recurso.trim());
    return apiFetch<{ accesos: BitacoraAcceso[] }>(`/api/cadena/bitacora?${qs.toString()}`, { signal })
      .then((d) => {
        setRows(Array.isArray(d.accesos) ? d.accesos : []);
        setLoadError(null); setMigracionPendiente(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.migracionPendiente) { setMigracionPendiente(true); return; }
        setLoadError((e as Error).message || 'No se pudo cargar la bitácora.');
      })
      .finally(() => setLoading(false));
  }, [limit, recurso]);

  // El montaje parte con loading=true; los cambios de filtro encienden el
  // loading en el handler (no en el cuerpo del efecto) antes de recargar.
  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const refresh = () => { setLoading(true); void load(); };

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={EYEBROW}>Cadena de custodia · Bitácora</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)' }}>Bitácora de accesos</h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, maxWidth: 760 }}>
            Registro append-only de quién leyó o exportó qué recurso y cuándo. No se reescribe ni se borra: una
            revocación de consentimiento cierra el acceso hacia adelante y deja intactas las lecturas anteriores.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={refresh} style={BTN_GHOST} disabled={loading} aria-label="Recargar">
            <RefreshCw size={16} strokeWidth={1.5} /> Recargar
          </button>
        </div>
      </header>

      {migracionPendiente && <MigracionPendiente />}
      <ErrorBox error={loadError} />

      <section id="exportar" style={{ ...CARD, borderColor: 'var(--border-2)' }}>
        <div style={EYEBROW}>Exportación</div>
        <h2 style={{ fontSize: 20, margin: '6px 0 4px', color: 'var(--ink)' }}>Exportar el registro</h2>
        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 12 }}>
          Descarga el conjunto completo del estándar (lotes, eventos encadenados, fuentes, consentimientos y bitácora)
          para verificación externa. Cada exportación queda registrada en la bitácora.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/api/cadena/exportar?formato=json" download style={{ ...BTN_PRIMARY, textDecoration: 'none' }}>
            <Download size={16} strokeWidth={1.5} /> Exportar JSON
          </a>
          <a href="/api/cadena/exportar?formato=csv" download style={{ ...BTN_GHOST, textDecoration: 'none' }}>
            <Download size={16} strokeWidth={1.5} /> Exportar CSV
          </a>
        </div>
      </section>

      <section style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={EYEBROW}>{loading ? 'Cargando…' : `${rows.length} accesos`}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)' }}>
              Recurso
              <input list="recursos-bitacora" style={{ ...INPUT, width: 200, padding: '6px 10px' }} value={recurso}
                onChange={(e) => { setLoading(true); setRecurso(e.target.value); }} placeholder="Todos" />
              <datalist id="recursos-bitacora">
                {RECURSOS_SUGERIDOS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)' }}>
              Límite
              <select style={{ ...INPUT, width: 'auto', padding: '6px 10px' }} value={limit} onChange={(e) => { setLoading(true); setLimit(Number(e.target.value)); }}>
                {LIMITES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" style={TH}>Fecha</th>
              <th scope="col" style={TH}>Usuario</th>
              <th scope="col" style={TH}>Rol</th>
              <th scope="col" style={TH}>Organización</th>
              <th scope="col" style={TH}>Acción</th>
              <th scope="col" style={TH}>Recurso</th>
              <th scope="col" style={TH}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <EmptyRow cols={7}>{migracionPendiente ? 'Pendiente de migración.' : 'Sin accesos registrados para el filtro.'}</EmptyRow>}
            {rows.map((a) => (
              <tr key={a.id}>
                <td style={TD}>{fmtDateTime(a.created_at)}</td>
                <td style={{ ...TD, ...MONO }} title={a.user_id ?? undefined}>{shortId(a.user_id)}</td>
                <td style={TD}>{ROL_LABEL_CADENA[a.rol ?? ''] ?? a.rol ?? '—'}</td>
                <td style={{ ...TD, ...MONO }} title={a.organizacion_id ?? undefined}>{shortId(a.organizacion_id)}</td>
                <td style={TD}>{a.accion === 'exportacion' ? <Pill token="var(--amber)">Exportación</Pill> : <Pill token="var(--blue)">Lectura</Pill>}</td>
                <td style={{ ...TD, ...MONO }}>{a.recurso_tipo}{a.recurso_id ? ` · ${shortId(a.recurso_id)}` : ''}</td>
                <td style={{ ...TD_WRAP, ...MONO, color: 'var(--t3)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.detalle && Object.keys(a.detalle).length ? JSON.stringify(a.detalle) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </section>
    </div>
  );
}
