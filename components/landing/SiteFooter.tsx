// Pie de página institucional compartido (Fase 2C). Server component — sin
// estado. El texto con consecuencia jurídica viene de lib/content/copy-legal.

import Link from 'next/link'
import TopoBand from '@/components/decor/TopoBand'
import {
  RAZON_SOCIAL,
  AVISO_PLATAFORMA,
  DOMICILIO_LINES,
  CERTIFICADO_ORIGEN_NOTA_BREVE,
} from '@/lib/content/copy-legal'

const FOOTER_LINKS: Array<{ href: string; label: string }> = [
  { href: '/pequena-mineria', label: 'Pequeña minería' },
  { href: '/comercializacion', label: 'Comercialización' },
  { href: '/mercados', label: 'Mercados' },
  { href: '/verificar', label: 'Verificar certificado' },
  { href: '/precios', label: 'Precios del día' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/registro', label: 'Registro INHGEOMIN' },
  { href: '/aviso-legal', label: 'Aviso legal' },
]

export default function SiteFooter() {
  return (
    <footer style={{ position: 'relative', display: 'block' }}>
      <TopoBand variant="dark" position="band" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 28,
          alignItems: 'start',
          paddingTop: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="logo">MAPE LEGAL</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{RAZON_SOCIAL}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            {DOMICILIO_LINES.map((line) => (
              <span key={line} style={{ display: 'block' }}>{line}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--sand)',
            }}
          >
            Notas legales
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            {CERTIFICADO_ORIGEN_NOTA_BREVE}{' '}
            <Link href="/aviso-legal" style={{ color: 'var(--sand)', fontSize: 12 }}>
              Nota legal completa →
            </Link>
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            {AVISO_PLATAFORMA}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--sand)',
            }}
          >
            Sitio
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} style={{ fontSize: 12 }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 28,
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          fontSize: 12,
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        © 2026 {RAZON_SOCIAL} — Todos los derechos reservados. Tegucigalpa, Honduras.
      </div>
    </footer>
  )
}
