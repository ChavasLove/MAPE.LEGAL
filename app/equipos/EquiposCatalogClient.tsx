'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, SlidersHorizontal, X, ArrowRight, ArrowLeft } from 'lucide-react';
import type {
  EquipoSearchResult,
  CategoriaStat,
  EquipoFilters,
  EquipoCategoria,
} from '@/lib/types/equipo';
import { CATEGORIA_LABELS } from '@/lib/types/equipo';

interface Props {
  equipos: EquipoSearchResult[];
  total: number;
  categorias: CategoriaStat[];
  initialFilters: EquipoFilters;
}

export function EquiposCatalogClient({
  equipos: initialEquipos,
  total: initialTotal,
  categorias,
  initialFilters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(initialFilters.query || '');
  const [selectedCategoria, setSelectedCategoria] = useState<EquipoCategoria | undefined>(
    initialFilters.categoria
  );
  const [precioMin, setPrecioMin] = useState(initialFilters.precioMin?.toString() || '');
  const [precioMax, setPrecioMax] = useState(initialFilters.precioMax?.toString() || '');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const buildUrl = useCallback(
    (updates: Partial<EquipoFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Presence check ('key' in updates), not value check — applyFilters
      // passes `query: undefined` for an emptied box, and that must DELETE
      // the stale ?q= param, not leave the old search active.
      if ('query' in updates) {
        if (updates.query) params.set('q', updates.query);
        else params.delete('q');
      }
      if ('categoria' in updates) {
        if (updates.categoria) params.set('categoria', updates.categoria);
        else params.delete('categoria');
      }
      if ('precioMin' in updates) {
        if (updates.precioMin) params.set('precio_min', updates.precioMin.toString());
        else params.delete('precio_min');
      }
      if ('precioMax' in updates) {
        if (updates.precioMax) params.set('precio_max', updates.precioMax.toString());
        else params.delete('precio_max');
      }

      return `/equipos?${params.toString()}`;
    },
    [searchParams]
  );

  const applyFilters = useCallback(() => {
    startTransition(() => {
      router.push(
        buildUrl({
          query: query || undefined,
          categoria: selectedCategoria,
          precioMin: precioMin ? Number.parseInt(precioMin, 10) : undefined,
          precioMax: precioMax ? Number.parseInt(precioMax, 10) : undefined,
        }),
        { scroll: false }
      );
    });
  }, [query, selectedCategoria, precioMin, precioMax, buildUrl, router]);

  const clearFilters = useCallback(() => {
    setQuery('');
    setSelectedCategoria(undefined);
    setPrecioMin('');
    setPrecioMax('');
    startTransition(() => {
      router.push('/equipos', { scroll: false });
    });
  }, [router]);

  const hasActiveFilters = Boolean(query || selectedCategoria || precioMin || precioMax);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-soft)' }}>
      {/* Hero Header */}
      <header className="relative overflow-hidden" style={{ background: 'var(--ink)' }}>
        <div className="absolute inset-0 opacity-[0.06]" aria-hidden="true">
          {/* Topo watermark — same language as TopoBand */}
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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
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
            style={{
              fontFamily: 'var(--font-jetbrains)',
              color: 'var(--sand)',
            }}
          >
            Maquinaria para minería artesanal
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight max-w-3xl"
            style={{
              fontFamily: 'var(--font-playfair)',
              color: 'var(--bg)',
            }}
          >
            Equipos para <em style={{ color: 'var(--sand)' }}>lavado de oro</em> y plantas de
            procesamiento
          </h1>
          <p
            className="mt-4 text-base sm:text-lg max-w-2xl leading-relaxed"
            style={{ color: 'var(--slate-lt)' }}
          >
            Maquinaria seleccionada para operaciones de minería artesanal y pequeña escala en
            Honduras. Desde trommels portátiles hasta plantas completas de lavado.
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-xl">
            <div
              className="flex items-center rounded-lg overflow-hidden"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              <Search className="ml-4 flex-shrink-0" size={20} style={{ color: 'var(--slate)' }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Buscar equipos..."
                aria-label="Buscar equipos"
                className="flex-1 px-4 py-3 text-sm outline-none"
                style={{
                  fontFamily: 'var(--font-inter)',
                  color: 'var(--t1)',
                  background: 'transparent',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="mr-2 p-1 rounded"
                  aria-label="Borrar búsqueda"
                  style={{ color: 'var(--slate)' }}
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={applyFilters}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  background: 'var(--moss)',
                  color: '#fff',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--slate)' }}>
              <span className="font-semibold" style={{ color: 'var(--t1)' }}>
                {initialTotal}
              </span>{' '}
              productos disponibles
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded"
                style={{
                  color: 'var(--red)',
                  background: 'color-mix(in oklch, var(--red) 8%, white)',
                }}
              >
                <X size={12} />
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Mobile Filter Button */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--t2)',
              background: 'var(--bg)',
            }}
          >
            <SlidersHorizontal size={16} />
            Filtros
          </button>
        </div>

        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div
              className="rounded-xl p-5 sticky top-6"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              <h3
                className="text-sm font-semibold mb-4"
                style={{ fontFamily: 'var(--font-inter)', color: 'var(--t1)' }}
              >
                Categorías
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="categoria"
                    checked={!selectedCategoria}
                    onChange={() => setSelectedCategoria(undefined)}
                    className="w-4 h-4 accent-[var(--moss)]"
                  />
                  <span
                    className="text-sm group-hover:font-medium transition-all"
                    style={{ color: 'var(--t2)' }}
                  >
                    Todas las categorías
                  </span>
                </label>
                {categorias.map((cat) => (
                  <label key={cat.categoria} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="categoria"
                      checked={selectedCategoria === cat.categoria}
                      onChange={() => setSelectedCategoria(cat.categoria)}
                      className="w-4 h-4 accent-[var(--moss)]"
                    />
                    <span
                      className="text-sm group-hover:font-medium transition-all"
                      style={{ color: 'var(--t2)' }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--t3)' }}>
                      {cat.count}
                    </span>
                  </label>
                ))}
              </div>

              <div className="my-5 h-px" style={{ background: 'var(--border)' }} />

              <h3
                className="text-sm font-semibold mb-4"
                style={{ fontFamily: 'var(--font-inter)', color: 'var(--t1)' }}
              >
                Precio (USD)
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={precioMin}
                  onChange={(e) => setPrecioMin(e.target.value)}
                  placeholder="Mín"
                  aria-label="Precio mínimo"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-soft)',
                    color: 'var(--t1)',
                  }}
                />
                <span style={{ color: 'var(--t3)' }}>-</span>
                <input
                  type="number"
                  value={precioMax}
                  onChange={(e) => setPrecioMax(e.target.value)}
                  placeholder="Máx"
                  aria-label="Precio máximo"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-soft)',
                    color: 'var(--t1)',
                  }}
                />
              </div>

              <button
                onClick={applyFilters}
                className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--ink)', color: '#fff' }}
              >
                Aplicar filtros
              </button>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {isPending ? (
              // Static skeleton — no animate-pulse (DESIGN.md prohíbe animaciones continuas)
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      height: '380px',
                      opacity: 0.55,
                    }}
                  />
                ))}
              </div>
            ) : initialEquipos.length === 0 ? (
              <div
                className="rounded-xl p-12 text-center"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-lg font-medium mb-2" style={{ color: 'var(--t1)' }}>
                  No se encontraron equipos
                </p>
                <p className="text-sm" style={{ color: 'var(--slate)' }}>
                  Intenta con otros filtros o términos de búsqueda.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 px-6 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--moss)', color: '#fff' }}
                >
                  Ver todos los equipos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {initialEquipos.map((equipo) => (
                  <EquipoCard key={equipo.id} equipo={equipo} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      {mobileFiltersOpen && (
        <MobileFilterSheet
          categorias={categorias}
          selectedCategoria={selectedCategoria}
          onSelectCategoria={setSelectedCategoria}
          precioMin={precioMin}
          precioMax={precioMax}
          onPrecioMinChange={setPrecioMin}
          onPrecioMaxChange={setPrecioMax}
          onApply={() => {
            setMobileFiltersOpen(false);
            applyFilters();
          }}
          onClose={() => setMobileFiltersOpen(false)}
        />
      )}
    </div>
  );
}

// ==================== Product Card ====================

function EquipoCard({ equipo }: { equipo: EquipoSearchResult }) {
  const precioDisplay = equipo.precio_max_usd
    ? `US$${equipo.precio_min_usd.toLocaleString()} - ${equipo.precio_max_usd.toLocaleString()}`
    : `US$${equipo.precio_min_usd.toLocaleString()}`;

  return (
    <Link href={`/equipos/${equipo.slug}`} className="group block">
      <div
        className="rounded-xl overflow-hidden transition-shadow hover:shadow-md"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
          <Image
            src={equipo.imagen_url}
            alt={equipo.nombre}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          {equipo.destacado && (
            <span
              className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'var(--moss)', color: '#fff' }}
            >
              Destacado
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <span
            className="text-xs font-medium tracking-wide uppercase"
            style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--moss)' }}
          >
            {CATEGORIA_LABELS[equipo.categoria]}
          </span>

          <h3
            className="mt-2 text-base font-semibold leading-snug line-clamp-2"
            style={{ fontFamily: 'var(--font-inter)', color: 'var(--t1)' }}
          >
            {equipo.nombre}
          </h3>

          {equipo.descripcion_corta && (
            <p className="mt-2 text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--t2)' }}>
              {equipo.descripcion_corta}
            </p>
          )}

          {equipo.capacidad && (
            <p className="mt-2 text-xs" style={{ color: 'var(--slate)' }}>
              Capacidad: {equipo.capacidad}
            </p>
          )}

          <div className="mt-4 flex items-end justify-between">
            <div>
              <p
                className="text-lg font-bold"
                style={{ fontFamily: 'var(--font-playfair)', color: 'var(--earth)' }}
              >
                {precioDisplay}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                MOQ: {equipo.moq} {equipo.unidad_moq}
              </p>
            </div>
            <span
              className="flex items-center gap-1 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--moss)' }}
            >
              Ver detalle
              <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ==================== Mobile Filter Sheet ====================

function MobileFilterSheet({
  categorias,
  selectedCategoria,
  onSelectCategoria,
  precioMin,
  precioMax,
  onPrecioMinChange,
  onPrecioMaxChange,
  onApply,
  onClose,
}: {
  categorias: CategoriaStat[];
  selectedCategoria: EquipoCategoria | undefined;
  onSelectCategoria: (c: EquipoCategoria | undefined) => void;
  precioMin: string;
  precioMax: string;
  onPrecioMinChange: (v: string) => void;
  onPrecioMaxChange: (v: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-xl max-h-[80dvh] overflow-y-auto"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="sticky top-0 flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--t1)' }}>
            Filtros
          </h2>
          <button onClick={onClose} className="p-2" aria-label="Cerrar filtros">
            <X size={20} style={{ color: 'var(--t2)' }} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--t1)' }}>
              Categorías
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="categoria-mobile"
                  checked={!selectedCategoria}
                  onChange={() => onSelectCategoria(undefined)}
                  className="w-4 h-4 accent-[var(--moss)]"
                />
                <span className="text-sm" style={{ color: 'var(--t2)' }}>
                  Todas
                </span>
              </label>
              {categorias.map((cat) => (
                <label key={cat.categoria} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="categoria-mobile"
                    checked={selectedCategoria === cat.categoria}
                    onChange={() => onSelectCategoria(cat.categoria)}
                    className="w-4 h-4 accent-[var(--moss)]"
                  />
                  <span className="text-sm" style={{ color: 'var(--t2)' }}>
                    {cat.label}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--t3)' }}>
                    {cat.count}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--t1)' }}>
              Precio (USD)
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={precioMin}
                onChange={(e) => onPrecioMinChange(e.target.value)}
                placeholder="Mín"
                aria-label="Precio mínimo"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-soft)',
                  color: 'var(--t1)',
                }}
              />
              <span style={{ color: 'var(--t3)' }}>-</span>
              <input
                type="number"
                value={precioMax}
                onChange={(e) => onPrecioMaxChange(e.target.value)}
                placeholder="Máx"
                aria-label="Precio máximo"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-soft)',
                  color: 'var(--t1)',
                }}
              />
            </div>
          </div>

          <button
            onClick={onApply}
            className="w-full py-3 rounded-lg text-sm font-medium"
            style={{ background: 'var(--ink)', color: '#fff' }}
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
