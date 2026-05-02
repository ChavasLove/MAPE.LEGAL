import Image from 'next/image';

const problems = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
    ),
    title: 'Precios injustos sin certificación',
    desc: 'Los intermediarios pagan 60–75 % LBMA sin ningún respaldo documental. La falta de trazabilidad elimina el acceso al mercado premium.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    title: 'Burocracia sin guía especializada',
    desc: 'Los trámites ante INHGEOMIN y SERNA requieren 54 pasos técnicos. Sin acompañamiento legal, los productores pierden años — y sus permisos.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    title: 'Riesgo legal permanente',
    desc: 'Sin licencia, cualquier operación está expuesta a decomisos, multas y cierre. La informalidad no es una opción sostenible.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
    ),
    title: 'Mercados éticos bloqueados',
    desc: 'CRAFT, Fairmined y RJC exigen trazabilidad documentada. Sin evidencia de origen, el oro artesanal queda excluido del mercado responsable global.',
  },
];

export function Problem() {
  return (
    <section className="py-24 bg-primary-50" id="problema">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-forest-800 text-sm font-bold tracking-widest uppercase mb-3 font-sans">
            El desafío
          </p>
          <h2 className="text-4xl text-primary-900 mb-5">
            La minería artesanal en Honduras enfrenta cuatro barreras sistémicas
          </h2>
          <p className="text-primary-500 text-lg leading-relaxed font-sans">
            Más de 60 productores en la cuenca de Iriona operan sin acceso a formalización,
            certificación ni mercados premium. MAPE.LEGAL cierra esa brecha.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {problems.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-5 p-7 bg-white border border-[#E5E7EB] rounded-xl hover:border-forest-800/30 hover:shadow-sm transition-all"
            >
              <div className="shrink-0 w-11 h-11 bg-badge-danger-bg text-action-red rounded-xl flex items-center justify-center">
                {icon}
              </div>
              <div>
                <h3 className="font-semibold text-primary-900 mb-2 font-sans">{title}</h3>
                <p className="text-primary-500 text-sm leading-relaxed font-sans">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Map callout */}
        <div className="mt-10 bg-earth-50 border border-earth-200 rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch">
          {/* Full topographic map — no height constraint */}
          <div className="md:w-56 shrink-0 overflow-hidden">
            <Image
              src="/images/Tophographic map.png"
              alt="Mapa topográfico zona piloto Iriona"
              width={1080}
              height={1440}
              className="w-full h-auto md:h-full md:object-cover"
              sizes="(max-width: 768px) 100vw, 224px"
            />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6 p-8 flex-1">
            <div className="flex-1">
              <p className="font-semibold text-primary-900 text-lg font-sans">Iriona, Colón — Zona de piloto activo</p>
              <p className="text-forest-800 text-sm mt-1 font-sans">
                60 productores identificados · Consulta ILO 169 completada ·
                Coordenadas UTM registradas · Primer expediente en Fase 1 INHGEOMIN
              </p>
            </div>
            <div className="shrink-0">
              <a
                href="/dashboard.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-forest-800 hover:bg-primary-950 text-white text-sm font-semibold font-sans px-5 py-3 rounded-lg transition-colors"
              >
                Ver expedientes activos →
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
