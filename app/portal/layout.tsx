import { redirect } from 'next/navigation';
import Image from 'next/image';
import { FileText, LogOut } from 'lucide-react';
import Link from 'next/link';
import { getServerAuth } from '@/lib/serverAuth';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth || auth.role !== 'cliente') {
    redirect('/login');
  }

  const email = auth.user.email ?? '';

  return (
    <div className="min-h-screen" style={{ background: '#FAF9F5' }}>
      {/* Top nav */}
      <header
        className="border-b"
        style={{ background: '#1F2A38', borderColor: 'rgba(94,107,123,0.3)' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/MAPE LEGAL LOGO 1.JPG"
              alt="MAPE.LEGAL"
              width={80}
              height={28}
              className="h-7 w-auto"
            />
            <div>
              <div className="text-white font-bold text-sm font-sans">MAPE.LEGAL</div>
              <div className="text-xs font-sans" style={{ color: '#A3A8AB' }}>Portal del cliente</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {email && (
              <span className="text-xs font-sans hidden sm:block" style={{ color: '#A3A8AB' }}>{email}</span>
            )}
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium font-sans hover:bg-white/10 transition-colors cursor-pointer"
                style={{ color: '#A3A8AB' }}
              >
                <LogOut size={14} strokeWidth={1.5} />
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="border-b" style={{ background: 'white', borderColor: '#E2E0D8' }}>
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex gap-1">
            <Link
              href="/portal"
              className="flex items-center gap-2 px-4 py-3.5 text-sm font-medium font-sans border-b-2 transition-colors"
              style={{ color: '#1F2A38', borderColor: '#1F2A38' }}
            >
              <FileText size={16} strokeWidth={1.5} />
              Mi expediente
            </Link>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
