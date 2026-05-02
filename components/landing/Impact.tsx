import Image from 'next/image';

const stats = [
  { value: '60+', label: 'Productores identificados', sub: 'Cuenca de Iriona, Colón' },
  { value: '80–85%', label: 'Precio LBMA garantizado', sub: 'vs 60–75% con intermediarios' },
  { value: '100%', label: 'Trazabilidad documental', sub: 'Origen verificable en campo' },
  { value: '54', label: 'Pasos técnicos navegados', sub: 'INHGEOMIN + SERNA + ILO 169' },
];

export function Impact() {
  return (
    <section className="py-24 bg-forest-800" id="impacto">
      <div className="max-w-6xl mx-auto px-6">

        <div className="max-w-2xl mb-16">
          <p className="text-earth-200 text-sm font-bold tracking-widest uppercase mb-3 font-sans">Impacto</p>
          <h2 className="text-4xl text-white mb-5">
            Resultados medibles desde el primer expediente
          </h2>
          <p className="text-earth-200/80 text-lg leading-relaxed font-sans">
            La formalización no es un trámite burocrático — es acceso directo a mejores precios,
            mercados éticos y protección legal permanente.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map(({ value, label, sub }) => (
            <div key={label} className="bg-primary-950/50 border border-primary-300/30 rounded-xl p-7">
              <div className="text-4xl font-bold text-action-gold mb-2 font-sans">{value}</div>
              <div className="text-white font-semibold mb-1 font-sans">{label}</div>
              <div className="text-earth-200/70 text-sm font-sans">{sub}</div>
            </div>
          ))}
        </div>

        {/* Field work callout */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch">
          <div className="md:w-64 shrink-0 overflow-hidden relative" style={{ minHeight: '200px' }}>
            <Image
              src="/images/Technitians Field Work.png"
              alt="Trabajo de campo — técnicos MAPE"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6 p-8 flex-1">
            <div className="flex-1 text-center md:text-left">
              <p className="text-white text-xl font-semibold leading-relaxed mb-3 font-sans">
                &ldquo;La minería artesanal responsable es viable cuando hay estructura legal y trazabilidad.
                MAPE.LEGAL convierte esa visión en expedientes concretos.&rdquo;
              </p>
              <p className="text-earth-200/70 text-sm font-sans">
                Corporación Hondureña Tenka — Piloto Iriona 2026
              </p>
            </div>
            <div className="shrink-0">
              <a
                href="#contacto"
                className="inline-flex items-center gap-2 bg-action-gold hover:bg-earth-600 text-white font-bold font-sans px-7 py-3.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Iniciar trámite ahora
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
