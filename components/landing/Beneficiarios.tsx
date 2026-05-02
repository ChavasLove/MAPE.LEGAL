import Image from 'next/image';

const groups = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title:  'Productores artesanales',
    desc:   'Para el minero que quiere operar con respaldo legal, precio justo y acceso a mercados internacionales.',
    benefits: [
      'Licencia minera INHGEOMIN en regla',
      'Licencia ambiental SERNA (SLAS-2)',
      'Permiso municipal de operación',
      'Acceso a mercados CRAFT y Fairmined',
      'Precio sobre referencia LBMA',
      'Protección legal permanente',
    ],
    color:     '#3A6EA5',
    badgeBg:   '#DBEAFE',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M9 21V9l3-7 3 7v12M5 12h2M17 12h2"/>
      </svg>
    ),
    title:  'Propietarios de tierra',
    desc:   'Para el dueño del terreno que quiere formalizar su propiedad y participar del valor generado por la operación minera.',
    benefits: [
      'Titulación formal del predio ante el IP',
      'Registro en catastro municipal',
      'Contrato de sociedad minera redactado',
      'Distribución justa de beneficios',
      'Régimen de permanencia protegido',
      'Valorización del activo territorial',
    ],
    color:     '#3E7C59',
    badgeBg:   '#E6F2EC',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    title:  'Compradores premium y refinadores',
    desc:   'Para refinadores y compradores internacionales que necesitan due diligence robusto y cumplimiento EUDR 2027.',
    benefits: [
      'Certificate of Origin verificable',
      'Due diligence simplificado y auditado',
      'Cumplimiento EUDR 2027 desde el origen',
      'Cadena de custodia CRAFT documentada',
      'Trazabilidad georreferenciada',
      'Informes de auditoría disponibles',
    ],
    color:     '#C49A4A',
    badgeBg:   '#F5EBDD',
  },
];

export function Beneficiarios() {
  return (
    <section className="py-24 bg-primary-50" id="beneficios">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-forest-800 text-sm font-bold tracking-widest uppercase mb-3 font-sans">
            Para quién trabajamos
          </p>
          <h2 className="text-4xl text-primary-900 mb-5">
            Beneficios para cada actor de la cadena
          </h2>
          <p className="text-primary-500 text-lg leading-relaxed font-sans">
            MAPE.LEGAL alinea los intereses de productores, propietarios y compradores
            bajo un mismo marco legal verificable — desde Honduras al mundo.
          </p>
        </div>

        {/* Beneficiary cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {groups.map(({ icon, title, desc, benefits, color, badgeBg }) => (
            <div
              key={title}
              className="bg-white rounded-xl border p-7 flex flex-col"
              style={{ borderColor: '#E5E7EB' }}
            >
              {/* Icon badge */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 shrink-0"
                style={{ background: badgeBg, color }}
              >
                {icon}
              </div>

              <h3 className="text-xl font-bold text-primary-900 mb-2 font-sans">{title}</h3>
              <p className="text-primary-500 text-sm leading-relaxed mb-6 font-sans flex-shrink-0">{desc}</p>

              <ul className="space-y-2.5 border-t border-[#E5E7EB] pt-5 flex-1">
                {benefits.map(b => (
                  <li key={b} className="flex items-start gap-2.5 text-sm font-sans text-primary-500">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0" style={{ color }}>
                      <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Environmental image strip */}
        <div className="rounded-xl overflow-hidden bg-earth-50 border border-earth-200 flex flex-col md:flex-row items-stretch">
          <div className="md:w-64 shrink-0">
            <Image
              src="/images/Estudio de Impacto Ambiental.png"
              alt="Estudio de impacto ambiental — minería responsable Honduras"
              width={1920}
              height={1280}
              className="w-full h-auto md:h-full md:object-cover"
              sizes="(max-width: 768px) 100vw, 256px"
            />
          </div>
          <div className="flex flex-col justify-center p-8 flex-1">
            <p className="text-forest-800 text-sm font-bold tracking-widest uppercase mb-3 font-sans">Compromiso ambiental</p>
            <h3 className="text-2xl text-primary-900 mb-3">
              Minería responsable desde el primer permiso
            </h3>
            <p className="text-primary-500 leading-relaxed font-sans">
              Cada expediente incluye la categorización ambiental SLAS-2 y la consulta ILO 169 —
              garantizando que la operación cumple con los estándares ambientales y de derechos
              de comunidades en todo el territorio nacional.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
