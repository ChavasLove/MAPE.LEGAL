'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopoBand from '@/components/decor/TopoBand'

export default function VerificarEntryPage() {
  const router = useRouter()
  const [numero, setNumero] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = numero.trim()
    if (!trimmed) return
    router.push(`/verificar/${encodeURIComponent(trimmed)}`)
  }

  return (
    <>
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
            Verificación de Certificado de Origen
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--t2)',
              lineHeight: 1.7,
              marginTop: 16,
            }}
          >
            Introduzca el número de certificado para validar su autenticidad.
            La consulta es pública y devuelve únicamente información no
            personal del registro.
          </p>

          <form
            onSubmit={onSubmit}
            style={{
              marginTop: 32,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
            }}
          >
            <label htmlFor="numero" style={{ display: 'none' }}>
              Número de certificado
            </label>
            <input
              id="numero"
              name="numero"
              type="text"
              required
              maxLength={64}
              placeholder="Número de certificado (ej. CO-2026-0001)"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              style={{
                flex: 1,
                minWidth: 240,
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--ink)',
                background: 'var(--bg)',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--ink)',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Verificar
            </button>
          </form>

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
          <Link href="/#cumplimiento">Cumplimiento</Link>
          <Link href="/#contacto">Contacto</Link>
        </div>
      </footer>
    </>
  )
}
