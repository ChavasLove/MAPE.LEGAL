export function Footer() {
  return (
    <footer className="bg-primary-950 border-t border-primary-900">

      {/* Footer content */}
      <div className="py-14 max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-10 mb-10 text-sm text-primary-500 font-sans">

          {/* Brand */}
          <div>
            <div className="text-white font-bold text-lg mb-3 font-sans">MAPE.LEGAL</div>
            <p className="leading-relaxed">
              Plataforma de evidencia legal de origen mineral para la minería artesanal
              y pequeña minería en Honduras.
            </p>
            <p className="mt-3 text-primary-300 font-medium">
              Corporación Hondureña Tenka, S.A.
            </p>
          </div>

          {/* Legal framework */}
          <div>
            <div className="text-white font-semibold mb-3 font-sans">Marco normativo</div>
            <ul className="space-y-2">
              {[
                'Ley de Minería de Honduras',
                'Reglamento MAPE',
                'Convenio ILO 169',
                'SLAS-2 · Categorización ambiental',
                'CRAFT Code / Fairmined / RJC',
                'EUDR 2027',
              ].map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <div className="text-white font-semibold mb-3 font-sans">Contacto</div>
            <ul className="space-y-2">
              <li>
                <a href="mailto:gerencia@mape.legal" className="text-earth-200 hover:text-white transition-colors">
                  gerencia@mape.legal
                </a>
              </li>
              <li className="pt-2 text-primary-300">Honduras · Cobertura nacional</li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div
          className="pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-primary-500 font-sans"
          style={{ borderColor: 'rgba(94,107,122,0.2)' }}
        >
          <p>© 2026 Corporación Hondureña Tenka, S.A. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            {['ILO 169', 'CRAFT', 'Fairmined', 'RJC'].map(cert => (
              <span key={cert} className="text-primary-300">{cert}</span>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
