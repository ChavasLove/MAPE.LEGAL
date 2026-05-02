'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, RefreshCw, Check, X } from 'lucide-react';

type Rol = 'abogado' | 'tecnico_ambiental' | 'admin';

interface Perfil {
  id:          string;
  nombre:      string;
  iniciales:   string;
  rol:         Rol;
  especialidad: string | null;
  email:       string | null;
  telefono:    string | null;
  activo:      boolean;
  created_at:  string;
}

const ROL_LABELS: Record<Rol, string> = {
  abogado:           'Abogado',
  tecnico_ambiental: 'Técnico ambiental',
  admin:             'Administrador',
};

const ROL_COLORS: Record<Rol, { bg: string; text: string }> = {
  abogado:           { bg: '#DBEAFE', text: '#3A6EA5' },
  tecnico_ambiental: { bg: '#E6F2EC', text: '#2F5D50' },
  admin:             { bg: '#F8E5E4', text: '#A94442' },
};

const EMPTY_FORM = {
  nombre: '', iniciales: '', rol: 'abogado' as Rol,
  especialidad: '', email: '', telefono: '',
};

export default function ProfesionalesPage() {
  const [perfiles, setPerfiles]     = useState<Perfil[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Perfil | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const [form, setForm]             = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/profesionales');
      if (!res.ok) throw new Error((await res.json()).error);
      setPerfiles(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar perfiles');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(p: Perfil) {
    setEditing(p);
    setForm({
      nombre:      p.nombre,
      iniciales:   p.iniciales,
      rol:         p.rol,
      especialidad: p.especialidad ?? '',
      email:       p.email ?? '',
      telefono:    p.telefono ?? '',
    });
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const payload = {
      ...form,
      especialidad: form.especialidad || null,
      email:        form.email || null,
      telefono:     form.telefono || null,
    };

    try {
      const url    = editing ? `/api/admin/profesionales/${editing.id}` : '/api/admin/profesionales';
      const method = editing ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar perfil');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActivo(p: Perfil) {
    await fetch(`/api/admin/profesionales/${p.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ activo: !p.activo }),
    });
    await load();
  }

  const field = (key: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
        {label}
      </label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
        style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
        {...props}
      />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Perfiles profesionales</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            Abogados y técnicos ambientales asignados a expedientes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 rounded-lg transition-colors hover:bg-white/10 cursor-pointer"
            style={{ color: '#A3AAB3' }}
            title="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans text-white transition-colors cursor-pointer"
            style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.4)' }}
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo perfil
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border p-6 mb-6" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <h2 className="text-base font-semibold text-white mb-4 font-sans">
            {editing ? 'Editar perfil' : 'Nuevo perfil profesional'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {field('nombre',    'Nombre completo',  { required: true, placeholder: 'Abg. Ana Rodríguez' })}
              {field('iniciales', 'Iniciales',        { required: true, placeholder: 'AR', maxLength: 4 })}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
                  Rol
                </label>
                <select
                  value={form.rol}
                  onChange={e => setForm(f => ({ ...f, rol: e.target.value as Rol }))}
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                >
                  <option value="abogado">Abogado</option>
                  <option value="tecnico_ambiental">Técnico ambiental</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {field('especialidad', 'Especialidad',  { placeholder: 'Derecho minero, MAPE…' })}
              {field('email',        'Correo',        { type: 'email', placeholder: 'ana@cht.hn' })}
              {field('telefono',     'Teléfono',      { placeholder: '+504 9999-0000' })}
            </div>

            {formError && (
              <div className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>
                {formError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-semibold font-sans text-white transition-opacity disabled:opacity-60 cursor-pointer"
                style={{ background: '#2F5D50' }}
              >
                {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear perfil'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-5 py-2 rounded-lg text-sm font-medium font-sans transition-colors hover:bg-white/10 cursor-pointer"
                style={{ color: '#A3AAB3' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm font-sans" style={{ background: '#F8E5E4', color: '#A94442' }}>
          {error}
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <p className="text-sm font-sans py-8 text-center" style={{ color: '#A3AAB3' }}>Cargando perfiles...</p>
      ) : perfiles.length === 0 ? (
        <p className="text-sm font-sans py-8 text-center" style={{ color: '#A3AAB3' }}>
          No hay perfiles registrados. Crea el primero.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {perfiles.map(p => {
            const badge = ROL_COLORS[p.rol] ?? { bg: '#F5F6F7', text: '#5E6B7A' };
            return (
              <div
                key={p.id}
                className="rounded-xl border p-5 flex flex-col gap-3"
                style={{
                  background:   '#1F2A44',
                  borderColor:  'rgba(94,107,122,0.3)',
                  opacity:      p.activo ? 1 : 0.55,
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Avatar initials */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-sans shrink-0"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {p.iniciales}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm font-sans">{p.nombre}</div>
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans mt-0.5"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {ROL_LABELS[p.rol]}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    style={{ color: '#A3AAB3' }}
                    title="Editar"
                  >
                    <Pencil size={15} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Details */}
                <div className="space-y-1 text-xs font-sans" style={{ color: '#A3AAB3' }}>
                  {p.especialidad && <div>{p.especialidad}</div>}
                  {p.email       && <div>{p.email}</div>}
                  {p.telefono    && <div>{p.telefono}</div>}
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => toggleActivo(p)}
                  className="flex items-center gap-1.5 text-xs font-semibold font-sans transition-colors cursor-pointer mt-auto"
                  style={{ color: p.activo ? '#3E7C59' : '#A3AAB3' }}
                >
                  {p.activo
                    ? <><Check size={13} strokeWidth={2} /> Activo</>
                    : <><X     size={13} strokeWidth={2} /> Inactivo</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs font-sans mt-6" style={{ color: '#5E6B7A' }}>
        Los perfiles activos aparecen disponibles para asignación en nuevos expedientes.
        Desactivar un perfil no afecta los expedientes existentes.
      </p>
    </div>
  );
}
