'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Mountain, Search, RefreshCw, ExternalLink } from 'lucide-react';

type Categoria      = 'explotacion_otorgada' | 'exploracion_otorgada' | 'solicitud_pendiente';
type Clasificacion  = 'Metálica' | 'No Metálica' | 'Pequeña Minería Metálica' | 'Suspenso';

interface Concesion {
  id:                 string;
  numero_registro:    number;
  codigo:             string | null;
  nombre_zona:        string;
  fecha_solicitud:    string | null;
  tipo_expediente:    string;
  solicitante:        string;
  estado_expediente:  string;
  clasificacion:      Clasificacion;
  categoria:          Categoria;
  fuente:             string;
  fuente_documento:   string | null;
  fuente_pagina:      number | null;
  notas:              string | null;
}

interface Stats {
  total:                  number;
  explotacion_otorgada:   number;
  exploracion_otorgada:   number;
  solicitud_pendiente:    number;
  metalicas:              number;
  no_metalicas:           number;
  pequena_mineria:        number;
  ultima_solicitud:       string | null;
}

const CATEGORIA_LABELS: Record<Categoria, string> = {
  explotacion_otorgada: 'Otorgada · Explotación',
  exploracion_otorgada: 'Otorgada · Exploración',
  solicitud_pendiente:  'En Solicitud',
};

const CATEGORIA_TOKEN: Record<Categoria, string> = {
  explotacion_otorgada: 'green',
  exploracion_otorgada: 'blue',
  solicitud_pendiente:  'amber',
};

const CLASIF_TOKEN: Record<Clasificacion, string> = {
  'Metálica':                  'earth',
  'No Metálica':               'slate',
  'Pequeña Minería Metálica':  'moss',
  'Suspenso':                  'red',
};

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

function pillStyle(token: string): React.CSSProperties {
  return {
    background:   `color-mix(in oklch, var(--${token}) 14%, white)`,
    color:        `var(--${token})`,
    borderColor:  `color-mix(in oklch, var(--${token}) 30%, white)`,
    border:       '1px solid',
    padding:      '4px 10px',
    borderRadius: 9999,
    fontSize:     12,
    fontWeight:   600,
    display:      'inline-block',
    whiteSpace:   'nowrap',
  };
}

const inputStyle: React.CSSProperties = {
  background:  'var(--bg)',
  border:      '1px solid var(--border)',
  color:       'var(--t1)',
};

export default function ConcesionesAdminPage() {
  const [rows, setRows]               = useState<Concesion[]>([]);
  const [total, setTotal]             = useState(0);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [categoria, setCategoria]     = useState<Categoria | ''>('');
  const [clasif, setClasif]           = useState<Clasificacion | ''>('');
  const [q, setQ]                     = useState('');
  // Debounced copy of `q` — every keystroke updates `q` (so the input is
  // controlled and snappy) but only `debouncedQ` triggers a refetch. Without
  // this, typing "Iriona" fired 6 sequential 100-row fetches.
  const [debouncedQ, setDebouncedQ]   = useState('');
  const [page, setPage]               = useState(0);
  const PAGE_SIZE = 100;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (categoria)   params.set('categoria', categoria);
      if (clasif)      params.set('clasificacion', clasif);
      if (debouncedQ)  params.set('q', debouncedQ);
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      const res = await fetch(`/api/admin/concesiones?${params.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      const json = await res.json();
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar concesiones');
    } finally {
      setLoading(false);
    }
  }, [categoria, clasif, debouncedQ, page]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/concesiones/stats');
      if (!res.ok) {
        console.warn('[admin/concesiones] stats fetch failed:', res.status);
        return;
      }
      setStats(await res.json());
    } catch (e) {
      console.warn('[admin/concesiones] stats fetch threw:', e);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const headerEyebrow = useMemo(() => (
    <div
      style={{
        color:         'var(--slate)',
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight:    600,
      }}
    >
      Registro INHGEOMIN
    </div>
  ), []);

  return (
    <div style={{ color: 'var(--t1)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {headerEyebrow}
          <h1 className="text-3xl mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            Concesiones Mineras
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
            Base de datos pública de concesiones mineras otorgadas y solicitudes pendientes en Honduras.
            Fuente: INHGEOMIN (transcrito de los listados publicados).
          </p>
        </div>
        <button
          onClick={() => { void load(); void loadStats(); }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          <RefreshCw size={16} strokeWidth={1.5} /> Refrescar
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total" value={stats?.total ?? '—'} token="ink" />
        <StatTile label="Otorgada · Explotación" value={stats?.explotacion_otorgada ?? '—'} token="green" />
        <StatTile label="Otorgada · Exploración" value={stats?.exploracion_otorgada ?? '—'} token="blue" />
        <StatTile label="En Solicitud" value={stats?.solicitud_pendiente ?? '—'} token="amber" />
        <StatTile label="Metálicas" value={stats?.metalicas ?? '—'} token="earth" />
        <StatTile label="No Metálicas" value={stats?.no_metalicas ?? '—'} token="slate" />
        <StatTile label="Pequeña Minería" value={stats?.pequena_mineria ?? '—'} token="moss" />
        <StatTile label="Última solicitud" value={stats?.ultima_solicitud ?? '—'} token="plum" />
      </div>

      {/* Filters */}
      <div
        className="p-4 mb-4 rounded-xl flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}
      >
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>
            Buscar
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Nombre, solicitante, código…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>
            Categoría
          </label>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value as Categoria | ''); setPage(0); }}
            className="px-3 py-2 rounded-lg text-sm"
            style={inputStyle}
          >
            <option value="">Todas</option>
            <option value="explotacion_otorgada">Otorgada · Explotación</option>
            <option value="exploracion_otorgada">Otorgada · Exploración</option>
            <option value="solicitud_pendiente">En Solicitud</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>
            Clasificación
          </label>
          <select
            value={clasif}
            onChange={(e) => { setClasif(e.target.value as Clasificacion | ''); setPage(0); }}
            className="px-3 py-2 rounded-lg text-sm"
            style={inputStyle}
          >
            <option value="">Todas</option>
            <option value="Metálica">Metálica</option>
            <option value="No Metálica">No Metálica</option>
            <option value="Pequeña Minería Metálica">Pequeña Minería Metálica</option>
            <option value="Suspenso">Suspenso</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}
      >
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--ink)', color: '#fff' }}>
            <tr>
              <Th style={{ width: 60 }}>No.</Th>
              <Th style={{ width: 90 }}>Código</Th>
              <Th>Zona</Th>
              <Th>Solicitante</Th>
              <Th style={{ width: 130 }}>Solicitud</Th>
              <Th style={{ width: 180 }}>Tipo</Th>
              <Th style={{ width: 200 }}>Estado</Th>
              <Th style={{ width: 180 }}>Clasificación</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--t3)' }}>Cargando…</td></tr>
            )}
            {error && !loading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--red)' }}>{error}</td></tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--t3)' }}>Sin resultados.</td></tr>
            )}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <Td>{r.numero_registro}</Td>
                <Td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.codigo ?? '—'}</span></Td>
                <Td><div className="font-medium" style={{ color: 'var(--ink)' }}>{r.nombre_zona}</div></Td>
                <Td><div style={{ color: 'var(--t1)' }}>{r.solicitante}</div></Td>
                <Td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t2)' }}>{r.fecha_solicitud ?? '—'}</span></Td>
                <Td><span style={{ color: 'var(--t2)', fontSize: 12 }}>{r.tipo_expediente}</span></Td>
                <Td><span style={pillStyle(CATEGORIA_TOKEN[r.categoria])}>{r.estado_expediente}</span></Td>
                <Td><span style={pillStyle(CLASIF_TOKEN[r.clasificacion])}>{r.clasificacion}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm" style={{ color: 'var(--t2)' }}>
          <div>
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </div>
          <div className="flex gap-2">
            <PageBtn disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</PageBtn>
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--t2)' }}>Página {page + 1} de {pages}</div>
            <PageBtn disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>Siguiente</PageBtn>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="mt-6 flex items-start gap-2 text-xs" style={{ color: 'var(--t3)' }}>
        <Mountain size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <div>
          Los datos se transcribieron del listado oficial de INHGEOMIN (3 PDFs).
          Las concesiones marcadas <span style={pillStyle('amber')}>En Solicitud</span> tienen estado pendiente de aprobación.
          Para discrepancias o actualizaciones, contactar a <a href="mailto:gerencia@mape.legal" style={{ color: 'var(--moss)' }}>gerencia@mape.legal</a>.
          <a
            href="https://inhgeomin.gob.hn"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 ml-2 underline"
            style={{ color: 'var(--moss)' }}
          >
            Fuente INHGEOMIN <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      scope="col"
      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
      style={style}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function StatTile({ label, value, token }: { label: string; value: number | string; token: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}
    >
      <div
        style={{
          color:         'var(--slate)',
          fontFamily:    'var(--font-mono)',
          fontSize:      10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight:    600,
        }}
      >
        {label}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize:   28,
          fontWeight: 600,
          color:      `var(--${token})`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
    >
      {children}
    </button>
  );
}
