import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { SlidesViewer, type Slide } from './SlidesViewer';

// Página técnica informativa — NO es e-commerce. Presenta el tipo de equipo
// para procesar oro aluvial con alto porcentaje arcilloso, usando las láminas
// técnicas como contenido central. Estática: sin Supabase, sin precios.

export const metadata: Metadata = {
  title: 'Equipo para Oro Aluvial con Alto Contenido Arcilloso',
  description:
    'Dossier técnico: circuito de lavado y recuperación gravimétrica para gravas auríferas con arcilla pegajosa — tolva grizzly, trommel lavador, concentración en dos etapas y fundición.',
};

const DIR = '/images/equipos/planta-lavado-oro-aluvial-100tph';

const SLIDES: Slide[] = [
  { src: `${DIR}/02.jpeg`, alt: 'Panorama del proyecto — recuperación gravimétrica en gravas con arcilla' },
  { src: `${DIR}/03.jpeg`, alt: 'Flujo de proceso — de la grava aluvial al lingote doré' },
  { src: `${DIR}/04.jpeg`, alt: 'Etapa 01 — Tolva grizzly y alimentador vibratorio' },
  { src: `${DIR}/05.jpeg`, alt: 'Etapa 02 — Trommel lavador, elegido por la arcilla' },
  { src: `${DIR}/06.jpeg`, alt: 'Etapa 03 — Concentración por gravedad en dos etapas' },
  { src: `${DIR}/07.jpeg`, alt: 'Etapa 04 — Esclusas de seguridad y horno de fundición' },
  { src: `${DIR}/08.jpeg`, alt: 'Equipos principales y lógica de diseño' },
];

const ETAPAS = [
  {
    numero: '01',
    titulo: 'Recepción y clasificación primaria',
    detalle:
      'La tolva grizzly de 25 m³ retiene bolones mayores de 300 mm y protege los equipos aguas abajo. El alimentador vibratorio de rejilla clasifica a ~70 mm y dosifica un flujo uniforme hacia el trommel.',
  },
  {
    numero: '02',
    titulo: 'Lavado y desaglomeración',
    detalle:
      'El trommel lavador (modelo 1500, 70–100 TPH) rompe los terrones de arcilla con rotación y agua, y libera el oro atrapado. El sobretamaño de 3–70 mm sale por cinta; el bajotamaño de 0–3 mm pasa como pulpa a concentración.',
  },
  {
    numero: '03',
    titulo: 'Concentración gravimétrica en dos etapas',
    detalle:
      'El concentrador centrífugo STLB80 (10–20 TPH) hace la recuperación primaria aprovechando la densidad del oro frente a la ganga. Dos mesas vibradoras 6S-4500 limpian el concentrado y entregan oro de alta pureza.',
  },
  {
    numero: '04',
    titulo: 'Recuperación de relaves y fundición',
    detalle:
      'Dos esclusas con tapa (1 m × 6 m × 0,3 m, 30 TPH cada una) sobre las colas del centrífugo capturan el oro residual. El concentrado final se procesa en el horno de fundición y sale como lingote doré.',
  },
];

const EQUIPOS_TABLA = [
  ['Trommel lavador de oro', '1500', '1 juego', '70–100 TPH'],
  ['Concentrador centrífugo', 'STLB80', '1 juego', '10–20 TPH'],
  ['Esclusa con tapa (An × L × Al)', '1 m × 6 m × 0,3 m', '2 juegos', '30 TPH cada una'],
  ['Mesa vibradora', '6S-4500', '2 juegos', '—'],
];

const WHATSAPP = '50497373139';

export default function EquiposPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-soft)' }}>
      {/* Hero técnico */}
      <header className="relative overflow-hidden" style={{ background: 'var(--ink)' }}>
        <div className="absolute inset-0 opacity-[0.06]" aria-hidden="true">
          <svg width="100%" height="100%" aria-hidden="true">
            <defs>
              <pattern id="topo-equipos" x="0" y="0" width="200" height="100" patternUnits="userSpaceOnUse">
                <path
                  d="M0 50 Q50 20 100 50 T200 50 M0 70 Q50 40 100 70 T200 70 M0 30 Q50 0 100 30 T200 30"
                  fill="none"
                  stroke="var(--sand)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-equipos)" />
          </svg>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
            style={{ color: 'var(--slate-lt)' }}
          >
            <ArrowLeft size={14} />
            MAPE LEGAL
          </Link>
          <p
            className="text-xs font-medium tracking-[0.18em] uppercase mb-4"
            style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--sand)' }}
          >
            Procesamiento de mineral aurífero
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight max-w-3xl"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--bg)' }}
          >
            Equipo para oro aluvial con <em style={{ color: 'var(--sand)' }}>alto contenido arcilloso</em>
          </h1>
          <p className="mt-4 text-base sm:text-lg max-w-2xl leading-relaxed" style={{ color: 'var(--slate-lt)' }}>
            El mineral aluvial llega mezclado con arcilla pegajosa que envuelve las partículas de
            oro y obstruye la clasificación convencional. Este dossier documenta el circuito que
            responde a ese yacimiento: lavado y desaglomeración antes de cualquier etapa de
            concentración.
          </p>

          {/* Stats técnicos */}
          <dl className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
            {[
              ['100 TPH', 'Capacidad de proceso'],
              ['≥ 80 %', 'Recuperación objetivo'],
              ['0–3 mm', 'Pulpa a concentración'],
              ['4', 'Etapas del circuito'],
            ].map(([valor, label]) => (
              <div key={label}>
                <dd
                  className="text-2xl sm:text-3xl font-semibold"
                  style={{ fontFamily: 'var(--font-playfair)', color: 'var(--sand)' }}
                >
                  {valor}
                </dd>
                <dt className="mt-1 text-xs" style={{ color: 'var(--slate-lt)' }}>
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
        {/* Render + desafío técnico */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div
            className="relative aspect-[4/3] rounded-xl overflow-hidden"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <Image
              src={`${DIR}/01.jpeg`}
              alt="Circuito completo de lavado de oro aluvial: tolva grizzly, trommel lavador, concentración gravimétrica"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={90}
              priority
            />
          </div>
          <div>
            <p
              className="text-xs font-medium tracking-[0.18em] uppercase mb-3"
              style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
            >
              El desafío del yacimiento
            </p>
            <h2
              className="text-2xl sm:text-3xl font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
            >
              La arcilla decide el diseño del circuito
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--t2)' }}>
              La arcilla pegajosa forma terrones que atrapan el oro fino: si el material entra
              directo a clasificación, el oro se va con los rechazos. Por eso el circuito prioriza
              el lavado — un trommel rotativo con aspersión de agua rompe la arcilla y libera el
              oro antes de clasificar.
            </p>
            <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--t2)' }}>
              La concentración se hace por gravedad en dos etapas — centrífugo primero, mesas
              vibradoras después — y las colas pasan por esclusas de seguridad que reintegran el
              oro residual al circuito. Sin mercurio ni cianuro: separación puramente física.
            </p>
          </div>
        </section>

        {/* Visor de láminas */}
        <section>
          <p
            className="text-xs font-medium tracking-[0.18em] uppercase mb-3"
            style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
          >
            Documentación técnica
          </p>
          <h2
            className="text-2xl sm:text-3xl font-semibold leading-tight mb-6"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
          >
            Las láminas del circuito, etapa por etapa
          </h2>
          <SlidesViewer slides={SLIDES} />
        </section>

        {/* Etapas */}
        <section>
          <p
            className="text-xs font-medium tracking-[0.18em] uppercase mb-3"
            style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
          >
            Flujo de proceso
          </p>
          <h2
            className="text-2xl sm:text-3xl font-semibold leading-tight mb-8"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
          >
            De la grava aluvial al lingote doré
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {ETAPAS.map((etapa) => (
              <article
                key={etapa.numero}
                className="rounded-xl p-6"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
                }}
              >
                <span
                  className="text-sm font-medium"
                  style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--earth)' }}
                >
                  Etapa {etapa.numero}
                </span>
                <h3
                  className="mt-2 text-lg font-semibold leading-snug"
                  style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
                >
                  {etapa.titulo}
                </h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
                  {etapa.detalle}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Tabla de equipos */}
        <section>
          <p
            className="text-xs font-medium tracking-[0.18em] uppercase mb-3"
            style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
          >
            Configuración de referencia
          </p>
          <h2
            className="text-2xl sm:text-3xl font-semibold leading-tight mb-6"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
          >
            Equipos principales del circuito
          </h2>
          <div
            className="rounded-xl overflow-hidden overflow-x-auto"
            style={{ border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm" style={{ background: 'var(--bg)' }}>
              <thead>
                <tr style={{ background: 'var(--ink)' }}>
                  {['Equipo', 'Modelo', 'Cantidad', 'Capacidad'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#fff' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EQUIPOS_TABLA.map(([equipo, modelo, cantidad, capacidad]) => (
                  <tr key={equipo} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--t1)' }}>
                      {equipo}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--t2)' }}>
                      {modelo}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>
                      {cantidad}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--t2)' }}>
                      {capacidad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--t3)' }}>
            Configuración de referencia para 100 TPH de material aluvial con arcilla pegajosa y
            alimentación de excavadora y camión. El dimensionamiento final depende del yacimiento.
          </p>
        </section>

        {/* Cierre institucional — consulta técnica, no venta */}
        <section
          className="rounded-xl p-8 sm:p-10 text-center"
          style={{ background: 'var(--concrete)', border: '1px solid var(--border)' }}
        >
          <h2
            className="text-xl sm:text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
          >
            ¿Tu yacimiento se parece a este?
          </h2>
          <p className="mt-3 text-sm max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--t2)' }}>
            MAPE LEGAL asesora la selección y dimensionamiento de equipo según la situación real
            del terreno — tipo de material, contenido de arcilla, acceso a agua y escala de la
            operación. La consulta técnica es el primer paso.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, vi el dossier técnico de equipo para oro aluvial arcilloso en mape.legal/equipos y quiero una consulta técnica.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--moss)', color: '#fff' }}
            >
              <Phone size={16} />
              WhatsApp +504 9737 3139
            </a>
            <a
              href="mailto:gerencia@mape.legal?subject=Consulta%20t%C3%A9cnica%20%E2%80%94%20equipo%20oro%20aluvial"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', color: 'var(--t2)', background: 'var(--bg)' }}
            >
              <Mail size={16} />
              gerencia@mape.legal
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
