import Link from 'next/link';
import { Users, UserCheck, FileText } from 'lucide-react';

const cards = [
  {
    href:  '/admin/usuarios',
    Icon:  Users,
    title: 'Usuarios del sistema',
    desc:  'Crear y gestionar cuentas de acceso al dashboard para abogados, técnicos y administradores.',
    cta:   'Gestionar usuarios',
    color: '#3A6EA5',
    bg:    '#DBEAFE',
  },
  {
    href:  '/admin/profesionales',
    Icon:  UserCheck,
    title: 'Perfiles profesionales',
    desc:  'Registrar abogados y técnicos ambientales que aparecen asignados en los expedientes.',
    cta:   'Gestionar perfiles',
    color: '#3E7C59',
    bg:    '#E6F2EC',
  },
  {
    href:  '/dashboard/expedientes',
    Icon:  FileText,
    title: 'Expedientes activos',
    desc:  'Ver y gestionar los expedientes mineros en curso en el dashboard operativo.',
    cta:   'Ver expedientes',
    color: '#C49A4A',
    bg:    '#F5EBDD',
  },
];

export default function AdminPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Panel de administración</h1>
        <p className="text-sm font-sans" style={{ color: '#A3AAB3' }}>
          MAPE.LEGAL · Corporación Hondureña Tenka
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {cards.map(({ href, Icon, title, desc, cta, color, bg }) => (
          <div
            key={href}
            className="rounded-xl p-6 border flex flex-col gap-4"
            style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: bg }}>
              <Icon size={22} strokeWidth={1.5} style={{ color }} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white mb-1 font-sans">{title}</h2>
              <p className="text-sm leading-relaxed font-sans" style={{ color: '#A3AAB3' }}>{desc}</p>
            </div>
            <Link
              href={href}
              className="inline-flex items-center text-sm font-semibold font-sans transition-colors hover:underline"
              style={{ color }}
            >
              {cta} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
