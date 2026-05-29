'use client';

import { useState, useCallback, type CSSProperties, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ORDER,
  ACCESS_TIER_LABELS,
  type DocumentType,
  type AccessTier,
} from '@/lib/marketplace/types';

interface DocumentUploadProps {
  projectId: string;
  onUploadComplete?: () => void;
}

const ACCESS_TIER_CHOICES: AccessTier[] = ['public', 'registered', 'nda_required'];

const labelStyle: CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)',
};

export default function DocumentUpload({ projectId, onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('exploration_geological');
  const [accessTier, setAccessTier] = useState<AccessTier>('registered');
  const [description, setDescription] = useState('');

  const acceptFile = useCallback((f: File | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF.'); return; }
    if (f.size > 100 * 1024 * 1024) { setError('El archivo supera 100 MB.'); return; }
    setFile(f);
    setError('');
    setSuccess('');
    setTitle((t) => t || f.name.replace(/\.pdf$/i, ''));
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files?.[0] ?? null);
  }, [acceptFile]);

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => acceptFile(e.target.files?.[0] ?? null);

  const reset = () => { setFile(null); setTitle(''); setDescription(''); };

  const handleUpload = async () => {
    if (!file || !title.trim()) { setError('Selecciona un archivo y escribe un título.'); return; }
    setUploading(true);
    setError('');
    setSuccess('');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title.trim());
    fd.append('documentType', documentType);
    fd.append('accessTier', accessTier);
    if (description.trim()) fd.append('description', description.trim());

    try {
      const res = await fetch(`/api/admin/marketplace/projects/${projectId}/documents`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.document?.id) {
        // Kick off OCR + embedding as its own server invocation. Not awaited —
        // the list refresh below will reflect the status as it progresses.
        fetch(`/api/admin/marketplace/documents/${data.document.id}/process`, { method: 'POST' })
          .catch(() => {});
        setSuccess(`"${title.trim()}" subido. Procesando OCR…`);
        reset();
        onUploadComplete?.();
      } else {
        setError(data.error || 'Error al subir el documento.');
      }
    } catch {
      setError('Error de red al subir.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 'clamp(20px, 4vw, 24px)' }}>
      <h3 className="text-lg" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
        Subir documento
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? 'var(--moss)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: 28,
          textAlign: 'center',
          background: isDragging ? 'color-mix(in oklch, var(--moss) 5%, white)' : 'var(--bg-soft)',
          transition: 'border-color .15s, background .15s',
        }}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FileText size={18} strokeWidth={1.5} style={{ color: 'var(--moss)' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
        ) : (
          <>
            <UploadCloud size={24} strokeWidth={1.5} style={{ color: 'var(--t3)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: 'var(--t2)' }}>
              Arrastra un PDF aquí o{' '}
              <label style={{ color: 'var(--moss)', cursor: 'pointer', textDecoration: 'underline' }}>
                selecciona
                <input type="file" accept="application/pdf" onChange={onSelect} style={{ display: 'none' }} />
              </label>
            </p>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>Máximo 100 MB</p>
          </>
        )}
      </div>

      {file && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle} htmlFor="mkt-title">Título</label>
            <input
              id="mkt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              placeholder="Ej: Reporte Técnico NI 43-101 — Proyecto San José"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle} htmlFor="mkt-type">Tipo de documento</label>
              <select
                id="mkt-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                style={inputStyle}
              >
                {DOCUMENT_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="mkt-access">Nivel de acceso</label>
              <select
                id="mkt-access"
                value={accessTier}
                onChange={(e) => setAccessTier(e.target.value as AccessTier)}
                style={inputStyle}
              >
                {ACCESS_TIER_CHOICES.map((t) => (
                  <option key={t} value={t}>{ACCESS_TIER_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="mkt-desc">Descripción (opcional)</label>
            <textarea
              id="mkt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
              placeholder="Breve descripción del contenido…"
            />
          </div>
        </div>
      )}

      {error && <p role="alert" style={{ marginTop: 12, fontSize: 14, color: 'var(--red)' }}>{error}</p>}
      {success && <p role="status" style={{ marginTop: 12, fontSize: 14, color: 'var(--green)' }}>{success}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-4 w-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          background: 'var(--ink)', color: '#fff', border: 'none',
        }}
      >
        {uploading ? 'Subiendo…' : 'Subir documento'}
      </button>
    </div>
  );
}
