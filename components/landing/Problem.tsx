const problems = [
  {
    num: '01',
    text: 'Precios bajos (60-75% LBMA) por intermediarios que no certifican origen.',
  },
  {
    num: '02',
    text: 'Burocracia eterna ante INHGEOMIN y SERNA sin guía legal especializada.',
  },
  {
    num: '03',
    text: 'Riesgo constante de operativos, decomisos y pérdida de producción.',
  },
  {
    num: '04',
    text: 'Sin trazabilidad el oro queda bloqueado de mercados éticos internacionales.',
  },
];

export function Problem() {
  return (
    <section className="py-24 bg-slate-950">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          <div>
            <p className="text-accent-400 text-sm font-bold tracking-widest uppercase mb-4">El problema</p>
            <h2 className="text-4xl font-bold text-white mb-8 leading-tight">
              La minería artesanal en Honduras enfrenta un problema histórico
            </h2>
            <ul className="space-y-6">
              {problems.map(({ num, text }) => (
                <li key={num} className="flex gap-5 items-start">
                  <span className="text-red-400 text-2xl font-bold shrink-0">{num}</span>
                  <p className="text-slate-300 text-lg leading-snug">{text}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Map / visual placeholder */}
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 flex flex-col items-center gap-6">
            {/* SVG map placeholder — replace with actual map image */}
            <div className="w-full aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border border-slate-700">
              <div className="text-center text-slate-500">
                <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4C15.2 4 8 11.2 8 20c0 13 16 24 16 24s16-11 16-24c0-8.8-7.2-16-16-16z" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="24" cy="20" r="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <p className="text-sm">MAPA GENERAL IRIONA, COLÓN</p>
                <p className="text-xs mt-1">60 productores identificados</p>
              </div>
            </div>
            <p className="text-center text-slate-400 text-sm">
              Valle de Sico, Iriona, Colón — Clusters consultados bajo ILO 169
              <br /><span className="text-accent-400 font-semibold">Puntos rojos = mineros en proceso de formalización</span>
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
