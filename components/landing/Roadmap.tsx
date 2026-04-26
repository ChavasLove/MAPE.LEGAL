const milestones = [
  {
    phase: 'Completado',
    color: 'bg-green-500',
    items: [
      'Dominio mape.legal confirmado',
      'Arquitectura Vercel + Supabase definida',
      'Dashboard 100% funcional (en vivo)',
      'Schema ER diseñado — 3 iteraciones',
      'Manual Operativo 54 pasos completo',
      'Menú de Servicios 2026 aprobado',
      'Mapa Iriona con 60 mineros',
      'Consulta ILO 169 completada',
    ],
  },
  {
    phase: 'En progreso — Q2 2026',
    color: 'bg-accent-400',
    items: [
      'Schema Supabase en producción',
      'Primera pantalla real: registro de productor',
      'Conexión WhatsApp Business API',
      'EXP-2026-001 avanzando Fase 1 INHGEOMIN',
      'Hito 1 cobrado — L 320.000',
    ],
  },
  {
    phase: 'Próximo — Q3-Q4 2026',
    color: 'bg-slate-500',
    items: [
      'Certificate of Origin automático',
      'Módulo de transacciones de oro',
      'RLS + autenticación por roles',
      'Integración Chiopa Industrias',
      'Primeras 10 licencias emitidas',
      'Expansión a todo el corredor aurífero',
    ],
  },
];

export function Roadmap() {
  return (
    <section className="py-24 bg-slate-950" id="roadmap">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-accent-400 text-sm font-bold tracking-widest uppercase mb-4">Hoja de ruta</p>
          <h2 className="text-4xl font-bold text-white">Estado del proyecto — Abril 2026</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {milestones.map(({ phase, color, items }) => (
            <div key={phase} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className={`${color} px-6 py-4`}>
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">{phase}</h3>
              </div>
              <ul className="p-6 space-y-3">
                {items.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${color}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Dashboard live link */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 bg-slate-900 border border-accent-400/30 rounded-full px-6 py-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-slate-300 text-sm">Dashboard operativo ahora mismo —</span>
            <a
              href="/dashboard.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-400 font-semibold text-sm hover:underline"
            >
              Ver en vivo →
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
