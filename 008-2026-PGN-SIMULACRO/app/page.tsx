'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-500">Cargando perfiles...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-pgn-800">PGN Estudio</h1>
        <p className="mt-2 text-sm text-slate-500">Selecciona tu perfil para comenzar</p>
      </div>

      <div className="space-y-4">
        {perfiles.map((perfil) => (
          <ProfileCard key={perfil.codigo} perfil={perfil} onSelect={handleSelect} />
        ))}
      </div>
    </main>
  );
}
