'use client';

import { PriceWidgets } from './PriceWidgets';

export function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Territory image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/RIVER%20AND%20MOUNTAINS.png')",
          filter: 'brightness(0.80) contrast(1.05) saturate(0.82)',
        }}
      />
      {/* Fallback gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

      {/* Top nav bar */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        <div className="flex flex-col leading-tight">
          <span className="text-white font-bold text-base tracking-tight font-sans">MAPE.LEGAL</span>
          <span className="text-white/45 text-[10px] tracking-widest uppercase font-sans">Corporación Hondureña Tenka</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-white/80 text-sm font-medium font-sans">
          <a href="#problema" className="hover:text-white transition-colors">El Problema</a>
          <a href="#solucion" className="hover:text-white transition-colors">La Solución</a>
          <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
          <a href="#roadmap" className="hover:text-white transition-colors">Avance</a>
        </div>
        <button
          onClick={() => scrollTo('contacto')}
          className="bg-primary-950 hover:bg-primary-900 text-white text-sm font-semibold font-sans px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Iniciar trámite
        </button>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-sm font-medium font-sans mb-8 border border-white/25">
          <span className="w-2 h-2 rounded-full bg-action-green animate-pulse" />
          Piloto Iriona 2026 · Colón, Honduras · 60 productores
        </div>

        <h1 className="text-5xl md:text-[4.5rem] font-bold leading-tight text-white mb-6 tracking-tight">
          Formalización minera con<br />
          <span className="text-earth-200">el menor tiempo posible</span>
        </h1>

        <p className="text-xl text-white/85 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          MAPE.LEGAL es la plataforma que convierte operaciones artesanales en oro
          traceable, certificado y premium —&nbsp;acompañamiento legal continuo
          conforme a ILO&nbsp;169, SLAS-2 y estándares CRAFT&nbsp;/&nbsp;Fairmined.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => scrollTo('contacto')}
            className="bg-primary-950 hover:bg-primary-900 text-white text-lg font-bold font-sans px-10 py-4 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Iniciar trámite ahora
          </button>
          <a
            href="#contacto"
            className="border border-white/40 hover:bg-white/10 text-white text-lg font-medium font-sans px-8 py-4 rounded-lg transition-colors"
          >
            Solicitar cotización →
          </a>
        </div>

        {/* Certifications strip */}
        <div className="mt-14 flex flex-wrap justify-center gap-8">
          {[
            { label: 'ILO 169', sub: 'Consulta completada' },
            { label: 'Precio justo LBMA', sub: 'Garantizado al productor' },
            { label: 'CRAFT / Fairmined', sub: 'Estándares aplicados' },
            { label: 'SLAS-2', sub: 'Categorización ambiental' },
          ].map(({ label, sub }) => (
            <div key={label} className="text-center">
              <div className="text-earth-200 font-bold text-lg font-sans">{label}</div>
              <div className="text-white/70 text-xs mt-0.5 font-sans">{sub}</div>
            </div>
          ))}
        </div>

        {/* Live price widgets */}
        <div className="mt-12 w-full max-w-2xl mx-auto">
          <PriceWidgets />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 text-xs font-sans">
        <span>Conoce el programa</span>
        <div className="w-px h-8 bg-white/30" />
      </div>
    </section>
  );
}
