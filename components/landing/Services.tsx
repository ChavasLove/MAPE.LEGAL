import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Services() {
  return (
    <section className="py-24 bg-primary-900" id="servicios">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-action-gold text-sm font-bold tracking-widest uppercase mb-4 font-sans">Menú de Servicios 2026</p>
          <h2 className="text-4xl font-bold text-white">Nuestros Servicios — Piloto Iriona 2026</h2>
          <p className="text-primary-300 text-sm mt-3 font-sans">Las cotizaciones se entregan de forma privada según el perfil de cada expediente.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">

          {/* Paquete Ancla */}
          <Card className="border-action-gold/40 bg-primary-950">
            <CardHeader className="pb-0">
              <div className="text-action-gold text-xs font-bold tracking-widest uppercase mb-3 font-sans">Paquete Principal</div>
              <CardTitle className="text-2xl mb-3 text-white">Paquete Ancla Formalización Minera</CardTitle>
              <p className="text-primary-300 text-sm mt-2 font-sans">3 hitos de pago vinculados a entregables verificados</p>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-primary-300 text-sm mb-6 font-sans">
                Permiso INHGEOMIN + Licencia ambiental SERNA + Permiso Municipal + Registro de Comercializador
              </p>
              <ul className="space-y-3 text-sm border-t border-primary-500/30 pt-4">
                {[
                  'Hito 1 — Firma del contrato',
                  'Hito 2 — Constancia INHGEOMIN',
                  'Hito 3 — Lic. ambiental + permiso municipal',
                ].map(label => (
                  <li key={label} className="flex items-center gap-2 text-primary-300 font-sans">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4" stroke="#C49A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {label}
                  </li>
                ))}
              </ul>
              <div className="mt-6 bg-primary-950 rounded-xl p-4 text-xs text-primary-300 font-sans">
                <strong className="text-action-gold">54 pasos</strong> del Manual Operativo CHT cubiertos.
                Abogado + PSA asignados desde el Hito 1.
              </div>
            </CardContent>
          </Card>

          {/* Titulación */}
          <Card className="border-primary-500/30 bg-primary-950">
            <CardHeader>
              <div className="text-action-gold text-xs font-bold tracking-widest uppercase mb-3 font-sans">Servicio Complementario</div>
              <CardTitle className="text-xl mb-3 text-white">Titulación de Propiedad</CardTitle>
              <p className="text-primary-300 text-sm mt-1 font-sans">Cotización según extensión del terreno</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-primary-300 font-sans">
                <li className="flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                    <path d="M3 8l3.5 3.5L13 4" stroke="#C49A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Base hasta 2 manzanas
                </li>
                <li className="flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                    <path d="M3 8l3.5 3.5L13 4" stroke="#C49A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Precio adicional por manzana extra
                </li>
              </ul>
              <p className="text-xs text-primary-300 mt-6 border-t border-primary-500/30 pt-4 font-sans">
                Facturado directamente al dueño de la tierra.
              </p>
            </CardContent>
          </Card>

          {/* Sociedad Minera */}
          <Card className="border-primary-500/30 bg-primary-950">
            <CardHeader>
              <div className="text-action-gold text-xs font-bold tracking-widest uppercase mb-3 font-sans">Servicio Complementario</div>
              <CardTitle className="text-xl mb-3 text-white">Contrato de Sociedad Minera</CardTitle>
              <p className="text-primary-300 text-sm mt-1 font-sans">Co-pagado entre minero y propietario</p>
            </CardHeader>
            <CardContent>
              <p className="text-primary-300 text-sm mb-4 font-sans">
                Estructura legal entre minero y propietario del terreno.
                Incluye cláusulas de distribución de beneficios y permanencia.
              </p>
              <p className="text-xs text-primary-300 border-t border-primary-500/30 pt-4 font-sans">
                Compartido en partes iguales entre minero y dueño de tierra.
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Comercialización strip */}
        <div className="bg-gradient-to-r from-forest-800/30 to-primary-900 border border-primary-500/30 rounded-xl p-8">
          <div className="grid md:grid-cols-3 gap-8 items-center text-center">
            <div>
              <div className="text-action-gold text-2xl font-bold font-sans">Precio justo</div>
              <div className="text-primary-300 text-sm mt-1 font-sans">Garantizado al productor sobre LBMA</div>
            </div>
            <div className="text-primary-500 text-2xl hidden md:block">→</div>
            <div>
              <div className="text-action-gold text-2xl font-bold font-sans">Mercado premium</div>
              <div className="text-primary-300 text-sm mt-1 font-sans">Venta a Chiopa Industrias y mercado ético</div>
            </div>
          </div>
          <p className="text-center text-primary-300 text-sm mt-6 font-sans">
            Comercialización provisional disponible mientras tramitan permisos completos.
          </p>
        </div>

      </div>
    </section>
  );
}
