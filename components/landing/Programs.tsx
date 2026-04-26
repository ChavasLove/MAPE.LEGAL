const programs = [
  {
    number: '01',
    title: 'Apertura de expediente',
    price: 'L 320.000',
    desc: 'Asignación de abogado y PSA, geolocalización UTM, apertura ante INHGEOMIN y consulta ILO 169 documentada.',
    features: ['Expediente digital auditado', 'Coordenadas UTM registradas', 'Consulta ILO 169', 'Abogado asignado'],
  },
  {
    number: '02',
    title: 'Certificación de origen',
    price: 'Fase 2',
    desc: 'Cadena de custodia CRAFT, análisis SLAS-2 ambiental, informe geológico y habilitación para mercados éticos internacionales.',
    features: ['Análisis SLAS-2', 'Cadena de custodia', 'Informe geológico', 'Acceso CRAFT / Fairmined'],
    highlight: true,
  },
  {
    number: '03',
    title: 'Acceso a mercado premium',
    price: '80–85 % LBMA',
    desc: 'Conexión directa con refinadores certificados y compradores europeos. Precio garantizado sobre LBMA vs 60–75 % de intermediarios.',
    features: ['Precio 80–85% LBMA', 'Refinadores certificados', 'Trazabilidad blockchain', 'Auditoría anual RJC'],
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
          {programs.map(({ number, title, price, desc, features, highlight }) => (
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
              <div className={`text-2xl font-bold mb-4 font-sans ${highlight ? 'text-action-gold' : 'text-forest-800'}`}>
                {price}
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

        <div className="mt-12 text-center">
          <a
            href="#contacto"
            className="inline-flex items-center gap-2 bg-primary-950 hover:bg-primary-900 text-white font-bold font-sans px-10 py-4 rounded-lg shadow-sm transition-colors text-lg"
          >
            Empezar trámite ahora
          </a>
          <p className="text-primary-300 text-sm mt-4 font-sans">
            Sin costo inicial de consulta · Respuesta en 48 horas
          </p>
        </div>

      </div>
    </section>
  );
}
