'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Search, MapPin, Plus, X } from 'lucide-react';

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

interface ClienteOption {
  id: string;
  nombre: string | null;
  telefono_whatsapp: string | null;
}

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  en_tramite:  { bg: '#F4E9D6', text: '#8B6A4A', label: 'En trámite' },
  activa:      { bg: '#E0EDE3', text: '#2F5D50', label: 'Activa'     },
  suspendida:  { bg: '#EFD7D5', text: '#B23A3A', label: 'Suspendida' },
  clausurada:  { bg: '#EFD7D5', text: '#B23A3A', label: 'Clausurada' },
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

interface FormState {
  cliente_id:     string;
  nombre:         string;
  codigo:         string;
  latitud:        string;
  longitud:       string;
  municipio:      string;
  departamento:   string;
  area_hectareas: string;
  tipo_mineral:   string;
  tipo_concesion: string;
  estado:         string;
}

const EMPTY_FORM: FormState = {
  cliente_id:     '',
  nombre:         '',
  codigo:         '',
  latitud:        '',
  longitud:       '',
  municipio:      '',
  departamento:   '',
  area_hectareas: '',
  tipo_mineral:   'oro',
  tipo_concesion: 'artesanal',
  estado:         'en_tramite',
};

export default function MinasPage() {
  const [minas, setMinas]       = useState<Mina[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [clientes, setClientes]       = useState<ClienteOption[]>([]);

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

  // Fetch clientes when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/clientes');
        const data = await res.json();
        if (!cancelled) setClientes(Array.isArray(data) ? data : []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [modalOpen]);

  const openModal = () => {
    setForm(EMPTY_FORM);
    setSubmitError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setSubmitError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nombre:         form.nombre.trim(),
        tipo_mineral:   form.tipo_mineral,
        tipo_concesion: form.tipo_concesion,
        estado:         form.estado,
      };
      if (form.cliente_id)     payload.cliente_id     = form.cliente_id;
      if (form.codigo.trim())  payload.codigo         = form.codigo.trim();
      if (form.municipio.trim())    payload.municipio    = form.municipio.trim();
      if (form.departamento.trim()) payload.departamento = form.departamento.trim();
      if (form.latitud.trim())  payload.latitud  = Number(form.latitud);
      if (form.longitud.trim()) payload.longitud = Number(form.longitud);
      if (form.area_hectareas.trim()) payload.area_hectareas = Number(form.area_hectareas);

      const res = await fetch('/api/admin/minas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error ?? 'No se pudo crear la mina.');
        return;
      }
      setModalOpen(false);
      await load();
    } catch {
      setSubmitError('Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3A8AB' }}>
            {loading ? '...' : `${minas.length} registradas · ${activas} activas · ${enTramite} en trámite`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openModal}
            className="px-3 py-2 rounded-lg text-sm font-medium font-sans flex items-center gap-2 transition-colors cursor-pointer"
            style={{ background: '#2F5D50', color: '#fff' }}
          >
            <Plus size={16} strokeWidth={1.8} />
            Nueva mina
          </button>
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            style={{ color: '#A3A8AB' }}
            title="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mb-5">
        <div className="relative w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A3A8AB' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, cliente..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm font-sans outline-none w-full"
            style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
          />
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A38' }}>
              {['Código', 'Nombre', 'Cliente', 'Municipio', 'Coordenadas', 'Área', 'Mineral', 'Concesión', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3A8AB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#A3A8AB', background: '#1F2A38' }}>
                  Cargando...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#A3A8AB', background: '#1F2A38' }}>
                  {search ? 'No hay resultados para esa búsqueda.' : 'Aún no hay minas registradas.'}
                </td>
              </tr>
            ) : visible.map(m => {
              const badge = ESTADO_BADGE[m.estado] ?? { bg: '#2A3347', text: '#5E6B7B', label: m.estado };
              return (
                <tr key={m.id} style={{ borderTop: '1px solid rgba(94,107,123,0.2)', background: '#1F2A38' }}>
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/dashboard/minas/${m.id}`} className="text-white hover:underline">
                      {m.codigo ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white">{m.nombre}</td>
                  <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{m.cliente?.nombre ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>
                    {m.municipio ? `${m.municipio}${m.departamento ? `, ${m.departamento}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#A3A8AB' }}>
                    {m.latitud != null && m.longitud != null ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} strokeWidth={1.5} />
                        {formatCoord(m.latitud, m.longitud)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{formatArea(m.area_hectareas)}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: '#A3A8AB' }}>{m.tipo_mineral}</td>
                  <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{CONCESION_LABEL[m.tipo_concesion] ?? m.tipo_concesion}</td>
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

      <p className="text-xs font-sans mt-3" style={{ color: '#5E6B7B' }}>
        Registrado: {visible[0] ? formatDate(visible[0].created_at) : '—'}
      </p>

      {modalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15, 22, 33, 0.7)' }}
          onClick={closeModal}
        >
          <div
            className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
              <h2 className="text-lg font-bold text-white">Nueva mina</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-white/10" style={{ color: '#A3A8AB' }}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                  Nombre <span style={{ color: '#B23A3A' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                  Cliente
                </label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm({ ...form, cliente_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                >
                  <option value="">— Sin cliente vinculado —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre ?? '(sin nombre)'} {c.telefono_whatsapp ? `· ${c.telefono_whatsapp}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Código
                  </label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value })}
                    placeholder="MINA-AAAA-NNN"
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#5E6B7B' }}>Formato sugerido: MINA-AAAA-NNN</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Área (ha)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.area_hectareas}
                    onChange={e => setForm({ ...form, area_hectareas: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Municipio
                  </label>
                  <input
                    type="text"
                    value={form.municipio}
                    onChange={e => setForm({ ...form, municipio: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Departamento
                  </label>
                  <input
                    type="text"
                    value={form.departamento}
                    onChange={e => setForm({ ...form, departamento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="-90"
                    max="90"
                    value={form.latitud}
                    onChange={e => setForm({ ...form, latitud: e.target.value })}
                    placeholder="15.123456"
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#5E6B7B' }}>Decimal con signo (−90 a 90)</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="-180"
                    max="180"
                    value={form.longitud}
                    onChange={e => setForm({ ...form, longitud: e.target.value })}
                    placeholder="-86.123456"
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#5E6B7B' }}>Decimal con signo (−180 a 180)</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Mineral
                  </label>
                  <select
                    value={form.tipo_mineral}
                    onChange={e => setForm({ ...form, tipo_mineral: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none capitalize"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  >
                    <option value="oro">Oro</option>
                    <option value="plata">Plata</option>
                    <option value="cobre">Cobre</option>
                    <option value="zinc">Zinc</option>
                    <option value="plomo">Plomo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Concesión
                  </label>
                  <select
                    value={form.tipo_concesion}
                    onChange={e => setForm({ ...form, tipo_concesion: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  >
                    <option value="artesanal">Artesanal</option>
                    <option value="exploracion">Exploración</option>
                    <option value="explotacion">Explotación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                    Estado
                  </label>
                  <select
                    value={form.estado}
                    onChange={e => setForm({ ...form, estado: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
                  >
                    <option value="en_tramite">En trámite</option>
                    <option value="activa">Activa</option>
                    <option value="suspendida">Suspendida</option>
                    <option value="clausurada">Clausurada</option>
                  </select>
                </div>
              </div>

              {submitError && (
                <div
                  className="px-3 py-2 rounded-lg text-sm font-sans"
                  style={{ background: 'rgba(178,58,58,0.15)', border: '1px solid rgba(178,58,58,0.4)', color: '#EFD7D5' }}
                >
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium font-sans"
                  style={{ background: 'transparent', color: '#A3A8AB', border: '1px solid rgba(94,107,123,0.3)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium font-sans disabled:opacity-60"
                  style={{ background: '#2F5D50', color: '#fff' }}
                >
                  {submitting ? 'Creando...' : 'Crear mina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
