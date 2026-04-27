import Image from 'next/image';

const pillars = [
  {
    title: 'Rigor legal',
    desc: 'Cada expediente sigue el Manual Operativo MAPE.LEGAL — 54 pasos verificados ante INHGEOMIN, SERNA y el marco normativo vigente.',
  },
  {
    title: 'Independencia técnica',
    desc: 'Abogados y técnicos ambientales asignados a cada productor. Sin conflictos de interés con intermediarios, compradores ni refinadores.',
  },
  {
    title: 'Estándares internacionales',
    desc: 'CRAFT Code, Fairmined, RJC y EUDR 2027. Los productores que formalizan hoy acceden al mercado premium de mañana.',
  },
  {
    title: 'Cobertura nacional',
    desc: 'Operamos en el corredor aurífero hondureño — acompañando operaciones artesanales en todo el territorio nacional con la misma rigurosidad.',
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
            <p className="text-primary-500 text-lg leading-relaxed mb-4 font-sans">
              Somos la empresa operadora de MAPE.LEGAL — la plataforma de evidencia legal de origen mineral
              para la minería artesanal y pequeña minería en Honduras.
            </p>
            <p className="text-primary-500 leading-relaxed mb-4 font-sans">
              Nuestra misión es transformar operaciones informales en negocios mineros formalizados,
              trazables y certificados para el mercado ético internacional,
              con acompañamiento legal continuo y tecnología de trazabilidad de clase mundial.
            </p>
            <p className="text-primary-500 leading-relaxed mb-6 font-sans">
              Nuestra visión es convertirnos en el estándar de referencia para la formalización del oro
              artesanal en Honduras y el corredor aurífero de América Central.
            </p>

            {/* Legal services image */}
            <div className="rounded-xl overflow-hidden mb-6 border border-earth-200">
              <Image
                src="/images/Servicios Legales.png"
                alt="Servicios legales especializados MAPE"
                width={1920}
                height={1080}
                className="w-full h-auto"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {['ILO 169', 'SLAS-2', 'CRAFT', 'Fairmined', 'RJC', 'EUDR 2027'].map(cert => (
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

        {/* Standards strip */}
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
            ].map(item => <span key={item}>{item}</span>)}
          </div>
        </div>

      </div>
    </section>
  );
}
