// /api/cadena/exportar — exportación para auditoría externa.
//
// GET auditor | admin → ?formato=json|csv (default json). Content-Disposition
// attachment. Contenido: lotes + eventos + alertas + fuentes + pagos.
//   · Sin datos personales del minero más allá de `cliente_id` (sin nombre,
//     DPI, teléfono). Las fuentes viajan sin el jsonb `documentos` (puede
//     contener rutas/identificadores de documentos personales).
//   · Sin `margenes_comercializador` (confidencial del comercializador).
//   · Pagos SIN `monto_lps` para auditor (decisión documentada, pendiente de
//     Willis: el auditor verifica bancarización y trazabilidad, no el valor).
//     admin exporta el monto.
// La exportación queda en bitácora con accion 'exportacion'.
//
// CSV: un solo archivo con secciones (`# <tabla>` + encabezado + filas), separadas
// por una línea en blanco; valores JSON se serializan como texto. Tope por
// tabla: EXPORT_MAX filas (ordenadas por created_at desc) — si se alcanza, el
// JSON lo marca en `truncado`.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { iniciarSesionCadena, respuestaErrorDb } from '@/lib/cadena/apiUtils';
import { registrarAcceso } from '@/lib/cadena/bitacora';
import { redactarPagoParaAuditor } from '@/lib/cadena/validacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_MAX = 5000;

const COLS = {
  lotes: 'id, codigo, fuente_id, cliente_id, comercializador_org_id, planta_org_id, estado, bloqueo_motivo, created_at, updated_at',
  lote_eventos: 'id, lote_id, secuencia, tipo, actor_rol, fecha, lugar, peso_g, ley_fino, detalle_canonico, hash_previo, hash, created_at',
  alertas_lote: 'id, lote_id, tipo, detalle, resuelta, created_at',
  fuentes_comercializador:
    'id, organizacion_id, cliente_id, mina_id, permiso_municipal_numero, permiso_vigente_hasta, dentro_area_inhgeomin, declaracion_mercurio_cero, clpi_estado, created_at, updated_at',
  pagos_lote: 'id, lote_id, monto_lps, medio, referencia_bancaria, banco, fecha_pago, beneficiario_cliente_id, pagado_por_org_id, created_at',
} as const;

type Fila = Record<string, unknown>;

async function leerTabla(admin: SupabaseClient, tabla: keyof typeof COLS, orden: string): Promise<{ rows: Fila[]; error: { code?: string; message?: string } | null }> {
  // Cast a string: el genérico de supabase-js sobre la unión de tablas/columnas
  // dispara TS2590 ("union too complex") sin aportar tipado real aquí.
  const columnas: string = COLS[tabla];
  const { data, error } = await admin.from(tabla as string).select(columnas).order(orden, { ascending: false }).limit(EXPORT_MAX);
  return { rows: (data ?? []) as unknown as Fila[], error };
}

function csvCelda(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvSeccion(nombre: string, cols: string[], rows: Fila[]): string {
  const lineas = [`# ${nombre}`, cols.join(',')];
  for (const r of rows) lineas.push(cols.map((c) => csvCelda(r[c])).join(','));
  return lineas.join('\r\n');
}

export async function GET(req: Request) {
  const s = await iniciarSesionCadena('admin', 'auditor');
  if (s instanceof NextResponse) return s;
  const { ctx, admin } = s;

  const url = new URL(req.url);
  const formato = url.searchParams.get('formato') ?? 'json';
  if (formato !== 'json' && formato !== 'csv') {
    return NextResponse.json({ error: 'formato inválido. Permitidos: json, csv' }, { status: 400 });
  }

  const [lotes, eventos, alertas, fuentes, pagos] = await Promise.all([
    leerTabla(admin, 'lotes', 'created_at'),
    leerTabla(admin, 'lote_eventos', 'created_at'),
    leerTabla(admin, 'alertas_lote', 'created_at'),
    leerTabla(admin, 'fuentes_comercializador', 'created_at'),
    leerTabla(admin, 'pagos_lote', 'created_at'),
  ]);
  for (const [nombre, r] of [['lotes', lotes], ['eventos', eventos], ['alertas', alertas], ['fuentes', fuentes], ['pagos', pagos]] as const) {
    if (r.error) return respuestaErrorDb('[cadena/exportar GET]', r.error, { generico: `Error al exportar ${nombre}` });
  }

  const pagosSalida = ctx.rol === 'auditor' ? pagos.rows.map(redactarPagoParaAuditor) : pagos.rows;
  const generadoEn = new Date().toISOString();
  const fecha = generadoEn.slice(0, 10);
  const truncado = {
    lotes: lotes.rows.length >= EXPORT_MAX,
    eventos: eventos.rows.length >= EXPORT_MAX,
    alertas: alertas.rows.length >= EXPORT_MAX,
    fuentes: fuentes.rows.length >= EXPORT_MAX,
    pagos: pagos.rows.length >= EXPORT_MAX,
  };

  registrarAcceso({
    ctx,
    accion: 'exportacion',
    recurso_tipo: 'exportacion',
    detalle: {
      formato,
      lotes: lotes.rows.length, eventos: eventos.rows.length, alertas: alertas.rows.length,
      fuentes: fuentes.rows.length, pagos: pagos.rows.length,
      monto_omitido: ctx.rol === 'auditor',
    },
  });

  if (formato === 'csv') {
    const pagoCols = COLS.pagos_lote.split(', ').filter((c) => ctx.rol !== 'auditor' || c !== 'monto_lps');
    const cuerpo = [
      csvSeccion('lotes', COLS.lotes.split(', '), lotes.rows),
      csvSeccion('eventos', COLS.lote_eventos.split(', '), eventos.rows),
      csvSeccion('alertas', COLS.alertas_lote.split(', '), alertas.rows),
      csvSeccion('fuentes', COLS.fuentes_comercializador.split(', '), fuentes.rows),
      csvSeccion('pagos', pagoCols, pagosSalida as Fila[]),
    ].join('\r\n\r\n');
    return new NextResponse(`﻿${cuerpo}\r\n`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cadena-export-${fecha}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const payload = {
    generado_en: generadoEn,
    exportado_por_rol: ctx.rol,
    monto_omitido: ctx.rol === 'auditor',
    truncado,
    lotes: lotes.rows,
    eventos: eventos.rows,
    alertas: alertas.rows,
    fuentes: fuentes.rows,
    pagos: pagosSalida,
  };
  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="cadena-export-${fecha}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
