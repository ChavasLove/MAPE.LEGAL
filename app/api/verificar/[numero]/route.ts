import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit'
import { VERIFICAR_LIMITE, VERIFICAR_VENTANA_MS, responderVerificacion, type Buscador } from '@/lib/certificados/publico'

export const dynamic = 'force-dynamic'

// GET /api/verificar/[numero] — VERIFICACIÓN PÚBLICA MÍNIMA.
//
// Respuesta: { numero, estado }. Nada más (reestructura 2026-11-28, Fase 7).
// CAMBIO INCOMPATIBLE respecto de la versión anterior, que devolvía
// { found, certificado } con fecha, peso, mina, municipio, huellas, etc.
//
// · Límite de 20 consultas por minuto por IP (anti-enumeración).
// · 404 uniforme para lo que no consta, con la misma forma que un acierto.
// · La proyección se hace en código (lib/certificados/publico.ts): aunque la
//   vista tenga más columnas, no salen.
// · Lo que se verifica es el SELLO complementario MAPE.LEGAL, no el documento
//   oficial (que emite el titular y autentica la autoridad).
export async function GET(req: Request, { params }: { params: Promise<{ numero: string }> }) {
  const rl = checkRateLimit(`verificar:${clientIpFrom(req)}`, VERIFICAR_LIMITE, VERIFICAR_VENTANA_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intente de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const { numero } = await params
  const r = await responderVerificacion(numero, buscarEnVistaPublica)
  return NextResponse.json(r.body, {
    status: r.status,
    headers: r.status === 200 ? { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } : { 'Cache-Control': 'no-store' },
  })
}

// Cliente anónimo creado dentro de la función (nunca a nivel de módulo).
const buscarEnVistaPublica: Buscador = async (numero) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { fila: null, error: true }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
  // select('*') para funcionar antes y después de la 042 (que agrega
  // numero_sello); la forma pública la fija la proyección en código.
  const { data, error } = await supabase
    .from('certificados_origen_publicos')
    .select('*')
    .eq('numero_certificado', numero)
    .maybeSingle()
  return { fila: (data as Record<string, unknown> | null) ?? null, error: !!error }
}
