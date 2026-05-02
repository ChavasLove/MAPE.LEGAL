'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertTriangle, FileText } from 'lucide-react';
import type { DashExpediente, DashHito, DashDoc } from '@/services/dashboardService';

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  activo:     { bg: '#E6F2EC', text: '#2F5D50', label: 'En trámite'  },
  alerta:     { bg: '#F5EBDD', text: '#8C6A4A', label: 'Atención'    },
  bloqueado:  { bg: '#F8E5E4', text: '#A94442', label: 'En pausa'    },
  nuevo:      { bg: '#DBEAFE', text: '#3A6EA5', label: 'Iniciado'    },
  completado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Completado'  },
};

const DOC_ESTADO: Record<string, { label: string; Icon: typeof CheckCircle2; color: string }> = {
  verificado: { label: 'Recibido y verificado', Icon: CheckCircle2,  color: '#3E7C59' },
  pendiente:  { label: 'En revisión',           Icon: Clock,         color: '#3A6EA5' },
  faltante:   { label: 'Requerido',             Icon: AlertTriangle, color: '#C49A4A' },
  rechazado:  { label: 'Requiere corrección',   Icon: AlertTriangle, color: '#A94442' },
};

export default function PortalPage() {
  const [expedientes, setExpedientes] = useState<DashExpediente[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    fetch('/api/expedientes')
      .then(r => r.json())
      .then(d => setExpedientes(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm font-sans" style={{ color: '#5E6B7A' }}>Cargando su expediente...</span>
      </div>
    );
  }

  // In the portal, clients only see their own expediente(s).
  // For now, show all (RLS on Supabase will filter by client in production).
  const exp = expedientes[0] ?? null;

  if (!exp) {
    return (
      <div className="text-center py-24">
        <FileText size={48} strokeWidth={1} className="mx-auto mb-4" style={{ color: '#A3AAB3' }} />
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#162033' }}>Sin expediente activo</h2>
        <p className="text-sm font-sans" style={{ color: '#5E6B7A' }}>
          Su expediente aún no ha sido registrado en el sistema.<br />
          Por favor contacte a su abogado asignado.
        </p>
      </div>
    );
  }

  const badge = ESTADO_BADGE[exp.estado] ?? ESTADO_BADGE.activo;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold" style={{ color: '#162033' }}>{exp.id}</h1>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold font-sans"
                style={{ background: badge.bg, color: badge.text }}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-sm font-sans" style={{ color: '#5E6B7A' }}>
              {exp.tipo} · {exp.municipio}
            </p>
            <p className="text-xs font-sans mt-1" style={{ color: '#A3AAB3' }}>
              Inicio: {exp.inicio}
              {exp.cierreEst ? ` · Cierre estimado: ${exp.cierreEst}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider font-sans mb-1" style={{ color: '#5E6B7A' }}>
              Índice de legalidad
            </p>
            <p className="text-3xl font-bold" style={{ color: '#162033' }}>{exp.legalidad}%</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 rounded-full" style={{ background: '#E5E7EB' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${exp.legalidad}%`, background: '#2F5D50' }}
            />
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { label: 'Abogado CHT', nombre: exp.abogado.nombre, initials: exp.abogado.initials, color: '#3A6EA5', bg: '#DBEAFE' },
          { label: 'Técnico Ambiental', nombre: exp.psa.nombre, initials: exp.psa.initials, color: '#2F5D50', bg: '#E6F2EC' },
        ].map(({ label, nombre, initials, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border p-5 shadow-sm flex items-center gap-4" style={{ borderColor: '#E5E7EB' }}>
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold font-sans shrink-0"
              style={{ background: bg, color }}
            >
              {initials}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider font-sans mb-0.5" style={{ color: '#5E6B7A' }}>{label}</p>
              <p className="text-sm font-semibold font-sans" style={{ color: '#162033' }}>{nombre}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Hitos de pago */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h2 className="text-base font-semibold font-sans" style={{ color: '#162033' }}>Hitos de pago</h2>
        </div>
        <div className="divide-y" style={{ borderColor: '#E5E7EB' }}>
          {exp.hitos.map((h: DashHito) => (
            <div key={h.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold font-sans" style={{ color: '#162033' }}>{h.trigger}</p>
                {h.fecha && <p className="text-xs font-sans mt-0.5" style={{ color: '#A3AAB3' }}>{h.fecha}</p>}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-base font-bold font-sans" style={{ color: '#162033' }}>
                    L. {h.monto.toLocaleString('es-HN')}
                  </p>
                  <p className="text-xs font-sans" style={{ color: '#A3AAB3' }}>{h.pct}%</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold font-sans"
                  style={{
                    background: h.estado === 'cobrado' ? '#E6F2EC' : h.estado === 'bloqueado' ? '#F5EBDD' : '#DBEAFE',
                    color:      h.estado === 'cobrado' ? '#2F5D50' : h.estado === 'bloqueado' ? '#8C6A4A' : '#3A6EA5',
                  }}
                >
                  {h.estado === 'cobrado' ? 'Pagado' : h.estado === 'bloqueado' ? 'Pendiente' : 'Por pagar'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documentos */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h2 className="text-base font-semibold font-sans" style={{ color: '#162033' }}>Documentos requeridos</h2>
        </div>
        <div className="divide-y" style={{ borderColor: '#E5E7EB' }}>
          {exp.documentos.map((d: DashDoc) => {
            const ds = DOC_ESTADO[d.estado] ?? DOC_ESTADO.faltante;
            const { Icon } = ds;
            return (
              <div key={d.id} className="px-6 py-4 flex items-center gap-4">
                <FileText size={18} strokeWidth={1.5} style={{ color: '#A3AAB3' }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-sans" style={{ color: '#162033' }}>{d.nombre}</p>
                  <p className="text-xs font-sans mt-0.5" style={{ color: '#5E6B7A' }}>{d.info}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold font-sans shrink-0" style={{ color: ds.color }}>
                  <Icon size={14} strokeWidth={2} />
                  {ds.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs font-sans text-center" style={{ color: '#A3AAB3' }}>
        Para enviar documentos o hacer consultas, contáctese con su abogado asignado por WhatsApp.
      </p>
    </div>
  );
}
