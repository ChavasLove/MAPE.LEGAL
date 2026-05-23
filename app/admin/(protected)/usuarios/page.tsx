'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, UserCheck, UserX } from 'lucide-react';

type Rol = 'admin' | 'abogado' | 'tecnico_ambiental' | 'cliente';

interface Usuario {
  id:           string;
  email:        string;
  created_at:   string;
  last_sign_in: string | null;
  confirmed:    boolean;
  rol:          string;
  activo:       boolean;
  perfil:       { nombre: string; iniciales: string } | null;
}

const ROL_LABELS: Record<string, string> = {
  admin:             'Administrador',
  abogado:           'Abogado',
  tecnico_ambiental: 'Técnico ambiental',
  cliente:           'Cliente',
  sin_rol:           'Sin rol',
};

/**
 * Status pill palette per DESIGN.md §3 — `color-mix(in oklch, …)` derives
 * the soft fill / 30% border combo from the base token. We map each role
 * to a status token (red=admin power, blue=abogado, green=tecnico, earth=cliente,
 * slate=sin_rol) — these are semantic role markers, not decorative colors.
 */
const ROL_TOKEN: Record<string, string> = {
  admin:             'red',
  abogado:           'blue',
  tecnico_ambiental: 'green',
  cliente:           'earth',
  sin_rol:           'slate',
};

function rolBadgeStyle(rol: string): React.CSSProperties {
  const token = ROL_TOKEN[rol] ?? 'slate';
  return {
    background:  `color-mix(in oklch, var(--${token}) 14%, white)`,
    color:       `var(--${token})`,
    borderColor: `color-mix(in oklch, var(--${token}) 30%, white)`,
  };
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background:  'var(--bg)',
  border:      '1px solid var(--border)',
  color:       'var(--t1)',
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios]       = useState<Usuario[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');
  const [busyRow, setBusyRow]         = useState<string | null>(null);

  const [newEmail, setNewEmail]       = useState('');
  const [newRol, setNewRol]           = useState<Rol>('cliente');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/usuarios');
      if (!res.ok) throw new Error((await res.json()).error);
      setUsuarios(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
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
      const res = await fetch('/api/admin/usuarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: newEmail, rol: newRol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setNewEmail('');
      setNewRol('cliente');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActivo(u: Usuario) {
    if (busyRow) return;
    setBusyRow(u.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ activo: !u.activo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo cambiar el estado.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado');
    } finally {
      setBusyRow(null);
    }
  }

  async function handleDelete(u: Usuario) {
    if (busyRow) return;
    if (!confirm(`¿Eliminar permanentemente la cuenta de ${u.email}?`)) return;
    setBusyRow(u.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo eliminar la cuenta.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar cuenta');
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Usuarios del sistema</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Cuentas de acceso al dashboard MAPE.LEGAL
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--slate)', background: 'transparent' }}
            title="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            style={{ background: 'var(--ink)', color: '#fff' }}
          >
            <Plus size={16} strokeWidth={2} />
            Invitar usuario
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--ink)' }}>Invitar usuario</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--t2)' }}>
            El usuario recibirá un correo con un enlace para configurar su propia contraseña.
          </p>
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--slate)' }}
              >
                Correo electrónico
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder="usuario@cht.hn"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-[color:var(--ink)]"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--slate)' }}
              >
                Rol
              </label>
              <select
                value={newRol}
                onChange={e => setNewRol(e.target.value as Rol)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              >
                <option value="cliente">Cliente</option>
                <option value="abogado">Abogado</option>
                <option value="tecnico_ambiental">Técnico ambiental</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {formError && (
              <div
                className="sm:col-span-2 text-sm px-3 py-2 rounded-lg border"
                style={{
                  color:       'var(--red)',
                  background:  'color-mix(in oklch, var(--red) 14%, white)',
                  borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
                }}
              >
                {formError}
              </div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60 cursor-pointer"
                style={{ background: 'var(--moss)', color: '#fff' }}
              >
                {submitting ? 'Enviando invitación...' : 'Enviar invitación'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border"
                style={{ color: 'var(--t2)', background: 'transparent', borderColor: 'var(--border)' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-6 text-sm border"
          style={{
            color:       'var(--red)',
            background:  'color-mix(in oklch, var(--red) 14%, white)',
            borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', boxShadow: SHADOW_SM }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--ink)' }}>
              {['Correo electrónico', 'Rol', 'Perfil asignado', 'Creado', 'Acciones'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#fff' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--t2)', background: 'var(--bg)' }}
                >
                  Cargando usuarios...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--t2)', background: 'var(--bg)' }}
                >
                  No hay usuarios registrados. Crea el primero.
                </td>
              </tr>
            ) : (
              usuarios.map(u => (
                <tr
                  key={u.id}
                  style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}
                  className="hover:bg-[color:var(--bg-soft)]"
                >
                  <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                      style={rolBadgeStyle(u.rol)}
                    >
                      {ROL_LABELS[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>
                    {u.perfil ? `${u.perfil.nombre} (${u.perfil.iniciales})` : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-HN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActivo(u)}
                        disabled={busyRow === u.id}
                        aria-label={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                        title={u.activo ? 'Desactivar' : 'Activar'}
                        className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[color:var(--bg-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: u.activo ? 'var(--green)' : 'var(--slate)' }}
                      >
                        {u.activo ? <UserCheck size={16} strokeWidth={1.5} /> : <UserX size={16} strokeWidth={1.5} />}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={busyRow === u.id}
                        aria-label="Eliminar usuario"
                        title="Eliminar usuario"
                        className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[color:var(--bg-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: 'var(--red)' }}
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: 'var(--t3)' }}>
        Los usuarios con rol <strong style={{ color: 'var(--ink)' }}>Administrador</strong> tienen acceso completo al panel.
        Los usuarios con rol <strong style={{ color: 'var(--ink)' }}>Abogado</strong> o <strong style={{ color: 'var(--ink)' }}>Técnico ambiental</strong> acceden al dashboard de expedientes.
      </p>
    </div>
  );
}
