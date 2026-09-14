'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import Flashcard from '@/components/Flashcard';
import { Perfil, Tema, Flashcard as FlashcardType } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas, getFlashcards } from '@/lib/client-data';

export default function FlashcardsPageClient() {
  const router = useRouter();
  const params = useParams();
  const temaClave = params.tema as string;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tema, setTema] = useState<Tema | null>(null);
  const [flashcards, setFlashcards] = useState<FlashcardType[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }
    Promise.all([getPerfiles(), getTemas(), getFlashcards()])
      .then(([perfiles, allTemas, allFlashcards]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        const t = allTemas.find((x) => x.perfil_codigo === codigo && x.clave === temaClave);
        if (!p || !t) {
          router.replace('/home');
          return;
        }
        setPerfil(p);
        setTema(t);
        setFlashcards(allFlashcards.filter((f) => f.tema_id === t.id));
      })
      .finally(() => setLoading(false));
  }, [router, temaClave]);

  if (loading || !perfil || !tema) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Cargando flashcards...</p>
      </main>
    );
  }

  const actual = flashcards[index];

  return (
    <main className="min-h-screen pb-8">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">{tema.nombre}</h1>
        <p className="mt-1 text-sm text-slate-500">Flashcards · {index + 1} de {flashcards.length || 0}</p>

        {flashcards.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">No hay flashcards cargadas para este tema aún.</p>
          </div>
        )}

        {actual && (
          <div className="mt-6">
            <Flashcard
              frente={actual.frente}
              reverso={actual.reverso}
              norma={actual.norma}
              onNext={() => setIndex((i) => Math.min(i + 1, flashcards.length - 1))}
              onPrev={() => setIndex((i) => Math.max(i - 1, 0))}
              hasNext={index < flashcards.length - 1}
              hasPrev={index > 0}
            />
          </div>
        )}
      </section>
    </main>
  );
}
