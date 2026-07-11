'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Phone, Check, ChevronRight, ExternalLink } from 'lucide-react';
import type { EquipoMercado } from '@/lib/types/equipo';
import { CATEGORIA_LABELS } from '@/lib/types/equipo';

interface Props {
  equipo: EquipoMercado;
}

export function EquipoDetailClient({ equipo }: Props) {
  const [selectedImage, setSelectedImage] = useState(equipo.imagen_url);
  const allImages = [equipo.imagen_url, ...(equipo.galeria_urls || [])].filter(Boolean);

  const precioDisplay = equipo.precio_max_usd
    ? `US$${equipo.precio_min_usd.toLocaleString()} - ${equipo.precio_max_usd.toLocaleString()}`
    : `US$${equipo.precio_min_usd.toLocaleString()}`;

  // MAPE LEGAL WhatsApp — same number/format as the landing (wa.me sin '+')
  const whatsappMessage = encodeURIComponent(
    `Hola, vi en MAPE.LEGAL el equipo "${equipo.nombre}" y me interesa recibir más información.`
  );
  const whatsappUrl = `https://wa.me/50497373139?text=${whatsappMessage}`;

  const specEntries = Object.entries(equipo.especificaciones || {});

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-soft)' }}>
      {/* Breadcrumb */}
      <div
        className="border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm" aria-label="Miga de pan">
            <Link
              href="/equipos"
              className="flex items-center gap-1 hover:underline"
              style={{ color: 'var(--slate)' }}
            >
              <ArrowLeft size={14} />
              Catálogo de equipos
            </Link>
            <ChevronRight size={14} style={{ color: 'var(--t3)' }} />
            <span style={{ color: 'var(--t3)' }}>{CATEGORIA_LABELS[equipo.categoria]}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div>
            <div
              className="relative aspect-square rounded-xl overflow-hidden"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <Image
                src={selectedImage}
                alt={equipo.nombre}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    aria-label={`Ver imagen ${i + 1}`}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImage === img ? 'border-[var(--moss)]' : 'border-transparent'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${equipo.nombre} ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <span
              className="text-xs font-medium tracking-[0.18em] uppercase"
              style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
            >
              {CATEGORIA_LABELS[equipo.categoria]}
            </span>

            <h1
              className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
            >
              {equipo.nombre}
            </h1>

            {equipo.proveedor && (
              <p className="mt-2 text-sm" style={{ color: 'var(--slate)' }}>
                Proveedor:{' '}
                <span className="font-medium" style={{ color: 'var(--t2)' }}>
                  {equipo.proveedor}
                </span>
              </p>
            )}

            <div className="mt-6">
              <p
                className="text-3xl font-bold"
                style={{ fontFamily: 'var(--font-playfair)', color: 'var(--earth)' }}
              >
                {precioDisplay}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--slate)' }}>
                MOQ: {equipo.moq} {equipo.unidad_moq} &middot; Precio FOB
              </p>
            </div>

            {/* Quick Specs */}
            <div
              className="mt-6 rounded-xl p-5 space-y-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <h3
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: 'var(--t1)' }}
              >
                Especificaciones
              </h3>

              {equipo.capacidad && <SpecRow label="Capacidad" value={equipo.capacidad} />}
              {equipo.potencia && <SpecRow label="Potencia" value={equipo.potencia} />}
              {equipo.peso && <SpecRow label="Peso" value={equipo.peso} />}
              {equipo.dimensiones && <SpecRow label="Dimensiones" value={equipo.dimensiones} />}

              {specEntries.map(([key, value]) => (
                <SpecRow key={key} label={key} value={value} />
              ))}

              {!equipo.capacidad &&
                !equipo.potencia &&
                !equipo.peso &&
                !equipo.dimensiones &&
                specEntries.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--t3)' }}>
                    Especificaciones técnicas disponibles bajo solicitud.
                  </p>
                )}
            </div>

            {/* Description */}
            {equipo.descripcion && (
              <div className="mt-6">
                <h3
                  className="text-sm font-semibold uppercase tracking-wide mb-3"
                  style={{ color: 'var(--t1)' }}
                >
                  Descripción
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
                  {equipo.descripcion}
                </p>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: 'var(--moss)', color: '#fff' }}
              >
                <Phone size={18} />
                Contactar por WhatsApp
              </a>

              <a
                href={`mailto:gerencia@mape.legal?subject=${encodeURIComponent(
                  `Consulta equipo: ${equipo.nombre}`
                )}`}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--t2)',
                  background: 'var(--bg)',
                }}
              >
                <ExternalLink size={16} />
                Solicitar cotización por correo
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-4">
              <TrustBadge text="Asesoría técnica incluida" />
              <TrustBadge text="Envío a Honduras" />
              <TrustBadge text="Soporte post-venta" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--slate)' }}>
        {label}
      </span>
      <span className="text-sm font-medium text-right" style={{ color: 'var(--t1)' }}>
        {value}
      </span>
    </div>
  );
}

function TrustBadge({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
      style={{
        background: 'color-mix(in oklch, var(--green) 10%, white)',
        color: 'var(--green)',
        border: '1px solid color-mix(in oklch, var(--green) 20%, white)',
      }}
    >
      <Check size={12} />
      {text}
    </span>
  );
}
