const stats = [
  { value: '60+', label: 'Productores identificados', sub: 'Cuenca de Iriona, Colón' },
  { value: '80–85%', label: 'Precio LBMA garantizado', sub: 'vs 60–75% con intermediarios' },
  { value: '100%', label: 'Trazabilidad documental', sub: 'Origen verificable en campo' },
  { value: '54', label: 'Pasos técnicos navegados', sub: 'INHGEOMIN + SERNA + ILO 169' },
];

export function Impact() {
  return (
    <section className="py-24 bg-green-800" id="impacto">
      <div className="max-w-6xl mx-auto px-6">

        <div className="max-w-2xl mb-16">
          <p className="text-green-300 text-sm font-bold tracking-widest uppercase mb-3">Impacto</p>
          <h2 className="text-4xl text-white mb-5">
            Resultados medibles desde el primer expediente
          </h2>
          <p className="text-green-100 text-lg leading-relaxed">
            La formalización no es un trámite burocrático — es acceso directo a mejores precios,
            mercados éticos y protección legal permanente.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map(({ value, label, sub }) => (
            <div key={label} className="bg-green-900/50 border border-green-700 rounded-2xl p-7">
              <div className="text-4xl font-black text-amber-300 mb-2">{value}</div>
              <div className="text-white font-semibold mb-1">{label}</div>
              <div className="text-green-300 text-sm">{sub}</div>
            </div>
          ))}
        </div>

        {/* Testimonial / callout */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path d="M32 6C18.7 6 8 16.7 8 30c0 17 24 34 24 34s24-17 24-34C56 16.7 45.3 6 32 6z" fill="#166534" opacity=".3" stroke="#bbf7d0" strokeWidth="2"/>
              <circle cx="32" cy="28" r="6" fill="#4ade80"/>
            </svg>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-white text-xl font-semibold leading-relaxed mb-3">
              "La minería artesanal responsable es viable cuando hay estructura legal y trazabilidad.
              MAPE.LEGAL convierte esa visión en expedientes concretos."
            </p>
            <p className="text-green-300 text-sm">
              Corporación Hondureña Tenka — Piloto Iriona 2026
            </p>
          </div>
          <div className="shrink-0">
            <a
              href="#contacto"
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-900 font-bold px-7 py-3.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Empezar trámite ahora
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
