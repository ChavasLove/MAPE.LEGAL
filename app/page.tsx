// Landing institucional (Fase 2C) — reposicionada hacia la legalización de
// permisos de pequeña minería y la comercialización condicionada de oro.
// Server component: el copy con consecuencia jurídica se importa desde
// lib/content/copy-legal.ts; la interactividad vive en PublicNav y MariaWidget.

import type { Metadata } from 'next'
import Link from 'next/link'
import TopoBand from '@/components/decor/TopoBand'
import MariaWidget from '@/components/landing/MariaWidget'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import PriceTickerBar from '@/components/precios/PriceTickerBar'
import {
  CERTIFICADO_ORIGEN_NOTA,
  CONTACTO,
  DOMICILIO_LINES,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Legalización de permisos de pequeña minería de oro en Honduras',
  description:
    'Acompañamiento legal, ambiental y técnico para obtener el permiso de pequeña minería ante INHGEOMIN: expediente, licencia ambiental, trazabilidad y certificado de origen del oro en Honduras.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Legalización de permisos de pequeña minería de oro en Honduras',
    description:
      'Del expediente ante INHGEOMIN a la trazabilidad del oro: pequeña minería legal en Honduras.',
  },
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 'clamp(20px, 4vw, 24px)',
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--earth)',
}

/* Franja de clasificación — autoidentificación del operador en <30 s. */
const CLASIFICACION = [
  {
    condicion: 'Uso tromel, zaranda o bomba',
    categoria: 'Pequeña minería',
    cita: 'Art. 4, Regl. Especial MAPE · Arts. 86–87, Ley General de Minería',
    cuerpo:
      'El uso de medios mecánicos define la pequeña minería. Su ruta es el permiso de pequeña minería ante INHGEOMIN. La ruta artesanal municipal no le aplica.',
    href: '/pequena-mineria',
    linkLabel: 'Ver requisitos y rutas legales',
  },
  {
    condicion: 'Uso solo herramienta manual, en cauce o playa',
    categoria: 'Minería artesanal',
    cita: 'Art. 89, Ley General de Minería',
    cuerpo:
      'Las técnicas exclusivamente manuales corresponden al régimen artesanal: permiso municipal dentro de un área delimitada por la autoridad.',
    href: '/#contacto',
    linkLabel: 'Consultar su caso',
  },
  {
    condicion: 'Soy dueño de tierra sin título registrado',
    categoria: 'Titulación y sociedad minera',
    cita: 'Trámite previo al derecho minero',
    cuerpo:
      'La titulación del predio y el contrato de sociedad minera ordenan la relación entre dueño de tierra y operador antes de solicitar el permiso.',
    href: '/#contacto',
    linkLabel: 'Consultar su caso',
  },
] as const

/* Qué hace CHT — cuatro bloques. */
const SERVICIOS = [
  {
    titulo: 'Expediente ante INHGEOMIN',
    cuerpo:
      'Preparación y gestión del expediente de permiso de pequeña minería conforme al Art. 6 del Reglamento Especial MAPE, con representación legal colegiada y seguimiento hasta la resolución.',
    href: '/pequena-mineria#requisitos',
  },
  {
    titulo: 'Licenciamiento ambiental',
    cuerpo:
      'Contratación del especialista ambiental, gestión de la licencia ambiental cuando procede y plan de cierre conforme al Manual de Buenas Prácticas.',
    href: '/pequena-mineria#requisitos',
  },
  {
    titulo: 'Trazabilidad y Certificado de Origen',
    cuerpo:
      'Expediente digital por unidad minera, evidencia georreferenciada y respaldo documental para la emisión del Certificado de Origen, verificable públicamente en este sitio.',
    href: '/mercados',
  },
  {
    titulo: 'Comercialización formal',
    cuerpo:
      'Compra de oro bajo condiciones publicadas: un solo precio de referencia, pago bancarizado en lempiras y registro documental por transacción.',
    href: '/comercializacion',
  },
] as const

export default function LandingPage() {
  return (
    <>
      {/* Ticker de precios — publicación diaria, enlaza a /precios */}
      <PriceTickerBar lang="es" />
      <PublicNav belowTicker />

      {/* ENCABEZADO */}
      <section
        className="hero"
        style={{
          position: 'relative',
          gridTemplateColumns: '1fr',
          backgroundImage: 'url(/images/RIVER%20AND%20MOUNTAINS.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'color-mix(in oklch, var(--bg-soft) 88%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <TopoBand variant="light" position="overlay" />
        <div className="hero-content" style={{ position: 'relative', maxWidth: 860 }}>
          <div className="hero-eyebrow">Pequeña minería · Honduras</div>
          <h1 className="hero-title">
            Legalización de permisos de pequeña minería de oro en Honduras.
          </h1>
          <p className="hero-sub" style={{ maxWidth: 640 }}>
            Acompañamiento legal, ambiental y técnico desde el expediente hasta la
            trazabilidad del oro.
          </p>
          <div className="hero-actions">
            <Link href="/pequena-mineria" className="btn-primary">
              Verificar si califico
            </Link>
            <Link href="/verificar" className="btn-ghost">
              Verificar un certificado
            </Link>
          </div>
        </div>
      </section>

      {/* FRANJA DE CLASIFICACIÓN */}
      <section
        id="clasificacion"
        className="mape-section"
        style={{ background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="section-label">Clasificación</div>
        <h2 className="section-title">¿Qué tipo de operación tiene usted?</h2>
        <p className="section-sub">
          La ley hondureña clasifica la operación por la técnica que usa, no por su
          tamaño. Identifique su caso:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10">
          {CLASIFICACION.map((card) => (
            <div key={card.condicion} style={CARD_STYLE}>
              <div style={EYEBROW_STYLE}>{card.condicion}</div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {card.categoria}
              </h3>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--slate)',
                }}
              >
                {card.cita}
              </div>
              <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, flexGrow: 1 }}>
                {card.cuerpo}
              </p>
              <Link
                href={card.href}
                style={{
                  color: 'var(--moss)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                {card.linkLabel} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* QUÉ HACE CHT */}
      <section
        id="servicios"
        className="mape-section"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="section-label">Qué hace CHT</div>
        <h2 className="section-title">Del expediente a la trazabilidad del oro.</h2>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          Corporación Hondureña Tenka, S.A. acompaña al operador de pequeña minería en
          cuatro frentes que terminan en un mismo lugar: oro con origen documentado.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mt-12">
          {SERVICIOS.map((bloque) => (
            <div key={bloque.titulo} style={CARD_STYLE}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {bloque.titulo}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, flexGrow: 1 }}>
                {bloque.cuerpo}
              </p>
              <Link
                href={bloque.href}
                style={{
                  color: 'var(--moss)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                Más detalle →
              </Link>
            </div>
          ))}
        </div>

        {/* Nota legal permanente — pie de la sección de trazabilidad */}
        <div
          style={{
            marginTop: 28,
            padding: 'clamp(16px, 3vw, 20px)',
            background: 'var(--concrete)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
            {CERTIFICADO_ORIGEN_NOTA}
          </p>
        </div>
      </section>

      {/* LA BRECHA REGULATORIA */}
      <section
        id="brecha"
        className="mape-section"
        style={{ background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="section-label">La brecha regulatoria</div>
        <h2 className="section-title">
          Quien usa medios mecánicos ya no es minero artesanal.
        </h2>
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
          <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
            La Ley General de Minería distingue dos regímenes. La minería artesanal usa
            técnicas exclusivamente manuales y se autoriza por permiso municipal dentro
            de áreas delimitadas (Art. 89). La pequeña minería usa medios mecánicos
            sencillos —tromel, zaranda, bombas— y requiere permiso ante INHGEOMIN
            (Arts. 86–87 de la Ley; Art. 4 del Reglamento Especial MAPE).
          </p>
          <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
            En la práctica, la mayoría de los operadores que hoy trabajan con medios
            mecánicos no encajan en el régimen artesanal y no cuentan con permiso de
            pequeña minería: operan sin derecho minero.
          </p>
          <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
            Esa brecha tiene consecuencias concretas. El Art. 34 del Reglamento Especial
            MAPE penaliza los actos de comercio sobre producción sin derecho minero, y
            el Art. 38 de la Ley hace responsable solidario a quien compra sin verificar
            el origen. Cerrar la brecha empieza por el expediente correcto.
          </p>
          <Link
            href="/pequena-mineria"
            style={{
              color: 'var(--moss)',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            Cómo se obtiene el permiso de pequeña minería →
          </Link>
        </div>
      </section>

      {/* CONTACTO */}
      <section
        id="contacto"
        className="mape-section"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="section-label">Contacto</div>
        <h2 className="section-title">Cómo escribirnos.</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10">
          <div style={CARD_STYLE}>
            <div style={EYEBROW_STYLE}>WhatsApp institucional</div>
            <a
              href={CONTACTO.whatsappHref}
              style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500, fontSize: 16 }}
            >
              {CONTACTO.whatsapp}
            </a>
          </div>
          <div style={CARD_STYLE}>
            <div style={EYEBROW_STYLE}>Correo</div>
            <a
              href={CONTACTO.emailHref}
              style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500, fontSize: 16 }}
            >
              {CONTACTO.email}
            </a>
          </div>
          <div style={CARD_STYLE}>
            <div style={EYEBROW_STYLE}>Oficina</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {DOMICILIO_LINES.map((line) => (
                <span key={line} style={{ fontSize: 14, color: 'var(--t2)' }}>{line}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* María — chat widget institucional (derivación a WhatsApp) */}
      <MariaWidget lang="es" />
    </>
  )
}
