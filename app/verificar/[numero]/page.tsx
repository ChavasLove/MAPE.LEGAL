import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import TopoBand from '@/components/decor/TopoBand'
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit'
import {
  ESTADO_VERIFICACION_ETIQUETA, VERIFICAR_LIMITE, VERIFICAR_VENTANA_MS, responderVerificacion,
  type Buscador, type EstadoVerificacion, type VerificacionPublica,
} from '@/lib/certificados/publico'
import { VERIFICAR_NO_CONSTA, VERIFICAR_SELLO_AVISO } from '@/lib/content/copy-legal'

export const dynamic = 'force-dynamic'

// /verificar/[numero] — VERIFICACIÓN PÚBLICA MÍNIMA (reestructura 2026-11-28).
// Muestra solo el número de sello y su estado. Sin datos personales, sin
// nombres, sin mina, sin peso, sin fechas, sin huellas, sin documentos.
// Misma lógica y mismo límite de consultas que GET /api/verificar/[numero].

const buscarEnVistaPublica: Buscador = async (numero) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { fila: null, error: true }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await supabase
    .from('certificados_origen_publicos')
    .select('*')
    .eq('numero_certificado', numero)
    .maybeSingle()
  return { fila: (data as Record<string, unknown> | null) ?? null, error: !!error }
}

const ESTADO_ESTILO: Record<Exclude<EstadoVerificacion, 'no_encontrado'>, { color: string; descripcion: string }> = {
  vigente: { color: 'var(--green)', descripcion: 'El sello consta en el registro y está vigente.' },
  revocado: { color: 'var(--red)', descripcion: 'El sello fue revocado y no debe considerarse vigente.' },
  vencido: { color: 'var(--amber)', descripcion: 'El sello superó su fecha de validez. No está vigente.' },
  suspendido: { color: 'var(--amber)', descripcion: 'El sello se encuentra suspendido.' },
}

function ShellNav() {
  return (
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
  )
}

function ShellFooter() {
  return (
    <footer style={{ position: 'relative' }}>
      <TopoBand variant="dark" position="band" />
      <div className="logo">MAPE LEGAL</div>
      <div className="copy">© 2026 MAPE LEGAL</div>
      <div className="links">
        <Link href="/verificar">Verificar otro</Link>
        <Link href="/pequena-mineria">Pequeña minería</Link>
        <Link href="/#contacto">Contacto</Link>
      </div>
    </footer>
  )
}

type Resultado =
  | { tipo: 'sello'; datos: VerificacionPublica }
  | { tipo: 'no_consta' }
  | { tipo: 'limite' }
  | { tipo: 'no_disponible' }

async function consultar(numeroCrudo: string): Promise<Resultado> {
  // Mismo límite que la API: la página no es una vía para enumerar números.
  const h = await headers()
  const rl = checkRateLimit(`verificar:${clientIpFrom(new Request('https://mape.legal/verificar', { headers: h }))}`, VERIFICAR_LIMITE, VERIFICAR_VENTANA_MS)
  if (!rl.ok) return { tipo: 'limite' }
  const r = await responderVerificacion(numeroCrudo, buscarEnVistaPublica)
  if (r.status === 200) return { tipo: 'sello', datos: r.body as VerificacionPublica }
  if (r.status === 500) return { tipo: 'no_disponible' }
  return { tipo: 'no_consta' } // 400 y 404: misma respuesta
}

export default async function VerificarResultPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const res = await consultar(numero ?? '')

  const titulo =
    res.tipo === 'sello' ? 'Registro de sello'
    : res.tipo === 'limite' ? 'Demasiadas consultas'
    : res.tipo === 'no_disponible' ? 'Consulta no disponible'
    : 'Registro no encontrado'

  return (
    <>
      <ShellNav />
      <section
        style={{
          position: 'relative',
          padding: '80px max(24px, calc((100% - 760px)/2))',
          background: 'var(--bg-soft)',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <TopoBand variant="light" position="overlay" />
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <div className="section-label">Resultado de verificación</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 600,
              color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 8,
            }}
          >
            {titulo}
          </h1>

          <div
            style={{
              marginTop: 32, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 2px 6px rgba(31,42,56,0.05)', padding: 'clamp(20px, 4vw, 28px)',
            }}
          >
            {res.tipo === 'sello' && res.datos.estado !== 'no_encontrado' && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--slate)' }}>
                  Número de sello
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--ink)', marginTop: 6, wordBreak: 'break-all' }}>
                  {res.datos.numero}
                </div>
                <div style={{ marginTop: 20 }}>
                  <span
                    style={{
                      display: 'inline-block', borderRadius: 9999, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                      color: ESTADO_ESTILO[res.datos.estado].color,
                      background: `color-mix(in oklch, ${ESTADO_ESTILO[res.datos.estado].color} 14%, white)`,
                      border: `1px solid color-mix(in oklch, ${ESTADO_ESTILO[res.datos.estado].color} 30%, white)`,
                    }}
                  >
                    {ESTADO_VERIFICACION_ETIQUETA[res.datos.estado]}
                  </span>
                </div>
                <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7, marginTop: 16 }}>
                  {ESTADO_ESTILO[res.datos.estado].descripcion}
                </p>
              </>
            )}
            {res.tipo === 'no_consta' && (
              <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>{VERIFICAR_NO_CONSTA}</p>
            )}
            {res.tipo === 'limite' && (
              <p role="alert" style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                Se alcanzó el límite de consultas. Intente de nuevo en unos minutos.
              </p>
            )}
            {res.tipo === 'no_disponible' && (
              <p role="alert" style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                La consulta no está disponible en este momento. Intente de nuevo más tarde.
              </p>
            )}
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)', marginTop: 24, lineHeight: 1.6 }}>
            {VERIFICAR_SELLO_AVISO}
          </p>
          <p style={{ marginTop: 24 }}>
            <Link href="/verificar" style={{ color: 'var(--moss)', fontWeight: 600 }}>Verificar otro número</Link>
          </p>
        </div>
      </section>
      <ShellFooter />
    </>
  )
}
