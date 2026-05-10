'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { RefreshCw, Check, Shield, ArrowRight } from 'lucide-react';

interface Rol {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  permisos:    string[];
  es_sistema:  boolean;
  activo:      boolean;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

// Canonical permission catalog. Add new permissions here as they are introduced.
// Grouped by area so the matrix is readable at a glance.
const PERMISSION_GROUPS: Array<{ group: string; perms: Array<{ key: string; label: string }> }> = [
  {
    group: 'Acceso general',
    perms: [
      { key: '*',                   label: 'Acceso total (admin)' },
      { key: 'dashboard:read',      label: 'Ver dashboard' },
      { key: 'portal:read',         label: 'Ver portal cliente' },
    ],
  },
  {
    group: 'Expedientes',
    perms: [
      { key: 'expedientes:read',    label: 'Ver expedientes' },
      { key: 'expedientes:write',   label: 'Editar expedientes' },
      { key: 'documentos:verify',   label: 'Verificar documentos' },
      { key: 'mensajes:verify',     label: 'Verificar mensajes' },
    ],
  },
  {
    group: 'Minas y legalidad',
    perms: [
      { key: 'minas:read',          label: 'Ver minas' },
      { key: 'minas:write',         label: 'Editar minas' },
      { key: 'legalidad:read',      label: 'Ver índice de legalidad' },
      { key: 'legalidad:write',     label: 'Editar índice de legalidad' },
    ],
  },
  {
    group: 'María y broadcast',
    perms: [
      { key: 'maria:read',          label: 'Ver panel María' },
      { key: 'maria:takeover',      label: 'Tomar control de conversaciones' },
      { key: 'broadcast:read',      label: 'Ver broadcast' },
      { key: 'broadcast:write',     label: 'Configurar broadcast' },
    ],
  },
];

const ROL_TOKEN: Record<string, string> = {
  admin:             'red',
  abogado:           'blue',
  tecnico_ambiental: 'green',
  cliente:           'earth',
};

function rolesEquivalent(actual: string[], required: string): boolean {
  // '*' grants everything; otherwise exact match.
  return actual.includes('*') || actual.includes(required);
}

export default function PermisosMatrixPage() {
  const [roles,   setRoles]   = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/roles', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRoles(Array.isArray(data) ? data.filter((r: Rol) => r.activo) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Matriz de permisos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Vista resumida de qué puede hacer cada rol. Edita los permisos en{' '}
            <Link href="/admin/roles" className="underline" style={{ color: 'var(--moss)' }}>
              Roles
            </Link>.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg cursor-pointer"
          style={{ color: 'var(--slate)' }}
          aria-label="Recargar"
        >
          <RefreshCw size={18} strokeWidth={1.5} />
        </button>
      </div>

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

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando…</p>
      ) : roles.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>
          No hay roles activos.
        </p>
      ) : (
        <>
          {/* Role legend */}
          <div className="flex flex-wrap gap-2 mb-5">
            {roles.map(r => {
              const token = ROL_TOKEN[r.nombre] ?? 'slate';
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                  style={{
                    background:  `color-mix(in oklch, var(--${token}) 10%, white)`,
                    borderColor: `color-mix(in oklch, var(--${token}) 25%, white)`,
                  }}
                >
                  <Shield size={14} strokeWidth={1.5} style={{ color: `var(--${token})` }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {r.nombre}
                  </span>
                  {r.es_sistema && (
                    <span className="text-xs" style={{ color: 'var(--t3)' }}>(sistema)</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Matrix table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', boxShadow: SHADOW_SM }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--ink)' }}>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#fff' }}
                  >
                    Permiso
                  </th>
                  {roles.map(r => (
                    <th
                      key={r.id}
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#fff' }}
                    >
                      {r.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map(g => (
                  <Fragment key={g.group}>
                    <tr style={{ background: 'var(--bg-soft)' }}>
                      <td
                        colSpan={1 + roles.length}
                        className="px-4 py-2 text-xs uppercase tracking-wider font-semibold"
                        style={{ color: 'var(--slate)' }}
                      >
                        {g.group}
                      </td>
                    </tr>
                    {g.perms.map(p => (
                      <tr
                        key={p.key}
                        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}
                      >
                        <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.label}</span>
                            <code
                              className="text-xs"
                              style={{ color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}
                            >
                              {p.key}
                            </code>
                          </div>
                        </td>
                        {roles.map(r => {
                          const has = rolesEquivalent(r.permisos ?? [], p.key);
                          return (
                            <td key={r.id} className="px-3 py-3 text-center">
                              {has ? (
                                <span
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                                  style={{
                                    background: 'color-mix(in oklch, var(--green) 18%, white)',
                                    color:      'var(--green)',
                                  }}
                                  aria-label="Permitido"
                                >
                                  <Check size={14} strokeWidth={2.5} />
                                </span>
                              ) : (
                                <span
                                  className="inline-block w-2 h-0.5 mx-auto"
                                  style={{ background: 'var(--slate-lt)' }}
                                  aria-label="No"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--t3)' }}>
            <span>El permiso <code style={{ fontFamily: 'var(--font-mono)' }}>*</code> otorga acceso total.</span>
            <Link
              href="/admin/roles"
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: 'var(--moss)' }}
            >
              Editar roles y permisos <ArrowRight size={11} strokeWidth={2} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
