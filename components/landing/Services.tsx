import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Services() {
  return (
    <section className="py-24 bg-slate-950" id="servicios">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-accent-400 text-sm font-bold tracking-widest uppercase mb-4">Menú de Servicios 2026</p>
          <h2 className="text-4xl font-bold text-white">Nuestros Servicios — Piloto Iriona 2026</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">

          {/* Paquete Ancla */}
          <Card className="border-accent-400/40 bg-slate-900">
            <CardHeader className="pb-0">
              <div className="text-accent-400 text-xs font-bold tracking-widest uppercase mb-3">Paquete Principal</div>
              <CardTitle className="text-2xl mb-3">Paquete Ancla Formalización Minera</CardTitle>
              <div className="text-5xl font-bold text-accent-400">L 1.600.000</div>
              <p className="text-slate-400 text-sm mt-2">3 hitos: 30 % / 40 % / 30 %</p>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-slate-300 text-sm mb-6">
                Permiso INHGEOMIN + Licencia ambiental SERNA + Permiso Municipal + Registro de Comercializador
              </p>
              <ul className="space-y-3 text-sm border-t border-slate-700 pt-4">
                {[
                  { label: 'Hito 1 — Firma del contrato', monto: 'L 320.000' },
                  { label: 'Hito 2 — Constancia INHGEOMIN', monto: 'L 480.000' },
                  { label: 'Hito 3 — Lic. ambiental + permiso', monto: 'L 800.000' },
                ].map(({ label, monto }) => (
                  <li key={label} className="flex justify-between items-center">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold text-white">{monto}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 bg-slate-800 rounded-xl p-4 text-xs text-slate-400">
                <strong className="text-accent-400">54 pasos</strong> del Manual Operativo CHT cubiertos.
                Abogado + PSA asignados desde el Hito 1.
              </div>
            </CardContent>
          </Card>

          {/* Titulación */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <div className="text-accent-400 text-xs font-bold tracking-widest uppercase mb-3">Servicio Complementario</div>
              <CardTitle className="text-xl mb-3">Titulación de Propiedad</CardTitle>
              <div className="text-4xl font-bold text-white">L 38.000</div>
              <p className="text-slate-400 text-sm mt-1">Base (hasta 2 manzanas)</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex justify-between">
                  <span>Base (2 manzanas)</span>
                  <span className="font-medium">L 38.000</span>
                </li>
                <li className="flex justify-between">
                  <span>Por manzana adicional</span>
                  <span className="font-medium">L 8.000</span>
                </li>
              </ul>
              <p className="text-xs text-slate-500 mt-6 border-t border-slate-700 pt-4">
                Facturado directamente al dueño de la tierra.
              </p>
            </CardContent>
          </Card>

          {/* Sociedad Minera */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <div className="text-accent-400 text-xs font-bold tracking-widest uppercase mb-3">Servicio Complementario</div>
              <CardTitle className="text-xl mb-3">Contrato de Sociedad Minera</CardTitle>
              <div className="text-4xl font-bold text-white">L 55.000</div>
              <p className="text-slate-400 text-sm mt-1">Co-pagado 50/50</p>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm mb-4">
                Estructura legal entre minero y propietario del terreno.
                Incluye cláusulas de distribución de beneficios y permanencia.
              </p>
              <p className="text-xs text-slate-500 border-t border-slate-700 pt-4">
                Compartido entre minero y dueño de tierra (L 27.500 c/u).
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Comercialización strip */}
        <div className="bg-gradient-to-r from-primary-600/30 to-slate-900 border border-primary-500/30 rounded-2xl p-8">
          <div className="grid md:grid-cols-3 gap-8 items-center text-center">
            <div>
              <div className="text-accent-400 text-3xl font-bold">80% LBMA</div>
              <div className="text-slate-400 text-sm mt-1">Precio de compra al minero</div>
            </div>
            <div className="text-slate-500 text-2xl hidden md:block">→</div>
            <div>
              <div className="text-accent-400 text-3xl font-bold">85% LBMA</div>
              <div className="text-slate-400 text-sm mt-1">Venta a Chiopa Industrias</div>
            </div>
          </div>
          <p className="text-center text-slate-400 text-sm mt-6">
            Comercialización provisional disponible mientras tramitan permisos completos.
          </p>
        </div>

      </div>
    </section>
  );
}
