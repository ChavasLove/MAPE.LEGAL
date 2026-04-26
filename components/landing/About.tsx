const pillars = [
  {
    title: 'Rigor legal',
    desc: 'Cada expediente sigue el Manual Operativo MAPE.LEGAL — 54 pasos verificados ante INHGEOMIN, SERNA e ILO 169.',
  },
  {
    title: 'Independencia técnica',
    desc: 'Abogados y PSAs asignados a cada productor. Sin conflictos de interés con intermediarios o compradores.',
  },
  {
    title: 'Estándares internacionales',
    desc: 'CRAFT Code, Fairmined, RJC y EUDR 2027. Los productores que formalizan hoy acceden al mercado premium de mañana.',
  },
  {
    title: 'Impacto territorial',
    desc: 'El programa está diseñado para comunidades —no corporaciones— en zonas de alta biodiversidad como la cuenca de Iriona.',
  },
];

export function About() {
  return (
    <section className="py-24 bg-earth-50" id="nosotros">
      <div className="max-w-6xl mx-auto px-6">

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <p className="text-forest-800 text-sm font-bold tracking-widest uppercase mb-3 font-sans">Quiénes somos</p>
            <h2 className="text-4xl text-primary-900 mb-6">
              Corporación Hondureña Tenka
            </h2>
            <p className="text-primary-500 text-lg leading-relaxed mb-6 font-sans">
              Somos la empresa operadora de MAPE.LEGAL — la plataforma de evidencia legal de origen mineral
              para la minería artesanal y pequeña minería (MAPE) en Honduras.
            </p>
            <p className="text-primary-500 leading-relaxed mb-6 font-sans">
              Nuestro modelo combina tecnología de trazabilidad, asesoría legal especializada y acceso
              directo a mercados de oro ético. Operamos bajo los más altos estándares de transparencia,
              con auditorías independientes y cadena de custodia verificable desde el campo.
            </p>

            {/* Legal services image */}
            <div className="rounded-xl overflow-hidden mb-6 border border-earth-200">
              <img
                src="/images/Servicios%20Legales.png"
                alt="Servicios legales especializados"
                className="w-full object-cover"
                style={{ maxHeight: '200px', objectPosition: 'center top' }}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {['ILO 169', 'SLAS-2', 'CRAFT', 'Fairmined', 'RJC'].map(cert => (
                <span key={cert} className="text-xs font-bold uppercase tracking-wider font-sans text-forest-800 bg-earth-50 border border-earth-200 px-3 py-1.5 rounded-full">
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Right — pillars */}
          <div className="grid sm:grid-cols-2 gap-5">
            {pillars.map(({ title, desc }) => (
              <div key={title} className="p-6 bg-primary-50 rounded-xl border border-[#E5E7EB]">
                <div className="w-2 h-2 rounded-full bg-forest-800 mb-3" />
                <h3 className="font-bold text-primary-900 mb-2 font-sans">{title}</h3>
                <p className="text-primary-500 text-sm leading-relaxed font-sans">{desc}</p>
              </div>
            ))}
          </div>

        </div>

        {/* Partners strip */}
        <div className="mt-20 pt-12 border-t border-[#E5E7EB]">
          <p className="text-center text-primary-300 text-xs uppercase tracking-widest font-semibold mb-8 font-sans">
            Marco normativo y estándares aplicados
          </p>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-primary-500 text-sm font-medium font-sans">
            {[
              'Ley de Minería Honduras',
              'Reglamento MAPE',
              'ILO 169',
              'SLAS-2',
              'CRAFT Code',
              'Fairmined',
              'RJC',
              'EUDR 2027',
            ].map(item => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
