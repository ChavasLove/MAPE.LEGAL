import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import TopoBand from '@/components/decor/TopoBand'

export const dynamic = 'force-dynamic'

type Estado = 'vigente' | 'revocado' | 'expirado' | 'suspendido'

type CertificadoPublico = {
  numero_certificado: string
  fecha_emision: string
  peso_oro_g: number
  estado: Estado
  valido_hasta: string
  hash_verificacion: string
  mina_nombre: string | null
  mina_codigo: string | null
  mina_municipio: string | null
  mina_departamento: string | null
}

async function lookupCertificado(numero: string): Promise<CertificadoPublico | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('certificados_origen_publicos')
    .select('*')
    .eq('numero_certificado', numero)
    .maybeSingle()

  if (error || !data) return null
  return data as CertificadoPublico
}

const STATE_STYLE: Record<Estado, { color: string; label: string; description: string }> = {
  vigente: {
    color: 'var(--green)',
    label: 'Vigente',
    description: 'Este certificado está activo y dentro de su período de validez.',
  },
  revocado: {
    color: 'var(--red)',
    label: 'Revocado',
    description: 'Este certificado fue revocado por MAPE LEGAL y no debe considerarse válido.',
  },
  expirado: {
    color: 'var(--amber)',
    label: 'Expirado',
    description: 'Este certificado ya superó su fecha de validez. No vigente.',
  },
  suspendido: {
    color: 'var(--amber)',
    label: 'Suspendido',
    description: 'Este certificado se encuentra suspendido temporalmente.',
  },
}

function ShellNav() {
  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        <span className="nav-logo-text">MAPE LEGAL</span>
      </Link>
      <div className="nav-links">
        <Link href="/" className="nav-link">Inicio</Link>
        <Link href="/#cumplimiento" className="nav-link">Cumplimiento</Link>
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
        <Link href="/#cumplimiento">Cumplimiento</Link>
        <Link href="/#contacto">Contacto</Link>
      </div>
    </footer>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--t3)',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  )
}

function FieldValue({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--ink)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
        wordBreak: 'break-word',
      }}
    >
      {children}
    </div>
  )
}

function StatePill({ estado }: { estado: Estado }) {
  const style = STATE_STYLE[estado]
  return (
    <span
      style={{
        display: 'inline-block',
        background: `color-mix(in oklch, ${style.color} 14%, white)`,
        color: style.color,
        border: `1px solid color-mix(in oklch, ${style.color} 30%, white)`,
        padding: '4px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {style.label}
    </span>
  )
}

export default async function VerificarResultPage({
  params,
}: {
  params: Promise<{ numero: string }>
}) {
  const { numero: rawNumero } = await params
  const numero = decodeURIComponent(rawNumero ?? '').trim()
  const cert = numero.length > 0 && numero.length <= 64 ? await lookupCertificado(numero) : null
  const found = !!cert

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
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(26px, 3.5vw, 36px)',
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginTop: 8,
            }}
          >
            {found ? 'Certificado de Origen' : 'Certificado no encontrado'}
          </h1>

          {found && cert ? (
            <div
              style={{
                marginTop: 32,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: 'var(--ink)',
                  color: '#fff',
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.65)',
                    }}
                  >
                    Número de certificado
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#fff',
                      marginTop: 2,
                    }}
                  >
                    {cert.numero_certificado}
                  </div>
                </div>
                <StatePill estado={cert.estado} />
              </div>
              <div
                style={{
                  padding: 24,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  rowGap: 18,
                  columnGap: 24,
                }}
              >
                <div>
                  <FieldLabel>Fecha de emisión</FieldLabel>
                  <FieldValue mono>{cert.fecha_emision}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Válido hasta</FieldLabel>
                  <FieldValue mono>{cert.valido_hasta}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Peso de oro certificado</FieldLabel>
                  <FieldValue mono>{Number(cert.peso_oro_g).toFixed(3)} g</FieldValue>
                </div>
                <div>
                  <FieldLabel>Hash de verificación</FieldLabel>
                  <FieldValue mono>
                    {cert.hash_verificacion.slice(0, 12)}…
                  </FieldValue>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel>Unidad minera de origen</FieldLabel>
                  <FieldValue>
                    {cert.mina_nombre ?? '—'}
                    {cert.mina_codigo ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--t3)',
                          marginLeft: 8,
                        }}
                      >
                        ({cert.mina_codigo})
                      </span>
                    ) : null}
                  </FieldValue>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--t2)',
                      marginTop: 4,
                    }}
                  >
                    {[cert.mina_municipio, cert.mina_departamento].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '14px 24px',
                  background: 'var(--bg-soft)',
                  borderTop: '1px solid var(--border)',
                  fontSize: 13,
                  color: 'var(--t2)',
                  lineHeight: 1.6,
                }}
              >
                {STATE_STYLE[cert.estado].description}
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: 32,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
                padding: 24,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <StatePill estado={'expirado' as Estado} />
              </div>
              <p style={{ fontSize: 15, color: 'var(--t1)', lineHeight: 1.6 }}>
                No se encontró ningún certificado emitido por MAPE LEGAL con el
                número{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {numero || '(vacío)'}
                </span>
                . Verifique el número impreso en el documento físico o
                contacte a MAPE LEGAL.
              </p>
            </div>
          )}

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--t3)',
              marginTop: 24,
              lineHeight: 1.6,
            }}
          >
            Esta verificación consulta el registro público de certificados
            emitidos por MAPE LEGAL. Los datos personales del productor y los montos
            de la transacción no son públicos.
          </p>

          <div style={{ marginTop: 24 }}>
            <Link
              href="/verificar"
              style={{
                color: 'var(--moss)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                borderBottom: '1px solid color-mix(in oklch, var(--moss) 35%, white)',
                paddingBottom: 2,
              }}
            >
              ← Verificar otro certificado
            </Link>
          </div>
        </div>
      </section>
      <ShellFooter />
    </>
  )
}
