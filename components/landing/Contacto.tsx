'use client';

import { useState } from 'react';

type FormState = 'idle' | 'sending' | 'success' | 'error';

export function Contacto() {
  const [nombre,    setNombre]    = useState('');
  const [empresa,   setEmpresa]   = useState('');
  const [correo,    setCorreo]    = useState('');
  const [mensaje,   setMensaje]   = useState('');
  const [estado,    setEstado]    = useState<FormState>('idle');
  const [errorMsg,  setErrorMsg]  = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEstado('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contacto', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, empresa, correo, mensaje }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al enviar');
      }

      setEstado('success');
      setNombre(''); setEmpresa(''); setCorreo(''); setMensaje('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de conexión. Intenta de nuevo.');
      setEstado('error');
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-lg border text-sm font-sans outline-none focus:ring-2 focus:ring-primary-950/30 transition bg-white text-primary-900 placeholder:text-primary-300";
  const inputStyle = { borderColor: '#E5E7EB' };

  return (
    <section className="py-24 bg-primary-900" id="contacto">
      <div className="max-w-6xl mx-auto px-6">

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* Left — CTA copy */}
          <div>
            <p className="text-earth-200 text-sm font-bold tracking-widest uppercase mb-4 font-sans">
              Inicia tu proceso
            </p>
            <h2 className="text-4xl font-bold text-white mb-6">
              Solicita información sobre tu formalización
            </h2>
            <p className="text-primary-300 text-lg leading-relaxed mb-8 font-sans">
              Cuéntanos sobre tu operación y te preparamos una propuesta personalizada.
              El proceso es privado y confidencial — sin compromiso inicial.
            </p>

            {/* Trust points */}
            <ul className="space-y-4">
              {[
                'Respuesta en menos de 48 horas hábiles',
                'Cotización privada adaptada a tu expediente',
                'Abogado y técnico ambiental asignados desde el inicio',
                'Sin costo por la evaluación preliminar',
              ].map(point => (
                <li key={point} className="flex items-start gap-3 text-primary-300 font-sans text-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3E7C59" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-10 pt-8 border-t border-primary-950">
              <p className="text-primary-300 text-sm font-sans mb-2">¿Prefiere el correo electrónico?</p>
              <a
                href="mailto:gerencia@mape.legal"
                className="text-earth-200 font-semibold font-sans hover:text-white transition-colors"
              >
                gerencia@mape.legal
              </a>
            </div>
          </div>

          {/* Right — Form */}
          <div className="bg-primary-50 rounded-xl border border-[#E5E7EB] p-5 sm:p-8">
            {estado === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-badge-success-bg flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3E7C59" strokeWidth="2" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-primary-900 mb-2">Mensaje enviado</h3>
                <p className="text-primary-500 text-sm font-sans">
                  Gracias por tu consulta. Nos pondremos en contacto en menos de 48 horas hábiles.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans text-primary-500">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      required
                      placeholder="Tu nombre"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans text-primary-500">
                      Empresa / Operación
                    </label>
                    <input
                      type="text"
                      value={empresa}
                      onChange={e => setEmpresa(e.target.value)}
                      placeholder="Nombre de tu operación"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans text-primary-500">
                    Correo electrónico *
                  </label>
                  <input
                    type="email"
                    value={correo}
                    onChange={e => setCorreo(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans text-primary-500">
                    Cuéntanos sobre tu situación *
                  </label>
                  <textarea
                    value={mensaje}
                    onChange={e => setMensaje(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe brevemente tu operación, municipio donde trabajas y en qué fase de formalización te encuentras…"
                    className={`${inputCls} resize-none`}
                    style={inputStyle}
                  />
                </div>

                {estado === 'error' && (
                  <p className="text-sm font-sans px-4 py-3 rounded-lg" style={{ color: '#A94442', background: '#F8E5E4' }}>
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={estado === 'sending'}
                  className="w-full py-4 rounded-lg text-white text-base font-bold font-sans transition-colors disabled:opacity-60 cursor-pointer"
                  style={{ background: '#1F2A44' }}
                >
                  {estado === 'sending' ? 'Enviando…' : 'Iniciar mi formalización'}
                </button>

                <p className="text-xs text-primary-300 text-center font-sans">
                  Tu información es confidencial y no se comparte con terceros.
                </p>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
