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
    <section className="py-24 bg-slate-50" id="programas">
      <div className="max-w-6xl mx-auto px-6">

        <div className="max-w-2xl mb-16">
          <p className="text-green-700 text-sm font-bold tracking-widest uppercase mb-3">Nuestros Programas</p>
          <h2 className="text-4xl text-slate-900 mb-5">
            Tres fases hacia la formalización completa
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Cada fase entrega valor inmediato. Los productores pueden ingresar en Fase 1 y avanzar a su ritmo
            hacia la certificación internacional y el precio premium.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {programs.map(({ number, title, price, desc, features, highlight }) => (
            <div
              key={number}
              className={`relative rounded-2xl p-8 flex flex-col ${
                highlight
                  ? 'bg-green-800 text-white shadow-xl'
                  : 'bg-white border border-slate-200'
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 left-8 bg-amber-400 text-amber-900 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Más solicitado
                </span>
              )}
              <div className={`text-5xl font-black mb-4 ${highlight ? 'text-green-400' : 'text-slate-200'}`}>
                {number}
              </div>
              <h3 className={`font-bold text-xl mb-2 ${highlight ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <div className={`text-2xl font-black mb-4 ${highlight ? 'text-amber-300' : 'text-green-700'}`}>
                {price}
              </div>
              <p className={`text-sm leading-relaxed mb-6 flex-1 ${highlight ? 'text-green-100' : 'text-slate-500'}`}>
                {desc}
              </p>
              <ul className="space-y-2">
                {features.map(f => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${highlight ? 'text-green-100' : 'text-slate-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={highlight ? 'text-green-300' : 'text-green-600'}>
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
            className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-bold px-10 py-4 rounded-xl shadow-lg transition-colors text-lg"
          >
            Empezar trámite ahora
          </a>
          <p className="text-slate-400 text-sm mt-4">
            Sin costo inicial de consulta · Respuesta en 48 horas
          </p>
        </div>

      </div>
    </section>
  );
}
