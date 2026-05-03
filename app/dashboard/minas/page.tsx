'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, MapPin } from 'lucide-react';

interface MinaCliente {
  id: string;
  nombre: string | null;
  telefono_whatsapp: string | null;
}

interface Mina {
  id: string;
  cliente_id: string | null;
  nombre: string;
  codigo: string | null;
  latitud: number | null;
  longitud: number | null;
  municipio: string | null;
  departamento: string | null;
  area_hectareas: number | null;
  tipo_mineral: string;
  tipo_concesion: string;
  estado: string;
  created_at: string;
  cliente: MinaCliente | null;
}

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  en_tramite:  { bg: '#F5EBDD', text: '#8C6A4A', label: 'En trámite' },
  activa:      { bg: '#E6F2EC', text: '#2F5D50', label: 'Activa'     },
  suspendida:  { bg: '#F8E5E4', text: '#A94442', label: 'Suspendida' },
  clausurada:  { bg: '#F8E5E4', text: '#A94442', label: 'Clausurada' },
};

const CONCESION_LABEL: Record<string, string> = {
  artesanal:   'Artesanal',
  exploracion: 'Exploración',
  explotacion: 'Explotación',
};

function formatCoord(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '—';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function formatArea(ha: number | null): string {
  if (ha == null) return '—';
  return `${new Intl.NumberFormat('es-HN', { maximumFractionDigits: 2 }).format(ha)} ha`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MinasPage() {
  const [minas, setMinas]     = useState<Mina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/minas');
      const data = await res.json();
      setMinas(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();
  const visible = minas.filter(m =>
    !q
    || m.nombre?.toLowerCase().includes(q)
    || m.codigo?.toLowerCase().includes(q)
    || m.municipio?.toLowerCase().includes(q)
    || m.cliente?.nombre?.toLowerCase().includes(q)
  );

  const activas    = minas.filter(m => m.estado === 'activa').length;
  const enTramite  = minas.filter(m => m.estado === 'en_tramite').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Minas</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            {loading ? '...' : `${minas.length} registradas · ${activas} activas · ${enTramite} en trámite`}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          style={{ color: '#A3AAB3' }}
          title="Recargar"
        >
          <RefreshCw size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mb-5">
        <div className="relative w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A3AAB3' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, cliente..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm font-sans outline-none w-full"
            style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.3)', color: 'white' }}
          />
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A44' }}>
              {['Código', 'Nombre', 'Cliente', 'Municipio', 'Coordenadas', 'Área', 'Mineral', 'Concesión', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3AAB3' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#A3AAB3', background: '#162033' }}>
                  Cargando...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#A3AAB3', background: '#162033' }}>
                  {search ? 'No hay resultados para esa búsqueda.' : 'Aún no hay minas registradas.'}
                </td>
              </tr>
            ) : visible.map(m => {
              const badge = ESTADO_BADGE[m.estado] ?? { bg: '#2A3347', text: '#5E6B7A', label: m.estado };
              return (
                <tr key={m.id} style={{ borderTop: '1px solid rgba(94,107,122,0.2)', background: '#162033' }}>
                  <td className="px-4 py-3 font-semibold text-white">{m.codigo ?? '—'}</td>
                  <td className="px-4 py-3 text-white">{m.nombre}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{m.cliente?.nombre ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>
                    {m.municipio ? `${m.municipio}${m.departamento ? `, ${m.departamento}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#A3AAB3' }}>
                    {m.latitud != null && m.longitud != null ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} strokeWidth={1.5} />
                        {formatCoord(m.latitud, m.longitud)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{formatArea(m.area_hectareas)}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: '#A3AAB3' }}>{m.tipo_mineral}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{CONCESION_LABEL[m.tipo_concesion] ?? m.tipo_concesion}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs font-sans mt-3" style={{ color: '#5E6B7A' }}>
        Registrado: {visible[0] ? formatDate(visible[0].created_at) : '—'}
      </p>
    </div>
  );
}
