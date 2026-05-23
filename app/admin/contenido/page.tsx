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

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border:     '1px solid var(--border)',
  color:      'var(--t1)',
};

export default function ContenidoPage() {
  const [fields,    setFields]    = useState<CmsField[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveStatus, setSaveStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
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
    setLoadError('');
    try {
      const res  = await fetch('/api/admin/cms');
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'No se pudo cargar el contenido.');
      }
      if (Array.isArray(data)) {
        setFields(data);
        // Auto-expand all sections on first load
        const secciones = new Set(data.map((f: CmsField) => f.seccion));
        setExpanded(secciones);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar el contenido');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setSaveStatus(null);
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seccion: editing.seccion, campo: editing.campo, valor: editVal, tipo: editTipo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo guardar el campo.');
      }
      setSaveStatus({ kind: 'ok', msg: 'Campo guardado.' });
      setEditing(null);
      await load();
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setSaveStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Error al guardar campo' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteField(seccion: string, campo: string) {
    if (!confirm(`¿Eliminar campo "${campo}" de la sección "${seccion}"?`)) return;
    setSaveStatus(null);
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seccion, campo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error ?? 'No se pudo eliminar el campo.');
      }
      setSaveStatus({ kind: 'ok', msg: 'Campo eliminado.' });
      await load();
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setSaveStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Error al eliminar campo' });
    }
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

  // Reusable token chip styling for the small "tipo" tag.
  const tipoChipStyle: React.CSSProperties = {
    background:  'color-mix(in oklch, var(--slate) 14%, white)',
    color:       'var(--slate)',
    borderColor: 'color-mix(in oklch, var(--slate) 30%, white)',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--ink)' }}>Contenido de la landing page</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--slate)' }}>
            Edita los textos y URLs de cada sección del sitio público
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
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--moss)', color: '#fff' }}
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo campo
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="text-sm mb-4 px-3 py-2 rounded-lg border"
          style={{
            color:       'var(--red)',
            background:  'color-mix(in oklch, var(--red) 8%, white)',
            borderColor: 'color-mix(in oklch, var(--red) 30%, white)',
          }}
        >
          {loadError}
        </div>
      )}
      {saveStatus && (
        <div
          role="status"
          aria-live="polite"
          className="text-sm mb-4 px-3 py-2 rounded-lg border"
          style={{
            color:       saveStatus.kind === 'ok' ? 'var(--green)' : 'var(--red)',
            background:  saveStatus.kind === 'ok'
              ? 'color-mix(in oklch, var(--green) 8%, white)'
              : 'color-mix(in oklch, var(--red) 8%, white)',
            borderColor: saveStatus.kind === 'ok'
              ? 'color-mix(in oklch, var(--green) 30%, white)'
              : 'color-mix(in oklch, var(--red) 30%, white)',
          }}
        >
          {saveStatus.msg}
        </div>
      )}

      {showAdd && (
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--ink)' }}>Agregar campo CMS</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {[['Sección', newSeccion, setNewSeccion, 'hero, nosotros, contacto...'],
                ['Campo', newCampo, setNewCampo, 'titulo, subtitulo, cta_primario...']].map(([label, val, setter, ph]) => (
                <div key={label as string}>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--slate)' }}
                  >
                    {label as string}
                  </label>
                  <input
                    value={val as string}
                    onChange={e => (setter as (v: string) => void)(e.target.value)}
                    placeholder={ph as string}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              ))}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'var(--slate)' }}
                >
                  Tipo
                </label>
                <select
                  value={newTipo}
                  onChange={e => setNewTipo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--slate)' }}
              >
                Valor
              </label>
              <textarea
                value={newValor}
                onChange={e => setNewValor(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={inputStyle}
              />
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
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--moss)', color: '#fff' }}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                style={{ color: 'var(--t2)', background: 'transparent', borderColor: 'var(--border)' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--t2)' }}>Cargando contenido...</p>
      ) : (
        <div className="space-y-3">
          {sections.map(seccion => {
            const sectionFields = fields.filter(f => f.seccion === seccion);
            const isOpen = expanded.has(seccion);
            return (
              <div
                key={seccion}
                className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: SHADOW_SM }}
              >
                <button
                  onClick={() => toggleSection(seccion)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer transition-colors hover:bg-[color:var(--bg-soft)]"
                  style={{ background: 'var(--bg)' }}
                >
                  <span className="text-sm font-semibold capitalize" style={{ color: 'var(--ink)' }}>{seccion}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--t3)' }}>{sectionFields.length} campos</span>
                    {isOpen
                      ? <ChevronDown size={16} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
                      : <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--slate)' }} />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div style={{ background: 'var(--bg)' }}>
                    {sectionFields.map(f => {
                      const isEditing = editing?.seccion === f.seccion && editing.campo === f.campo;
                      return (
                        <div
                          key={f.campo}
                          className="px-5 py-4 border-t"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <span
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--slate)' }}
                              >
                                {f.campo}
                              </span>
                              <span
                                className="ml-2 px-1.5 py-0.5 rounded text-xs border"
                                style={tipoChipStyle}
                              >
                                {f.tipo}
                              </span>
                            </div>
                            {!isEditing && (
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() => startEdit(f)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border"
                                  style={{
                                    background:  'color-mix(in oklch, var(--blue) 14%, white)',
                                    color:       'var(--blue)',
                                    borderColor: 'color-mix(in oklch, var(--blue) 30%, white)',
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => deleteField(f.seccion, f.campo)}
                                  className="p-1.5 rounded-lg cursor-pointer hover:bg-[color:var(--bg-soft)]"
                                  style={{ color: 'var(--red)' }}
                                >
                                  <Trash2 size={14} strokeWidth={1.5} />
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs" style={{ color: 'var(--slate)' }}>Tipo:</label>
                                <select
                                  value={editTipo}
                                  onChange={e => setEditTipo(e.target.value)}
                                  className="px-2 py-1 rounded text-xs outline-none"
                                  style={inputStyle}
                                >
                                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <textarea
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                rows={editTipo === 'html' ? 5 : 2}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                                style={inputStyle}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 cursor-pointer"
                                  style={{ background: 'var(--moss)', color: '#fff' }}
                                >
                                  <Save size={13} strokeWidth={2} />
                                  {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border"
                                  style={{ color: 'var(--t2)', background: 'transparent', borderColor: 'var(--border)' }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm" style={{ color: f.valor ? 'var(--ink)' : 'var(--t3)' }}>
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
