'use client'

// Navegación pública compartida (Fase 2C). Un solo lugar para el menú del
// sitio institucional: landing, /pequena-mineria, /comercializacion,
// /mercados, /verificar y /aviso-legal.

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { TICKER_HEIGHT } from '@/components/precios/PriceTickerBar'

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/pequena-mineria', label: 'Pequeña minería' },
  { href: '/comercializacion', label: 'Comercialización' },
  { href: '/mercados', label: 'Mercados' },
  { href: '/verificar', label: 'Verificar certificado' },
  { href: '/#contacto', label: 'Contacto' },
]

export default function PublicNav({ belowTicker = false }: { belowTicker?: boolean }) {
  // El ticker de precios es sticky arriba del nav solo en la landing.
  const topOffset = belowTicker ? TICKER_HEIGHT : 0
  const [navOpen, setNavOpen] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  // Close mobile nav on Escape; restore focus to toggle button
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  // Close mobile nav on click outside the nav element
  useEffect(() => {
    if (!navOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      const insideNav = navRef.current?.contains(target)
      const insidePanel = panelRef.current?.contains(target)
      if (!insideNav && !insidePanel) setNavOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [navOpen])

  // Auto-close on desktop resize (≥ 1024)
  useEffect(() => {
    if (!navOpen) return
    const onResize = () => {
      if (window.innerWidth >= 1024) setNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [navOpen])

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [navOpen])

  // When overlay opens, move focus into it
  useEffect(() => {
    if (!navOpen) return
    const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>('a')
    firstLink?.focus()
  }, [navOpen])

  return (
    <>
      <nav className="nav" ref={navRef} style={{ top: topOffset }}>
        <Link href="/" className="nav-logo">
          <span className="nav-logo-text">MAPE LEGAL</span>
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          style={{ marginLeft: 'auto' }}
          aria-expanded={navOpen}
          aria-controls="nav-mobile-panel"
          aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setNavOpen((v) => !v)}
        >
          {navOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>
      {navOpen && (
        <div
          id="nav-mobile-panel"
          className="nav-mobile-panel"
          ref={panelRef}
          style={{ top: topOffset + 64 }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              onClick={() => setNavOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
