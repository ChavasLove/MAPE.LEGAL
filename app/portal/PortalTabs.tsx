'use client';

// Pestañas del portal del cliente. Client island mínimo: el layout es server
// component y necesita el pathname para marcar la pestaña activa. Conserva los
// valores legacy del layout (#1F2A38 / #5E6B7B) sin añadir hex nuevos.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface PortalTab { href: string; label: string; icon: ReactNode; exact?: boolean }

export default function PortalTabs({ tabs }: { tabs: PortalTab[] }) {
  const pathname = usePathname() ?? '';
  return (
    <nav className="flex gap-1" aria-label="Secciones del portal">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className="flex items-center gap-2 px-4 py-3.5 text-sm font-medium font-sans border-b-2 transition-colors"
            style={{ color: active ? '#1F2A38' : '#5E6B7B', borderColor: active ? '#1F2A38' : 'transparent' }}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
