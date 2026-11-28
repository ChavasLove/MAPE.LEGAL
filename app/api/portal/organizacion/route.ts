// GET /api/portal/organizacion — pertenencia del usuario a organizaciones, en
// SOLO LECTURA. Cada quien ve sus membresías; el representante con membresía
// activa ve además los miembros de SU organización y los lotes de los
// titulares que dieron consentimiento con alcance "lotes". Una organización
// nunca ve los miembros ni los lotes de otra.

import { NextResponse } from 'next/server';
import { errorDb, esMigracionPendiente, iniciarSesionRoles, respuestaEnPreparacion } from '@/lib/acceso/sesionPersonal';
import { lotesVisiblesParaOrganizacion, membresiasVisibles, representaOrganizacion, type Membresia, type PertenenciaUsuario } from '@/lib/organizaciones/membresias';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COL_M = 'id, organizacion_id, perfil_id, user_id, rol_en_organizacion, estado, alta_por, fecha_alta, fecha_activacion, fecha_baja';

export async function GET() {
  const s = await iniciarSesionRoles('cliente', 'comercializador', 'planta', 'auditor');
  if (s instanceof NextResponse) return s;
  const { admin, ctx } = s;

  // Perfil del usuario si es titular.
  const cli = await admin.from('clientes').select('id').eq('user_id', ctx.userId).maybeSingle();
  if (cli.error) return errorDb('[portal/organizacion]', cli.error);
  const clienteId = (cli.data as { id?: string } | null)?.id ?? null;
  let perfilId: string | null = null;
  if (clienteId) {
    const p = await admin.from('perfiles').select('id').eq('cliente_id', clienteId).maybeSingle();
    if (p.error) return esMigracionPendiente(p.error) ? respuestaEnPreparacion() : errorDb('[portal/organizacion]', p.error);
    perfilId = (p.data as { id?: string } | null)?.id ?? null;
  }

  // Membresías propias.
  let q = admin.from('membresias_organizacion').select(COL_M);
  q = perfilId ? q.or(`user_id.eq.${ctx.userId},perfil_id.eq.${perfilId}`) : q.eq('user_id', ctx.userId);
  const propias = await q;
  if (propias.error) return esMigracionPendiente(propias.error) ? respuestaEnPreparacion() : errorDb('[portal/organizacion]', propias.error);
  const mias = (propias.data ?? []) as Membresia[];
  const pertenencia: PertenenciaUsuario = { userId: ctx.userId, perfilId, membresias: mias };

  const orgIds = [...new Set(mias.map((m) => m.organizacion_id))];
  if (orgIds.length === 0) return NextResponse.json({ organizaciones: [], solo_lectura: true });
  const representadas = orgIds.filter((o) => representaOrganizacion(pertenencia, o));

  const [orgs, colegas] = await Promise.all([
    admin.from('organizaciones').select('id, tipo, nombre').in('id', orgIds),
    representadas.length
      ? admin.from('membresias_organizacion').select(COL_M).in('organizacion_id', representadas)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (orgs.error) return errorDb('[portal/organizacion]', orgs.error);
  if (colegas.error) return errorDb('[portal/organizacion]', colegas.error);

  // Defensa en código: el filtro se aplica aunque la consulta trajera de más.
  const visibles = membresiasVisibles(pertenencia, [...mias, ...((colegas.data ?? []) as Membresia[])]);
  const porId = new Map(visibles.map((m) => [m.id, m]));

  const salida = [];
  for (const o of (orgs.data ?? []) as Array<{ id: string; tipo: string; nombre: string }>) {
    const miembros = [...porId.values()].filter((m) => m.organizacion_id === o.id);
    let lotes: Array<{ id: string; codigo: string; estado: string }> = [];
    if (representadas.includes(o.id)) {
      const perfilIds = miembros.filter((m) => m.estado === 'activa' && m.perfil_id).map((m) => m.perfil_id as string);
      if (perfilIds.length) {
        const perfiles = await admin.from('perfiles').select('id, cliente_id').in('id', perfilIds);
        if (perfiles.error) return errorDb('[portal/organizacion]', perfiles.error);
        const titulares = ((perfiles.data ?? []) as Array<{ cliente_id: string | null }>).map((p) => p.cliente_id).filter((c): c is string => !!c);
        if (titulares.length) {
          const [cons, lot] = await Promise.all([
            admin.from('consentimientos').select('cliente_id, otorgado_a_org_id, estado, alcance').eq('otorgado_a_org_id', o.id).in('cliente_id', titulares),
            admin.from('lotes').select('id, codigo, estado, cliente_id').in('cliente_id', titulares).limit(500),
          ]);
          if (cons.error) return errorDb('[portal/organizacion]', cons.error);
          if (lot.error) return errorDb('[portal/organizacion]', lot.error);
          lotes = lotesVisiblesParaOrganizacion({
            organizacionId: o.id,
            lotes: (lot.data ?? []) as Array<{ id: string; codigo: string; estado: string; cliente_id: string }>,
            titularesActivos: titulares,
            consentimientos: (cons.data ?? []) as Array<{ cliente_id: string; otorgado_a_org_id: string; estado: string; alcance: Record<string, unknown> | null }>,
          }).map((l) => ({ id: l.id, codigo: l.codigo, estado: l.estado }));
        }
      }
    }
    salida.push({
      id: o.id, tipo: o.tipo, nombre: o.nombre,
      es_representante: representadas.includes(o.id),
      miembros: miembros.map((m) => ({ id: m.id, rol: m.rol_en_organizacion, estado: m.estado, es_usted: m.user_id === ctx.userId || (perfilId !== null && m.perfil_id === perfilId), desde: m.fecha_alta })),
      lotes,
    });
  }
  return NextResponse.json({ organizaciones: salida, solo_lectura: true });
}
