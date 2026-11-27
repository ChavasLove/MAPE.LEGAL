// /api/precio — Precio informativo MAPE.LEGAL (fijación diaria).
//
// DEC-2026-11-26-1 / DEC-2026-11-27-2: el precio fijado es SOLO INFORMATIVO y
// SIN factor de compra: L/g fino = referencia internacional (USD/oz) × tipo de
// cambio de COMPRA del BCH ÷ 31.1034768. Las columnas `referencia_lbma_usd_oz`,
// `tipo_cambio_bch` y `factor_comercializacion` (migración 030, NOT NULL) se
// CONSERVAN sin alterar la migración: el factor se escribe como 1 (sin
// recorte) y NO se expone en lo público; en lectura el precio se recalcula
// con la fórmula pública. Etiquetas públicas: "precio internacional del oro"
// (fuente real) y "tipo de cambio de compra del BCH".
//
// GET  (público): registro vigente de la fecha actual (hora de Honduras).
//      Si no hay precio fijado hoy: { disponible: false } + el último
//      vigente anterior claramente etiquetado con su fecha. No extrapola.
// POST (restringido): fijación diaria. R3 del encargo — proxy.ts solo
//      verifica presencia de cookies, así que la guardia real vive AQUÍ:
//      requireRole('admin') valida el JWT contra Supabase Auth y re-deriva
//      el rol vía el RPC de user_roles (lib/serverAuth.ts). La service-role
//      key se usa únicamente server-side (getAdminClient) y nunca llega al
//      navegador.
//
// R4: el precio se fija una vez al día y no cambia durante la jornada. El
// GET no consulta feeds externos ni recalcula nada — solo lee la tabla.
// R8: POST es idempotente por fecha — si ya existe un vigente para la
// fecha, exige motivo_reemplazo (409 si falta) y genera un registro de
// reemplazo vía RPC atómico, nunca una duplicación silenciosa.

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import {
  calcularPrecioLempirasGramoFino,
  redondearAlmacenamiento,
  FACTOR_SIN_RECORTE,
  GRAMOS_POR_ONZA_TROY,
  VERSION_POLITICA_PRECIOS,
} from '@/lib/precio/calculo';
import {
  fechaHondurasHoy,
  getPrecioReferenciaHoy,
  recalcularLpsGramoFino,
  type PrecioReferenciaRow,
} from '@/lib/precio/consulta';
import {
  AVISO_PRECIO_INFORMATIVO,
  ETIQUETA_TIPO_CAMBIO,
  FORMULA_PRECIO_INFORMATIVO,
  FUENTE_TIPO_CAMBIO,
} from '@/lib/content/copy-legal';

// Proyección pública de una fila de precios_referencia: SIN factor; el precio
// se recalcula en lectura con la fórmula pública (o null = dato no disponible).
function publico(r: PrecioReferenciaRow) {
  return {
    fecha: r.fecha,
    hora_fijacion: r.hora_fijacion,
    precio_lempiras_gramo_fino: recalcularLpsGramoFino(r),
    referencia_internacional_usd_oz: r.referencia_lbma_usd_oz,
    tipo_cambio_compra_bch: r.tipo_cambio_bch,
    version_politica: r.version_politica,
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60_000;

// El precio no cambia durante el día, pero una fijación de las 08:00 (o un
// reemplazo con motivo) debe propagarse en minutos, no en horas — de ahí un
// TTL corto de caché compartida con SWR, no un TTL de jornada completa.
const CACHE_HEADER = 'public, s-maxage=300, stale-while-revalidate=900';

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFrom(request);
    const rl = checkRateLimit(`precio-ref:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intente de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const { hoy, vigente, anterior } = await getPrecioReferenciaHoy();

    const comun = {
      formula: FORMULA_PRECIO_INFORMATIVO,
      gramos_por_onza_troy: GRAMOS_POR_ONZA_TROY,
      tipo_cambio_fuente: FUENTE_TIPO_CAMBIO,
      tipo_cambio_etiqueta: ETIQUETA_TIPO_CAMBIO,
      aviso: AVISO_PRECIO_INFORMATIVO,
    };

    if (vigente) {
      return NextResponse.json(
        { disponible: true, ...publico(vigente), ...comun },
        { headers: { 'Cache-Control': CACHE_HEADER } },
      );
    }

    return NextResponse.json(
      {
        disponible: false,
        fecha: hoy,
        ...comun,
        // Último precio vigente anterior, etiquetado con su propia fecha.
        // No se extrapola.
        ultimo_vigente: anterior ? publico(anterior) : null,
      },
      { headers: { 'Cache-Control': CACHE_HEADER } },
    );
  } catch (err) {
    console.error('[api/precio] GET error:', err);
    return NextResponse.json({ error: 'Error al consultar el precio informativo' }, { status: 500 });
  }
}

// ─── POST — fijación diaria ──────────────────────────────────────────────────

interface FijacionBody {
  referencia_lbma_usd_oz?: unknown;
  tipo_cambio_bch?: unknown;
  motivo_reemplazo?: unknown;
  fecha?: unknown;
}

function numFinito(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    // 1–2. Sesión + rol dentro del handler (R3). 401 sin sesión, 403 si el
    // rol no es admin.
    const auth = await requireRole('admin');
    if (auth instanceof NextResponse) return auth;

    // 3. Validación del cuerpo.
    let body: FijacionBody;
    try {
      body = (await request.json()) as FijacionBody;
    } catch {
      return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
    }

    // Insumos: referencia internacional del oro (USD/oz troy) y tipo de cambio
    // de COMPRA del BCH (L por USD). Las claves del body conservan los nombres
    // de columna de la tabla. No se acepta ningún factor del cliente: la
    // columna histórica factor_comercializacion recibe FACTOR_SIN_RECORTE (1).
    const lbma = numFinito(body.referencia_lbma_usd_oz);
    const tc = numFinito(body.tipo_cambio_bch);
    const factor = FACTOR_SIN_RECORTE;
    if (lbma === null || lbma <= 0 || lbma > 1_000_000) {
      return NextResponse.json({ error: 'referencia_lbma_usd_oz (precio internacional del oro, USD/oz) debe ser un número mayor que 0' }, { status: 400 });
    }
    if (tc === null || tc <= 0 || tc > 10_000) {
      return NextResponse.json({ error: 'tipo_cambio_bch (tipo de cambio de compra del BCH, L por USD) debe ser un número mayor que 0' }, { status: 400 });
    }

    const hoy = fechaHondurasHoy();
    let fecha = hoy;
    if (body.fecha != null) {
      if (typeof body.fecha !== 'string' || !FECHA_RE.test(body.fecha) || Number.isNaN(Date.parse(`${body.fecha}T00:00:00Z`))) {
        return NextResponse.json({ error: 'fecha debe tener formato YYYY-MM-DD' }, { status: 400 });
      }
      if (body.fecha > hoy) {
        // Un precio "fijado" para una fecha futura no es evidencia de nada.
        return NextResponse.json({ error: 'No se puede fijar un precio para una fecha futura' }, { status: 400 });
      }
      fecha = body.fecha;
    }

    const motivo =
      typeof body.motivo_reemplazo === 'string' ? body.motivo_reemplazo.trim().slice(0, 500) : '';

    // 4. El precio SIEMPRE se calcula en el servidor. Nunca se acepta un
    // precio calculado desde el cliente.
    const bruto = calcularPrecioLempirasGramoFino(lbma, tc);
    const precio = bruto == null ? 0 : redondearAlmacenamiento(bruto);
    if (!(precio > 0)) {
      return NextResponse.json({ error: 'El cálculo no produce un precio válido' }, { status: 400 });
    }

    const admin = getAdminClient();
    const horaFijacion = new Date().toISOString();

    // 5. Idempotencia por fecha (R8).
    const { data: existente, error: errExistente } = await admin
      .from('precios_referencia')
      .select('id')
      .eq('fecha', fecha)
      .eq('estado', 'vigente')
      .maybeSingle();
    if (errExistente) {
      console.error('[api/precio] lectura de vigente falló:', errExistente);
      return NextResponse.json(
        { error: 'Error al verificar el precio vigente', code: errExistente.code === '42P01' ? 'MIGRACION_030_PENDIENTE' : undefined },
        { status: 500 },
      );
    }

    if (existente) {
      if (!motivo) {
        return NextResponse.json(
          {
            error:
              'Ya existe un precio vigente para esta fecha. El reemplazo exige motivo_reemplazo.',
            code: 'MOTIVO_REQUERIDO',
          },
          { status: 409 },
        );
      }

      // Reemplazo atómico vía RPC (marca el anterior como 'reemplazado' e
      // inserta el nuevo con reemplaza_a en una sola transacción).
      const { data: nuevoId, error: errRpc } = await admin.rpc('reemplazar_precio_referencia', {
        p_anterior_id: existente.id,
        p_fecha: fecha,
        p_hora_fijacion: horaFijacion,
        p_referencia_lbma_usd_oz: lbma,
        p_tipo_cambio_bch: tc,
        p_factor_comercializacion: factor,
        p_version_politica: VERSION_POLITICA_PRECIOS,
        p_precio_lempiras_gramo_fino: precio,
        p_motivo_reemplazo: motivo,
        p_fijado_por: auth.user.id,
      });
      if (errRpc) {
        // 40001 = el vigente cambió bajo nuestros pies; 23505 = carrera del
        // índice único; 23514 = motivo vacío (defensa en profundidad).
        if (errRpc.code === '40001' || errRpc.code === '23505' || errRpc.code === '23514') {
          return NextResponse.json(
            { error: 'El precio vigente fue modificado por otra operación. Recargue e intente de nuevo.' },
            { status: 409 },
          );
        }
        console.error('[api/precio] RPC reemplazar_precio_referencia falló:', errRpc);
        return NextResponse.json({ error: 'Error al reemplazar el precio' }, { status: 500 });
      }

      return NextResponse.json(
        {
          id: nuevoId,
          fecha,
          precio_lempiras_gramo_fino: precio,
          version_politica: VERSION_POLITICA_PRECIOS,
          reemplaza_a: existente.id,
        },
        { status: 201 },
      );
    }

    // 6. Primera fijación de la fecha.
    const { data: creado, error: errInsert } = await admin
      .from('precios_referencia')
      .insert({
        fecha,
        hora_fijacion: horaFijacion,
        referencia_lbma_usd_oz: lbma,
        tipo_cambio_bch: tc,
        factor_comercializacion: factor,
        version_politica: VERSION_POLITICA_PRECIOS,
        precio_lempiras_gramo_fino: precio,
        estado: 'vigente',
        fijado_por: auth.user.id,
      })
      .select('id')
      .single();
    if (errInsert || !creado) {
      if (errInsert?.code === '23505') {
        // Doble fijación concurrente — el índice único parcial ganó.
        return NextResponse.json(
          { error: 'Otra operación fijó el precio de esta fecha primero. Recargue e intente de nuevo.' },
          { status: 409 },
        );
      }
      console.error('[api/precio] insert falló:', errInsert);
      return NextResponse.json({ error: 'Error al fijar el precio' }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: creado.id,
        fecha,
        precio_lempiras_gramo_fino: precio,
        version_politica: VERSION_POLITICA_PRECIOS,
        reemplaza_a: null,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/precio] POST error:', err);
    return NextResponse.json({ error: 'Error al fijar el precio informativo' }, { status: 500 });
  }
}
