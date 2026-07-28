// /pequena-mineria — ruta núcleo del sitio (Fase 2C, Tarea 4).
// Página larga con anclas de navegación lateral. Server component; el copy
// con consecuencia jurídica se importa desde lib/content/copy-legal.ts.

import type { Metadata } from 'next'
import MariaWidget from '@/components/landing/MariaWidget'
import PublicNav from '@/components/landing/PublicNav'
import SiteFooter from '@/components/landing/SiteFooter'
import {
  AVISO_RESOLUCIONES,
  CITAS_LEGALES,
  CONTACTO,
} from '@/lib/content/copy-legal'

export const metadata: Metadata = {
  title: 'Permiso de pequeña minería en Honduras — requisitos INHGEOMIN y rutas legales',
  description:
    'Cómo legalizar una mina de oro en Honduras: requisitos INHGEOMIN del permiso de pequeña minería (Art. 6, Reglamento Especial MAPE), licencia ambiental, y las tres rutas legales de acceso al derecho minero.',
  alternates: { canonical: '/pequena-mineria' },
  openGraph: {
    type: 'website',
    locale: 'es_HN',
    title: 'Permiso de pequeña minería en Honduras · MAPE.LEGAL',
    description:
      'Requisitos del expediente ante INHGEOMIN, licencia ambiental y rutas legales para el operador con tromel, zaranda o bomba.',
    images: [{ url: '/images/RIVER AND MOUNTAINS.png', width: 1200, height: 630, alt: 'MAPE LEGAL — territorio' }],
  },
}

const ANCLAS = [
  { href: '#aplica', label: '¿Esto le aplica?' },
  { href: '#que-se-obtiene', label: 'Qué se obtiene' },
  { href: '#requisitos', label: 'Requisitos del expediente' },
  { href: '#rutas', label: 'Tres rutas legales' },
  { href: '#que-hace-cht', label: 'Qué hace CHT y qué no' },
  { href: '#antes-del-permiso', label: 'Antes del permiso' },
  { href: '#recuperacion', label: 'Recuperación metalúrgica' },
  { href: '#contacto-cta', label: 'Contacto' },
] as const

/* Requisitos del expediente — Art. 6, Reglamento Especial MAPE. */
const REQUISITOS = [
  'Identificación del solicitante y RTN.',
  'Poder de representación otorgado a profesional del derecho colegiado.',
  'Escritura de constitución de sociedad o inscripción como comerciante individual.',
  'Declaración jurada de no estar comprendido en las inhabilidades del Art. 75 de la Ley General de Minería.',
  'Comprobante de pago de la inspección de campo.',
  'Formulario de solicitud con ubicación, antecedentes, forma de explotación, sustancia y volumen estimado.',
  'Tecnología de recuperación prevista.',
  'Plan de cierre conforme al Manual de Buenas Prácticas y plan de seguridad.',
  'Presupuesto y cronograma de operación.',
  'Plano del área a escala 1:20,000 en coordenadas UTM, datum NAD27 (Centroamérica).',
  'Ubicación del plantel de acopio o beneficio.',
  'Licencia ambiental cuando proceda, y título de propiedad del predio o autorización registrada del dueño.',
] as const

const RUTAS = [
  {
    id: 'A',
    titulo: 'Coexistencia con concesión vigente',
    cita: `${CITAS_LEGALES.regArt32.articulo} y ${CITAS_LEGALES.regArt33.articulo}, Regl. Especial MAPE`,
    cuerpo:
      'Acuerdo con el concesionario, notificado a la Autoridad Minera y Municipal. El concesionario asume las actividades dentro de sus obligaciones y amplía su licencia ambiental para cubrirlas. Es la ruta de menor carga documental para el operador.',
  },
  {
    id: 'B',
    titulo: 'Modificación de derecho minero',
    cita: `${CITAS_LEGALES.regArt31.articulo}, Regl. Especial MAPE`,
    cuerpo:
      'Aplica cuando existe una concesión inactiva sobre el área solicitada. El derecho existente se modifica para habilitar la operación de pequeña minería.',
  },
  {
    id: 'C',
    titulo: 'Grupo organizado',
    cita: `${CITAS_LEGALES.regArt5.articulo}, Regl. Especial MAPE`,
    cuerpo:
      'Hasta diez permisos por persona natural, jurídica o grupo organizado, con un máximo de 10 hectáreas cada uno. Distribuye el costo del expediente entre varios operadores.',
  },
] as const

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(22px, 3vw, 28px)',
  fontWeight: 600,
  color: 'var(--ink)',
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
}

const BODY: React.CSSProperties = { fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 'clamp(20px, 4vw, 24px)',
  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
}

export default function PequenaMineriaPage() {
  return (
    <>
      <PublicNav />

      <section className="mape-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="section-label">Pequeña minería</div>
        <h1 className="section-title" style={{ maxWidth: 780 }}>
          El permiso de pequeña minería, paso a paso.
        </h1>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          Si su operación usa tromel, zaranda o bomba, la ley la clasifica como
          pequeña minería. Esta página reúne el criterio de clasificación, los
          requisitos del expediente ante INHGEOMIN y las rutas legales de acceso al
          derecho minero.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10 mt-12 items-start">
          {/* Navegación lateral por anclas (desktop) */}
          <aside
            className="hidden lg:block"
            style={{ position: 'sticky', top: 96 }}
            aria-label="Secciones de la página"
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ANCLAS.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  style={{
                    fontSize: 13,
                    color: 'var(--slate)',
                    textDecoration: 'none',
                    padding: '6px 10px',
                    borderLeft: '2px solid var(--border)',
                  }}
                >
                  {a.label}
                </a>
              ))}
            </nav>
          </aside>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 56, maxWidth: 760 }}>
            {/* Índice móvil — el aside lateral desaparece bajo lg; <details>
                da salto a secciones sin JS */}
            <details
              className="lg:hidden"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 18px',
              }}
            >
              <summary
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--earth)',
                  cursor: 'pointer',
                }}
              >
                En esta página
              </summary>
              <nav style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                {ANCLAS.map((a) => (
                  <a
                    key={a.href}
                    href={a.href}
                    style={{
                      fontSize: 15,
                      color: 'var(--t2)',
                      textDecoration: 'none',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {a.label}
                  </a>
                ))}
              </nav>
            </details>

            {/* 1 — ¿ESTO LE APLICA? */}
            <section id="aplica" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>¿Esto le aplica?</h2>
              <p style={BODY}>
                El criterio es único y verificable: <strong style={{ color: 'var(--ink)' }}>si
                usa medios mecánicos, es pequeña minería</strong>. El tromel, la zaranda y la
                bomba son medios mecánicos sencillos; por definición legal, esa operación es
                pequeña minería ({CITAS_LEGALES.regArt4.articulo} del Reglamento Especial
                MAPE; {CITAS_LEGALES.leyArt86_87.articulo} de la Ley General de Minería).
              </p>
              <p style={BODY}>
                La minería artesanal es otra cosa: técnicas exclusivamente manuales
                ({CITAS_LEGALES.leyArt89.articulo} de la Ley), con permiso municipal dentro
                de un área delimitada. Son regímenes distintos, con autoridades distintas.
              </p>
              <div
                style={{
                  ...CARD,
                  background: 'var(--concrete)',
                }}
              >
                <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--ink)' }}>Advertencia.</strong> Presentarse
                  como minero artesanal usando medios mecánicos es una declaración incorrecta
                  ante la autoridad. Además de no resolver la situación legal de la
                  operación, expone al operador en cualquier verificación posterior.
                </p>
              </div>
            </section>

            {/* 2 — QUÉ SE OBTIENE */}
            <section id="que-se-obtiene" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Qué se obtiene.</h2>
              <p style={BODY}>
                Un <strong style={{ color: 'var(--ink)' }}>Permiso de Pequeña Minería
                Metálica</strong> sobre un área de hasta 10 hectáreas
                ({CITAS_LEGALES.leyArt45.articulo} de la Ley General de Minería), inscrito
                en el Registro Minero y Catastral. Con el permiso inscrito, la operación
                adquiere derecho minero: puede extraer, beneficiar y comercializar su
                producción dentro del marco legal, y emitir el Certificado de Origen de cada
                venta.
              </p>
            </section>

            {/* 3 — REQUISITOS DEL EXPEDIENTE */}
            <section id="requisitos" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Requisitos del expediente.</h2>
              <p style={BODY}>
                El {CITAS_LEGALES.regArt6.articulo} del Reglamento Especial MAPE define el
                contenido de la solicitud. Presentado como lista verificable:
              </p>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 0, listStyle: 'none' }}>
                {REQUISITOS.map((req, i) => (
                  <li
                    key={req}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '12px 16px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--earth)',
                        minWidth: 22,
                        paddingTop: 2,
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>{req}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* 4 — TRES RUTAS LEGALES */}
            <section id="rutas" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Tres rutas legales de acceso.</h2>
              <p style={BODY}>
                No existe una sola puerta de entrada al derecho minero. Según la situación
                del área, se evalúa la ruta aplicable. Ninguna ruta tiene plazo prometido:
                la resolución es potestad de la Autoridad Minera.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {RUTAS.map((ruta) => (
                  <div key={ruta.id} style={CARD}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--earth)',
                        }}
                      >
                        Ruta {ruta.id}
                      </span>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--ink)',
                        }}
                      >
                        {ruta.titulo}
                      </h3>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>
                      {ruta.cita}
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, marginTop: 8 }}>
                      {ruta.cuerpo}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5 — QUÉ HACE CHT Y QUÉ NO HACE */}
            <section id="que-hace-cht" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Qué hace CHT y qué no hace.</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div style={CARD}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      // --moss, no --green: 11px en --green sobre card blanca
                      // queda bajo 4.5:1 (AA); --moss es AAA sobre claros
                      color: 'var(--moss)',
                      marginBottom: 10,
                    }}
                  >
                    CHT hace
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
                    <li style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                      Gestiona el expediente completo ante INHGEOMIN.
                    </li>
                    <li style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                      Contrata al especialista ambiental y coordina la licencia.
                    </li>
                    <li style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                      Asume la representación legal con profesional colegiado.
                    </li>
                  </ul>
                </div>
                <div style={CARD}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--red)',
                      marginBottom: 10,
                    }}
                  >
                    CHT no hace
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
                    <li style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                      No otorga permisos ni acelera resoluciones.
                    </li>
                    <li style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                      No garantiza resultados: la resolución es potestad de la Autoridad Minera.
                    </li>
                    <li style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                      No compra mineral antes de que exista derecho minero.
                    </li>
                  </ul>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>{AVISO_RESOLUCIONES}</p>
            </section>

            {/* 6 — LO QUE SÍ ES LÍCITO ANTES DEL PERMISO */}
            <section id="antes-del-permiso" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Lo que sí es lícito antes del permiso.</h2>
              <p style={BODY}>
                Mientras el expediente avanza, hay trabajo legal y técnico que no requiere
                derecho minero:
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
                <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  Asistencia técnica y capacitación ({CITAS_LEGALES.regArt37.articulo} del
                  Reglamento Especial MAPE).
                </li>
                <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  Caracterización de relaves y diseño del circuito de recuperación.
                </li>
                <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  Titulación de la tierra donde opera.
                </li>
                <li style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  Constitución de sociedades mineras entre dueño de tierra y operador.
                </li>
              </ul>
              <p style={BODY}>
                Lo que no es lícito es comerciar producción sin derecho minero: el{' '}
                {CITAS_LEGALES.regArt34.articulo} del Reglamento Especial MAPE lo penaliza,
                y el {CITAS_LEGALES.leyArt38.articulo} de la Ley hace responsable solidario
                al comprador.
              </p>
            </section>

            {/* 7 — RECUPERACIÓN METALÚRGICA */}
            <section id="recuperacion" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Recuperación metalúrgica.</h2>
              <p style={BODY}>
                La recuperación de oro en configuraciones típicas de tromel y zaranda suele
                quedar por debajo del potencial del material. La caracterización del relave
                y la mejora del circuito de recuperación incrementan el ingreso del
                operador sin extraer más material.
              </p>
              <p style={BODY}>
                CHT no publica cifras de recuperación mientras no existan mediciones
                propias documentadas. El diagnóstico se hace por unidad minera, sobre
                muestras del material real de la operación.
              </p>
            </section>

            {/* 8 — CTA */}
            <section id="contacto-cta" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={SECTION_TITLE}>Evalúe su caso.</h2>
              <p style={BODY}>
                Escríbanos con la ubicación de la operación y el equipo que usa. La primera
                evaluación define la ruta legal aplicable y la lista de documentos
                faltantes.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href={CONTACTO.whatsappHref} className="btn-primary">
                  WhatsApp {CONTACTO.whatsapp}
                </a>
                <a href={CONTACTO.emailHref} className="btn-ghost">
                  {CONTACTO.email}
                </a>
              </div>
            </section>
          </div>
        </div>
      </section>

      <SiteFooter />
      <MariaWidget lang="es" />
    </>
  )
}
