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

const ROL_COLORS: Record<string, { bg: string; text: string }> = {
  admin:             { bg: '#EFD7D5', text: '#B23A3A' },
  abogado:           { bg: '#D6E2F0', text: '#2A6BA8' },
  tecnico_ambiental: { bg: '#E0EDE3', text: '#2F5D50' },
  cliente:           { bg: '#F4E9D6', text: '#8B6A4A' },
  sin_rol:           { bg: '#FAF9F5', text: '#5E6B7B' },
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios]       = useState<Usuario[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');

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
    await fetch(`/api/admin/usuarios/${u.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ activo: !u.activo }),
    });
    await load();
  }

  async function handleDelete(u: Usuario) {
    if (!confirm(`¿Eliminar permanentemente la cuenta de ${u.email}?`)) return;
    await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios del sistema</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3A8AB' }}>
            Cuentas de acceso al dashboard MAPE.LEGAL
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 rounded-lg transition-colors hover:bg-white/10 cursor-pointer"
            style={{ color: '#A3A8AB' }}
            title="Recargar"
          >
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans transition-colors cursor-pointer text-white"
            style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.4)' }}
          >
            <Plus size={16} strokeWidth={2} />
            Invitar usuario
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border p-6 mb-6" style={{ background: '#1F2A38', borderColor: 'rgba(94,107,123,0.3)' }}>
          <h2 className="text-base font-semibold text-white mb-1 font-sans">Invitar usuario</h2>
          <p className="text-xs font-sans mb-4" style={{ color: '#A3A8AB' }}>
            El usuario recibirá un correo con un enlace para configurar su propia contraseña.
          </p>
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3A8AB' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder="usuario@cht.hn"
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.4)', color: 'white' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3A8AB' }}>
                Rol
              </label>
              <select
                value={newRol}
                onChange={e => setNewRol(e.target.value as Rol)}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.4)', color: 'white' }}
              >
                <option value="cliente">Cliente</option>
                <option value="abogado">Abogado</option>
                <option value="tecnico_ambiental">Técnico ambiental</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {formError && (
              <div className="sm:col-span-2 text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#B23A3A', background: '#EFD7D5' }}>
                {formError}
              </div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-semibold font-sans text-white transition-opacity disabled:opacity-60 cursor-pointer"
                style={{ background: '#2F5D50' }}
              >
                {submitting ? 'Enviando invitación...' : 'Enviar invitación'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium font-sans transition-colors hover:bg-white/10 cursor-pointer"
                style={{ color: '#A3A8AB' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm font-sans" style={{ background: '#EFD7D5', color: '#B23A3A' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A38' }}>
              {['Correo electrónico', 'Rol', 'Perfil asignado', 'Creado', 'Acciones'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3A8AB' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#A3A8AB', background: '#1F2A38' }}>
                  Cargando usuarios...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#A3A8AB', background: '#1F2A38' }}>
                  No hay usuarios registrados. Crea el primero.
                </td>
              </tr>
            ) : (
              usuarios.map(u => {
                const badgeStyle = ROL_COLORS[u.rol] ?? ROL_COLORS.sin_rol;
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid rgba(94,107,123,0.2)', background: '#1F2A38' }}>
                    <td className="px-4 py-3 text-white">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: badgeStyle.bg, color: badgeStyle.text }}
                      >
                        {ROL_LABELS[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>
                      {u.perfil ? `${u.perfil.nombre} (${u.perfil.iniciales})` : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('es-HN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActivo(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/10 cursor-pointer"
                          style={{ color: u.activo ? '#2A8E50' : '#A3A8AB' }}
                        >
                          {u.activo ? <UserCheck size={16} strokeWidth={1.5} /> : <UserX size={16} strokeWidth={1.5} />}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Eliminar usuario"
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/10 cursor-pointer"
                          style={{ color: '#B23A3A' }}
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs font-sans mt-4" style={{ color: '#5E6B7B' }}>
        Los usuarios con rol <strong>Administrador</strong> tienen acceso completo al panel.
        Los usuarios con rol <strong>Abogado</strong> o <strong>Técnico ambiental</strong> acceden al dashboard de expedientes.
      </p>
    </div>
  );
}
