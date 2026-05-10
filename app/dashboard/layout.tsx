import { redirect } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, FolderOpen, MessageSquare, Users, Mountain, Settings, LogOut } from 'lucide-react';
import { getServerAuth, DASHBOARD_ROLES } from '@/lib/serverAuth';
import SidebarNav from '@/components/dashboard/SidebarNav';

const ROL_LABEL: Record<string, string> = {
  admin:             'Administrador',
  abogado:           'Abogado CHT',
  tecnico_ambiental: 'Técnico Ambiental',
};

// Icons are rendered to JSX here (server side) instead of passed as component
// references — lucide-react components carry `'use client'` and cannot cross
// the server→client boundary as raw function values inside a prop array.
const ICON = { size: 18, strokeWidth: 1.5 } as const;

const navItems = [
  { href: '/dashboard',              label: 'Resumen',      icon: <LayoutDashboard {...ICON} />, exact: true },
  { href: '/dashboard/expedientes',  label: 'Expedientes',  icon: <FolderOpen      {...ICON} />              },
  { href: '/dashboard/mensajes',     label: 'Mensajes WA',  icon: <MessageSquare   {...ICON} />              },
  { href: '/dashboard/clientes',     label: 'Clientes WA',  icon: <Users           {...ICON} />              },
  { href: '/dashboard/minas',        label: 'Minas',        icon: <Mountain        {...ICON} />              },
];

const adminItems = [
  { href: '/admin',                  label: 'Panel admin',  icon: <Settings        {...ICON} />              },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth || !DASHBOARD_ROLES.includes(auth.role)) {
    redirect('/login');
  }

  const role  = auth.role;
  const email = auth.user.email ?? '';

  // Sidebar dividers stay in slate-lt @ 30% transparent against ink.
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
            alt="MAPE.LEGAL"
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
              Dashboard
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <SidebarNav items={navItems} />

          {role === 'admin' && (
            <>
              <div className="my-3 border-t" style={{ borderColor: sidebarHairlineSoft }} />
              <SidebarNav items={adminItems} />
            </>
          )}
        </nav>

        {/* User + logout */}
        <div className="p-4 border-t" style={{ borderColor: sidebarHairline }}>
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-semibold truncate" style={{ color: '#fff' }}>{email || 'Usuario'}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--slate-lt)' }}>
              {ROL_LABEL[role] ?? role}
            </div>
          </div>
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

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
