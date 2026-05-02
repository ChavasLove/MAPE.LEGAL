'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, FileText, Image as ImageIcon } from 'lucide-react';
import type { DashMensaje } from '@/services/dashboardService';

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  listo:      { bg: '#DBEAFE', text: '#3A6EA5', label: 'Listo para revisar' },
  procesando: { bg: '#F5EBDD', text: '#8C6A4A', label: 'Procesando'         },
  ilegible:   { bg: '#F8E5E4', text: '#A94442', label: 'Ilegible'           },
  verificado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Verificado'         },
  rechazado:  { bg: '#F8E5E4', text: '#A94442', label: 'Rechazado'          },
};

const CONFIANZA_COLOR: Record<string, string> = {
  ok:   '#3E7C59',
  warn: '#C49A4A',
  err:  '#A94442',
};

export default function MensajesPage() {
  const [mensajes, setMensajes] = useState<DashMensaje[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [active,   setActive]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/mensajes');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setMensajes(list);
      if (list.length > 0 && !active) setActive(list[0].id);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [active]);

  useEffect(() => { load(); }, [load]);

  async function updateEstado(id: string, estado: string) {
    await fetch(`/api/mensajes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    await load();
  }

  const selectedMsg = mensajes.find(m => m.id === active) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mensajes WhatsApp</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            Feed de documentos entrantes para verificación
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          style={{ color: '#A3AAB3' }}
          title="Recargar"
        >
          <RefreshCw size={18} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>

        {/* Message list */}
        <div
          className="lg:col-span-2 rounded-xl border overflow-hidden flex flex-col"
          style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
        >
          <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider font-sans" style={{ color: '#A3AAB3', borderColor: 'rgba(94,107,122,0.3)' }}>
            {mensajes.length} mensajes
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm font-sans" style={{ color: '#A3AAB3' }}>Cargando...</p>
            ) : mensajes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm font-sans" style={{ color: '#A3AAB3' }}>No hay mensajes.</p>
            ) : (
              mensajes.map(m => {
                const badge = ESTADO_BADGE[m.estado] ?? ESTADO_BADGE.listo;
                const isSelected = m.id === active;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActive(m.id)}
                    className="w-full text-left px-4 py-4 border-b transition-colors cursor-pointer"
                    style={{
                      borderColor: 'rgba(94,107,122,0.2)',
                      background: isSelected ? 'rgba(94,107,122,0.15)' : 'transparent',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {m.tipo === 'imagen'
                          ? <ImageIcon size={14} strokeWidth={1.5} style={{ color: '#A3AAB3' }} />
                          : <FileText  size={14} strokeWidth={1.5} style={{ color: '#A3AAB3' }} />
                        }
                        <span className="text-sm font-semibold text-white font-sans">{m.cliente}</span>
                      </div>
                      <span className="text-xs font-sans" style={{ color: '#5E6B7A' }}>{m.hora?.slice(11, 16) ?? ''}</span>
                    </div>
                    <div className="text-xs font-sans mb-1.5" style={{ color: '#A3AAB3' }}>
                      {m.docTipo || m.archivo}
                    </div>
                    {m.expId && (
                      <div className="text-xs font-sans mb-1.5" style={{ color: '#5E6B7A' }}>{m.expId}</div>
                    )}
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold font-sans"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {badge.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div
          className="lg:col-span-3 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
        >
          {!selectedMsg ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-sans" style={{ color: '#5E6B7A' }}>Selecciona un mensaje para ver el detalle</p>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
                <div>
                  <div className="text-base font-semibold text-white font-sans">{selectedMsg.cliente}</div>
                  <div className="text-xs font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
                    {selectedMsg.docTipo || selectedMsg.archivo}
                    {selectedMsg.expId ? ` · ${selectedMsg.expId}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedMsg.estado !== 'verificado' && selectedMsg.estado !== 'rechazado' && (
                    <>
                      <button
                        onClick={() => updateEstado(selectedMsg.id, 'verificado')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans cursor-pointer"
                        style={{ background: '#E6F2EC', color: '#2F5D50' }}
                      >
                        <CheckCircle2 size={13} strokeWidth={2} />
                        Verificar
                      </button>
                      <button
                        onClick={() => updateEstado(selectedMsg.id, 'rechazado')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans cursor-pointer"
                        style={{ background: '#F8E5E4', color: '#A94442' }}
                      >
                        <XCircle size={13} strokeWidth={2} />
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Extracted fields */}
              <div className="flex-1 overflow-auto p-5">
                {selectedMsg.campos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <FileText size={32} strokeWidth={1} style={{ color: '#5E6B7A' }} />
                    <p className="text-sm font-sans" style={{ color: '#A3AAB3' }}>
                      Sin campos extraídos — adjunto directo
                    </p>
                    <p className="text-xs font-sans" style={{ color: '#5E6B7A' }}>{selectedMsg.archivo}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider font-sans mb-4" style={{ color: '#A3AAB3' }}>
                      Datos extraídos por OCR
                    </p>
                    {selectedMsg.campos.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-lg border p-3.5"
                        style={{ background: '#162033', borderColor: 'rgba(94,107,122,0.3)' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider font-sans" style={{ color: '#A3AAB3' }}>
                            {c.label}
                          </span>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: CONFIANZA_COLOR[c.confianza] ?? '#5E6B7A' }}
                            title={c.confianza === 'ok' ? 'Alta confianza' : c.confianza === 'warn' ? 'Confianza media' : 'Baja confianza'}
                          />
                        </div>
                        <div className="text-sm text-white font-sans">{c.valor}</div>
                        {c.nota && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs font-sans" style={{ color: '#C49A4A' }}>
                            <AlertTriangle size={11} strokeWidth={2} />
                            {c.nota}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
