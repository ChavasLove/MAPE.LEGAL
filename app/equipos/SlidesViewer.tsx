'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Visor de láminas técnicas — navegación prev/next + miniaturas + flechas del
// teclado. Sin autoplay ni animaciones continuas (DESIGN.md §4).

export interface Slide {
  src: string;
  alt: string;
}

interface Props {
  slides: Slide[];
}

export function SlidesViewer({ slides }: Props) {
  const [index, setIndex] = useState(0);

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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  const slide = slides[index];

  return (
    <figure aria-label="Láminas técnicas del equipo">
      <div
        className="relative aspect-video rounded-xl overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          className="object-contain"
          sizes="(max-width: 1024px) 100vw, 960px"
          priority={index === 0}
        />

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
      </div>

      <figcaption
        className="mt-3 flex items-center justify-between text-xs"
        style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--slate)' }}
      >
        <span>{slide.alt}</span>
        <span aria-live="polite">
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
    </figure>
  );
}
