import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Users, UserCheck, LayoutDashboard, LogOut } from 'lucide-react';

const navItems = [
  { href: '/admin',               label: 'Resumen',        Icon: LayoutDashboard },
  { href: '/admin/usuarios',      label: 'Usuarios',       Icon: Users            },
  { href: '/admin/profesionales', label: 'Profesionales',  Icon: UserCheck        },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;

  // Server-side guard — redirect to login if no token present
  if (!token) {
    redirect('/admin/login');
  }

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
            src="/images/LOGO CHT.png"
            alt="CHT"
            width={80}
            height={32}
            className="h-8 w-auto"
          />
          <div>
            <div className="text-white font-bold text-sm font-sans">MAPE.LEGAL</div>
            <div className="text-xs font-sans" style={{ color: '#A3AAB3' }}>Panel de administración</div>
          </div>
        </div>

        {/* Navigation */}
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
        </nav>

        {/* Logout */}
        <form action="/api/admin/auth/logout" method="POST" className="p-4 border-t" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium font-sans transition-colors hover:bg-white/10 cursor-pointer"
            style={{ color: '#A3AAB3' }}
            formAction="/api/admin/auth/logout"
          >
            <LogOut size={18} strokeWidth={1.5} />
            Cerrar sesión
          </button>
        </form>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
