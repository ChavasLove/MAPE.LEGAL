const articles = [
  {
    tag: 'Piloto activo',
    date: '12 abr 2026',
    title: 'Iriona inicia su primera ronda de formalización bajo ILO 169',
    excerpt:
      'Veintidós productores de la cuenca completaron la consulta indígena y recibieron sus coordenadas UTM. El expediente colectivo ingresa a Fase 1 INHGEOMIN esta semana.',
  },
  {
    tag: 'Certificación',
    date: '8 abr 2026',
    title: 'CRAFT Code of Risk Mitigation: qué exige el estándar y cómo lo cumplimos',
    excerpt:
      'El protocolo CRAFT requiere trazabilidad documental en tres capas. MAPE.LEGAL automatiza las dos primeras — registro de origen y cadena de custodia — desde el campo.',
  },
  {
    tag: 'Mercado',
    date: '2 abr 2026',
    title: 'Compradores europeos demandan prueba de origen: la ventana para el oro artesanal hondureño',
    excerpt:
      'Regulaciones UE de debida diligencia en minerales (EUDR) entran en vigor en 2027. Los productores que certifiquen ahora tendrán acceso preferencial al mercado premium.',
  },
];

export function News() {
  return (
    <section className="py-24 bg-primary-50" id="noticias">
      <div className="max-w-6xl mx-auto px-6">

        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-forest-800 text-sm font-bold tracking-widest uppercase mb-2 font-sans">Actualidad</p>
            <h2 className="text-4xl text-primary-900">Últimas novedades</h2>
          </div>
          <a
            href="#contacto"
            className="hidden md:inline-flex items-center gap-2 text-forest-800 font-semibold text-sm font-sans hover:text-primary-900 transition-colors"
          >
            Ver todo →
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {articles.map(({ tag, date, title, excerpt }) => (
            <article
              key={title}
              className="group flex flex-col border border-[#E5E7EB] rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
            >
              {/* Color bar */}
              <div className="h-1.5 bg-forest-800" />
              <div className="p-7 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest font-sans text-forest-800 bg-earth-50 px-3 py-1 rounded-full">
                    {tag}
                  </span>
                  <span className="text-xs text-primary-300 font-sans">{date}</span>
                </div>
                <h3 className="font-bold text-primary-900 text-lg leading-snug mb-3 font-sans group-hover:text-forest-800 transition-colors">
                  {title}
                </h3>
                <p className="text-primary-500 text-sm leading-relaxed flex-1 font-sans">{excerpt}</p>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
