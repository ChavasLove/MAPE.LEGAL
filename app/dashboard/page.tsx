'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderOpen, AlertTriangle, CheckCircle2, Clock, Plus } from 'lucide-react';
import type { DashExpediente } from '@/services/dashboardService';

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  activo:     { bg: '#E6F2EC', text: '#2F5D50', label: 'Activo'      },
  alerta:     { bg: '#F5EBDD', text: '#8C6A4A', label: 'Alerta'      },
  bloqueado:  { bg: '#F8E5E4', text: '#A94442', label: 'Bloqueado'   },
  nuevo:      { bg: '#DBEAFE', text: '#3A6EA5', label: 'Nuevo'       },
  completado: { bg: '#E6F2EC', text: '#2F5D50', label: 'Completado'  },
};

export default function DashboardPage() {
  const [expedientes, setExpedientes] = useState<DashExpediente[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    fetch('/api/expedientes')
      .then(r => r.json())
      .then(d => setExpedientes(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total:      expedientes.length,
    activos:    expedientes.filter(e => e.estado === 'activo').length,
    alertas:    expedientes.filter(e => e.estado === 'alerta' || e.estado === 'bloqueado').length,
    completados: expedientes.filter(e => e.estado === 'completado').length,
  };

  const statCards = [
    { label: 'Total',      value: stats.total,       Icon: FolderOpen,    color: '#3A6EA5', bg: '#DBEAFE' },
    { label: 'Activos',    value: stats.activos,     Icon: CheckCircle2,  color: '#3E7C59', bg: '#E6F2EC' },
    { label: 'Alertas',    value: stats.alertas,     Icon: AlertTriangle, color: '#C49A4A', bg: '#F5EBDD' },
    { label: 'Completados',value: stats.completados, Icon: Clock,         color: '#5E6B7A', bg: '#F5F6F7' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Resumen operativo</h1>
          <p className="text-sm font-sans" style={{ color: '#A3AAB3' }}>
            Piloto Iriona 2026 · MAPE.LEGAL
          </p>
        </div>
        <Link
          href="/dashboard/expedientes"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold font-sans text-white cursor-pointer"
          style={{ background: '#2F5D50' }}
        >
          <Plus size={16} strokeWidth={2} />
          Nuevo expediente
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map(({ label, value, Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl border p-6"
            style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium font-sans" style={{ color: '#A3AAB3' }}>{label}</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                <Icon size={18} strokeWidth={1.5} style={{ color }} />
              </div>
            </div>
            <div className="text-4xl font-bold text-white font-sans">
              {loading ? '—' : value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent expedientes */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
        >
          <h2 className="text-base font-semibold text-white font-sans">Expedientes recientes</h2>
          <Link
            href="/dashboard/expedientes"
            className="text-xs font-sans hover:underline"
            style={{ color: '#A3AAB3' }}
          >
            Ver todos →
          </Link>
        </div>

        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#1F2A44' }}>
              {['Expediente', 'Cliente', 'Fase', 'Legalidad', 'Abogado', 'Estado'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#A3AAB3' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-sans text-sm" style={{ color: '#A3AAB3', background: '#162033' }}>
                  Cargando expedientes...
                </td>
              </tr>
            ) : expedientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-sans text-sm" style={{ color: '#A3AAB3', background: '#162033' }}>
                  No hay expedientes registrados.
                </td>
              </tr>
            ) : (
              expedientes.slice(0, 6).map(e => {
                const badge = ESTADO_BADGE[e.estado] ?? ESTADO_BADGE.activo;
                return (
                  <tr
                    key={e.id}
                    style={{ borderTop: '1px solid rgba(94,107,122,0.2)', background: '#162033' }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/expedientes/${e.id}`}
                        className="font-semibold text-white hover:underline"
                      >
                        {e.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>{e.cliente}</td>
                    <td className="px-4 py-3" style={{ color: '#A3AAB3' }}>Fase {e.fase}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(94,107,122,0.3)' }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${e.legalidad}%`, background: '#3E7C59' }}
                          />
                        </div>
                        <span className="text-xs font-sans" style={{ color: '#A3AAB3' }}>{e.legalidad}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans" style={{ color: '#A3AAB3' }}>
                      {e.abogado.initials}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold font-sans"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
