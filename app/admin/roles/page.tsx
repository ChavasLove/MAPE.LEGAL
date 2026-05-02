'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';

interface Rol {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  permisos:    string[];
  es_sistema:  boolean;
  activo:      boolean;
  created_at:  string;
}

export default function RolesPage() {
  const [roles,      setRoles]      = useState<Rol[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');

  const [nombre,      setNombre]      = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisos,    setPermisos]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/roles');
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res  = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          descripcion: descripcion || null,
          permisos: permisos.split(',').map(p => p.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setNombre(''); setDescripcion(''); setPermisos('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear rol');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActivo(rol: Rol) {
    await fetch(`/api/admin/roles/${rol.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !rol.activo }),
    });
    await load();
  }

  const SYSTEM_PERMISOS = [
    'dashboard:read', 'expedientes:read', 'expedientes:write',
    'documentos:verify', 'mensajes:verify', 'portal:read', '*',
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles y permisos</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            Gestión de roles del sistema y sus permisos de acceso
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" style={{ color: '#A3AAB3' }}>
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans text-white cursor-pointer"
            style={{ background: '#2F5D50' }}
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo rol
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border p-6 mb-6" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <h2 className="text-base font-semibold text-white mb-4 font-sans">Crear nuevo rol</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
                  Nombre del rol (identificador)
                </label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  required
                  placeholder="ej: supervisor_campo"
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
                  Descripción
                </label>
                <input
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="ej: Supervisor de campo MAPE"
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>
                Permisos (separados por coma)
              </label>
              <input
                value={permisos}
                onChange={e => setPermisos(e.target.value)}
                placeholder="dashboard:read, expedientes:read"
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SYSTEM_PERMISOS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPermisos(prev => prev ? `${prev}, ${p}` : p)}
                    className="px-2 py-0.5 rounded text-xs font-sans cursor-pointer hover:bg-white/10 transition-colors"
                    style={{ background: 'rgba(94,107,122,0.2)', color: '#A3AAB3' }}
                  >
                    + {p}
                  </button>
                ))}
              </div>
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
                {submitting ? 'Creando...' : 'Crear rol'}
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-3 text-sm font-sans py-8 text-center" style={{ color: '#A3AAB3' }}>Cargando roles...</p>
        ) : roles.map(rol => (
          <div
            key={rol.id}
            className="rounded-xl border p-5 flex flex-col gap-3"
            style={{
              background:  '#1F2A44',
              borderColor: 'rgba(94,107,122,0.3)',
              opacity:     rol.activo ? 1 : 0.55,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: rol.es_sistema ? '#DBEAFE' : '#E6F2EC' }}
                >
                  <Shield size={18} strokeWidth={1.5} style={{ color: rol.es_sistema ? '#3A6EA5' : '#2F5D50' }} />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm font-sans">{rol.nombre}</div>
                  {rol.es_sistema && (
                    <span className="text-xs font-sans" style={{ color: '#5E6B7A' }}>Rol del sistema</span>
                  )}
                </div>
              </div>
              {!rol.es_sistema && (
                <button
                  onClick={() => toggleActivo(rol)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  style={{ color: rol.activo ? '#3E7C59' : '#A3AAB3' }}
                  title={rol.activo ? 'Desactivar' : 'Activar'}
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              )}
            </div>

            {rol.descripcion && (
              <p className="text-xs font-sans" style={{ color: '#A3AAB3' }}>{rol.descripcion}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(rol.permisos) ? rol.permisos : []).map((p: string) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded text-xs font-sans"
                  style={{ background: 'rgba(94,107,122,0.2)', color: '#A3AAB3' }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs font-sans mt-6" style={{ color: '#5E6B7A' }}>
        Los roles del sistema no pueden eliminarse. Los roles personalizados pueden asignarse a usuarios desde la sección <strong style={{ color: '#A3AAB3' }}>Usuarios</strong>.
      </p>
    </div>
  );
}
