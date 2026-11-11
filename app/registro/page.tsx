/**
 * /registro — consulta informativa de derechos mineros (transcripción no
 * oficial de listados publicados por INHGEOMIN). NO es el Registro Minero y
 * Catastral ni un portal oficial del Instituto.
 *
 * APAGADA POR DEFECTO (hotfix de neutralidad, 11-nov-2026): la página solo se
 * sirve con NEXT_PUBLIC_REGISTRO_PUBLICO === 'true'; en cualquier otro caso
 * responde notFound(). También está fuera del sitemap y del pie sin el flag.
 *
 * Es un punto de entrada con un input que redirige a la API pública
 * `/api/concesiones/buscar`. Server component que consume la vista
 * `concesiones_mineras_publicas` (lazy-init de Supabase) para mostrar las
 * primeras 25 concesiones; el cliente hace búsquedas inmediatas contra el
 * endpoint público.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mountain, Search } from 'lucide-react';
import TopoBand from '@/components/decor/TopoBand';
import RegistroSearch from './RegistroSearch';
import { REGISTRO_CONSULTA_NOTA, REGISTRO_CONSULTA_TITULO } from '@/lib/content/copy-legal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `${REGISTRO_CONSULTA_TITULO} — MAPE.LEGAL`,
  description:
    'Consulta informativa de concesiones mineras y solicitudes pendientes en Honduras, transcritas de listados que INHGEOMIN ha hecho públicos. No es el Registro Minero y Catastral ni una base oficial del Instituto.',
};

const REGISTRO_PUBLICO = process.env.NEXT_PUBLIC_REGISTRO_PUBLICO === 'true';

export default function RegistroPage() {
  if (!REGISTRO_PUBLICO) notFound();
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-text">MAPE LEGAL</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">Inicio</Link>
          <Link href="/pequena-mineria" className="nav-link">Pequeña minería</Link>
          <Link href="/verificar" className="nav-link">Verificación</Link>
          <Link href="/#contacto" className="nav-link">Contacto</Link>
        </div>
      </nav>

      <section
        style={{
          position: 'relative',
          padding: '120px max(24px, calc((100% - 960px)/2)) 80px',
          background: 'var(--bg-soft)',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <TopoBand variant="light" position="overlay" />
        <div style={{ position: 'relative', maxWidth: 960, margin: '0 auto' }}>
          <div
            style={{
              color:         'var(--slate)',
              fontFamily:    'var(--font-mono)',
              fontSize:      11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight:    600,
            }}
          >
            Consulta informativa · Transcripción no oficial
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize:   'clamp(34px, 5vw, 52px)',
              fontWeight: 600,
              color:      'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              marginTop:  8,
            }}
          >
            {REGISTRO_CONSULTA_TITULO}
          </h1>
          <p
            style={{
              color:      'var(--t2)',
              fontFamily: 'var(--font-body)',
              fontSize:   16,
              lineHeight: 1.6,
              marginTop:  16,
              maxWidth:   720,
            }}
          >
            Búsqueda pública de las concesiones mineras de exploración y explotación otorgadas, y de las
            solicitudes pendientes de aprobación, ante el Instituto Hondureño de Geología y Minas
            (INHGEOMIN). Datos transcritos de listados que INHGEOMIN ha hecho públicos — la mayoría de los registros marcados
            <strong style={{ color: 'var(--amber)' }}> En Solicitud </strong>
            siguen pendientes de aprobación.
          </p>

          <RegistroSearch />

          <div
            className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <CategoriaCard
              token="green"
              label="Otorgada · Explotación"
              body="Concesiones con permiso vigente de extracción de mineral."
            />
            <CategoriaCard
              token="blue"
              label="Otorgada · Exploración"
              body="Concesiones con permiso vigente para exploración y muestreo."
            />
            <CategoriaCard
              token="amber"
              label="En Solicitud"
              body="Solicitudes ingresadas pero aún pendientes de aprobación."
            />
          </div>

          <div
            style={{
              marginTop:  48,
              padding:    20,
              background: 'var(--concrete)',
              borderRadius: 12,
              border:     '1px solid var(--border)',
            }}
          >
            <div className="flex gap-3 items-start">
              <Mountain
                size={18}
                strokeWidth={1.5}
                style={{ color: 'var(--moss)', marginTop: 2 }}
              />
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55 }}>
                {REGISTRO_CONSULTA_NOTA} Para dudas sobre esta consulta, escriba a{' '}
                <a href="mailto:gerencia@mape.legal" style={{ color: 'var(--moss)', textDecoration: 'underline' }}>
                  gerencia@mape.legal
                </a>
                . Las clasificaciones <em>Metálica</em>, <em>No Metálica</em> y
                <em> Pequeña Minería Metálica</em> corresponden a la tipología del listado publicado por INHGEOMIN.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CategoriaCard({ token, label, body }: { token: string; label: string; body: string }) {
  return (
    <div
      style={{
        background:  'var(--bg)',
        border:      '1px solid var(--border)',
        borderRadius: 12,
        padding:     20,
        boxShadow:   '0 2px 6px rgba(31,42,56,0.05)',
      }}
    >
      <div
        style={{
          width:        10,
          height:       10,
          borderRadius: 9999,
          background:   `var(--${token})`,
          marginBottom: 12,
        }}
      />
      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
