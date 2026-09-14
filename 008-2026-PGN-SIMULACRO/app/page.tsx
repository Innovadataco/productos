'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
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
    <main className="page-shell py-6">
      <div className="mb-8 px-4 text-center animate-fade-up opacity-0">
        <h1 className="text-display text-ink">PGN Estudio</h1>
        <p className="mt-2 text-body text-ink-muted">Selecciona tu perfil para comenzar</p>
      </div>

      <div className="space-y-4 px-4">
        {perfiles.map((perfil, i) => (
          <div
            key={perfil.codigo}
            className="animate-fade-up opacity-0"
            style={{ animationDelay: `${(i + 1) * 80}ms` }}
          >
            <ProfileCard perfil={perfil} onSelect={handleSelect} />
          </div>
        ))}
      </div>
    </main>
  );
}
