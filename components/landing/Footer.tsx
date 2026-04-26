'use client';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800" id="contacto">

      {/* CTA final */}
      <div className="py-20 text-center border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-green-400 text-sm font-bold tracking-widest uppercase mb-4">¿Listo para formalizar?</p>
          <h2 className="text-4xl font-bold text-white mb-6">
            Inicia tu expediente hoy
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            El primer hito es L 320.000 e incluye apertura de expediente, asignación de abogado y PSA,
            y el inicio de la Fase 0 del Manual Operativo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:contacto@mape.legal"
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-10 rounded-2xl text-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              Empezar trámite ahora
            </a>
            <a
              href="/dashboard.html"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-slate-600 hover:border-green-500 text-white font-semibold py-4 px-10 rounded-2xl text-lg transition-colors inline-flex items-center justify-center"
            >
              Ver el Dashboard →
            </a>
          </div>
        </div>
      </div>

      {/* Footer meta */}
      <div className="py-10 max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-10 text-sm text-slate-400">
          <div>
            <div className="text-white font-bold text-lg mb-3">MAPE.LEGAL</div>
            <p>
              Motor de evidencia legal de origen mineral para minería artesanal y
              pequeña minería en Honduras.
            </p>
            <p className="mt-2 text-slate-500">Piloto Iriona 2026 · Colón, Honduras</p>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">Marco legal</div>
            <ul className="space-y-2">
              {['Ley de Minería Honduras', 'Reglamento MAPE', 'ILO 169', 'SLAS-2', 'CRAFT / Fairmined / RJC'].map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">Corporación Hondureña Tenka</div>
            <ul className="space-y-2">
              <li>Operador MAPE.LEGAL</li>
              <li>Piloto Iriona, Colón · 2026</li>
              <li className="pt-2">
                <a href="/dashboard.html" className="text-green-400 hover:underline">
                  Panel administrativo →
                </a>
              </li>
              <li>
                <a href="mailto:contacto@mape.legal" className="text-green-400 hover:underline">
                  contacto@mape.legal
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600">
          <p>© 2026 Corporación Hondureña Tenka, S.A. Todos los derechos reservados.</p>
          <p>Uso exclusivo interno CHT y socios autorizados · Documento confidencial</p>
        </div>
      </div>

    </footer>
  );
}
