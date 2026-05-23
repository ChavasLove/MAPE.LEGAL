'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, Eye, EyeOff } from 'lucide-react';

interface ConfigEntry {
  clave:       string;
  valor:       string | null;
  tipo:        string;
  descripcion: string | null;
}

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

export default function ConfigPage() {
  const [config,   setConfig]   = useState<ConfigEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [values,   setValues]   = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [status,   setStatus]   = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res  = await fetch('/api/admin/config');
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'No se pudo cargar la configuración.');
      }
      if (Array.isArray(data)) {
        setConfig(data);
        const init: Record<string, string> = {};
        data.forEach((c: ConfigEntry) => { init[c.clave] = c.valor ?? ''; });
        setValues(init);
      }
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Error al cargar configuración' });
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'No se pudo guardar la configuración.');
      }
      setStatus({ kind: 'ok', msg: 'Guardado correctamente' });
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Error al guardar configuración' });
    } finally {
      setSaving(false);
    }
  }

  function toggleShowKey(clave: string) {
    setShowKeys(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  }

  const SECTION_LABELS: Record<string, string> = {
    sendgrid:   'Email (SendGrid)',
    whatsapp:   'WhatsApp Business',
    sistema:    'Sistema',
    piloto:     'Piloto activo',
    tasa:       'Finanzas',
  };

  // Group by prefix
  const groups: Record<string, ConfigEntry[]> = {};
  config.forEach(c => {
    const prefix = c.clave.split('_')[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(c);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Configuración del sistema</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Claves API, parámetros de integración y ajustes globales
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--slate)' }}
        >
          <RefreshCw size={18} strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando configuración...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {Object.entries(groups).map(([prefix, entries]) => (
            <div
              key={prefix}
              className="rounded-xl border overflow-hidden"
              style={{
                background:  'var(--bg)',
                borderColor: 'var(--border)',
                boxShadow:   SHADOW_SM,
              }}
            >
              <div
                className="px-5 py-3 border-b"
                style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}
              >
                <h2
                  className="text-sm font-semibold"
                  style={{ color: '#fff', fontFamily: 'var(--font-body)' }}
                >
                  {SECTION_LABELS[prefix] ?? prefix}
                </h2>
              </div>
              <div className="divide-y" style={{ background: 'var(--bg)' }}>
                {entries.map(c => {
                  const isSecret = c.tipo === 'secreto';
                  const show     = showKeys.has(c.clave);
                  return (
                    <div
                      key={c.clave}
                      className="px-5 py-4 grid sm:grid-cols-2 gap-4 items-start"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div>
                        <div
                          className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                          style={{ color: 'var(--slate)' }}
                        >
                          {c.clave}
                        </div>
                        {c.descripcion && (
                          <div className="text-xs" style={{ color: 'var(--t3)' }}>{c.descripcion}</div>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={isSecret && !show ? 'password' : 'text'}
                          value={values[c.clave] ?? ''}
                          onChange={e => setValues(v => ({ ...v, [c.clave]: e.target.value }))}
                          placeholder={isSecret ? '••••••••••••••••' : 'Sin valor'}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none pr-9"
                          style={inputStyle}
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleShowKey(c.clave)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ color: 'var(--slate)' }}
                          >
                            {show ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
              style={{ background: 'var(--ink)', color: '#fff' }}
            >
              <Save size={16} strokeWidth={2} />
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            {status && (
              <span
                role="status"
                aria-live="polite"
                className="text-sm"
                style={{ color: status.kind === 'ok' ? 'var(--green)' : 'var(--red)' }}
              >
                {status.msg}
              </span>
            )}
          </div>

          <p className="text-xs" style={{ color: 'var(--t3)' }}>
            Las claves de tipo <strong style={{ color: 'var(--slate)' }}>secreto</strong> se almacenan en la base de datos y están disponibles para el servidor. Para producción, prefiere usar variables de entorno de Vercel (.env) para las claves API principales.
          </p>
        </form>
      )}
    </div>
  );
}
