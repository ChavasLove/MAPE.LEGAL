import { redirect } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, FolderOpen, MessageSquare, Users, Mountain, FileCheck2, Banknote, Settings, LogOut,
  Boxes, MapPinned, ShieldCheck, ScrollText, Download,
} from 'lucide-react';
import { getServerAuth, DASHBOARD_ROLES } from '@/lib/serverAuth';
import SidebarNav from '@/components/dashboard/SidebarNav';

// Etiquetas genéricas: en la UI no se nombra a ninguna organización. Los roles
// nuevos del estándar privado (Etapa 2) se describen por función.
const ROL_LABEL: Record<string, string> = {
  admin:             'Administrador',
  abogado:           'Abogado CHT',
  tecnico_ambiental: 'Técnico Ambiental',
  comercializador:   'Comercializador',
  planta:            'Planta de beneficio participante',
  auditor:           'Auditor externo',
};

const STAFF_ROLES: ReadonlyArray<string> = ['admin', 'abogado', 'tecnico_ambiental'];

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
  { href: '/dashboard/certificados', label: 'Certificados', icon: <FileCheck2      {...ICON} />              },
];

const adminItems = [
  { href: '/dashboard/precio',       label: 'Precio de referencia', icon: <Banknote {...ICON} />            },
  { href: '/admin',                  label: 'Panel admin',  icon: <Settings        {...ICON} />              },
];

// Cadena de custodia (estándar privado de debida diligencia, Etapa 2).
// `exact` en Lotes para que no quede activo bajo /fuentes, /consentimientos…
const cadenaLotes          = { href: '/dashboard/cadena',                 label: 'Lotes',           icon: <Boxes       {...ICON} />, exact: true };
const cadenaFuentes        = { href: '/dashboard/cadena/fuentes',         label: 'Fuentes',         icon: <MapPinned   {...ICON} /> };
const cadenaConsentimientos= { href: '/dashboard/cadena/consentimientos', label: 'Consentimientos', icon: <ShieldCheck {...ICON} /> };
const cadenaBitacora       = { href: '/dashboard/cadena/bitacora',        label: 'Bitácora',        icon: <ScrollText  {...ICON} /> };
const cadenaExportar       = { href: '/dashboard/cadena/exportar',        label: 'Exportar',        icon: <Download    {...ICON} /> };

function cadenaItemsFor(role: string) {
  switch (role) {
    case 'admin':
      return [cadenaLotes, cadenaFuentes, cadenaConsentimientos, cadenaBitacora];
    case 'abogado':
    case 'tecnico_ambiental':
      return [cadenaLotes, cadenaFuentes, cadenaConsentimientos];
    case 'comercializador':
      return [cadenaLotes, cadenaFuentes];
    case 'planta':
      return [cadenaLotes, cadenaConsentimientos];
    case 'auditor':
      return [cadenaLotes, cadenaFuentes, cadenaConsentimientos, cadenaBitacora, cadenaExportar];
    default:
      return [];
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth || !DASHBOARD_ROLES.includes(auth.role)) {
    redirect('/login');
  }

  // `Role` se amplía con los roles del estándar privado; la comparación va
  // como string para no depender del orden en que llegue esa ampliación.
  const role: string = auth.role;
  const email = auth.user.email ?? '';
  const isStaff = STAFF_ROLES.includes(role);
  const cadenaItems = cadenaItemsFor(role);

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
          {isStaff && <SidebarNav items={navItems} />}

          {cadenaItems.length > 0 && (
            <>
              {isStaff && <div className="my-3 border-t" style={{ borderColor: sidebarHairlineSoft }} />}
              <div
                className="px-3 pt-2 pb-1"
                style={{
                  color: 'var(--slate-lt)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Cadena de custodia
              </div>
              <SidebarNav items={cadenaItems} />
            </>
          )}

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
