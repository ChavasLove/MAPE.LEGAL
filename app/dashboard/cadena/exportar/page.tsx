// /dashboard/cadena/exportar — exportación del registro completo (JSON/CSV)
// para el auditor externo y la administración. Server component sin fetch: los
// enlaces apuntan a la API, que registra cada exportación en la bitácora. No
// se usa <Link> para que el prefetch del router no dispare una exportación.

import { redirect } from 'next/navigation';
import { Download } from 'lucide-react';
import { getServerAuth } from '@/lib/serverAuth';
import { Forbidden } from '@/components/cadena/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'var(--slate)',
};
const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8,
  fontSize: 14, fontWeight: 600, textDecoration: 'none',
};

export default async function ExportarPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');
  const role: string = auth.role;
  if (role !== 'admin' && role !== 'auditor') {
    return <Forbidden detalle="La exportación del registro está reservada a la administración y al auditor externo." />;
  }
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 760 }}>
      <header>
        <div style={EYEBROW}>Cadena de custodia · Exportar</div>
        <h1 style={{ fontSize: 28, margin: '6px 0 8px', color: 'var(--ink)' }}>Exportar el registro</h1>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
          Conjunto completo del estándar privado de debida diligencia: lotes, eventos encadenados por hash, fuentes,
          consentimientos y bitácora de accesos. Cada exportación queda asentada en la bitácora con su fecha, usuario y
          rol. El archivo permite recalcular la cadena de hash de cada lote fuera de la plataforma.
        </p>
      </header>
      <section style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 24, boxShadow: '0 2px 6px rgba(31,42,56,0.05)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/api/cadena/exportar?formato=json" download style={{ ...BTN, background: 'var(--ink)', color: '#fff' }}>
            <Download size={16} strokeWidth={1.5} /> Exportar JSON
          </a>
          <a href="/api/cadena/exportar?formato=csv" download style={{ ...BTN, background: 'transparent', color: 'var(--t2)', border: '1px solid var(--border)' }}>
            <Download size={16} strokeWidth={1.5} /> Exportar CSV
          </a>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 12, lineHeight: 1.5 }}>
          El archivo no incluye márgenes ni condiciones comerciales entre organizaciones. Los pagos del lote figuran con
          su referencia bancaria, medio, fecha y monto.
        </p>
      </section>
    </div>
  );
}
