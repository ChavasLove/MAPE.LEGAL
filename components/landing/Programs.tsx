const programs = [
  {
    number: '01',
    title: 'Apertura de expediente',
    timeframe: '4–6 semanas',
    desc: 'Asignación de abogado y PSA, geolocalización UTM, apertura ante INHGEOMIN y consulta ILO 169 documentada.',
    features: ['Expediente digital auditado', 'Coordenadas UTM registradas', 'Consulta ILO 169', 'Abogado asignado'],
  },
  {
    number: '02',
    title: 'Certificación de origen',
    timeframe: '8–12 semanas',
    desc: 'Cadena de custodia CRAFT, análisis SLAS-2 ambiental, informe geológico y habilitación para mercados éticos internacionales.',
    features: ['Análisis SLAS-2', 'Cadena de custodia', 'Informe geológico', 'Acceso CRAFT / Fairmined'],
    highlight: true,
  },
  {
    number: '03',
    title: 'Acceso a mercado premium',
    timeframe: 'Precio justo LBMA',
    desc: 'Conexión directa con refinadores certificados y compradores europeos. Precio garantizado sobre LBMA vs 60–75 % de intermediarios.',
    features: ['Precio LBMA garantizado', 'Refinadores certificados', 'Trazabilidad blockchain', 'Auditoría anual RJC'],
  },
];

export function Programs() {
  return (
    <section className="py-24 bg-earth-50" id="programas">
      <div className="max-w-6xl mx-auto px-6">

        <div className="max-w-2xl mb-16">
          <p className="text-forest-800 text-sm font-bold tracking-widest uppercase mb-3 font-sans">Nuestros Programas</p>
          <h2 className="text-4xl text-primary-900 mb-5">
            Tres fases hacia la formalización completa
          </h2>
          <p className="text-primary-500 text-lg leading-relaxed font-sans">
            Cada fase entrega valor inmediato. Los productores pueden ingresar en Fase 1 y avanzar a su ritmo
            hacia la certificación internacional y el precio premium.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {programs.map(({ number, title, timeframe, desc, features, highlight }) => (
            <div
              key={number}
              className={`relative rounded-xl p-8 flex flex-col ${
                highlight
                  ? 'bg-forest-800 text-white shadow-sm'
                  : 'bg-white border border-[#E5E7EB]'
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 left-8 bg-action-gold text-white text-xs font-bold font-sans uppercase tracking-wider px-3 py-1 rounded-full">
                  Más solicitado
                </span>
              )}
              <div className={`text-5xl font-bold mb-4 font-sans ${highlight ? 'text-earth-200' : 'text-primary-300'}`}>
                {number}
              </div>
              <h3 className={`font-bold text-xl mb-2 font-sans ${highlight ? 'text-white' : 'text-primary-900'}`}>{title}</h3>
              <div className={`text-sm font-semibold mb-4 font-sans flex items-center gap-1.5 ${highlight ? 'text-action-gold' : 'text-forest-800'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {timeframe}
              </div>
              <p className={`text-sm leading-relaxed mb-6 flex-1 font-sans ${highlight ? 'text-earth-200/80' : 'text-primary-500'}`}>
                {desc}
              </p>
              <ul className="space-y-2">
                {features.map(f => (
                  <li key={f} className={`flex items-center gap-2 text-sm font-sans ${highlight ? 'text-earth-200' : 'text-primary-500'}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={highlight ? 'text-earth-200' : 'text-forest-800'}>
                      <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Time guarantee strip */}
        <div className="mt-10 bg-primary-950 rounded-xl p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 text-center md:text-left">
            <p className="text-white font-bold text-lg font-sans">Garantizamos el menor tiempo posible de gestión</p>
            <p className="text-primary-300 text-sm mt-1 font-sans">
              Acompañamiento legal continuo en cada fase — desde la apertura del expediente hasta la obtención del permiso.
            </p>
          </div>
          <a
            href="#contacto"
            className="shrink-0 inline-flex items-center gap-2 bg-forest-800 hover:bg-primary-900 text-white font-semibold font-sans px-7 py-3 rounded-lg shadow-sm transition-colors text-sm"
          >
            Solicitar cotización privada →
          </a>
        </div>

      </div>
    </section>
  );
}
