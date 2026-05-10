'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

export interface SidebarNavItem {
  href:    string;
  label:   string;
  /** Pre-rendered icon JSX. Must be a JSX element (e.g. `<Users size={18} />`),
   *  NOT a component reference — passing a raw client-component function
   *  through the RSC server→client boundary fails serialization. */
  icon:    ReactNode;
  /** When true, only an exact pathname match counts as active.
   *  Use for root-ish links like /admin or /dashboard so they don't
   *  light up for every nested route. */
  exact?:  boolean;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
}

/**
 * Tokenized sidebar navigation per DESIGN.md §6.
 *  - Default link text: `--slate-lt` on `--ink` background.
 *  - Hover: `color-mix(in oklch, var(--slate) 18%, var(--ink))` background
 *    with white text.
 *  - Active: `color-mix(in oklch, var(--moss) 14%, var(--ink))` background
 *    with white text and a 2px inset left border in `--moss` (no layout shift).
 *
 * Implemented as a client island so the surrounding layout can remain a
 * server component (auth + redirects live there).
 */
export default function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname() ?? '';

  return (
    <>
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <NavLink key={item.href} item={item} isActive={isActive} />;
      })}
    </>
  );
}

function NavLink({ item, isActive }: { item: SidebarNavItem; isActive: boolean }) {
  const [hover, setHover] = useState(false);
  const { href, label, icon } = item;

  const background = isActive
    ? 'color-mix(in oklch, var(--moss) 14%, var(--ink))'
    : hover
    ? 'color-mix(in oklch, var(--slate) 18%, var(--ink))'
    : 'transparent';

  const textColor = isActive || hover ? '#fff' : 'var(--slate-lt)';

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        background,
        color:     textColor,
        boxShadow: isActive ? 'inset 2px 0 0 var(--moss)' : undefined,
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
