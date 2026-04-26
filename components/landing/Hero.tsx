'use client';

import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Video background — if file is absent the browser simply shows nothing */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        src="/videos/panoramic-jungle.mp4"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900/95" />

      {/* Fallback solid background when video is absent */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-700 via-slate-900 to-slate-950" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

        {/* Pilot badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-sm mb-8 border border-white/20 text-white">
          <span className="text-accent-400 text-xs">●</span>
          PILOTO IRIONA 2026 — 60 MINEROS · COLÓN, HONDURAS
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6 text-white">
          De la minería informal<br />
          <span className="text-accent-400">al oro traceable y premium</span>
        </h1>

        <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-10">
          MAPE.LEGAL convierte minería artesanal en evidencia legal defendible —
          certificada bajo ILO&nbsp;169, SLAS-2 y estándares internacionales —
          para Chiopa Industrias y mercados éticos globales.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="bg-accent-400 hover:bg-accent-500 text-black font-bold text-lg px-10 py-4 rounded-2xl"
            onClick={() => {
              const el = document.getElementById('servicios');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Iniciar Formalización — Hito 1 (L 320.000)
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-4 rounded-2xl"
            onClick={() => window.open('https://wa.me/50498765432', '_blank')}
          >
            Hablar con Willis por WhatsApp
          </Button>
        </div>

        {/* KPIs */}
        <div className="mt-16 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-accent-400 text-4xl font-bold">ILO 169</div>
            <div className="text-slate-400 text-sm mt-1">Consulta completada</div>
          </div>
          <div>
            <div className="text-accent-400 text-4xl font-bold">80-85%</div>
            <div className="text-slate-400 text-sm mt-1">LBMA garantizado</div>
          </div>
          <div>
            <div className="text-accent-400 text-4xl font-bold">Chiopa</div>
            <div className="text-slate-400 text-sm mt-1">Refinería aliada</div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-slate-400 text-sm flex flex-col items-center gap-2">
        <span>Desplaza para conocer el piloto</span>
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-400 to-transparent" />
      </div>
    </section>
  );
}
