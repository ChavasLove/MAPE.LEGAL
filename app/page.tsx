'use client'

import { useState, useEffect } from 'react'

type Lang = 'es' | 'en'

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml_lang')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'es' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    try { localStorage.setItem('ml_lang', l) } catch {}
  }

  const t = (es: string, en: string) => lang === 'es' ? es : en

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <a href="#" className="nav-logo">
          <div className="nav-logo-mark">ML</div>
          <span className="nav-logo-text">MAPE LEGAL</span>
        </a>
        <div className="nav-links">
          <a href="#como-funciona" className="nav-link">{t('Cómo funciona', 'How it works')}</a>
          <a href="#fases" className="nav-link">{t('Fases del proceso', 'Process phases')}</a>
          <a href="#contacto" className="nav-link">{t('Contacto', 'Contact')}</a>
          <div className="lang-toggle">
            <button className={`lang-btn${lang === 'es' ? ' active' : ''}`} onClick={() => changeLang('es')}>ES</button>
            <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => changeLang('en')}>EN</button>
          </div>
          <a href="#contacto" className="nav-cta">{t('Solicitar consulta', 'Get a consultation')}</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('Plataforma de gestión minera', 'Mining legal management platform')}
          </div>
          <h1 className="hero-title">
            {t('Tu proceso minero,', 'Your mining process,')}
            <br/><span>{t('siempre visible.', 'always visible.')}</span>
          </h1>
          <p className="hero-sub">
            {t(
              'Gestionamos cada paso de tu concesión o exploración minera con trazabilidad completa, alertas automáticas y comunicación directa por WhatsApp.',
              'We manage every step of your mining concession or exploration with full traceability, automatic alerts, and direct communication via WhatsApp.'
            )}
          </p>
          <div className="hero-actions">
            <a href="#contacto" className="btn-primary">
              {t('Iniciar mi expediente', 'Start my file')}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="#como-funciona" className="btn-ghost">
              {t('Ver cómo funciona', 'See how it works')}
            </a>
          </div>
          <div className="hero-trust">
            {([
              t('Alertas en tiempo real', 'Real-time alerts'),
              t('Actualización por WhatsApp', 'WhatsApp updates'),
              t('5 fases, 40+ pasos documentados', '5 phases, 40+ documented steps'),
            ] as string[]).map((text) => (
              <div key={text} className="hero-trust-item">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="hero-visual">
          <div className="mockup-window">
            <div className="mockup-bar">
              <div className="mockup-bar-dot"/>
              <div className="mockup-bar-dot"/>
              <div className="mockup-bar-dot"/>
              <div className="mockup-bar-title">MAPE LEGAL — Panel</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar">
                <div className="mockup-sidebar-item active">
                  <div className="skel" style={{height:'7px',width:'60%',marginBottom:'4px',background:'var(--blue)',opacity:0.4}}/>
                  <div className="skel" style={{height:'9px',width:'90%',marginBottom:'3px'}}/>
                  <div className="skel" style={{height:'6px',width:'70%'}}/>
                  <div style={{marginTop:'6px'}}><span className="badge-g">Activo</span></div>
                </div>
                <div className="mockup-sidebar-item" style={{padding:'8px 10px',borderBottom:'1px solid var(--border)'}}>
                  <div className="skel" style={{height:'7px',width:'60%',marginBottom:'4px'}}/>
                  <div className="skel" style={{height:'9px',width:'90%',marginBottom:'3px'}}/>
                  <div style={{marginTop:'5px'}}><span className="badge-r">Alerta</span></div>
                </div>
                <div className="mockup-sidebar-item" style={{padding:'8px 10px',opacity:0.5}}>
                  <div className="skel" style={{height:'7px',width:'60%',marginBottom:'4px'}}/>
                  <div className="skel" style={{height:'9px',width:'80%'}}/>
                </div>
              </div>
              <div className="mockup-main">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
                  <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:'4px',padding:'7px',borderTop:'2px solid var(--blue)'}}>
                    <div className="skel" style={{height:'6px',width:'60%',marginBottom:'3px'}}/>
                    <div style={{fontSize:'14px',fontWeight:800,color:'var(--blue)'}}>20%</div>
                  </div>
                  <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:'4px',padding:'7px',borderTop:'2px solid var(--green)'}}>
                    <div className="skel" style={{height:'6px',width:'60%',marginBottom:'3px'}}/>
                    <div style={{fontSize:'14px',fontWeight:800,color:'var(--green)'}}>L 320k</div>
                  </div>
                  <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:'4px',padding:'7px',borderTop:'2px solid var(--amber)'}}>
                    <div className="skel" style={{height:'6px',width:'60%',marginBottom:'3px'}}/>
                    <div style={{fontSize:'14px',fontWeight:800,color:'var(--amber)'}}>F1/P9</div>
                  </div>
                </div>
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:'4px',padding:'8px',display:'flex',flexDirection:'column',gap:'6px'}}>
                  <div className="skel" style={{height:'6px',width:'40%',marginBottom:'2px'}}/>
                  <div style={{height:'4px',background:'var(--bg3)',borderRadius:'20px',overflow:'hidden'}}>
                    <div style={{height:'100%',width:'20%',background:'var(--amber)',borderRadius:'20px'}}/>
                  </div>
                  <div style={{height:'4px',background:'var(--bg3)',borderRadius:'20px',overflow:'hidden'}}>
                    <div style={{height:'100%',width:'100%',background:'var(--green)',borderRadius:'20px'}}/>
                  </div>
                  <div style={{height:'4px',background:'var(--bg3)',borderRadius:'20px',overflow:'hidden'}}>
                    <div style={{height:'100%',width:'0%',background:'var(--border)',borderRadius:'20px'}}/>
                  </div>
                </div>
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:'4px',overflow:'hidden'}}>
                  <div style={{background:'var(--bg2)',padding:'4px 8px'}}>
                    <div className="skel" style={{height:'5px',width:'30%'}}/>
                  </div>
                  <div style={{padding:'5px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div className="skel" style={{height:'7px',width:'40%'}}/>
                    <span className="badge-g">Cobrado</span>
                  </div>
                  <div style={{padding:'5px 8px',background:'var(--bg2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div className="skel" style={{height:'7px',width:'40%'}}/>
                    <span className="badge-a">Pendiente</span>
                  </div>
                </div>
              </div>
              <div className="mockup-feed">
                <div className="mockup-feed-head">
                  <div className="skel" style={{height:'7px',width:'70%',background:'rgba(255,255,255,0.3)'}}/>
                </div>
                <div style={{padding:'7px',borderBottom:'1px solid var(--border)'}}>
                  <div className="skel" style={{height:'5px',width:'60%',marginBottom:'3px'}}/>
                  <div className="skel" style={{height:'7px',width:'80%',marginBottom:'3px'}}/>
                  <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                    <div style={{width:'5px',height:'5px',background:'var(--green)',borderRadius:'50%'}}/>
                    <div className="skel" style={{height:'5px',width:'50%'}}/>
                  </div>
                </div>
                <div style={{padding:'7px',background:'var(--bg2)',borderBottom:'1px solid var(--border)'}}>
                  <div className="skel" style={{height:'5px',width:'60%',marginBottom:'3px'}}/>
                  <div className="skel" style={{height:'7px',width:'80%',marginBottom:'3px'}}/>
                  <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                    <div style={{width:'5px',height:'5px',background:'var(--amber)',borderRadius:'50%',animation:'blink 1.4s ease-in-out infinite'}}/>
                    <div className="skel" style={{height:'5px',width:'50%'}}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="float-notif">
            <div className="float-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#057a55" strokeWidth="1.5"/>
                <path d="M5 8l2 2 4-4" stroke="#057a55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:'11px',fontWeight:700,color:'var(--t1)'}}>
                {t('Documento verificado ✓', 'Document verified ✓')}
              </div>
              <div style={{fontSize:'10px',color:'var(--t3)'}}>RTN autenticado · EXP-001</div>
            </div>
          </div>
          <div className="float-notif2">
            <div className="float-icon2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="var(--blue)" strokeWidth="1.5"/>
                <path d="M5 8h6M5 5.5h4" stroke="var(--blue)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:'11px',fontWeight:700,color:'var(--t1)'}}>
                {t('Hito 2 desbloqueado', 'Milestone 2 unlocked')}
              </div>
              <div style={{fontSize:'10px',color:'var(--t3)'}}>L 480,000 · EXP-001</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="stats-grid">
          {([
            { num: '5',    es: 'Fases del proceso minero',            en: 'Mining process phases' },
            { num: '40+',  es: 'Pasos documentados y automatizados',  en: 'Documented and automated steps' },
            { num: '100%', es: 'Trazabilidad de tu expediente',       en: 'Full file traceability' },
            { num: '24h',  es: 'Respuesta y seguimiento continuo',    en: 'Continuous monitoring & response' },
          ] as const).map(({ num, es, en }) => (
            <div key={num} className="stat-item">
              <div className="stat-num">{num}</div>
              <div className="stat-label">{t(es, en)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="how" id="como-funciona">
        <div className="section-label">{t('Cómo funciona', 'How it works')}</div>
        <h2 className="section-title">
          {t('De la consulta al permiso,', 'From consultation to permit,')}
          <br/>
          {t('sabés exactamente dónde estás.', 'you always know where you stand.')}
        </h2>
        <p className="section-sub">
          {t(
            'No más incertidumbre ni llamadas sin respuesta. Cada movimiento en tu expediente se refleja en tiempo real y te llega directo al WhatsApp.',
            'No more uncertainty or unanswered calls. Every move in your file is reflected in real time and sent straight to your WhatsApp.'
          )}
        </p>
        <div className="steps">
          <div className="step">
            <div className="step-connector"/>
            <div className="step-num">1</div>
            <div className="step-title">{t('Consulta inicial gratuita', 'Free initial consultation')}</div>
            <div className="step-body">
              {t(
                'Analizamos la viabilidad de tu área en SIMHON e INHGEOMIN. Te decimos si hay derechos mineros vigentes antes de iniciar el proceso.',
                "We analyze your area's viability in SIMHON and INHGEOMIN. We tell you if there are existing mining rights before starting the process."
              )}
            </div>
          </div>
          <div className="step">
            <div className="step-connector"/>
            <div className="step-num">2</div>
            <div className="step-title">{t('Abrimos tu expediente', 'We open your file')}</div>
            <div className="step-body">
              {t(
                'Firmamos el contrato y asignamos tu equipo: un abogado minero y un PSA certificado. Desde ese momento, cada paso queda documentado.',
                'We sign the contract and assign your team: a mining lawyer and a certified PSA. From that moment, every step is documented.'
              )}
            </div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div className="step-title">{t('Seguimiento automático', 'Automatic follow-up')}</div>
            <div className="step-body">
              {t(
                'Recibís actualizaciones por WhatsApp en cada hito. Sabés cuándo enviar documentos, cuándo hay plazos críticos y cuándo se activa tu próximo cobro.',
                'You receive WhatsApp updates at each milestone. You know when to send documents, when there are critical deadlines, and when your next payment is triggered.'
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TRACEABILITY */}
      <section className="trace">
        <div className="section-label">{t('Trazabilidad completa', 'Full traceability')}</div>
        <h2 className="section-title">
          {t('Todo en un solo lugar.', 'Everything in one place.')}
          <br/>
          {t('Nada se pierde.', 'Nothing gets lost.')}
        </h2>
        <div className="trace-grid">
          <div className="trace-features">
            {([
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M6 10l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                titleEs: 'Checklist documental en tiempo real',
                titleEn: 'Real-time document checklist',
                bodyEs: 'Sabés exactamente qué documentos ya enviaste, cuáles están en revisión y cuáles faltan. Sin sorpresas.',
                bodyEn: "You know exactly which documents you've sent, which are under review, and which are missing. No surprises.",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ),
                titleEs: 'Alertas de plazo automáticas',
                titleEn: 'Automatic deadline alerts',
                bodyEs: '3 días antes de cada vencimiento, tu abogado y vos reciben una alerta. Ningún plazo se vence sin aviso.',
                bodyEn: '3 days before each deadline, your lawyer and you receive an alert. No deadline passes without notice.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                titleEs: 'Hitos de pago transparentes',
                titleEn: 'Transparent payment milestones',
                bodyEs: 'Pagás por logros, no por tiempo. Cada hito tiene un trigger claro y documentado que vos podés seguir en tiempo real.',
                bodyEn: 'You pay for results, not time. Each milestone has a clear, documented trigger that you can follow in real time.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M17 8l-7-5-7 5v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                titleEs: 'Comunicación directa por WhatsApp',
                titleEn: 'Direct WhatsApp communication',
                bodyEs: 'Sin apps nuevas ni portales complicados. Todo pasa por WhatsApp, que ya usás todos los días.',
                bodyEn: 'No new apps or complicated portals. Everything happens through WhatsApp, which you already use every day.',
              },
            ] as const).map(({ icon, titleEs, titleEn, bodyEs, bodyEn }) => (
              <div key={titleEs} className="trace-feat">
                <div className="trace-icon">{icon}</div>
                <div>
                  <div className="trace-feat-title">{t(titleEs, titleEn)}</div>
                  <div className="trace-feat-body">{t(bodyEs, bodyEn)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="progress-card">
            <div className="progress-card-head">
              <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.65)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'4px'}}>
                {t('TU EXPEDIENTE', 'YOUR FILE')}
              </div>
              <div style={{fontSize:'17px',fontWeight:700,color:'#fff'}}>EXP-2026-001</div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.75)',marginTop:'2px'}}>
                {t('Juan Zelaya · Exploración minera · Iriona, Colón', 'Juan Zelaya · Mining exploration · Iriona, Colón')}
              </div>
            </div>
            <div className="progress-card-body">
              <div>
                <div style={{fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t3)',marginBottom:'8px'}}>
                  {t('Índice de legalidad', 'Legality index')}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'3px',marginBottom:'8px'}}>
                  <div style={{textAlign:'center',padding:'5px 2px',border:'1px solid var(--border)',borderTop:'2px solid var(--green)',borderRadius:'3px',fontSize:'9px',color:'var(--green)',fontWeight:700}}>✓ Tierra</div>
                  <div style={{textAlign:'center',padding:'5px 2px',border:'1px solid var(--border)',borderTop:'2px solid var(--amber)',borderRadius:'3px',fontSize:'9px',color:'var(--amber)',fontWeight:700}}>↻ INHGEO</div>
                  <div style={{textAlign:'center',padding:'5px 2px',border:'1px solid var(--border)',borderTop:'2px solid var(--border)',borderRadius:'3px',fontSize:'9px',color:'var(--t3)',opacity:0.5}}>Amb.</div>
                  <div style={{textAlign:'center',padding:'5px 2px',border:'1px solid var(--border)',borderTop:'2px solid var(--border)',borderRadius:'3px',fontSize:'9px',color:'var(--t3)',opacity:0.5}}>Mun.</div>
                  <div style={{textAlign:'center',padding:'5px 2px',border:'1px solid var(--border)',borderTop:'2px solid var(--border)',borderRadius:'3px',fontSize:'9px',color:'var(--t3)',opacity:0.5}}>Reg.</div>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <div className="pbar-wrap" style={{flex:1}}>
                    <div className="pbar-fill" style={{width:'20%',background:'var(--amber)'}}/>
                  </div>
                  <span style={{fontSize:'12px',fontWeight:700,color:'var(--amber)'}}>20%</span>
                </div>
              </div>
              <div>
                <div style={{fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t3)',marginBottom:'8px'}}>
                  {t('Hitos de pago', 'Payment milestones')}
                </div>
                <div className="hito-row">
                  <div style={{fontSize:'12px',fontWeight:500,color:'var(--t1)'}}>
                    {t('Hito 1 · Firma del contrato', 'Milestone 1 · Contract signing')}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                    <span style={{fontSize:'12px',fontWeight:700,color:'var(--t1)'}}>L 320k</span>
                    <span style={{background:'#dcfce7',color:'#057a55',padding:'1px 8px',borderRadius:'20px',fontSize:'10px',fontWeight:600}}>
                      {t('Cobrado', 'Paid')}
                    </span>
                  </div>
                </div>
                <div className="hito-row">
                  <div style={{fontSize:'12px',fontWeight:500,color:'var(--t1)'}}>
                    {t('Hito 2 · Constancia INHGEOMIN', 'Milestone 2 · INHGEOMIN certificate')}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                    <span style={{fontSize:'12px',fontWeight:700,color:'var(--t1)'}}>L 480k</span>
                    <span style={{background:'#fef3c7',color:'#92580a',padding:'1px 8px',borderRadius:'20px',fontSize:'10px',fontWeight:600}}>
                      {t('Pendiente', 'Pending')}
                    </span>
                  </div>
                </div>
                <div className="hito-row" style={{opacity:0.45}}>
                  <div style={{fontSize:'12px',fontWeight:500,color:'var(--t1)'}}>
                    {t('Hito 3 · Permiso completo', 'Milestone 3 · Full permit')}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                    <span style={{fontSize:'12px',fontWeight:700,color:'var(--t1)'}}>L 800k</span>
                    <span style={{background:'#eef0f4',color:'#9ca3af',padding:'1px 8px',borderRadius:'20px',fontSize:'10px',fontWeight:600,border:'1px solid var(--border)'}}>
                      {t('Bloqueado', 'Locked')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FASES */}
      <section className="fases" id="fases">
        <div className="section-label">{t('El proceso completo', 'The complete process')}</div>
        <h2 className="section-title">{t('5 fases. Cada paso, documentado.', '5 phases. Every step, documented.')}</h2>
        <p className="section-sub">
          {t(
            'El proceso minero en Honduras es complejo. Nosotros lo convertimos en un camino claro con fechas, responsables y alertas automáticas.',
            'The mining process in Honduras is complex. We turn it into a clear path with dates, owners, and automatic alerts.'
          )}
        </p>
        <div className="fases-grid">
          {([
            { numEs: 'Fase 0', numEn: 'Phase 0', nameEs: 'Onboarding',                   nameEn: 'Onboarding',           bodyEs: 'Análisis de viabilidad, recolección de documentos y firma del contrato.',                                         bodyEn: 'Viability analysis, document collection, and contract signing.',                                                stepsEs: '6 pasos',  stepsEn: '6 steps' },
            { numEs: 'Fase 1', numEn: 'Phase 1', nameEs: 'INHGEOMIN',                     nameEn: 'INHGEOMIN',            bodyEs: 'Trámites ante el Instituto Nacional de Geología y Minas: publicaciones, constancias y resoluciones.',             bodyEn: 'Procedures with the National Geology and Mines Institute: publications, certificates, and resolutions.',        stepsEs: '13 pasos', stepsEn: '13 steps' },
            { numEs: 'Fase 2', numEn: 'Phase 2', nameEs: 'Ambiental (SERNA)',             nameEn: 'Environmental (SERNA)',bodyEs: 'Licencia ambiental con la Secretaría de Recursos Naturales y Ambiente.',                                         bodyEn: 'Environmental license with the Secretary of Natural Resources and Environment.',                                stepsEs: '8 pasos',  stepsEn: '8 steps' },
            { numEs: 'Fase 3', numEn: 'Phase 3', nameEs: 'Resolución minera',             nameEn: 'Mining resolution',    bodyEs: 'Obtención del permiso de exploración o explotación y firma del contrato minero definitivo.',                       bodyEn: 'Obtaining the exploration or exploitation permit and signing the final mining contract.',                       stepsEs: '7 pasos',  stepsEn: '7 steps' },
            { numEs: 'Fase 4', numEn: 'Phase 4', nameEs: 'Municipal + Comercializador',   nameEn: 'Municipal + Trader',   bodyEs: 'Permisos municipales y registro del comercializador autorizado para operar legalmente.',                          bodyEn: 'Municipal permits and registration of the authorized trader to operate legally.',                               stepsEs: '6 pasos',  stepsEn: '6 steps' },
          ] as const).map(({ numEs, numEn, nameEs, nameEn, bodyEs, bodyEn, stepsEs, stepsEn }) => (
            <div key={numEs} className="fase-card">
              <div className="fase-num">{t(numEs, numEn)}</div>
              <div className="fase-name">{t(nameEs, nameEn)}</div>
              <div className="fase-body">{t(bodyEs, bodyEn)}</div>
              <div className="fase-steps">{t(stepsEs, stepsEn)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE */}
      <section className="quote-section">
        <div className="quote-inner">
          <div className="quote-text">
            {t(
              '"No queremos que te sorprendas con una llamada del abogado.',
              '"We don\'t want you to be surprised by a call from the lawyer.'
            )}
            <br/>
            <em>
              {t(
                'Queremos que ya lo sepás antes de que él llame."',
                'We want you to already know before they call."'
              )}
            </em>
          </div>
          <div className="quote-author">Equipo MAPE LEGAL · CHT</div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="contacto">
        <div className="cta-inner">
          <div className="section-label" style={{textAlign:'center'}}>
            {t('Empezá hoy', 'Start today')}
          </div>
          <h2 className="section-title" style={{textAlign:'center'}}>
            {t('¿Listo para ordenar tu proceso minero?', 'Ready to organize your mining process?')}
          </h2>
          <p className="section-sub" style={{textAlign:'center',margin:'14px auto 0'}}>
            {t(
              'Dejanos tu número de WhatsApp y te contactamos para una consulta gratuita. Sin compromisos.',
              "Leave us your WhatsApp number and we'll contact you for a free consultation. No strings attached."
            )}
          </p>
          {!submitted ? (
            <form className="cta-form" onSubmit={handleSubmit}>
              <input className="cta-input" type="text" placeholder={t('Tu nombre', 'Your name')} required/>
              <input className="cta-input" type="tel" placeholder="WhatsApp (+504...)" required/>
              <button type="submit" className="btn-primary" style={{whiteSpace:'nowrap'}}>
                {t('Solicitar consulta gratuita →', 'Request free consultation →')}
              </button>
            </form>
          ) : (
            <div style={{marginTop:'16px',background:'#dcfce7',color:'#057a55',padding:'12px 20px',borderRadius:'8px',fontSize:'14px',fontWeight:600,textAlign:'center'}}>
              {t('✓ Recibimos tu solicitud. Te contactamos pronto por WhatsApp.', "✓ We received your request. We'll contact you soon via WhatsApp.")}
            </div>
          )}
          <p className="cta-note">
            {t('También podés escribirnos directamente: ', 'You can also write directly: ')}
            <strong>+504 9XXX-XXXX</strong>
            {t(' · Respondemos en menos de 24 horas.', ' · We respond within 24 hours.')}
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="logo">MAPE LEGAL</div>
        <div className="copy">© 2026 CHT. {t('Todos los derechos reservados.', 'All rights reserved.')}</div>
        <div className="links">
          <a href="#como-funciona">{t('Cómo funciona', 'How it works')}</a>
          <a href="#fases">{t('Fases', 'Phases')}</a>
          <a href="#contacto">{t('Contacto', 'Contact')}</a>
        </div>
      </footer>
    </>
  )
}
