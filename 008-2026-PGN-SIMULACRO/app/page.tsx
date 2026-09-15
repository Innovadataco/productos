'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronRight } from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import HeroCube from '../components/HeroCube';
import { Perfil } from '../lib/types';
import { getPerfiles, setPerfilActivo } from '../lib/client-data';

export default function SeleccionPerfilPage() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPerfiles()
      .then(setPerfiles)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (perfil: Perfil) => {
    setPerfilActivo(perfil.codigo);
    router.push('/home');
  };

  if (loading) {
    return (
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell flex items-center justify-center px-4">
        <div className="card w-full max-w-sm p-6 text-center animate-fade-up opacity-0">
          <p className="text-body text-danger">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] -z-10"
        style={{
          background:
            'radial-gradient(900px 500px at 50% -10%, rgba(13, 148, 136, 0.18) 0%, transparent 55%), radial-gradient(700px 400px at 20% 10%, rgba(94, 234, 215, 0.12) 0%, transparent 45%), radial-gradient(700px 400px at 80% 15%, rgba(20, 184, 166, 0.10) 0%, transparent 45%)',
        }}
      />

      <section className="flex flex-col items-center px-6 pt-10 pb-8 text-center">
        <div className="animate-fade-up opacity-0">
          <HeroCube />
        </div>

        <div className="mt-8 animate-fade-up opacity-0" style={{ animationDelay: '120ms' }}>
          <h1 className="text-display bg-gradient-to-r from-pgn-700 via-teal-600 to-pgn-500 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
            PGN Estudio
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-body text-ink-muted">
            Preparación enfocada para las convocatorias de la Procuraduría General de la Nación.
          </p>
        </div>

        <div
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-pgn-200 bg-pgn-50/80 px-3.5 py-1.5 text-caption font-medium text-pgn-700 backdrop-blur-sm animate-fade-up opacity-0"
          style={{ animationDelay: '220ms' }}
        >
          Elige tu perfil y empieza a entrenar
          <ChevronRight size={14} className="text-pgn-500" />
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="space-y-3">
          {perfiles.map((perfil, i) => (
            <div
              key={perfil.codigo}
              className="animate-fade-up opacity-0"
              style={{ animationDelay: `${320 + i * 100}ms` }}
            >
              <ProfileCard perfil={perfil} onSelect={handleSelect} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
