import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Phone, Mail } from 'lucide-react';
import type { EquipoMercado } from '@/lib/types/equipo';
import { CATEGORIA_LABELS } from '@/lib/types/equipo';

// Vitrina institucional del Mercado de Equipos — el inventario nunca supera
// MAX_EQUIPOS_ACTIVOS (3), así que no hay buscador, filtros ni paginación:
// cada equipo se presenta como pieza editorial completa. Server component
// (cero estado; los CTAs son anchors).

interface Props {
  equipos: EquipoMercado[];
}

const WHATSAPP = '50497373139';

function precioDisplay(e: EquipoMercado): string {
  const min = `USD ${e.precio_min_usd.toLocaleString('en-US')}`;
  return e.precio_max_usd ? `${min} – ${e.precio_max_usd.toLocaleString('en-US')}` : min;
}

function whatsappUrl(e: EquipoMercado): string {
  const msg = `Hola, me interesa el equipo "${e.nombre}" publicado en mape.legal/equipos. ¿Me pueden dar más información?`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

// Hasta 4 specs clave por equipo en la vitrina: capacidad primero, luego las
// primeras entradas de especificaciones (la ficha completa vive en el detalle).
function keySpecs(e: EquipoMercado): Array<[string, string]> {
  const specs: Array<[string, string]> = [];
  if (e.capacidad) specs.push(['Capacidad', e.capacidad]);
  for (const [k, v] of Object.entries(e.especificaciones ?? {})) {
    if (specs.length >= 4) break;
    if (k === 'Incoterm') continue; // ya se muestra junto al precio
    specs.push([k, v]);
  }
  return specs;
}

export function EquiposShowcase({ equipos }: Props) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-soft)' }}>
      {/* Hero institucional */}
      <header className="relative overflow-hidden" style={{ background: 'var(--ink)' }}>
        <div className="absolute inset-0 opacity-[0.06]" aria-hidden="true">
          <svg width="100%" height="100%" aria-hidden="true">
            <defs>
              <pattern
                id="topo-equipos"
                x="0"
                y="0"
                width="200"
                height="100"
                patternUnits="userSpaceOnUse"
              >
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
            Equipos en venta · Importación directa
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight max-w-3xl"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--bg)' }}
          >
            Maquinaria para <em style={{ color: 'var(--sand)' }}>lavado de oro</em> seleccionada
            por MAPE LEGAL
          </h1>
          <p
            className="mt-4 text-base sm:text-lg max-w-2xl leading-relaxed"
            style={{ color: 'var(--slate-lt)' }}
          >
            Un inventario corto y curado: cada equipo se importa con especificaciones verificadas
            y precio CIF Honduras. MAPE LEGAL acompaña la compra de punta a punta.
          </p>
        </div>
      </header>

      {/* Vitrina */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {equipos.length === 0 ? (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
            >
              Inventario en rotación
            </h2>
            <p className="mt-3 text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--t2)' }}>
              En este momento no hay equipos publicados. Escribinos y te avisamos cuando entre el
              próximo lote.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--moss)', color: '#fff' }}
            >
              <Phone size={16} />
              Consultar disponibilidad
            </a>
          </div>
        ) : (
          <div className="space-y-12 sm:space-y-16">
            {equipos.map((equipo, i) => (
              <article
                key={equipo.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(31,42,56,0.05)',
                }}
              >
                <div className={`grid grid-cols-1 lg:grid-cols-2 ${i % 2 === 1 ? 'lg:[direction:rtl]' : ''}`}>
                  {/* Imagen */}
                  <Link
                    href={`/equipos/${equipo.slug}`}
                    className="relative block aspect-[4/3] lg:aspect-auto lg:min-h-[420px]"
                    style={{ background: 'var(--bg)', direction: 'ltr' }}
                    aria-label={`Ver ficha de ${equipo.nombre}`}
                  >
                    <Image
                      src={equipo.imagen_url}
                      alt={equipo.nombre}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority={i === 0}
                    />
                  </Link>

                  {/* Info */}
                  <div className="p-6 sm:p-10 flex flex-col" style={{ direction: 'ltr' }}>
                    <span
                      className="text-xs font-medium tracking-[0.18em] uppercase"
                      style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
                    >
                      {CATEGORIA_LABELS[equipo.categoria]}
                    </span>

                    <h2
                      className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight"
                      style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
                    >
                      {equipo.nombre}
                    </h2>

                    {equipo.descripcion_corta && (
                      <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--t2)' }}>
                        {equipo.descripcion_corta}
                      </p>
                    )}

                    {keySpecs(equipo).length > 0 && (
                      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        {keySpecs(equipo).map(([label, value]) => (
                          <div key={label} className="flex flex-col gap-0.5">
                            <dt
                              className="text-xs uppercase tracking-wide"
                              style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--t3)' }}
                            >
                              {label}
                            </dt>
                            <dd className="text-sm font-medium" style={{ color: 'var(--t1)' }}>
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                      <p
                        className="text-3xl font-bold"
                        style={{ fontFamily: 'var(--font-playfair)', color: 'var(--earth)' }}
                      >
                        {precioDisplay(equipo)}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--slate)' }}>
                        Precio {equipo.especificaciones?.['Incoterm'] ?? 'FOB'} &middot; MOQ:{' '}
                        {equipo.moq} {equipo.unidad_moq}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Link
                        href={`/equipos/${equipo.slug}`}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
                        style={{ background: 'var(--ink)', color: '#fff' }}
                      >
                        Ver ficha completa
                        <ArrowRight size={16} />
                      </Link>
                      <a
                        href={whatsappUrl(equipo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
                        style={{ background: 'var(--moss)', color: '#fff' }}
                      >
                        <Phone size={16} />
                        Consultar por WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Cierre institucional */}
        <section
          className="mt-16 rounded-xl p-8 sm:p-10 text-center"
          style={{ background: 'var(--concrete)', border: '1px solid var(--border)' }}
        >
          <h2
            className="text-xl sm:text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
          >
            ¿Necesitás un equipo que no está en la vitrina?
          </h2>
          <p className="mt-3 text-sm max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--t2)' }}>
            MAPE LEGAL importa maquinaria bajo pedido con especificaciones verificadas. Contanos qué
            capacidad y mineral trabajás, y armamos la cotización CIF Honduras.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, busco un equipo de minería que no está en la vitrina de mape.legal/equipos.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--moss)', color: '#fff' }}
            >
              <Phone size={16} />
              WhatsApp +504 9737 3139
            </a>
            <a
              href="mailto:gerencia@mape.legal?subject=Consulta%20de%20equipo%20bajo%20pedido"
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
