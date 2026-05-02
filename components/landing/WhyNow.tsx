const reasons = [
  {
    icon: '🌍',
    title: 'Demanda global de oro responsable',
    desc: 'CRAFT, Fairmined y RJC exigen trazabilidad documentada. El mercado premium paga más por evidencia — no por volumen.',
  },
  {
    icon: '⚖️',
    title: 'Marco legal hondureño listo',
    desc: 'La Ley de Minería, el Reglamento MAPE y la consulta ILO 169 ya están completas en Iriona. El camino está habilitado.',
  },
  {
    icon: '🏭',
    title: 'Chiopa Industrias como ancla',
    desc: 'Primera refinería de oro en Honduras. Destino garantizado para el oro formalizado con precio transparente LBMA.',
  },
  {
    icon: '📈',
    title: 'Piloto de 60 mineros activos',
    desc: 'El mapa con coordenadas UTM ya está. Los mineros están listos. El primer expediente (EXP-2026-001) ya está en proceso.',
  },
];

export function WhyNow() {
  return (
    <section className="py-24 bg-primary-950">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-action-gold text-sm font-bold tracking-widest uppercase mb-4 font-sans">Por qué ahora</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            La ventana de oportunidad está abierta
          </h2>
          <p className="text-primary-300 text-xl max-w-2xl mx-auto font-sans">
            Cuatro factores convergen en 2026 para hacer de Iriona el primer corredor aurífero
            formalizado de Honduras.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {reasons.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-6 items-start bg-primary-900 border border-primary-500/30 rounded-xl p-8 hover:border-action-gold/40 transition-colors"
            >
              <span className="text-4xl shrink-0">{icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 font-sans">{title}</h3>
                <p className="text-primary-300 text-sm leading-relaxed font-sans">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Vision strip */}
        <div className="text-center bg-gradient-to-r from-primary-900 via-primary-950/80 to-primary-900 border border-primary-500/30 rounded-xl p-10">
          <p className="text-primary-300 text-sm uppercase tracking-widest mb-4 font-sans">Visión a largo plazo</p>
          <p className="text-2xl font-semibold text-white max-w-3xl mx-auto leading-relaxed font-sans">
            Convertirse en el <span className="text-action-gold">Verra / Fairmined de Honduras</span>:
            la primera plataforma que une formalización legal + trazabilidad + comercialización de oro responsable.
          </p>
          <p className="text-primary-300 mt-4 font-sans">
            Iriona → Corredor aurífero hondureño → Centroamérica
          </p>
        </div>

      </div>
    </section>
  );
}
