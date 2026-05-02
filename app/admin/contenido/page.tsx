'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Save, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface CmsField {
  seccion: string;
  campo:   string;
  valor:   string | null;
  tipo:    string;
}

const TIPOS = ['texto', 'html', 'url', 'imagen'] as const;

export default function ContenidoPage() {
  const [fields,    setFields]    = useState<CmsField[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [editing,   setEditing]   = useState<{ seccion: string; campo: string } | null>(null);
  const [editVal,   setEditVal]   = useState('');
  const [editTipo,  setEditTipo]  = useState<string>('texto');
  const [saving,    setSaving]    = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);
  const [newSeccion,setNewSeccion]= useState('');
  const [newCampo,  setNewCampo]  = useState('');
  const [newValor,  setNewValor]  = useState('');
  const [newTipo,   setNewTipo]   = useState<string>('texto');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/cms');
      const data = await res.json();
      if (Array.isArray(data)) {
        setFields(data);
        // Auto-expand all sections on first load
        const secciones = new Set(data.map((f: CmsField) => f.seccion));
        setExpanded(secciones);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sections = Array.from(new Set<string>(fields.map(f => f.seccion)));

  function toggleSection(s: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function startEdit(f: CmsField) {
    setEditing({ seccion: f.seccion, campo: f.campo });
    setEditVal(f.valor ?? '');
    setEditTipo(f.tipo);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seccion: editing.seccion, campo: editing.campo, valor: editVal, tipo: editTipo }),
      });
      setEditing(null);
      await load();
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function deleteField(seccion: string, campo: string) {
    if (!confirm(`¿Eliminar campo "${campo}" de la sección "${seccion}"?`)) return;
    await fetch('/api/admin/cms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seccion, campo }),
    });
    await load();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seccion: newSeccion, campo: newCampo, valor: newValor, tipo: newTipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAdd(false);
      setNewSeccion(''); setNewCampo(''); setNewValor(''); setNewTipo('texto');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Contenido de la landing page</h1>
          <p className="text-sm font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
            Edita los textos y URLs de cada sección del sitio público
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: '#A3AAB3' }}>
            <RefreshCw size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-sans text-white cursor-pointer"
            style={{ background: '#2F5D50' }}
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo campo
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-xl border p-6 mb-6" style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}>
          <h2 className="text-base font-semibold text-white mb-4 font-sans">Agregar campo CMS</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {[['Sección', newSeccion, setNewSeccion, 'hero, nosotros, contacto...'],
                ['Campo', newCampo, setNewCampo, 'titulo, subtitulo, cta_primario...']].map(([label, val, setter, ph]) => (
                <div key={label as string}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>{label as string}</label>
                  <input
                    value={val as string}
                    onChange={e => (setter as (v: string) => void)(e.target.value)}
                    placeholder={ph as string}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                    style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>Tipo</label>
                <select
                  value={newTipo}
                  onChange={e => setNewTipo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                >
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 font-sans" style={{ color: '#A3AAB3' }}>Valor</label>
              <textarea
                value={newValor}
                onChange={e => setNewValor(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none resize-none"
                style={{ background: '#162033', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
              />
            </div>
            {formError && <p className="text-sm font-sans px-3 py-2 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>{formError}</p>}
            <div className="flex gap-3">
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold font-sans text-white cursor-pointer" style={{ background: '#2F5D50' }}>
                Guardar
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2 rounded-lg text-sm font-medium font-sans hover:bg-white/10 cursor-pointer" style={{ color: '#A3AAB3' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm font-sans py-8 text-center" style={{ color: '#A3AAB3' }}>Cargando contenido...</p>
      ) : (
        <div className="space-y-3">
          {sections.map(seccion => {
            const sectionFields = fields.filter(f => f.seccion === seccion);
            const isOpen = expanded.has(seccion);
            return (
              <div key={seccion} className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
                <button
                  onClick={() => toggleSection(seccion)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ background: '#1F2A44' }}
                >
                  <span className="text-sm font-semibold text-white font-sans capitalize">{seccion}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-sans" style={{ color: '#5E6B7A' }}>{sectionFields.length} campos</span>
                    {isOpen
                      ? <ChevronDown size={16} strokeWidth={1.5} style={{ color: '#A3AAB3' }} />
                      : <ChevronRight size={16} strokeWidth={1.5} style={{ color: '#A3AAB3' }} />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div style={{ background: '#162033' }}>
                    {sectionFields.map(f => {
                      const isEditing = editing?.seccion === f.seccion && editing.campo === f.campo;
                      return (
                        <div
                          key={f.campo}
                          className="px-5 py-4 border-t"
                          style={{ borderColor: 'rgba(94,107,122,0.2)' }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <span className="text-xs font-semibold uppercase tracking-wider font-sans" style={{ color: '#A3AAB3' }}>{f.campo}</span>
                              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-sans" style={{ background: 'rgba(94,107,122,0.2)', color: '#5E6B7A' }}>{f.tipo}</span>
                            </div>
                            {!isEditing && (
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() => startEdit(f)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold font-sans cursor-pointer"
                                  style={{ background: '#DBEAFE', color: '#3A6EA5' }}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => deleteField(f.seccion, f.campo)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                                  style={{ color: '#A94442' }}
                                >
                                  <Trash2 size={14} strokeWidth={1.5} />
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs font-sans" style={{ color: '#A3AAB3' }}>Tipo:</label>
                                <select
                                  value={editTipo}
                                  onChange={e => setEditTipo(e.target.value)}
                                  className="px-2 py-1 rounded text-xs font-sans outline-none"
                                  style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                                >
                                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <textarea
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                rows={editTipo === 'html' ? 5 : 2}
                                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none resize-y"
                                style={{ background: '#1F2A44', border: '1px solid rgba(94,107,122,0.4)', color: 'white' }}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans text-white disabled:opacity-60 cursor-pointer"
                                  style={{ background: '#2F5D50' }}
                                >
                                  <Save size={13} strokeWidth={2} />
                                  {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium font-sans hover:bg-white/10 cursor-pointer"
                                  style={{ color: '#A3AAB3' }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm font-sans" style={{ color: f.valor ? 'white' : '#5E6B7A' }}>
                              {f.valor || '(sin valor)'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
