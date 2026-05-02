'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Search } from 'lucide-react';

interface ClienteExpediente {
  id: string;
  numero_expediente: string;
  tipo: string;
  estado: string;
  fase_numero: number;
  paso: number;
  total_pasos: number;
  cierre_estimado: string | null;
}

interface Cliente {
  id: string;
  nombre: string;
  dpi: string | null;
  municipio: string | null;
  tipo_mineral: string | null;
  situacion_tierra: string | null;
  telefono_whatsapp: string | null;
  created_at: string;
  expedientes: ClienteExpediente[];
}

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  activo:     { bg: '#DBEAFE', text: '#3A6EA5', label: 'Activo'     },
  alerta:     { bg: '#F5EBDD', text: '#8C6A4A', label: 'Alerta'     },
  bloqueado:  { bg: '#F8E5E4', text: '#A94442', label: 'Bloqueado'  },
  nuevo:      { bg: '#DBEAFE', text: '#3A6EA5', label: 'Nuevo'      },
  completado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Completado' },
};

const TIERRA_LABEL: Record<string, string> = {
  titular:                  'Propietario',
  arrendatario_con_titulo:  'Arrend. c/título',
  arrendatario_sin_titulo:  'Arrend. s/título',
  por_definir:              'Por definir',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/clientes');
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();
  const visible = clientes.filter(c =>
    !q
    || c.nombre?.toLowerCase().includes(q)
    || c.municipio?.toLowerCase().includes(q)
    || c.telefono_whatsapp?.includes(q)
  );

  const leads  = clientes.filter(c => c.expedientes.length === 0).length;
  const activos = clientes.filter(c => c.expedientes.length > 0).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes WhatsApp</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            {loading ? '...' : `${clientes.length} registrados · ${leads} sin expediente · ${activos} con expediente`}
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

      {/* Search */}
      <div className="mb-5">
        <div className="relative w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A3AAB3' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, municipio, teléfono..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm font-sans outline-none w-full"
            style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.3)', color: 'white' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A44' }}>
              {['Nombre', 'Municipio', 'Mineral', 'Situación tierra', 'Teléfono WA', 'Registrado', 'Expediente', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3AAB3' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: '#A3AAB3', background: '#162033' }}>
                  Cargando...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: '#A3AAB3', background: '#162033' }}>
                  {search ? 'No hay resultados para esa búsqueda.' : 'Aún no hay clientes registrados por WhatsApp.'}
                </td>
              </tr>
            ) : visible.map(c => {
              const exp = c.expedientes[0];
              const badge = exp ? (ESTADO_BADGE[exp.estado] ?? ESTADO_BADGE.activo) : null;
              return (
                <tr key={c.id} style={{ borderTop: '1px solid rgba(94,107,122,0.2)', background: '#162033' }}>
                  <td className="px-4 py-3 font-semibold text-white">{c.nombre || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{c.municipio || '—'}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: '#A3AAB3' }}>{c.tipo_mineral || 'oro'}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>
                    {TIERRA_LABEL[c.situacion_tierra ?? ''] ?? c.situacion_tierra ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{c.telefono_whatsapp || '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#A3AAB3' }}>{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    {exp ? (
                      <Link
                        href={`/dashboard/expedientes/${exp.id}`}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: '#3A6EA5' }}
                      >
                        {exp.numero_expediente}
                      </Link>
                    ) : (
                      <span className="text-xs" style={{ color: '#5E6B7A' }}>Sin expediente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {badge ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text }}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: '#2A3347', color: '#5E6B7A' }}>
                        Prospecto
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
