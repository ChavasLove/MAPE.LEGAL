const comparisons = [
  {
    sin: 'Operación sin respaldo legal — exposición permanente a cierres y decomisos',
    con: 'Expediente digital auditado, licencias en regla y protección legal continua',
  },
  {
    sin: 'Proceso burocrático de 54 pasos sin orientación especializada',
    con: 'Cada paso navegado por abogados y técnicos ambientales asignados',
  },
  {
    sin: 'Acceso bloqueado a mercados éticos (CRAFT, Fairmined, RJC)',
    con: 'Certificación internacional habilitada desde el primer expediente',
  },
  {
    sin: 'Precio de intermediario sin referencia ni transparencia',
    con: 'Precio sobre referencia LBMA con trazabilidad documental verificable',
  },
  {
    sin: 'Sin evidencia de origen — incumplimiento EUDR 2027',
    con: 'Certificate of Origin automático — lista para el mercado europeo',
  },
  {
    sin: 'Sin contrato entre minero y propietario del terreno',
    con: 'Sociedad minera formalizada con cláusulas de distribución y permanencia',
  },
];

const legalityComponents = [
  { num: '01', label: 'Derecho sobre la tierra',      icon: 'M3 21h18M9 21V9l3-7 3 7v12M5 12h2M17 12h2' },
  { num: '02', label: 'Permiso INHGEOMIN',            icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { num: '03', label: 'Licencia ambiental SERNA',     icon: 'M4.5 12.75l6 6 9-13.5' },
  { num: '04', label: 'Permiso municipal',            icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M3 21h18M9 9h1.01M9 13h1.01M15 9h.01M15 13h.01' },
  { num: '05', label: 'Registro de comercializador',  icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

export function ValorSection() {
  return (
    <section className="py-24 bg-primary-950" id="valor">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-action-gold text-sm font-bold tracking-widest uppercase mb-4 font-sans">
            Nuestra propuesta de valor
          </p>
          <h2 className="text-4xl font-bold text-white mb-5">
            El Índice de Legalidad MAPE.LEGAL
          </h2>
          <p className="text-primary-300 text-lg max-w-2xl mx-auto font-sans">
            Cinco componentes verificados determinan la legalidad completa de una operación minera artesanal en Honduras.
            MAPE.LEGAL gestiona cada uno.
          </p>
        </div>

        {/* Legality index — 5 components */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-20">
          {legalityComponents.map(({ num, label, icon }) => (
            <div
              key={num}
              className="flex flex-col items-center text-center p-5 rounded-xl border"
              style={{ background: '#162033', borderColor: 'rgba(94,107,122,0.3)' }}
            >
              <div className="w-10 h-10 rounded-full bg-action-green/15 flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3E7C59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
              </div>
              <div className="text-action-gold text-xs font-bold font-sans mb-1">{num}</div>
              <div className="text-white text-xs font-semibold font-sans leading-snug">{label}</div>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(94,107,122,0.3)' }}>
          {/* Table header */}
          <div className="grid grid-cols-2">
            <div className="px-6 py-4 text-center" style={{ background: '#F8E5E4' }}>
              <span className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: '#A94442' }}>
                Sin MAPE.LEGAL
              </span>
            </div>
            <div className="px-6 py-4 text-center" style={{ background: '#E6F2EC' }}>
              <span className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: '#2F5D50' }}>
                Con MAPE.LEGAL
              </span>
            </div>
          </div>

          {comparisons.map(({ sin, con }, i) => (
            <div
              key={i}
              className="grid grid-cols-2"
              style={{ borderTop: '1px solid rgba(94,107,122,0.2)' }}
            >
              {/* Sin CHT */}
              <div
                className="px-6 py-5 flex items-start gap-3"
                style={{ background: i % 2 === 0 ? '#1A1018' : '#1F1520' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A94442" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <p className="text-sm font-sans leading-relaxed" style={{ color: '#A3AAB3' }}>{sin}</p>
              </div>
              {/* Con CHT */}
              <div
                className="px-6 py-5 flex items-start gap-3"
                style={{ background: i % 2 === 0 ? '#162033' : '#1A2840' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3E7C59" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <p className="text-sm font-sans leading-relaxed" style={{ color: '#D8C3A5' }}>{con}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="#contacto"
            className="inline-flex items-center gap-2 text-white font-bold font-sans px-10 py-4 rounded-lg shadow-sm transition-colors text-lg"
            style={{ background: '#2F5D50' }}
          >
            Solicitar evaluación de mi operación →
          </a>
        </div>

      </div>
    </section>
  );
}
