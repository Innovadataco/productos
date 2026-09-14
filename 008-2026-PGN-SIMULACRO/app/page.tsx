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
      <main className="ios-page flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-ios-primary" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="ios-page flex items-center justify-center px-4">
        <div className="ios-card w-full max-w-sm p-6 text-center">
          <p className="text-ios-body text-ios-red">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ios-page py-6">
      <div className="ios-content mb-8 text-center">
        <h1 className="text-ios-title-1 text-ios-label">PGN Estudio</h1>
        <p className="mt-2 text-ios-body text-ios-label-secondary">Selecciona tu perfil para comenzar</p>
      </div>

      <div className="ios-content space-y-4">
        {perfiles.map((perfil) => (
          <ProfileCard key={perfil.codigo} perfil={perfil} onSelect={handleSelect} />
        ))}
      </div>
    </main>
  );
}
