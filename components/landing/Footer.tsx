'use client';

export function Footer() {
  return (
    <footer className="bg-primary-900 border-t border-primary-950" id="contacto">

      {/* CTA final */}
      <div className="py-20 text-center border-b border-primary-950">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-earth-200 text-sm font-bold tracking-widest uppercase mb-4 font-sans">¿Listo para formalizar?</p>
          <h2 className="text-4xl font-bold text-white mb-6">
            Inicia tu expediente hoy
          </h2>
          <p className="text-primary-500 text-lg mb-8 font-sans">
            Nos comprometemos a gestionar tu proceso en el menor tiempo posible,
            con acompañamiento legal continuo en cada fase — desde la apertura del expediente
            hasta la obtención del permiso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:contacto@mape.legal"
              className="bg-forest-800 hover:bg-primary-950 text-white font-bold font-sans py-4 px-10 rounded-lg text-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              Solicitar cotización privada
            </a>
            <a
              href="/dashboard.html"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-primary-500 hover:border-earth-200 text-white font-semibold font-sans py-4 px-10 rounded-lg text-lg transition-colors inline-flex items-center justify-center"
            >
              Ver el Dashboard →
            </a>
          </div>
        </div>
      </div>

      {/* Footer meta */}
      <div className="py-10 max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-10 text-sm text-primary-500 font-sans">
          <div>
            <div className="text-white font-bold text-lg mb-3 font-sans">MAPE.LEGAL</div>
            <p>
              Motor de evidencia legal de origen mineral para minería artesanal y
              pequeña minería en Honduras.
            </p>
            <p className="mt-2 text-primary-300">Piloto Iriona 2026 · Colón, Honduras</p>
          </div>
          <div>
            <div className="text-white font-semibold mb-3 font-sans">Marco legal</div>
            <ul className="space-y-2">
              {['Ley de Minería Honduras', 'Reglamento MAPE', 'ILO 169', 'SLAS-2', 'CRAFT / Fairmined / RJC'].map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-white font-semibold mb-3 font-sans">Corporación Hondureña Tenka</div>
            <ul className="space-y-2">
              <li>Operador MAPE.LEGAL</li>
              <li>Piloto Iriona, Colón · 2026</li>
              <li className="pt-2">
                <a href="/dashboard.html" className="text-earth-200 hover:underline">
                  Panel administrativo →
                </a>
              </li>
              <li>
                <a href="mailto:contacto@mape.legal" className="text-earth-200 hover:underline">
                  contacto@mape.legal
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-950 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-primary-500 font-sans">
          <p>© 2026 Corporación Hondureña Tenka, S.A. Todos los derechos reservados.</p>
          <p>Uso exclusivo interno CHT y socios autorizados · Documento confidencial</p>
        </div>
      </div>

    </footer>
  );
}
