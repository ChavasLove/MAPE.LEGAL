import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const services = [
  {
    tag:   'Paquete principal',
    title: 'Formalización Minera Integral',
    desc:  'Gestión completa del proceso de formalización ante las autoridades nacionales — desde la apertura del expediente hasta la obtención del permiso definitivo.',
    features: [
      'Permiso de exploración o explotación INHGEOMIN',
      'Licencia ambiental SERNA (categoría SLAS-2)',
      'Permiso municipal de operación',
      'Registro como comercializador autorizado',
      'Consulta ILO 169 documentada',
      'Abogado y técnico ambiental asignados',
    ],
    highlight: true,
  },
  {
    tag:   'Servicio complementario',
    title: 'Titulación de Propiedad',
    desc:  'Regularización legal del derecho sobre la tierra donde opera el minero, requisito previo para la formalización minera.',
    features: [
      'Estudio de título y situación registral',
      'Gestión ante el Instituto de la Propiedad',
      'Escrituración y registro en RNP',
      'Coordinación con catastro municipal',
    ],
    highlight: false,
  },
  {
    tag:   'Servicio complementario',
    title: 'Contrato de Sociedad Minera',
    desc:  'Estructura legal entre el minero y el propietario del terreno, con reglas claras de distribución de beneficios y condiciones de permanencia.',
    features: [
      'Redacción del contrato de sociedad',
      'Cláusulas de distribución de beneficios',
      'Régimen de permanencia y resolución',
      'Inscripción ante notario público',
    ],
    highlight: false,
  },
];

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
    <path d="M3 8l3.5 3.5L13 4" stroke="#C49A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function Services() {
  return (
    <section className="py-24 bg-primary-900" id="servicios">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-action-gold text-sm font-bold tracking-widest uppercase mb-4 font-sans">
            Nuestros servicios
          </p>
          <h2 className="text-4xl font-bold text-white mb-4">
            Acompañamiento legal en cada fase
          </h2>
          <p className="text-primary-300 text-lg max-w-2xl mx-auto font-sans">
            Cada operación es distinta. Las cotizaciones se elaboran de forma privada
            según el perfil del expediente y el tipo de solicitud.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {services.map(({ tag, title, desc, features, highlight }) => (
            <Card
              key={title}
              className={highlight
                ? 'border-action-gold/40 bg-primary-950'
                : 'border-primary-500/30 bg-primary-950'}
            >
              <CardHeader className="pb-2">
                <div className="text-action-gold text-xs font-bold tracking-widest uppercase mb-3 font-sans">{tag}</div>
                <CardTitle className="text-xl text-white leading-snug">{title}</CardTitle>
                <p className="text-primary-300 text-sm mt-2 font-sans leading-relaxed">{desc}</p>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-2.5 border-t border-primary-500/20 pt-5">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-primary-300 font-sans">
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Field work image + guarantee strip */}
        <div className="rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch border border-primary-500/30">
          <div className="md:w-72 shrink-0">
            <Image
              src="/images/Technitians Field Work.png"
              alt="Trabajo de campo — técnicos MAPE"
              width={1080}
              height={1440}
              className="w-full h-auto md:h-full md:object-cover"
              sizes="(max-width: 768px) 100vw, 288px"
            />
          </div>
          <div className="flex flex-col justify-center gap-5 p-5 sm:p-8 flex-1 bg-primary-950">
            <div>
              <p className="text-white font-bold text-xl font-sans mb-2">
                Garantizamos el menor tiempo posible de gestión
              </p>
              <p className="text-primary-300 text-sm leading-relaxed font-sans">
                Acompañamiento legal continuo en cada fase — desde la apertura del expediente
                hasta la obtención del permiso definitivo en todo el territorio hondureño.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="#contacto"
                className="inline-flex items-center justify-center gap-2 text-white font-bold font-sans px-7 py-3 rounded-lg transition-colors text-sm"
                style={{ background: '#2F5D50' }}
              >
                Solicitar cotización privada
              </a>
              <a
                href="#valor"
                className="inline-flex items-center justify-center gap-2 font-semibold font-sans px-7 py-3 rounded-lg border transition-colors text-sm"
                style={{ borderColor: 'rgba(94,107,122,0.4)', color: '#A3AAB3' }}
              >
                Ver comparación sin / con CHT →
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
