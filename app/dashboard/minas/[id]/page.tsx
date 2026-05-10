'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Edit3, X, ShieldCheck } from 'lucide-react';

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  en_tramite:  { bg: '#F4E9D6', text: '#8B6A4A', label: 'En trámite' },
  activa:      { bg: '#E0EDE3', text: '#2F5D50', label: 'Activa'     },
  suspendida:  { bg: '#EFD7D5', text: '#B23A3A', label: 'Suspendida' },
  clausurada:  { bg: '#EFD7D5', text: '#B23A3A', label: 'Clausurada' },
};

const CONCESION_LABEL: Record<string, string> = {
  artesanal:   'Artesanal',
  exploracion: 'Exploración',
  explotacion: 'Explotación',
};

const COMPONENT_LABEL: Record<string, string> = {
  tierra:    'Tenencia de tierra',
  inhgeomin: 'Permiso INHGEOMIN',
  ambiental: 'Licencia ambiental',
  municipal: 'Permiso municipal',
  registro:  'Registro como comercializador',
};

const COMPONENT_ORDER = ['tierra', 'inhgeomin', 'ambiental', 'municipal', 'registro'];

const COMPONENT_ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pendiente:   { bg: '#2A3347', text: '#A3A8AB', label: 'Pendiente'   },
  en_proceso:  { bg: '#F4E9D6', text: '#8B6A4A', label: 'En proceso'  },
  cumplido:    { bg: '#E0EDE3', text: '#2F5D50', label: 'Cumplido'    },
  alerta:      { bg: '#F2D8B0', text: '#8B6A4A', label: 'Alerta'      },
  incumplido:  { bg: '#EFD7D5', text: '#B23A3A', label: 'Incumplido'  },
};

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  formalizacion_mape:   'Formalización MAPE',
  consultoria:          'Consultoría',
  representacion_legal: 'Representación legal',
  estudio_ambiental:    'Estudio ambiental',
  otro:                 'Otro',
};

const ESTADO_CONTRATO_LABEL: Record<string, string> = {
  borrador:    'Borrador',
  activo:      'Activo',
  completado:  'Completado',
  rescindido:  'Rescindido',
  vencido:     'Vencido',
};

const ESTADO_TX_LABEL: Record<string, string> = {
  registrada: 'Registrada',
  verificada: 'Verificada',
  liquidada:  'Liquidada',
  auditada:   'Auditada',
  impugnada:  'Impugnada',
};

interface Mina {
  id: string;
  cliente_id: string | null;
  nombre: string;
  codigo: string | null;
  latitud: number | null;
  longitud: number | null;
  municipio: string | null;
  departamento: string | null;
  area_hectareas: number | null;
  tipo_mineral: string;
  tipo_concesion: string;
  estado: string;
  created_at: string;
}

interface Cliente {
  id: string;
  nombre: string | null;
  dpi: string | null;
  telefono_whatsapp: string | null;
  municipio: string | null;
  departamento: string | null;
}

interface IndiceComponente {
  id: string | null;
  componente: string;
  estado: string;
  puntaje: number;
  notas: string | null;
  verificado_en: string | null;
  _persisted?: boolean;
}

interface Contrato {
  id: string;
  tipo: string;
  fecha_firma: string | null;
  fecha_vencimiento: string | null;
  monto_total: number | null;
  moneda: string;
  estado: string;
}

interface Transaccion {
  id: string;
  fecha: string;
  gramos: number;
  precio_usd_gramo: number;
  total_usd: number;
  total_hnl: number;
  estado: string;
}

interface DetailPayload {
  mina: Mina;
  cliente: Cliente | null;
  indice_legalidad: IndiceComponente[];
  contratos: Contrato[];
  transacciones: Transaccion[];
  certificados_count: number;
}

interface IndicePayload {
  componentes: IndiceComponente[];
  total: number;
}

interface ClienteOption {
  id: string;
  nombre: string | null;
  telefono_whatsapp: string | null;
}

type Tab = 'general' | 'legalidad' | 'contratos' | 'transacciones';

function formatCoord(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '—';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function formatArea(ha: number | null): string {
  if (ha == null) return '—';
  return `${new Intl.NumberFormat('es-HN', { maximumFractionDigits: 2 }).format(ha)} ha`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(value: number | null, moneda: string): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number | null, frac = 3): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-HN', { maximumFractionDigits: frac }).format(value);
}

function scoreColor(total: number): string {
  if (total >= 80) return '#2A8E50';
  if (total >= 50) return '#C58B2C';
  return '#B23A3A';
}

interface EditMineForm {
  cliente_id:     string;
  nombre:         string;
  codigo:         string;
  latitud:        string;
  longitud:       string;
  municipio:      string;
  departamento:   string;
  area_hectareas: string;
  tipo_mineral:   string;
  tipo_concesion: string;
  estado:         string;
}

function mineToForm(m: Mina): EditMineForm {
  return {
    cliente_id:     m.cliente_id ?? '',
    nombre:         m.nombre ?? '',
    codigo:         m.codigo ?? '',
    latitud:        m.latitud != null ? String(m.latitud) : '',
    longitud:       m.longitud != null ? String(m.longitud) : '',
    municipio:      m.municipio ?? '',
    departamento:   m.departamento ?? '',
    area_hectareas: m.area_hectareas != null ? String(m.area_hectareas) : '',
    tipo_mineral:   m.tipo_mineral,
    tipo_concesion: m.tipo_concesion,
    estado:         m.estado,
  };
}

interface EditCompForm {
  componente: string;
  estado:     string;
  puntaje:    string;
  notas:      string;
}

export default function MinaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [data, setData]       = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab]         = useState<Tab>('general');

  const [indice, setIndice]       = useState<IndicePayload | null>(null);
  const [indiceLoading, setIndiceLoading] = useState(false);

  const [editOpen, setEditOpen]   = useState(false);
  const [editForm, setEditForm]   = useState<EditMineForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [clientes, setClientes]   = useState<ClienteOption[]>([]);

  const [compEditOpen, setCompEditOpen]   = useState(false);
  const [compForm, setCompForm]           = useState<EditCompForm | null>(null);
  const [compError, setCompError]         = useState<string | null>(null);
  const [compSubmitting, setCompSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/minas/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const payload = await res.json();
      setData(payload);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [id]);

  const loadIndice = useCallback(async () => {
    setIndiceLoading(true);
    try {
      const res = await fetch(`/api/admin/indice-legalidad/${id}`);
      const payload = await res.json();
      setIndice(payload);
    } catch { /* silent */ } finally {
      setIndiceLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (tab !== 'legalidad' || indice) return;
    let cancelled = false;
    (async () => {
      await loadIndice();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [tab, indice, loadIndice]);

  useEffect(() => {
    if (!editOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/clientes');
        const list = await res.json();
        if (!cancelled) setClientes(Array.isArray(list) ? list : []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [editOpen]);

  const openEdit = () => {
    if (!data) return;
    setEditForm(mineToForm(data.mina));
    setEditError(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (editSubmitting) return;
    setEditOpen(false);
    setEditError(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nombre:         editForm.nombre.trim(),
        cliente_id:     editForm.cliente_id || null,
        codigo:         editForm.codigo.trim() || null,
        municipio:      editForm.municipio.trim() || null,
        departamento:   editForm.departamento.trim() || null,
        latitud:        editForm.latitud.trim()  ? Number(editForm.latitud)  : null,
        longitud:       editForm.longitud.trim() ? Number(editForm.longitud) : null,
        area_hectareas: editForm.area_hectareas.trim() ? Number(editForm.area_hectareas) : null,
        tipo_mineral:   editForm.tipo_mineral,
        tipo_concesion: editForm.tipo_concesion,
        estado:         editForm.estado,
      };

      const res = await fetch(`/api/admin/minas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        setEditError(result?.error ?? 'No se pudo actualizar la mina.');
        return;
      }
      setEditOpen(false);
      await load();
    } catch {
      setEditError('Error de red. Intenta de nuevo.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openCompEdit = (c: IndiceComponente) => {
    setCompForm({
      componente: c.componente,
      estado:     c.estado,
      puntaje:    String(c.puntaje ?? 0),
      notas:      c.notas ?? '',
    });
    setCompError(null);
    setCompEditOpen(true);
  };

  const closeCompEdit = () => {
    if (compSubmitting) return;
    setCompEditOpen(false);
    setCompError(null);
  };

  const submitCompEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compForm) return;
    setCompError(null);
    setCompSubmitting(true);
    try {
      const puntaje = Number(compForm.puntaje);
      const payload = {
        componente: compForm.componente,
        estado:     compForm.estado,
        puntaje:    isFinite(puntaje) ? puntaje : 0,
        notas:      compForm.notas.trim() || null,
      };
      const res = await fetch(`/api/admin/indice-legalidad/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        setCompError(result?.error ?? 'No se pudo guardar el componente.');
        return;
      }
      setCompEditOpen(false);
      await loadIndice();
    } catch {
      setCompError('Error de red. Intenta de nuevo.');
    } finally {
      setCompSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-white text-lg font-bold mb-2">Mina no encontrada</p>
        <p className="text-sm font-sans mb-6" style={{ color: '#A3A8AB' }}>
          La mina que buscas no existe o fue removida.
        </p>
        <Link
          href="/dashboard/minas"
          className="px-4 py-2 rounded-lg text-sm font-medium font-sans"
          style={{ background: '#2F5D50', color: '#fff' }}
        >
          ← Volver a minas
        </Link>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div>
        <Link
          href="/dashboard/minas"
          className="inline-flex items-center gap-1.5 text-sm font-sans mb-4"
          style={{ color: '#A3A8AB' }}
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Volver a minas
        </Link>
        <p className="text-sm font-sans" style={{ color: '#A3A8AB' }}>Cargando...</p>
      </div>
    );
  }

  const m = data.mina;
  const badge = ESTADO_BADGE[m.estado] ?? { bg: '#2A3347', text: '#5E6B7B', label: m.estado };
  const cliente = data.cliente;

  return (
    <div>
      <Link
        href="/dashboard/minas"
        className="inline-flex items-center gap-1.5 text-sm font-sans mb-4 hover:underline"
        style={{ color: '#A3A8AB' }}
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Volver a minas
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">
              {m.codigo ?? 'Sin código'} · {m.nombre}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text }}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm font-sans mt-1" style={{ color: '#A3A8AB' }}>
            Registrada el {formatDate(m.created_at)}
          </p>
        </div>
        <button
          onClick={openEdit}
          className="px-3 py-2 rounded-lg text-sm font-medium font-sans flex items-center gap-2 transition-colors cursor-pointer"
          style={{ background: '#2F5D50', color: '#fff' }}
        >
          <Edit3 size={14} strokeWidth={1.8} />
          Editar
        </button>
      </div>

      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
        {([
          ['general',       'General'],
          ['legalidad',     'Índice de Legalidad'],
          ['contratos',     'Contratos'],
          ['transacciones', 'Transacciones'],
        ] as [Tab, string][]).map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-2.5 text-sm font-medium font-sans transition-colors cursor-pointer"
              style={{
                color: active ? '#fff' : '#A3A8AB',
                borderBottom: active ? '2px solid #2F5D50' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl p-5" style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.3)' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#A3A8AB' }}>
              Datos generales
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Nombre" value={m.nombre} />
              <Field label="Código" value={m.codigo} mono />
              <Field label="Municipio" value={m.municipio} />
              <Field label="Departamento" value={m.departamento} />
              <Field
                label="Coordenadas"
                value={
                  m.latitud != null && m.longitud != null ? (
                    <span className="inline-flex items-center gap-1.5 text-white">
                      <MapPin size={13} strokeWidth={1.5} />
                      {formatCoord(m.latitud, m.longitud)}
                    </span>
                  ) : '—'
                }
                mono
              />
              <Field label="Área" value={formatArea(m.area_hectareas)} />
              <Field label="Mineral" value={<span className="capitalize">{m.tipo_mineral}</span>} />
              <Field label="Concesión" value={CONCESION_LABEL[m.tipo_concesion] ?? m.tipo_concesion} />
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.3)' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#A3A8AB' }}>
              Cliente
            </h2>
            {cliente ? (
              <div className="space-y-3">
                <Field label="Nombre" value={cliente.nombre ?? '—'} />
                <Field label="DPI" value={cliente.dpi ?? '—'} mono />
                <Field label="WhatsApp" value={cliente.telefono_whatsapp ?? '—'} mono />
                <Field
                  label="Ubicación"
                  value={
                    cliente.municipio
                      ? `${cliente.municipio}${cliente.departamento ? `, ${cliente.departamento}` : ''}`
                      : '—'
                  }
                />
                <div className="pt-2 border-t" style={{ borderColor: 'rgba(94,107,123,0.2)' }}>
                  <Link href="/dashboard/clientes" className="text-xs font-sans hover:underline" style={{ color: '#587E5E' }}>
                    Ver todos los clientes →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm font-sans" style={{ color: '#A3A8AB' }}>
                Esta mina no tiene cliente vinculado.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'legalidad' && (
        <LegalidadTab
          loading={indiceLoading}
          indice={indice}
          onEdit={openCompEdit}
        />
      )}

      {tab === 'contratos' && (
        <ContratosTab contratos={data.contratos} />
      )}

      {tab === 'transacciones' && (
        <TransaccionesTab
          transacciones={data.transacciones}
          certificadosCount={data.certificados_count}
        />
      )}

      {editOpen && editForm && (
        <EditMineModal
          form={editForm}
          setForm={setEditForm as (f: EditMineForm) => void}
          clientes={clientes}
          error={editError}
          submitting={editSubmitting}
          onClose={closeEdit}
          onSubmit={submitEdit}
        />
      )}

      {compEditOpen && compForm && (
        <EditComponentModal
          form={compForm}
          setForm={setCompForm as (f: EditCompForm) => void}
          error={compError}
          submitting={compSubmitting}
          onClose={closeCompEdit}
          onSubmit={submitCompEdit}
        />
      )}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#A3A8AB' }}>
        {label}
      </p>
      <p className={`text-sm text-white ${mono ? 'font-mono' : 'font-sans'}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}

function LegalidadTab({
  loading,
  indice,
  onEdit,
}: {
  loading: boolean;
  indice: IndicePayload | null;
  onEdit: (c: IndiceComponente) => void;
}) {
  if (loading || !indice) {
    return <p className="text-sm font-sans" style={{ color: '#A3A8AB' }}>Cargando índice...</p>;
  }

  const total = indice.total;
  const color = scoreColor(total);
  const sorted = [...indice.componentes].sort(
    (a, b) => COMPONENT_ORDER.indexOf(a.componente) - COMPONENT_ORDER.indexOf(b.componente)
  );

  return (
    <div className="rounded-xl p-5" style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.3)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white">Índice de Legalidad</h2>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color }}>{total}</span>
          <span className="text-sm font-sans" style={{ color: '#A3A8AB' }}>/ 100</span>
        </div>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: 'rgba(94,107,123,0.25)' }}>
        <div
          className="h-full transition-all"
          style={{ width: `${Math.min(100, total)}%`, background: color }}
        />
      </div>

      <div className="space-y-3">
        {sorted.map(c => {
          const badge = COMPONENT_ESTADO_BADGE[c.estado] ?? { bg: '#2A3347', text: '#5E6B7B', label: c.estado };
          return (
            <div
              key={c.componente}
              className="flex items-center gap-4 px-4 py-3 rounded-lg"
              style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.2)' }}
            >
              <ShieldCheck size={18} strokeWidth={1.5} style={{ color: '#587E5E' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{COMPONENT_LABEL[c.componente] ?? c.componente}</p>
                {c.notas && (
                  <p className="text-xs font-sans mt-0.5 truncate" style={{ color: '#A3A8AB' }} title={c.notas}>
                    {c.notas}
                  </p>
                )}
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text }}>
                {badge.label}
              </span>
              <span className="text-sm font-mono text-white w-16 text-right">
                {c.puntaje} / 20
              </span>
              <button
                onClick={() => onEdit(c)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium font-sans hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1"
                style={{ color: '#A3A8AB' }}
              >
                <Edit3 size={12} strokeWidth={1.8} />
                Editar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContratosTab({ contratos }: { contratos: Contrato[] }) {
  return (
    <div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A38' }}>
              {['Tipo', 'Fecha firma', 'Vencimiento', 'Monto', 'Moneda', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3A8AB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: '#A3A8AB', background: '#1F2A38' }}>
                  Sin contratos registrados aún.
                </td>
              </tr>
            ) : contratos.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid rgba(94,107,123,0.2)', background: '#1F2A38' }}>
                <td className="px-4 py-3 text-white">{TIPO_CONTRATO_LABEL[c.tipo] ?? c.tipo}</td>
                <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{formatDate(c.fecha_firma)}</td>
                <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{formatDate(c.fecha_vencimiento)}</td>
                <td className="px-4 py-3 text-white">{formatMoney(c.monto_total, c.moneda)}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#A3A8AB' }}>{c.moneda}</td>
                <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{ESTADO_CONTRATO_LABEL[c.estado] ?? c.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs font-sans mt-3" style={{ color: '#5E6B7B' }}>
        Gestión de contratos disponible en Fase 2C.
      </p>
    </div>
  );
}

function TransaccionesTab({
  transacciones,
  certificadosCount,
}: {
  transacciones: Transaccion[];
  certificadosCount: number;
}) {
  return (
    <div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A38' }}>
              {['Fecha', 'Gramos', 'Precio USD/g', 'Total USD', 'Total HNL', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#A3A8AB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transacciones.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: '#A3A8AB', background: '#1F2A38' }}>
                  Sin transacciones registradas aún.
                </td>
              </tr>
            ) : transacciones.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid rgba(94,107,123,0.2)', background: '#1F2A38' }}>
                <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{formatDate(t.fecha)}</td>
                <td className="px-4 py-3 text-white font-mono">{formatNumber(t.gramos, 3)}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#A3A8AB' }}>{formatNumber(t.precio_usd_gramo, 4)}</td>
                <td className="px-4 py-3 text-white font-mono">{formatMoney(t.total_usd, 'USD')}</td>
                <td className="px-4 py-3 text-white font-mono">{formatMoney(t.total_hnl, 'HNL')}</td>
                <td className="px-4 py-3" style={{ color: '#A3A8AB' }}>{ESTADO_TX_LABEL[t.estado] ?? t.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs font-sans" style={{ color: '#5E6B7B' }}>
          Registro de transacciones disponible en Fase 2B.
        </p>
        <Link
          href="/verificar"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-sans hover:underline"
          style={{ background: 'rgba(42, 142, 80, 0.15)', color: '#2A8E50', border: '1px solid rgba(42, 142, 80, 0.3)' }}
        >
          Certificados emitidos: {certificadosCount}
        </Link>
      </div>
    </div>
  );
}

function EditMineModal({
  form,
  setForm,
  clientes,
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  form: EditMineForm;
  setForm: (f: EditMineForm) => void;
  clientes: ClienteOption[];
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(15, 22, 33, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
          <h2 className="text-lg font-bold text-white">Editar mina</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: '#A3A8AB' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
              Nombre <span style={{ color: '#B23A3A' }}>*</span>
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
              style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
              Cliente
            </label>
            <select
              value={form.cliente_id}
              onChange={e => setForm({ ...form, cliente_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
              style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
            >
              <option value="">— Sin cliente vinculado —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre ?? '(sin nombre)'} {c.telefono_whatsapp ? `· ${c.telefono_whatsapp}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                Código
              </label>
              <input
                type="text"
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                placeholder="MINA-AAAA-NNN"
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              />
              <p className="text-xs mt-1" style={{ color: '#C58B2C' }}>Cambiar el código rompe enlaces existentes — hazlo con cuidado.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
                Área (ha)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.area_hectareas}
                onChange={e => setForm({ ...form, area_hectareas: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Municipio</label>
              <input
                type="text"
                value={form.municipio}
                onChange={e => setForm({ ...form, municipio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Departamento</label>
              <input
                type="text"
                value={form.departamento}
                onChange={e => setForm({ ...form, departamento: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Latitud</label>
              <input
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={form.latitud}
                onChange={e => setForm({ ...form, latitud: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Longitud</label>
              <input
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={form.longitud}
                onChange={e => setForm({ ...form, longitud: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Mineral</label>
              <select
                value={form.tipo_mineral}
                onChange={e => setForm({ ...form, tipo_mineral: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none capitalize"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              >
                <option value="oro">Oro</option>
                <option value="plata">Plata</option>
                <option value="cobre">Cobre</option>
                <option value="zinc">Zinc</option>
                <option value="plomo">Plomo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Concesión</label>
              <select
                value={form.tipo_concesion}
                onChange={e => setForm({ ...form, tipo_concesion: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              >
                <option value="artesanal">Artesanal</option>
                <option value="exploracion">Exploración</option>
                <option value="explotacion">Explotación</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
              >
                <option value="en_tramite">En trámite</option>
                <option value="activa">Activa</option>
                <option value="suspendida">Suspendida</option>
                <option value="clausurada">Clausurada (retirar)</option>
              </select>
            </div>
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded-lg text-sm font-sans"
              style={{ background: 'rgba(178,58,58,0.15)', border: '1px solid rgba(178,58,58,0.4)', color: '#EFD7D5' }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium font-sans"
              style={{ background: 'transparent', color: '#A3A8AB', border: '1px solid rgba(94,107,123,0.3)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium font-sans disabled:opacity-60"
              style={{ background: '#2F5D50', color: '#fff' }}
            >
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditComponentModal({
  form,
  setForm,
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  form: EditCompForm;
  setForm: (f: EditCompForm) => void;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(15, 22, 33, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-md"
        style={{ background: '#1F2A38', border: '1px solid rgba(94,107,123,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(94,107,123,0.3)' }}>
          <h2 className="text-base font-bold text-white">
            {COMPONENT_LABEL[form.componente] ?? form.componente}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: '#A3A8AB' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Estado</label>
            <select
              value={form.estado}
              onChange={e => setForm({ ...form, estado: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
              style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="cumplido">Cumplido</option>
              <option value="alerta">Alerta</option>
              <option value="incumplido">Incumplido</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>
              Puntaje (0–20)
            </label>
            <input
              type="number"
              min={0}
              max={20}
              step={1}
              value={form.puntaje}
              onChange={e => setForm({ ...form, puntaje: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
              style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A3A8AB' }}>Notas</label>
            <textarea
              rows={3}
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none resize-none"
              style={{ background: '#0F1621', border: '1px solid rgba(94,107,123,0.3)', color: 'white' }}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded-lg text-sm font-sans"
              style={{ background: 'rgba(178,58,58,0.15)', border: '1px solid rgba(178,58,58,0.4)', color: '#EFD7D5' }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium font-sans"
              style={{ background: 'transparent', color: '#A3A8AB', border: '1px solid rgba(94,107,123,0.3)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium font-sans disabled:opacity-60"
              style={{ background: '#2F5D50', color: '#fff' }}
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
