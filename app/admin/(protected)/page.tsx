import Link from 'next/link';
import { Users, UserCheck, FileText, Bot } from 'lucide-react';

interface AdminCard {
  href:  string;
  Icon:  typeof Users;
  title: string;
  desc:  string;
  cta:   string;
  /** Token name (without `--`) used for the icon tile, icon glyph, and CTA accent. */
  token: 'blue' | 'green' | 'earth' | 'moss';
}

const cards: AdminCard[] = [
  {
    href:  '/admin/maria',
    Icon:  Bot,
    title: 'Panel María',
    desc:  'Master Control Panel del asistente virtual: conversaciones en vivo, leads, transacciones, broadcast diario y auditoría.',
    cta:   'Abrir panel María',
    token: 'moss',
  },
  {
    href:  '/admin/usuarios',
    Icon:  Users,
    title: 'Usuarios del sistema',
    desc:  'Crear y gestionar cuentas de acceso al dashboard para abogados, técnicos y administradores.',
    cta:   'Gestionar usuarios',
    token: 'blue',
  },
  {
    href:  '/admin/profesionales',
    Icon:  UserCheck,
    title: 'Perfiles profesionales',
    desc:  'Registrar abogados y técnicos ambientales que aparecen asignados en los expedientes.',
    cta:   'Gestionar perfiles',
    token: 'green',
  },
  {
    href:  '/dashboard/expedientes',
    Icon:  FileText,
    title: 'Expedientes activos',
    desc:  'Ver y gestionar los expedientes mineros en curso en el dashboard operativo.',
    cta:   'Ver expedientes',
    token: 'earth',
  },
];

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

export default function AdminPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>Panel de administración</h1>
        <p className="text-sm" style={{ color: 'var(--slate)' }}>
          MAPE.LEGAL
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map(({ href, Icon, title, desc, cta, token }) => {
          const accent = `var(--${token})`;
          const tileBg = `color-mix(in oklch, var(--${token}) 12%, white)`;
          return (
            <div
              key={href}
              className="rounded-xl p-6 border flex flex-col gap-4"
              style={{
                background:  'var(--bg)',
                borderColor: 'var(--border)',
                boxShadow:   SHADOW_SM,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: tileBg }}
              >
                <Icon size={22} strokeWidth={1.5} style={{ color: accent }} />
              </div>
              <div className="flex-1">
                <h2
                  className="text-base font-semibold mb-1"
                  style={{ color: 'var(--ink)', fontFamily: 'var(--font-body)' }}
                >
                  {title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>{desc}</p>
              </div>
              <Link
                href={href}
                className="inline-flex items-center text-sm font-semibold transition-colors hover:underline"
                style={{ color: accent }}
              >
                {cta} →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
