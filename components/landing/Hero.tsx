'use client';

import Image from 'next/image';

export function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Territory image */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/images/RIVER AND MOUNTAINS.png"
          alt=""
          fill
          priority
          className="object-cover"
          style={{ filter: 'brightness(0.80) contrast(1.05) saturate(0.82)' }}
          sizes="100vw"
        />
      </div>
      {/* Fallback gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950" />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 md:px-8 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/images/LOGO CHT.png"
            alt="Corporación Hondureña Tenka"
            width={160}
            height={64}
            className="h-10 w-auto"
            priority
          />
          <span className="text-white font-bold text-lg tracking-tight font-sans">MAPE.LEGAL</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-white/80 text-sm font-medium font-sans">
          <a href="#nosotros"  className="hover:text-white transition-colors">Quiénes somos</a>
          <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
          <a href="#beneficios" className="hover:text-white transition-colors">Beneficios</a>
        </div>
        <button
          onClick={() => scrollTo('contacto')}
          className="bg-primary-950 hover:bg-primary-900 text-white text-sm font-semibold font-sans px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Iniciar trámite
        </button>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-sm font-medium font-sans mb-8 border border-white/25">
          <span className="w-2 h-2 rounded-full bg-action-green" />
          Formalización minera · Honduras · Corredor aurífero nacional
        </div>

        <h1 className="text-5xl md:text-[4.5rem] font-bold leading-tight text-white mb-6 tracking-tight">
          Transformamos la minería<br />artesanal en oro
          <span className="text-earth-200"> trazable,<br />certificado y premium</span>
        </h1>

        <p className="text-xl text-white/85 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          MAPE.LEGAL acompaña a productores artesanales de Honduras desde el primer trámite
          ante INHGEOMIN hasta los mercados éticos internacionales —
          con respaldo legal continuo en cada fase.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => scrollTo('contacto')}
            className="bg-primary-950 hover:bg-primary-900 text-white text-lg font-bold font-sans px-10 py-4 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Iniciar tu formalización
          </button>
          <a
            href="#nosotros"
            className="border border-white/40 hover:bg-white/10 text-white text-lg font-medium font-sans px-8 py-4 rounded-lg transition-colors"
          >
            Conocer MAPE.LEGAL →
          </a>
        </div>

        {/* Certifications strip */}
        <div className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-4">
          {[
            { label: 'ILO 169',          sub: 'Consulta previa' },
            { label: 'CRAFT / Fairmined', sub: 'Estándares aplicados' },
            { label: 'SLAS-2',           sub: 'Categorización ambiental' },
            { label: 'EUDR 2027',        sub: 'Cumplimiento europeo' },
          ].map(({ label, sub }) => (
            <div key={label} className="text-center">
              <div className="text-earth-200 font-bold text-lg font-sans">{label}</div>
              <div className="text-white/70 text-xs mt-0.5 font-sans">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 text-xs font-sans">
        <span>Descubre el programa</span>
        <div className="w-px h-8 bg-white/30" />
      </div>
    </section>
  );
}
