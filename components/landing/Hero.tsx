'use client';

export function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Forest image — falls back to gradient if absent */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/forest-regenerated.jpg')",
          filter: 'brightness(0.78) contrast(1.05) saturate(1.1)',
        }}
      />
      {/* Fallback gradient (shown when image is absent) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-green-900 via-green-800 to-emerald-900" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />

      {/* Top nav bar */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C5 2 2 5 2 8c0 4 6 8 6 8s6-4 6-8c0-3-2.7-6-6-6z" fill="white"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">MAPE.LEGAL</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-white/80 text-sm font-medium">
          <a href="#problema" className="hover:text-white transition-colors">El Problema</a>
          <a href="#solucion" className="hover:text-white transition-colors">La Solución</a>
          <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
          <a href="#roadmap" className="hover:text-white transition-colors">Avance</a>
        </div>
        <button
          onClick={() => scrollTo('contacto')}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Empezar trámite ahora
        </button>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-sm font-medium mb-8 border border-white/25">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Piloto Iriona 2026 · Colón, Honduras · 60 productores
        </div>

        <h1 className="text-5xl md:text-[4.5rem] font-bold leading-tight text-white mb-6 tracking-tight">
          Formalización minera con<br />
          <span className="text-green-400">evidencia legal certificada</span>
        </h1>

        <p className="text-xl text-white/85 max-w-2xl mx-auto mb-10 leading-relaxed">
          MAPE.LEGAL es la plataforma que convierte operaciones artesanales en oro
          traceable, certificado y premium —&nbsp;conforme a ILO&nbsp;169, SLAS-2
          y estándares internacionales CRAFT&nbsp;/&nbsp;Fairmined.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => scrollTo('contacto')}
            className="bg-green-600 hover:bg-green-700 text-white text-lg font-bold px-10 py-4 rounded-xl shadow-2xl transition-colors cursor-pointer"
          >
            Empezar trámite ahora
          </button>
          <a
            href="/dashboard.html"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/40 hover:bg-white/10 text-white text-lg font-medium px-8 py-4 rounded-xl transition-colors"
          >
            Ver el Dashboard →
          </a>
        </div>

        {/* Certifications strip */}
        <div className="mt-14 flex flex-wrap justify-center gap-8">
          {[
            { label: 'ILO 169', sub: 'Consulta completada' },
            { label: '80–85 % LBMA', sub: 'Precio garantizado' },
            { label: 'CRAFT / Fairmined', sub: 'Estándares aplicados' },
            { label: 'SLAS-2', sub: 'Categorización ambiental' },
          ].map(({ label, sub }) => (
            <div key={label} className="text-center">
              <div className="text-green-400 font-bold text-lg">{label}</div>
              <div className="text-white/60 text-xs mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 text-xs">
        <span>Conoce el programa</span>
        <div className="w-px h-8 bg-white/30" />
      </div>
    </section>
  );
}
