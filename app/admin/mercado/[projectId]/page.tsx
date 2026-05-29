'use client';

import { useEffect, useState, useCallback, useMemo, type CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, RefreshCw, Download, UploadCloud, X } from 'lucide-react';
import DocumentUpload from '@/components/marketplace/DocumentUpload';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ORDER,
  ACCESS_TIER_LABELS,
  type DocumentType,
  type DocumentListItem,
  type OCRStatus,
  type ProjectRow,
  type SearchResultChunk,
} from '@/lib/marketplace/types';

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

// OCR status → label + Color-Manual token.
const OCR_PILL: Record<OCRStatus, { label: string; token: string }> = {
  pending:    { label: 'OCR pendiente',  token: 'amber' },
  queued:     { label: 'En cola',        token: 'amber' },
  processing: { label: 'Procesando…',    token: 'amber' },
  retrying:   { label: 'Reintentando…',  token: 'amber' },
  completed:  { label: 'OCR listo',      token: 'green' },
  failed:     { label: 'OCR falló',      token: 'red'   },
  skipped:    { label: 'OCR omitido',    token: 'slate' },
};

function pillStyle(token: string): CSSProperties {
  return {
    background: `color-mix(in oklch, var(--${token}) 14%, white)`,
    color: `var(--${token})`,
    border: `1px solid color-mix(in oklch, var(--${token}) 30%, white)`,
    padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  };
}

export default function ProjectDocumentsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [grouped, setGrouped] = useState<Record<string, DocumentListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultChunk[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/marketplace/projects/${projectId}/documents`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      const json = await res.json();
      setDocuments(json.documents ?? []);
      setGrouped(json.grouped ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/marketplace/projects/${projectId}`);
      if (res.ok) setProject((await res.json()).project ?? null);
    } catch { /* header meta is non-critical */ }
  }, [projectId]);

  // Fetch-on-mount — setLoading inside the callback trips the strict React 19
  // rule; same accepted pattern as app/dashboard/clientes/page.tsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadProject(); }, [loadProject]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const docTitleById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of documents) m[d.id] = d.title;
    return m;
  }, [documents]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch(`/api/admin/marketplace/projects/${projectId}/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json().catch(() => ({}));
      setSearchResults(res.ok ? (data.results ?? []) : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (docId: string) => {
    setBusyId(docId);
    try {
      const res = await fetch(`/api/admin/marketplace/documents/${docId}/download`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError(data.error || 'Error al generar el enlace de descarga.');
      }
    } catch {
      setError('Error de red al descargar.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReprocess = async (docId: string) => {
    setBusyId(docId);
    try {
      const res = await fetch(`/api/admin/marketplace/documents/${docId}/process`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error al reprocesar.');
      }
      await loadDocuments();
    } catch {
      setError('Error de red al reprocesar.');
    } finally {
      setBusyId(null);
    }
  };

  const renderGroup = (type: DocumentType, docs: DocumentListItem[]) => (
    <section key={type} className="mb-6">
      <h2 className="mb-2 px-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--slate)' }}>
        {DOCUMENT_TYPE_LABELS[type]}
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}>
        {docs.map((doc, i) => {
          const pill = OCR_PILL[doc.ocr_status] ?? OCR_PILL.pending;
          return (
            <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate" style={{ color: 'var(--t1)' }}>{doc.title}</div>
                <div className="flex items-center gap-2 flex-wrap mt-1" style={{ fontSize: 12, color: 'var(--t3)' }}>
                  {doc.page_count ? <span>{doc.page_count} págs.</span> : null}
                  {doc.file_size_bytes ? <span>· {(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span> : null}
                  <span>·</span>
                  <span style={pillStyle(pill.token)}>{pill.label}</span>
                  {doc.access_tier !== 'public' && (
                    <span style={pillStyle('slate')}>{ACCESS_TIER_LABELS[doc.access_tier]}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleReprocess(doc.id)}
                  disabled={busyId === doc.id}
                  aria-label="Reprocesar OCR"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  style={{ fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t2)' }}
                >
                  <RefreshCw size={13} strokeWidth={1.5} /> Reprocesar
                </button>
                <button
                  onClick={() => handleDownload(doc.id)}
                  disabled={busyId === doc.id}
                  aria-label="Descargar documento"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  style={{ fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t2)' }}
                >
                  <Download size={13} strokeWidth={1.5} /> Descargar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div style={{ color: 'var(--t1)' }}>
      {/* Breadcrumb + header */}
      <Link href="/admin/mercado" className="inline-flex items-center gap-1 text-sm mb-3 hover:underline" style={{ color: 'var(--moss)' }}>
        <ArrowLeft size={14} /> Proyectos
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {project?.name ?? 'Biblioteca de documentos'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
            {documents.length} documento{documents.length === 1 ? '' : 's'} en {Object.keys(grouped).length} categoría{Object.keys(grouped).length === 1 ? '' : 's'}
            {project?.region ? ` · ${project.region}` : ''}
          </p>
        </div>
        <button
          onClick={() => setShowUpload((s) => !s)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ background: 'var(--ink)', border: 'none', color: '#fff' }}
        >
          {showUpload ? <X size={16} strokeWidth={1.5} /> : <UploadCloud size={16} strokeWidth={1.5} />}
          {showUpload ? 'Cerrar' : 'Subir documento'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'color-mix(in oklch, var(--red) 8%, white)', border: '1px solid color-mix(in oklch, var(--red) 25%, white)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {showUpload && (
        <div className="mb-6">
          <DocumentUpload projectId={projectId} onUploadComplete={() => { void loadDocuments(); }} />
        </div>
      )}

      {/* Search */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
            placeholder="Buscar dentro de los documentos…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)' }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--ink)', color: '#fff', border: 'none' }}
        >
          {searching ? '…' : 'Buscar'}
        </button>
      </div>

      {/* Search results */}
      {searchResults && (
        <div className="mb-6 rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: SHADOW_SM }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Resultados de búsqueda</h3>
            <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="text-sm cursor-pointer hover:underline" style={{ color: 'var(--moss)' }}>Limpiar</button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--t3)' }}>No se encontraron resultados.</p>
          ) : (
            <div className="space-y-3">
              {searchResults.map((r) => (
                <div key={r.chunk_id} className="p-3 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
                  <p style={{ fontSize: 11, color: 'var(--moss)', marginBottom: 4 }}>
                    {docTitleById[r.document_id] ?? r.breadcrumb ?? 'Documento'}
                    {r.page_number ? ` · pág. ${r.page_number}` : ''}
                  </p>
                  <p className="text-sm line-clamp-3" style={{ color: 'var(--t2)' }}>{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* Category sidebar */}
        <aside className="w-56 shrink-0 hidden md:block">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--slate)', marginBottom: 8 }}>
            Categorías
          </div>
          <nav className="space-y-1">
            <CategoryButton active={selectedType === null} label="Todos" count={documents.length} onClick={() => setSelectedType(null)} />
            {DOCUMENT_TYPE_ORDER.map((t) => {
              const count = grouped[t]?.length ?? 0;
              if (count === 0) return null;
              return <CategoryButton key={t} active={selectedType === t} label={DOCUMENT_TYPE_LABELS[t]} count={count} onClick={() => setSelectedType(t)} />;
            })}
          </nav>
        </aside>

        {/* Document list */}
        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="px-4 py-12 text-center" style={{ color: 'var(--t3)' }}>Cargando documentos…</div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl px-4 py-12 text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t3)' }}>
              No hay documentos. Usa “Subir documento”.
            </div>
          ) : selectedType ? (
            renderGroup(selectedType, grouped[selectedType] ?? [])
          ) : (
            DOCUMENT_TYPE_ORDER.map((t) => (grouped[t]?.length ? renderGroup(t, grouped[t]) : null))
          )}
        </main>
      </div>
    </div>
  );
}

function CategoryButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between gap-2"
      style={{
        background: active ? 'var(--moss)' : 'transparent',
        color: active ? '#fff' : 'var(--t1)',
      }}
    >
      <span className="truncate">{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>{count}</span>
    </button>
  );
}
