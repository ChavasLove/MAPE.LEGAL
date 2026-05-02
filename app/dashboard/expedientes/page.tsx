'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Search } from 'lucide-react';
import type { DashExpediente } from '@/services/dashboardService';

const ESTADOS = ['todos', 'activo', 'alerta', 'bloqueado', 'nuevo', 'completado'] as const;

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  activo:     { bg: '#E6F2EC', text: '#2F5D50', label: 'Activo'     },
  alerta:     { bg: '#F5EBDD', text: '#8C6A4A', label: 'Alerta'     },
  bloqueado:  { bg: '#F8E5E4', text: '#A94442', label: 'Bloqueado'  },
  nuevo:      { bg: '#DBEAFE', text: '#3A6EA5', label: 'Nuevo'      },
  completado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Completado' },
};

type EstadoFilter = typeof ESTADOS[number];

interface NewExpedienteForm {
  cliente: string; tipo: string; municipio: string;
  abogado_nombre: string; abogado_iniciales: string;
  psa_nombre: string; psa_iniciales: string;
}

const EMPTY_FORM: NewExpedienteForm = {
  cliente: '', tipo: '', municipio: '',
  abogado_nombre: '', abogado_iniciales: '',
  psa_nombre: '', psa_iniciales: '',
};

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<DashExpediente[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<EstadoFilter>('todos');
  const [search,      setSearch]      = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState<NewExpedienteForm>(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/expedientes');
      const data = await res.json();
      setExpedientes(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = expedientes.filter(e => {
    const matchEstado = filter === 'todos' || e.estado === filter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || e.id.toLowerCase().includes(q)
      || e.cliente.toLowerCase().includes(q)
      || e.municipio.toLowerCase().includes(q);
    return matchEstado && matchSearch;
  });

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res  = await fetch('/api/expedientes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al crear expediente');
    } finally {
      setSubmitting(false);
    }
  }

  const inp = (key: keyof NewExpedienteForm, label: string, placeholder: string) => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
        {label}
      </label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        required
        className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
        style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
      />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Expedientes</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            {loading ? '...' : `${expedientes.length} expedientes · ${visible.length} visibles`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            style={{ color: '#A3AAB3' }}
            title="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans text-white cursor-pointer"
            style={{ background: '#2F5D50' }}
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo expediente
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border p-6 mb-6" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <h2 className="text-base font-semibold text-white mb-5 font-sans">Nuevo expediente</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {inp('cliente',           'Cliente',           'Juan Antonio Zelaya')}
              {inp('tipo',              'Tipo de trámite',   'Exploración minera')}
              {inp('municipio',         'Municipio',         'Iriona, Colón')}
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              {inp('abogado_nombre',    'Abogado CHT',       'Abg. Ana Rodríguez')}
              {inp('abogado_iniciales', 'Iniciales',         'AR')}
              {inp('psa_nombre',        'Técnico Ambiental', 'PSA Pedro Méndez')}
              {inp('psa_iniciales',     'Iniciales',         'PM')}
            </div>
            {formError && (
              <p className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>
                {formError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-semibold font-sans text-white disabled:opacity-60 cursor-pointer"
                style={{ background: '#2F5D50' }}
              >
                {submitting ? 'Creando...' : 'Crear expediente'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium font-sans hover:bg-white/10 transition-colors cursor-pointer"
                style={{ color: '#A3AAB3' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A3AAB3' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID, cliente, municipio..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm font-sans outline-none w-72"
            style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.3)', color: 'white' }}
          />
        </div>
        <div className="flex gap-2">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => setFilter(e)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold font-sans capitalize transition-colors cursor-pointer"
              style={
                filter === e
                  ? { background: '#1F2A44', color: 'white', border: '1px solid rgba(94,107,122,0.6)' }
                  : { background: 'transparent', color: '#A3AAB3', border: '1px solid rgba(94,107,122,0.3)' }
              }
            >
              {e === 'todos' ? 'Todos' : ESTADO_BADGE[e]?.label ?? e}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A44' }}>
              {['Expediente', 'Cliente', 'Tipo', 'Municipio', 'Fase', 'Legalidad', 'Abogado / PSA', 'Estado', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3AAB3' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#A3AAB3', background: '#162033' }}>Cargando...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#A3AAB3', background: '#162033' }}>No hay expedientes con ese filtro.</td></tr>
            ) : visible.map(e => {
              const badge = ESTADO_BADGE[e.estado] ?? ESTADO_BADGE.activo;
              return (
                <tr key={e.id} style={{ borderTop: '1px solid rgba(94,107,122,0.2)', background: '#162033' }}>
                  <td className="px-4 py-3 font-semibold text-white">{e.id}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{e.cliente}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{e.tipo}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{e.municipio}</td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>Fase {e.fase}</td>
                  <td className="px-4 py-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(94,107,122,0.3)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${e.legalidad}%`, background: '#3E7C59' }} />
                      </div>
                      <span className="text-xs" style={{ color: '#A3AAB3' }}>{e.legalidad}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>
                    {e.abogado.initials} / {e.psa.initials}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/expedientes/${e.id}`}
                      className="text-xs font-semibold font-sans hover:underline"
                      style={{ color: '#3A6EA5' }}
                    >
                      Ver →
                    </Link>
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
