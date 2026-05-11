'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';

type Categoria = 'explotacion_otorgada' | 'exploracion_otorgada' | 'solicitud_pendiente';

interface Hit {
  id:                 string;
  numero_registro:    number;
  codigo:             string | null;
  nombre_zona:        string;
  fecha_solicitud:    string | null;
  tipo_expediente:    string;
  solicitante:        string;
  estado_expediente:  string;
  clasificacion:      string;
  categoria:          Categoria;
  match_rank?:        number;
}

const CAT_TOKEN: Record<Categoria, string> = {
  explotacion_otorgada: 'green',
  exploracion_otorgada: 'blue',
  solicitud_pendiente:  'amber',
};

const CAT_LABEL: Record<Categoria, string> = {
  explotacion_otorgada: 'Otorgada · Explotación',
  exploracion_otorgada: 'Otorgada · Exploración',
  solicitud_pendiente:  'En Solicitud',
};

export default function RegistroSearch() {
  const [q, setQ]                 = useState('');
  const [results, setResults]     = useState<Hit[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search — fires 250ms after the last keystroke.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setError('');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/concesiones/buscar?q=${encodeURIComponent(trimmed)}&limit=20`);
        if (!res.ok) {
          setError((await res.json()).error ?? 'Error al consultar el registro.');
          setResults([]);
        } else {
          const json = await res.json();
          setResults(json.results ?? []);
          setHasSearched(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error de red');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          background:   'var(--bg)',
          border:       '1px solid var(--border-2)',
          borderRadius: 12,
          padding:      16,
          boxShadow:    '0 2px 6px rgba(31,42,56,0.05)',
        }}
      >
        <label
          htmlFor="q"
          style={{
            display:       'block',
            color:         'var(--slate)',
            fontFamily:    'var(--font-mono)',
            fontSize:      11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight:    600,
            marginBottom:  6,
          }}
        >
          Buscar zona, empresa o código
        </label>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}
          />
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: El Mochito, American Pacific, MINA-2026…"
            style={{
              width:        '100%',
              padding:      '12px 14px 12px 38px',
              background:   'var(--bg)',
              border:       '1px solid var(--border)',
              borderRadius: 8,
              color:        'var(--t1)',
              fontSize:     15,
              outline:      'none',
            }}
          />
        </div>
      </div>

      {loading && (
        <div style={{ color: 'var(--t3)', marginTop: 16, fontSize: 14 }}>Buscando…</div>
      )}
      {error && !loading && (
        <div style={{ color: 'var(--red)', marginTop: 16, fontSize: 14 }}>{error}</div>
      )}
      {!loading && !error && hasSearched && results.length === 0 && (
        <div style={{ color: 'var(--t3)', marginTop: 16, fontSize: 14 }}>
          Sin resultados para “{q}”.
        </div>
      )}
      {!loading && results.length > 0 && (
        <ul style={{ marginTop: 24, listStyle: 'none', padding: 0 }}>
          {results.map(r => (
            <li
              key={r.id}
              style={{
                background:   'var(--bg)',
                border:       '1px solid var(--border)',
                borderRadius: 12,
                padding:      16,
                marginBottom: 10,
                boxShadow:    '0 2px 6px rgba(31,42,56,0.04)',
              }}
            >
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                  {r.nombre_zona}
                </div>
                <span
                  style={{
                    padding:      '4px 10px',
                    background:   `color-mix(in oklch, var(--${CAT_TOKEN[r.categoria]}) 14%, white)`,
                    color:        `var(--${CAT_TOKEN[r.categoria]})`,
                    border:       `1px solid color-mix(in oklch, var(--${CAT_TOKEN[r.categoria]}) 30%, white)`,
                    borderRadius: 9999,
                    fontSize:     12,
                    fontWeight:   600,
                  }}
                >
                  {CAT_LABEL[r.categoria]}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55 }}>
                <strong>Solicitante:</strong> {r.solicitante}
              </div>
              <div
                style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}
              >
                {r.codigo ? `cód. ${r.codigo} · ` : ''}#{r.numero_registro} · {r.fecha_solicitud ?? 's/f'} · {r.clasificacion}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
