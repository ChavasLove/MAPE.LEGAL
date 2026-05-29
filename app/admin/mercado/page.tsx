'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import { Briefcase, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import {
  PROJECT_STAGE_LABELS,
  TENEMENT_STATUS_LABELS,
  PROJECT_STAGE_VALUES,
  type ProjectListItem,
  type ProjectStage,
} from '@/lib/marketplace/types';

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';
const inputStyle: CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)' };

export default function MercadoProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [region, setRegion] = useState('');
  const [stage, setStage] = useState<ProjectStage | ''>('');
  const [commodity, setCommodity] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/marketplace/projects');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      const json = await res.json();
      setProjects(json.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch-on-mount — setLoading inside the callback trips the strict React 19
  // rule; same accepted pattern as app/dashboard/clientes/page.tsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const createProject = async () => {
    if (name.trim().length < 3) { setSaveError('El nombre debe tener al menos 3 caracteres.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/admin/marketplace/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          company_name: company.trim() || null,
          region: region.trim() || null,
          project_stage: stage || null,
          commodity: commodity.trim() ? commodity.split(',').map((c) => c.trim()).filter(Boolean) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data.error || 'Error al crear el proyecto.'); return; }
      setName(''); setCompany(''); setRegion(''); setStage(''); setCommodity('');
      setShowForm(false);
      await load();
    } catch {
      setSaveError('Error de red al crear.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ color: 'var(--t1)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div style={{ color: 'var(--slate)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
            Mercado de proyectos
          </div>
          <h1 className="text-3xl mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            Proyectos Mineros
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
            Junior ventures con su biblioteca de documentos técnicos, permisos y reportes. Búsqueda y OCR por proyecto.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void load(); }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            <RefreshCw size={16} strokeWidth={1.5} /> Refrescar
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--ink)', border: 'none', color: '#fff' }}
          >
            <Plus size={16} strokeWidth={1.5} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-4 mb-6 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>Nombre *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="Proyecto Aurífero San José" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>Empresa</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="Minera San José S.A." />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>Región / Departamento</label>
              <input value={region} onChange={(e) => setRegion(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="Olancho" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>Etapa</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as ProjectStage | '')} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">—</option>
                {PROJECT_STAGE_VALUES.map((s) => <option key={s} value={s}>{PROJECT_STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--slate)' }}>Minerales (separados por coma)</label>
              <input value={commodity} onChange={(e) => setCommodity(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="gold, silver" />
            </div>
          </div>
          {saveError && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--red)' }}>{saveError}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={createProject} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--ink)', color: '#fff', border: 'none' }}>
              {saving ? 'Creando…' : 'Crear proyecto'}
            </button>
            <button onClick={() => { setShowForm(false); setSaveError(''); }} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--ink)', color: '#fff' }}>
            <tr>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Proyecto</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Empresa</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Región</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Etapa</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Tenencia</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Docs</th>
              <th scope="col" className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--t3)' }}>Cargando…</td></tr>}
            {error && !loading && <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--red)' }}>{error}</td></tr>}
            {!loading && !error && projects.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--t3)' }}>Sin proyectos todavía. Crea el primero.</td></tr>
            )}
            {!loading && projects.map((p) => (
              <tr key={p.id} className="border-t hover:bg-[color:var(--bg-soft)]" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3 align-top">
                  <Link href={`/admin/mercado/${p.id}`} className="font-medium hover:underline" style={{ color: 'var(--ink)' }}>{p.name}</Link>
                  {p.commodity && p.commodity.length > 0 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t3)' }}>{p.commodity.join(' · ')}</div>
                  )}
                </td>
                <td className="px-4 py-3 align-top" style={{ color: 'var(--t2)' }}>{p.company_name ?? '—'}</td>
                <td className="px-4 py-3 align-top" style={{ color: 'var(--t2)' }}>{p.region ?? '—'}</td>
                <td className="px-4 py-3 align-top" style={{ color: 'var(--t2)' }}>{p.project_stage ? PROJECT_STAGE_LABELS[p.project_stage] : '—'}</td>
                <td className="px-4 py-3 align-top" style={{ color: 'var(--t2)' }}>{p.tenement_status ? TENEMENT_STATUS_LABELS[p.tenement_status] : '—'}</td>
                <td className="px-4 py-3 align-top"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)' }}>{p.document_count ?? 0}</span></td>
                <td className="px-4 py-3 align-top text-right">
                  <Link href={`/admin/mercado/${p.id}`} className="inline-flex items-center gap-1 text-sm hover:underline" style={{ color: 'var(--moss)' }}>
                    Abrir <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-start gap-2 text-xs" style={{ color: 'var(--t3)' }}>
        <Briefcase size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <div>Fase 1 (admin-only): subida y gestión de documentos. La OCR usa Mistral; la búsqueda combina embeddings (OpenAI) y texto completo.</div>
      </div>
    </div>
  );
}
