'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import Flashcard from '@/components/Flashcard';
import { Perfil, Tema, Flashcard as FlashcardType } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas, getFlashcards } from '@/lib/client-data';
import { Loader2 } from 'lucide-react';

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
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" aria-label="Cargando flashcards" />
      </main>
    );
  }

  const actual = flashcards[index];
  const progress = flashcards.length ? ((index + 1) / flashcards.length) * 100 : 0;

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <div className="animate-fade-up opacity-0">
          <h1 className="text-headline text-ink">{tema.nombre}</h1>
          <p className="mt-1 text-callout text-ink-muted">
            Flashcards · {index + 1} de {flashcards.length || 0}
          </p>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft animate-fade-up opacity-0" style={{ animationDelay: '80ms' }}>
          <div
            className="h-full rounded-full bg-pgn-600 transition-all duration-300 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>

        {flashcards.length === 0 && (
          <div className="mt-6 card border-dashed border-ink-subtle/30 p-8 text-center animate-fade-up opacity-0" style={{ animationDelay: '120ms' }}>
            <p className="text-body text-ink-muted">
              No hay flashcards cargadas para este tema aún.
            </p>
          </div>
        )}

        {actual && (
          <div className="mt-6 animate-fade-up opacity-0" style={{ animationDelay: '160ms' }}>
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
