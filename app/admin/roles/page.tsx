'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Shield, Check, X } from 'lucide-react';

interface Rol {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  permisos:    string[];
  es_sistema:  boolean;
  activo:      boolean;
  created_at:  string;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

export default function RolesPage() {
  const [roles,      setRoles]      = useState<Rol[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [rowError,   setRowError]   = useState('');
  const [busyId,     setBusyId]     = useState<string | null>(null);

  const [nombre,      setNombre]      = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisos,    setPermisos]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res  = await fetch('/api/admin/roles');
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'No se pudieron cargar los roles.');
      }
      setRoles(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar roles');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (busyId) return;
    setBusyId(rol.id);
    setRowError('');
    try {
      const res = await fetch(`/api/admin/roles/${rol.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !rol.activo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo cambiar el estado del rol.');
      }
      await load();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Error al cambiar estado del rol');
    } finally {
      setBusyId(null);
    }
  }

  const SYSTEM_PERMISOS = [
    'dashboard:read', 'expedientes:read', 'expedientes:write',
    'documentos:verify', 'mensajes:verify', 'portal:read', '*',
  ];

  // Permission chip — tonal slate.
  const permChipStyle: React.CSSProperties = {
    background:  'color-mix(in oklch, var(--slate) 12%, white)',
    color:       'var(--slate)',
    borderColor: 'color-mix(in oklch, var(--slate) 28%, white)',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Roles y permisos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Gestión de roles del sistema y sus permisos de acceso
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--slate)' }}
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--moss)', color: '#fff' }}
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo rol
          </button>
        </div>
      </div>

      {showForm && (
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--ink)' }}>Crear nuevo rol</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'var(--slate)' }}
                >
                  Nombre del rol (identificador)
                </label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  required
                  placeholder="ej: supervisor_campo"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'var(--slate)' }}
                >
                  Descripción
                </label>
                <input
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="ej: Supervisor de campo MAPE"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--slate)' }}
              >
                Permisos (separados por coma)
              </label>
              <input
                value={permisos}
                onChange={e => setPermisos(e.target.value)}
                placeholder="dashboard:read, expedientes:read"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SYSTEM_PERMISOS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPermisos(prev => prev ? `${prev}, ${p}` : p)}
                    className="px-2 py-0.5 rounded text-xs cursor-pointer transition-colors border"
                    style={permChipStyle}
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>
            {formError && (
              <p
                className="text-sm px-3 py-2 rounded-lg border"
                style={{
                  color:       'var(--red)',
                  background:  'color-mix(in oklch, var(--red) 14%, white)',
                  borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
                }}
              >
                {formError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
                style={{ background: 'var(--moss)', color: '#fff' }}
              >
                {submitting ? 'Creando...' : 'Crear rol'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                style={{ color: 'var(--t2)', background: 'transparent', borderColor: 'var(--border)' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {(loadError || rowError) && (
        <div
          role="alert"
          className="text-sm mb-4 px-3 py-2 rounded-lg border"
          style={{
            color:       'var(--red)',
            background:  'color-mix(in oklch, var(--red) 8%, white)',
            borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
          }}
        >
          {loadError || rowError}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-3 text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando roles...</p>
        ) : roles.length === 0 ? (
          <p className="col-span-3 text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>
            No hay roles para mostrar.
          </p>
        ) : roles.map(rol => {
          // System roles get a blue tile, custom ones get a moss/green tile.
          const tileToken = rol.es_sistema ? 'blue' : 'green';
          const tileStyle: React.CSSProperties = {
            background: `color-mix(in oklch, var(--${tileToken}) 12%, white)`,
            color:      `var(--${tileToken})`,
          };
          return (
            <div
              key={rol.id}
              className="rounded-xl border p-5 flex flex-col gap-3"
              style={{
                background:  'var(--bg)',
                borderColor: 'var(--border)',
                boxShadow:   SHADOW_SM,
                opacity:     rol.activo ? 1 : 0.55,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={tileStyle}
                  >
                    <Shield size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{rol.nombre}</div>
                    {rol.es_sistema && (
                      <span className="text-xs" style={{ color: 'var(--t3)' }}>Rol del sistema</span>
                    )}
                  </div>
                </div>
                {!rol.es_sistema && (
                  <button
                    onClick={() => toggleActivo(rol)}
                    disabled={busyId === rol.id}
                    aria-label={rol.activo ? 'Desactivar rol' : 'Activar rol'}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[color:var(--bg-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: rol.activo ? 'var(--green)' : 'var(--slate)' }}
                    title={rol.activo ? 'Desactivar' : 'Activar'}
                  >
                    {rol.activo
                      ? <Check size={15} strokeWidth={1.5} />
                      : <X size={15} strokeWidth={1.5} />}
                  </button>
                )}
              </div>

              {rol.descripcion && (
                <p className="text-xs" style={{ color: 'var(--t2)' }}>{rol.descripcion}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(rol.permisos) ? rol.permisos : []).map((p: string) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded text-xs border"
                    style={permChipStyle}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-6" style={{ color: 'var(--t3)' }}>
        Los roles del sistema no pueden eliminarse. Los roles personalizados pueden asignarse a usuarios desde la sección <strong style={{ color: 'var(--slate)' }}>Usuarios</strong>.
      </p>
    </div>
  );
}
