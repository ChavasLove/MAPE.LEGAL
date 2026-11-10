import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import TopoBand from '@/components/decor/TopoBand'
import {
  VERIFICAR_ABIERTO,
  VERIFICAR_CARGA_INICIAL,
  VERIFICAR_FRESCURA_NOTA,
  VERIFICAR_INTRO,
  VERIFICAR_TITULO,
} from '@/lib/content/copy-legal'
import VerificarForm from './VerificarForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: VERIFICAR_TITULO,
  description:
    'Compruebe si un número de registro del sello complementario de trazabilidad MAPE.LEGAL consta en la base operada por Inversiones Zekaii, S. de R.L. La consulta no sustituye el Certificado de Origen oficial.',
  alternates: { canonical: '/verificar' },
}

// Conteo público de certificados: sostiene el estado inicial honesto del
// registro (T2.4 — mientras no existan certificados se declara la fase de
// carga inicial en vez de simular un registro poblado). Anon client con
// lazy-init (regla §Framework); null = no se pudo contar (no se muestra el
// aviso, tampoco se rompe la página).
async function countCertificados(): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  try {
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
    const { count, error } = await supabase
      .from('certificados_origen_publicos')
      .select('numero_certificado', { count: 'exact', head: true })
    if (error) return null
    return count
  } catch {
    return null
  }
}

export default async function VerificarEntryPage() {
  const total = await countCertificados()

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-text">MAPE LEGAL</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">Inicio</Link>
          <Link href="/pequena-mineria" className="nav-link">Pequeña minería</Link>
          <Link href="/#contacto" className="nav-link">Contacto</Link>
        </div>
      </nav>

      <section
        style={{
          position: 'relative',
          padding: '120px max(24px, calc((100% - 720px)/2)) 80px',
          background: 'var(--bg-soft)',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <TopoBand variant="light" position="overlay" />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div className="section-label">Verificación pública</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginTop: 8,
            }}
          >
            {VERIFICAR_TITULO}
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--t2)',
              lineHeight: 1.7,
              marginTop: 16,
            }}
          >
            {VERIFICAR_INTRO}
          </p>
          <p
            style={{
              fontSize: 14,
              color: 'var(--t2)',
              lineHeight: 1.7,
              marginTop: 12,
            }}
          >
            {VERIFICAR_ABIERTO}
          </p>

          {total === 0 && (
            <div
              style={{
                marginTop: 24,
                background: 'var(--concrete)',
                border: '1px solid var(--border-2)',
                borderRadius: 12,
                padding: '16px 20px',
                fontSize: 14,
                color: 'var(--t2)',
                lineHeight: 1.7,
              }}
            >
              {VERIFICAR_CARGA_INICIAL}
            </div>
          )}

          <VerificarForm />

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--t3)',
              marginTop: 24,
              lineHeight: 1.6,
            }}
          >
            Esta consulta se limita al registro público del sello complementario
            MAPE.LEGAL. Los datos personales del productor y los montos de la
            transacción no son públicos.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--t3)',
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            {VERIFICAR_FRESCURA_NOTA}
          </p>
        </div>
      </section>

      <footer style={{ position: 'relative' }}>
        <TopoBand variant="dark" position="band" />
        <div className="logo">MAPE LEGAL</div>
        <div className="copy">
          © 2026 MAPE LEGAL
        </div>
        <div className="links">
          <Link href="/">Inicio</Link>
          <Link href="/pequena-mineria">Pequeña minería</Link>
          <Link href="/#contacto">Contacto</Link>
        </div>
      </footer>
    </>
  )
}
