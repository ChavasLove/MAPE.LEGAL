'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

// Visor de láminas técnicas — navegación prev/next + miniaturas + flechas del
// teclado + zoom a pantalla completa. Sin autoplay ni animaciones continuas
// (DESIGN.md §4).
//
// Las láminas van con `unoptimized`: la fuente es 1920×1080 con texto denso y
// el pipeline de next/image (resize al ancho del slot + re-encode webp q75)
// emborrona la tipografía pequeña. Servir el JPEG original (~170 KB) mantiene
// el texto nítido; el zoom muestra la lámina a resolución nativa.

export interface Slide {
  src: string;
  alt: string;
}

interface Props {
  slides: Slide[];
}

export function SlidesViewer({ slides }: Props) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + slides.length) % slides.length),
    [slides.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  // Scroll lock + foco al botón de cierre mientras el zoom está abierto.
  useEffect(() => {
    if (!zoomed) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomed]);

  const slide = slides[index];

  return (
    <figure aria-label="Láminas técnicas del equipo">
      <div
        className="relative aspect-video rounded-xl overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`Ampliar lámina: ${slide.alt}`}
          className="absolute inset-0 w-full h-full cursor-zoom-in"
        >
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 960px"
            priority={index === 0}
            unoptimized
          />
        </button>

        {/* Controles */}
        <button
          type="button"
          onClick={prev}
          aria-label="Lámina anterior"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--ink) 85%, white)',
            color: '#fff',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Lámina siguiente"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--ink) 85%, white)',
            color: '#fff',
          }}
        >
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="Ver a pantalla completa"
          className="absolute right-3 top-3 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--ink) 85%, white)',
            color: '#fff',
          }}
        >
          <Maximize2 size={18} />
        </button>
      </div>

      <figcaption
        className="mt-3 flex items-center justify-between gap-4 text-xs"
        style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--slate)' }}
      >
        <span>{slide.alt}</span>
        <span className="flex-shrink-0" aria-live="polite">
          Lámina {index + 1} de {slides.length}
        </span>
      </figcaption>

      {/* Miniaturas */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Miniaturas">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Ver lámina ${i + 1}: ${s.alt}`}
            onClick={() => setIndex(i)}
            className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2"
            style={{
              borderColor: i === index ? 'var(--moss)' : 'var(--border)',
              background: 'var(--bg)',
            }}
          >
            <Image src={s.src} alt="" fill className="object-contain" sizes="96px" />
          </button>
        ))}
      </div>

      {/* Zoom a pantalla completa — la lámina a resolución nativa */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Lámina ampliada: ${slide.alt}`}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'color-mix(in oklch, var(--ink) 96%, black)' }}
          onClick={() => setZoomed(false)}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span
              className="text-xs truncate"
              style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--slate-lt)' }}
            >
              {slide.alt} · {index + 1}/{slides.length}
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="Cerrar vista ampliada"
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in oklch, var(--ink) 60%, white)', color: '#fff' }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
            <Image
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              fill
              className="object-contain"
              sizes="100vw"
              unoptimized
            />
            <button
              type="button"
              onClick={prev}
              aria-label="Lámina anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: 'color-mix(in oklch, var(--ink) 60%, white)', color: '#fff' }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Lámina siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: 'color-mix(in oklch, var(--ink) 60%, white)', color: '#fff' }}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}
    </figure>
  );
}
