import { Hero }          from '@/components/landing/Hero';
import { About }         from '@/components/landing/About';
import { ValorSection }  from '@/components/landing/ValorSection';
import { Services }      from '@/components/landing/Services';
import { Solution }      from '@/components/landing/Solution';
import { Beneficiarios } from '@/components/landing/Beneficiarios';
import { Contacto }      from '@/components/landing/Contacto';
import { Footer }        from '@/components/landing/Footer';

export const metadata = {
  title: 'MAPE.LEGAL — Formalización minera en Honduras · Corporación Hondureña Tenka',
  description:
    'Transformamos la minería artesanal en oro trazable, certificado y premium. ' +
    'Acompañamiento legal continuo desde INHGEOMIN hasta los mercados éticos internacionales. ' +
    'ILO 169 · CRAFT · Fairmined · RJC · EUDR 2027.',
};

export default function Home() {
  return (
    <div className="min-h-screen bg-primary-50 text-primary-900 overflow-x-hidden">
      {/* 1. Hero */}
      <Hero />
      {/* 2. Quiénes somos */}
      <About />
      {/* 3. Propuesta de valor — Sin CHT vs Con CHT */}
      <ValorSection />
      {/* 4. Servicios (sin precios) */}
      <Services />
      {/* 5. MAPE.LEGAL — Motor de evidencia */}
      <Solution />
      {/* 6. Beneficios por actor */}
      <Beneficiarios />
      {/* 7. Contacto + CTA final */}
      <Contacto />
      {/* 8. Footer institucional */}
      <Footer />
    </div>
  );
}
