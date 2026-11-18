// Pie de página institucional compartido (Fase 2C). Server component — sin
// estado. El texto con consecuencia jurídica viene de lib/content/copy-legal.

import Link from 'next/link'
import TopoBand from '@/components/decor/TopoBand'
import {
  RAZON_SOCIAL,
  ROL_TITULAR,
  AVISO_PLATAFORMA,
  DOMICILIO_LINES,
  PIE_NOTA_LEGAL,
} from '@/lib/content/copy-legal'

// Hotfix de neutralidad (11-nov-2026): la razón social del pie es la TITULAR y
// operadora de la plataforma (Corporación Hondureña Tenka, S.A.). El pie no
// nombra compradores. /registro queda fuera del menú mientras la consulta
// informativa esté apagada (NEXT_PUBLIC_REGISTRO_PUBLICO).

const FOOTER_LINKS: Array<{ href: string; label: string }> = [
  { href: '/pequena-mineria', label: 'Pequeña minería' },
  { href: '/comercializacion', label: 'Comercialización' },
  { href: '/mercados', label: 'Mercados' },
  { href: '/verificar', label: 'Verificar sello' },
  { href: '/precio', label: 'Precio referencial' },
  { href: '/politica-de-precios', label: 'Política de publicación del precio' },
  { href: '/precios', label: 'Precios del día' },
  { href: '/equipos', label: 'Equipos' },
  // Estándar privado de debida diligencia (Etapa 2, 2026-11-12).
  { href: '/quienes-somos', label: 'Quiénes somos' },
  { href: '/estandar', label: 'Estándar' },
  { href: '/politica-de-cadena', label: 'Política de cadena' },
  { href: '/auditoria', label: 'Auditoría' },
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
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{ROL_TITULAR}</div>
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
          {/* Nota legal del sello — completa, sin nombrar compradores. */}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            {PIE_NOTA_LEGAL}{' '}
            <Link href="/aviso-legal" style={{ color: 'var(--sand)', fontSize: 12 }}>
              Aviso legal →
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
