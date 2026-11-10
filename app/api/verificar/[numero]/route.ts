import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit'
import { pickCertificadoPublico } from '@/lib/certificados/sello'

export const dynamic = 'force-dynamic'

// Anti-enumeración de números de certificado: el contraste 200/404 permite
// barrer el espacio de números sin costo. 20 consultas/min por IP cubren
// con holgura el uso legítimo (un comprador verifica pocos certificados).
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

export async function GET(
  req: Request,
  { params }: { params: Promise<{ numero: string }> }
) {
  const ip = clientIpFrom(req)
  const rl = checkRateLimit(`verificar:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intente de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const { numero: rawNumero } = await params
  const numero = decodeURIComponent(rawNumero ?? '').trim()

  if (!numero || numero.length > 64) {
    return NextResponse.json({ error: 'invalid_numero' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

  // select('*') sobre la vista: así la ruta sigue funcionando tanto antes como
  // después de aplicar la 042 (que agrega numero_sello y copia_minero_estado al
  // final de la vista). La proyección pública se hace en código con la lista
  // cerrada CERTIFICADO_PUBLICO_FIELDS — un campo nuevo en la vista NO se filtra
  // al JSON hasta que alguien lo agregue ahí a propósito. Las claves ausentes
  // (migración sin aplicar) simplemente no aparecen.
  //
  // Lo que se verifica aquí es el SELLO complementario MAPE.LEGAL, no el
  // documento oficial (que emite el titular y autentica la autoridad).
  const { data, error } = await supabase
    .from('certificados_origen_publicos')
    .select('*')
    .eq('numero_certificado', numero)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  return NextResponse.json(
    { found: true, certificado: pickCertificadoPublico(data as Record<string, unknown>) },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
