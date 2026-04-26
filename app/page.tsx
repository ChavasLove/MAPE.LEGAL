import { Hero }     from '@/components/landing/Hero';
import { News }     from '@/components/landing/News';
import { Problem }  from '@/components/landing/Problem';
import { Programs } from '@/components/landing/Programs';
import { Impact }   from '@/components/landing/Impact';
import { About }    from '@/components/landing/About';
import { Footer }   from '@/components/landing/Footer';

export const metadata = {
  title: 'MAPE.LEGAL — Oro Traceable y Premium · Piloto Iriona 2026',
  description:
    'La plataforma que convierte minería artesanal en evidencia legal defendible para mercados éticos internacionales. Corporación Hondureña Tenka.',
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <Hero />
      <News />
      <Problem />
      <Programs />
      <Impact />
      <About />
      <Footer />
    </div>
  );
}
