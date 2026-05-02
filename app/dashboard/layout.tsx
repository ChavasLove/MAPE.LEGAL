import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, FolderOpen, MessageSquare, Users, Settings, LogOut } from 'lucide-react';

const ROL_LABEL: Record<string, string> = {
  admin:             'Administrador',
  abogado:           'Abogado CHT',
  tecnico_ambiental: 'Técnico Ambiental',
};

const navItems = [
  { href: '/dashboard',              label: 'Resumen',      Icon: LayoutDashboard },
  { href: '/dashboard/expedientes',  label: 'Expedientes',  Icon: FolderOpen      },
  { href: '/dashboard/mensajes',     label: 'Mensajes WA',  Icon: MessageSquare   },
  { href: '/dashboard/clientes',     label: 'Clientes WA',  Icon: Users           },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  const token = cookieStore.get('auth-token')?.value
    ?? cookieStore.get('admin-token')?.value;

  const role = cookieStore.get('auth-role')?.value
    ?? (cookieStore.get('admin-token')?.value ? 'admin' : null);

  if (!token || !role || !['admin', 'abogado', 'tecnico_ambiental'].includes(role)) {
    redirect('/login');
  }

  const email = cookieStore.get('user-email')?.value ?? '';

  return (
    <div className="min-h-screen flex" style={{ background: '#162033' }}>

      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col border-r"
        style={{ background: '#1F2A44', borderColor: 'rgba(94,107,122,0.3)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
          <Image
            src="/images/MAPE LEGAL LOGO 1.JPG"
            alt="MAPE.LEGAL"
            width={80}
            height={32}
            className="h-8 w-auto"
          />
          <div>
            <div className="text-white font-bold text-sm font-sans">MAPE.LEGAL</div>
            <div className="text-xs font-sans" style={{ color: '#A3AAB3' }}>Dashboard</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium font-sans transition-colors hover:bg-white/10"
              style={{ color: '#A3AAB3' }}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </Link>
          ))}

          {role === 'admin' && (
            <>
              <div className="my-3 border-t" style={{ borderColor: 'rgba(94,107,122,0.2)' }} />
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium font-sans transition-colors hover:bg-white/10"
                style={{ color: '#A3AAB3' }}
              >
                <Settings size={18} strokeWidth={1.5} />
                Panel admin
              </Link>
            </>
          )}
        </nav>

        {/* User + logout */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-semibold text-white font-sans truncate">{email || 'Usuario'}</div>
            <div className="text-xs font-sans mt-0.5" style={{ color: '#A3AAB3' }}>
              {ROL_LABEL[role] ?? role}
            </div>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium font-sans transition-colors hover:bg-white/10 cursor-pointer"
              style={{ color: '#A3AAB3' }}
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
