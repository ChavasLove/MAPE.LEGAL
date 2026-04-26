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
    <section className="py-24 bg-slate-900">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-accent-400 text-sm font-bold tracking-widest uppercase mb-4">Por qué ahora</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            La ventana de oportunidad está abierta
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Cuatro factores convergen en 2026 para hacer de Iriona el primer corredor aurífero
            formalizado de Honduras.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {reasons.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-6 items-start bg-slate-950 border border-slate-700 rounded-2xl p-8 hover:border-accent-400/40 transition-colors"
            >
              <span className="text-4xl shrink-0">{icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Vision strip */}
        <div className="text-center bg-gradient-to-r from-slate-950 via-primary-700/20 to-slate-950 border border-slate-700 rounded-2xl p-10">
          <p className="text-slate-400 text-sm uppercase tracking-widest mb-4">Visión a largo plazo</p>
          <p className="text-2xl font-semibold text-white max-w-3xl mx-auto leading-relaxed">
            Convertirse en el <span className="text-accent-400">Verra / Fairmined de Honduras</span>:
            la primera plataforma que une formalización legal + trazabilidad + comercialización de oro responsable.
          </p>
          <p className="text-slate-400 mt-4">
            Iriona → Corredor aurífero hondureño → Centroamérica
          </p>
        </div>

      </div>
    </section>
  );
}
