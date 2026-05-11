import { redirect } from 'next/navigation';
import Image from 'next/image';
import {
  Users, UserCheck, LayoutDashboard, LogOut, Shield, FileText, Settings, LayoutGrid,
  MessageSquare, UserPlus, Coins, Radio, Terminal, Bot, KeyRound, Mountain,
} from 'lucide-react';
import { getServerAuth } from '@/lib/serverAuth';
import SidebarNav from '@/components/dashboard/SidebarNav';

// Icons are rendered to JSX here (server side) instead of passed as component
// references — lucide-react components carry `'use client'` and cannot cross
// the server→client boundary as raw function values inside a prop array.
const ICON = { size: 18, strokeWidth: 1.5 } as const;

// Two grouped sections in the sidebar — IAM/CMS at the top (existing surface)
// and the María master control panel below it. The grouping keeps the daily
// operational pages (conversations, leads, transactions, broadcast) one click
// away without burying users/roles/config.
const adminItems = [
  { href: '/admin',                label: 'Resumen',        icon: <LayoutDashboard {...ICON} />, exact: true },
  { href: '/admin/usuarios',       label: 'Usuarios',       icon: <Users           {...ICON} />              },
  { href: '/admin/profesionales',  label: 'Profesionales',  icon: <UserCheck       {...ICON} />              },
  { href: '/admin/roles',          label: 'Roles',          icon: <Shield          {...ICON} />              },
  { href: '/admin/permisos',       label: 'Permisos',       icon: <KeyRound        {...ICON} />              },
  { href: '/admin/contenido',      label: 'Contenido',      icon: <FileText        {...ICON} />              },
  { href: '/admin/concesiones',    label: 'Concesiones',    icon: <Mountain        {...ICON} />              },
  { href: '/admin/config',         label: 'Configuración',  icon: <Settings        {...ICON} />              },
];

const mariaItems = [
  { href: '/admin/maria',                label: 'Panel María',      icon: <Bot           {...ICON} />, exact: true },
  { href: '/admin/maria/conversaciones', label: 'Conversaciones',   icon: <MessageSquare {...ICON} />              },
  { href: '/admin/maria/clientes',       label: 'Clientes y leads', icon: <UserPlus      {...ICON} />              },
  { href: '/admin/maria/transacciones',  label: 'Transacciones',    icon: <Coins         {...ICON} />              },
  { href: '/admin/maria/broadcast',      label: 'Broadcast',        icon: <Radio         {...ICON} />              },
  { href: '/admin/maria/auditoria',      label: 'Auditoría',        icon: <Terminal      {...ICON} />              },
];

const dashboardItems = [
  { href: '/dashboard',            label: 'Ir al Dashboard', icon: <LayoutGrid     {...ICON} />              },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // getServerAuth validates the JWT against Supabase Auth and re-derives
  // the role from user_roles — cookie names alone are not trusted.
  const auth = await getServerAuth();
  if (!auth || auth.role !== 'admin') {
    redirect('/login');
  }

  const email = auth.user.email ?? '';

  // Sidebar dividers stay in slate-lt @ 30% transparent against ink — keeps
  // the on-dark hairline tonally close to the design's hairline language.
  const sidebarHairline = 'color-mix(in oklch, var(--slate-lt) 30%, transparent)';
  const sidebarHairlineSoft = 'color-mix(in oklch, var(--slate-lt) 18%, transparent)';

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-soft)' }}>
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col border-r"
        style={{ background: 'var(--ink)', borderColor: sidebarHairline }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: sidebarHairline }}>
          <Image
            src="/images/MAPE LEGAL LOGO 1.JPG"
            alt="CHT"
            width={80}
            height={32}
            className="h-8 w-auto"
          />
          <div>
            <div className="text-sm font-semibold" style={{ color: '#fff' }}>MAPE.LEGAL</div>
            <div
              className="mt-0.5"
              style={{
                color: 'var(--slate-lt)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Panel admin
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <SidebarNav items={adminItems} />

          <div className="my-3 border-t" style={{ borderColor: sidebarHairlineSoft }} />

          <div
            className="px-3 mt-2 mb-1"
            style={{
              color:           'var(--slate-lt)',
              fontFamily:      'var(--font-mono)',
              fontSize:        10,
              letterSpacing:   '0.18em',
              textTransform:   'uppercase',
              fontWeight:      600,
            }}
          >
            María
          </div>
          <SidebarNav items={mariaItems} />

          <div className="my-3 border-t" style={{ borderColor: sidebarHairlineSoft }} />

          <SidebarNav items={dashboardItems} />
        </nav>

        {/* User + Logout */}
        <div className="p-4 border-t" style={{ borderColor: sidebarHairline }}>
          {email && (
            <div className="px-3 py-2 mb-1">
              <div className="text-xs font-semibold truncate" style={{ color: '#fff' }}>{email}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--slate-lt)' }}>Administrador</div>
            </div>
          )}
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer"
              style={{ color: 'var(--slate-lt)' }}
            >
              <LogOut size={18} strokeWidth={1.5} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
