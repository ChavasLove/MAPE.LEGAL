'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function VerificarForm() {
  const router = useRouter()
  const [numero, setNumero] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = numero.trim()
    if (!trimmed) return
    router.push(`/verificar/${encodeURIComponent(trimmed)}`)
  }

  return (
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
        placeholder="Número de certificado"
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
  )
}
