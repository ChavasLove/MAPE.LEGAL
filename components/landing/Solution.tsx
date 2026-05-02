import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

const modules = [
  {
    num:   '01',
    title: 'Registro de Productores',
    desc:  'Verificación en tiempo real ante INHGEOMIN y SERNA. Ficha completa con RTN, coordenadas GPS, situación del terreno y fotografía georreferenciada.',
  },
  {
    num:   '02',
    title: 'Certificate of Origin Automático',
    desc:  'Evidencia legal defendible generada automáticamente: fotos GPS, constancia ILO 169 e Índice de Legalidad de cinco componentes.',
  },
  {
    num:   '03',
    title: 'Registro de Transacciones',
    desc:  'Registro de compra de oro con peso, ley, fecha y coordenadas de origen — trazabilidad completa desde el campo hasta el mercado ético.',
  },
  {
    num:   '04',
    title: 'Gestión de Expedientes',
    desc:  'Seguimiento en tiempo real de cada expediente, integración de documentos vía WhatsApp y avance sobre los 54 pasos del Manual Operativo CHT.',
  },
];

export function Solution() {
  return (
    <section className="py-24 bg-primary-950" id="solucion">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-action-gold text-sm font-bold tracking-widest uppercase mb-4 font-sans">El motor de evidencia</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            Se llama <span className="text-action-gold">MAPE.LEGAL</span>
          </h2>
          <p className="text-xl text-primary-300 max-w-2xl mx-auto font-sans">
            La primera plataforma digital de Honduras que genera evidencia legal de origen mineral
            automáticamente — con cuatro módulos integrados.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {modules.map(({ num, title, desc }) => (
            <Card key={num} className="bg-primary-900 border-primary-500/30 hover:border-action-gold/50 transition-colors">
              <CardContent className="pt-8">
                <div className="text-action-gold text-3xl font-bold mb-4 font-sans">{num}</div>
                <h3 className="text-lg font-semibold text-white mb-3 font-sans">{title}</h3>
                <p className="text-primary-300 text-sm leading-relaxed font-sans">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Topographic context image */}
        <div className="rounded-xl overflow-hidden mb-8 border border-primary-500/30" style={{ maxHeight: '320px' }}>
          <Image
            src="/images/Services Tophography .png"
            alt="Topografía territorial — trazabilidad de origen mineral Honduras"
            width={1920}
            height={640}
            className="w-full object-cover"
            style={{ filter: 'brightness(0.75) contrast(1.05) saturate(0.82)', maxHeight: '320px', objectFit: 'cover' }}
            sizes="(max-width: 768px) 100vw, 1152px"
          />
        </div>

        {/* Standards compliance strip */}
        <div className="bg-primary-900 border border-primary-500/30 rounded-xl p-5 sm:p-8">
          <div className="grid md:grid-cols-3 gap-8 items-center text-center">
            <div>
              <div className="text-white font-bold text-lg font-sans mb-1">Trazabilidad completa</div>
              <div className="text-primary-300 text-sm font-sans">Desde el campo hasta el mercado ético internacional</div>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="flex items-center gap-3 text-primary-500">
                <div className="w-16 h-px bg-primary-500/50" />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                <div className="w-16 h-px bg-primary-500/50" />
              </div>
            </div>
            <div>
              <div className="text-action-gold font-bold text-lg font-sans mb-1">Mercados premium</div>
              <div className="text-primary-300 text-sm font-sans">CRAFT · Fairmined · RJC · EUDR 2027 cumplidos</div>
            </div>
          </div>
          <p className="text-center text-primary-300 text-sm mt-6 font-sans border-t border-primary-500/20 pt-6">
            El sistema está diseñado para generar la evidencia que exigen los estándares internacionales —
            sin trabajo manual adicional por parte del productor.
          </p>
        </div>

      </div>
    </section>
  );
}
