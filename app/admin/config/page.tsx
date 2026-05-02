'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, Eye, EyeOff } from 'lucide-react';

interface ConfigEntry {
  clave:       string;
  valor:       string | null;
  tipo:        string;
  descripcion: string | null;
}

export default function ConfigPage() {
  const [config,   setConfig]   = useState<ConfigEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [values,   setValues]   = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/config');
      const data = await res.json();
      if (Array.isArray(data)) {
        setConfig(data);
        const init: Record<string, string> = {};
        data.forEach((c: ConfigEntry) => { init[c.clave] = c.valor ?? ''; });
        setValues(init);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ }
    finally { setSaving(false); }
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
          <h1 className="text-2xl font-bold text-white">Configuración del sistema</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            Claves API, parámetros de integración y ajustes globales
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: '#A3AAB3' }}>
          <RefreshCw size={18} strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm font-sans py-8 text-center" style={{ color: '#A3AAB3' }}>Cargando configuración...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {Object.entries(groups).map(([prefix, entries]) => (
            <div
              key={prefix}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'rgba(94,107,122,0.3)' }}
            >
              <div className="px-5 py-3 border-b" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
                <h2 className="text-sm font-semibold text-white font-sans">
                  {SECTION_LABELS[prefix] ?? prefix}
                </h2>
              </div>
              <div className="divide-y" style={{ background: '#162033', borderColor: 'rgba(94,107,122,0.2)' }}>
                {entries.map(c => {
                  const isSecret = c.tipo === 'secreto';
                  const show     = showKeys.has(c.clave);
                  return (
                    <div key={c.clave} className="px-5 py-4 grid sm:grid-cols-2 gap-4 items-start" style={{ borderColor: 'rgba(94,107,122,0.2)' }}>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider font-sans mb-0.5" style={{ color: '#A3AAB3' }}>
                          {c.clave}
                        </div>
                        {c.descripcion && (
                          <div className="text-xs font-sans" style={{ color: '#5E6B7A' }}>{c.descripcion}</div>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={isSecret && !show ? 'password' : 'text'}
                          value={values[c.clave] ?? ''}
                          onChange={e => setValues(v => ({ ...v, [c.clave]: e.target.value }))}
                          placeholder={isSecret ? '••••••••••••••••' : 'Sin valor'}
                          className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none pr-9"
                          style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleShowKey(c.clave)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ color: '#A3AAB3' }}
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold font-sans text-white disabled:opacity-60 cursor-pointer"
              style={{ background: '#1F2A44' }}
            >
              <Save size={16} strokeWidth={2} />
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            {saved && (
              <span className="text-sm font-sans" style={{ color: '#3E7C59' }}>
                ✓ Guardado correctamente
              </span>
            )}
          </div>

          <p className="text-xs font-sans" style={{ color: '#5E6B7A' }}>
            Las claves de tipo <strong style={{ color: '#A3AAB3' }}>secreto</strong> se almacenan en la base de datos y están disponibles para el servidor. Para producción, prefiere usar variables de entorno de Vercel (.env) para las claves API principales.
          </p>
        </form>
      )}
    </div>
  );
}
