import { Card, CardContent } from '@/components/ui/card';

const modules = [
  {
    num: '01',
    title: 'Registro de Productores',
    desc: 'Verificación en tiempo real INHGEOMIN/SERNA. Ficha completa: RTN, coordenadas GPS, situación de tierra, foto georeferenciada.',
  },
  {
    num: '02',
    title: 'Certificate of Origin Automático',
    desc: 'Evidencia legal defendible con fotos GPS + constancia ILO 169 + índice de legalidad de 5 componentes.',
  },
  {
    num: '03',
    title: 'Registro de Transacciones',
    desc: 'Compra de oro con peso, ley, fecha y coordenadas de origen. Trazabilidad completa hacia Chiopa Industrias.',
  },
  {
    num: '04',
    title: 'Dashboard en Vivo',
    desc: 'Seguimiento de expedientes, feed WhatsApp en tiempo real y progreso de los 54 pasos del Manual Operativo.',
  },
];

export function Solution() {
  return (
    <section className="py-24 bg-slate-900">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-accent-400 text-sm font-bold tracking-widest uppercase mb-4">La solución</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            Se llama <span className="text-accent-400">MAPE.LEGAL</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            La primera plataforma digital de Honduras que genera evidencia legal de origen mineral automáticamente —
            con cuatro módulos integrados.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {modules.map(({ num, title, desc }) => (
            <Card key={num} className="bg-slate-950 border-slate-700 hover:border-accent-400/50 transition-colors">
              <CardContent className="pt-8">
                <div className="text-accent-400 text-3xl font-bold mb-4">{num}</div>
                <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dashboard preview CTA */}
        <div className="text-center">
          <div className="inline-block bg-slate-950 border border-slate-700 rounded-2xl p-6">
            <p className="text-slate-400 text-sm mb-3">Panel administrativo disponible ahora</p>
            <a
              href="/dashboard.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-accent-400 hover:text-accent-500 font-semibold text-lg transition-colors"
            >
              Ver demo del Dashboard
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
