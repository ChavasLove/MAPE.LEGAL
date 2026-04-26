import { Hero }     from '@/components/landing/Hero';
import { Problem }  from '@/components/landing/Problem';
import { Solution } from '@/components/landing/Solution';
import { Services } from '@/components/landing/Services';
import { WhyNow }   from '@/components/landing/WhyNow';
import { Roadmap }  from '@/components/landing/Roadmap';
import { Footer }   from '@/components/landing/Footer';

export const metadata = {
  title: 'MAPE.LEGAL — Oro Traceable y Premium · Piloto Iriona 2026',
  description:
    'La plataforma que convierte minería artesanal en evidencia legal defendible para Chiopa Industrias y mercados éticos internacionales. Corporación Hondureña Tenka.',
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden">
      <Hero />
      <Problem />
      <Solution />
      <Services />
      <WhyNow />
      <Roadmap />
      <Footer />
    </div>
  );
}
