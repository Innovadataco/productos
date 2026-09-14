'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import { Perfil, Tema, Pregunta } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas, getPreguntas } from '@/lib/client-data';

const TOTAL_QUIZ = 10;
const labels = ['A', 'B', 'C', 'D'];

interface QuizPageClientProps {
  temaClave: string;
}

export default function QuizPageClient({ temaClave }: QuizPageClientProps) {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tema, setTema] = useState<Tema | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [index, setIndex] = useState(0);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [correctas, setCorrectas] = useState(0);
  const [respondida, setRespondida] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(() => Date.now());
  const [respuestas, setRespuestas] = useState<{ pregunta_id: number; marcada: number; correcta: number }[]>([]);
  const [falladas, setFalladas] = useState<number[]>([]);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }
    Promise.all([getPerfiles(), getTemas(), getPreguntas()])
      .then(([perfiles, allTemas, allPreguntas]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        const t = allTemas.find((x) => x.perfil_codigo === codigo && x.clave === temaClave);
        if (!p || !t) {
          router.replace('/home');
          return;
        }
        setPerfil(p);
        setTema(t);
        const delTema = allPreguntas.filter((q) => q.perfil_codigo === codigo && q.tema_id === t.id);
        setPreguntas(shuffle(delTema).slice(0, TOTAL_QUIZ));
      })
      .finally(() => setLoading(false));
  }, [router, temaClave]);

  const pregunta = preguntas[index];

  const handleSeleccion = (opcion: number) => {
    if (respondida || !pregunta) return;
    setSeleccion(opcion);
    setRespondida(true);
    const esCorrecta = opcion === pregunta.respuesta ? 1 : 0;
    if (esCorrecta) setCorrectas((c) => c + 1);
    else setFalladas((f) => [...f, pregunta.id]);
    setRespuestas((r) => [...r, { pregunta_id: pregunta.id, marcada: opcion, correcta: esCorrecta }]);
  };

  const siguiente = () => {
    if (!pregunta) return;
    if (index + 1 >= preguntas.length) {
      const duracion = Math.round((Date.now() - startTime) / 1000);
      const c = correctas + (seleccion === pregunta.respuesta ? 1 : 0);
      const payload = {
        perfil_codigo: perfil?.codigo,
        tema_id: tema?.id ?? null,
        correctas: c,
        total: preguntas.length,
        falladas,
        duracion_seg: duracion,
        respuestas,
      };
      fetch('/api/resultados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null).finally(() => {
        router.push(`/resultado?correctas=${c}&total=${preguntas.length}&tipo=quiz&tema=${tema?.id}&duracion=${duracion}`);
      });
      return;
    }
    setIndex((i) => i + 1);
    setSeleccion(null);
    setRespondida(false);
  };

  if (loading || !perfil || !tema) {
    return (
      <main className="page-shell">
        <div className="nav-blur px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-7 w-20" />
          </div>
        </div>
        <section className="px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="skeleton h-7 w-28" />
            <div className="skeleton h-4 w-16" />
          </div>
          <div className="skeleton h-2 w-full rounded-full" />
          <div className="mt-8 space-y-6">
            <div className="card h-40 skeleton" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[72px] w-full rounded-2xl skeleton" />
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <div className="animate-fade-up">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-headline text-ink">Práctica</h1>
            <span className="text-caption text-ink-muted">
              {index + 1} de {preguntas.length}
            </span>
          </div>
          <ProgressBar actual={index + (respondida ? 1 : 0)} total={preguntas.length} />
        </div>

        {pregunta ? (
          <>
            <div className="card mt-6 p-5 animate-fade-up" style={{ animationDelay: '80ms' }}>
              <p className="text-body leading-relaxed text-ink">{pregunta.enunciado}</p>
            </div>
            <div className="mt-5 space-y-3 animate-fade-up" style={{ animationDelay: '120ms' }}>
              {pregunta.opciones.map((opcion, i) => {
                const estado = !respondida
                  ? 'default'
                  : i === pregunta.respuesta
                  ? 'correct'
                  : i === seleccion
                  ? 'incorrect'
                  : 'faded';
                const labelColor =
                  estado === 'correct'
                    ? 'text-success'
                    : estado === 'incorrect'
                    ? 'text-danger'
                    : estado === 'faded'
                    ? 'text-ink-subtle'
                    : 'text-ink';
                return (
                  <button
                    key={i}
                    onClick={() => handleSeleccion(i)}
                    disabled={respondida}
                    className={`option-card min-h-[52px] ${estado === 'default' ? '' : estado} ${
                      respondida ? 'cursor-default' : 'active:scale-[0.98]'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-callout font-bold ${labelColor}`}
                    >
                      {labels[i]}
                    </span>
                    <span className={`text-body leading-relaxed ${estado === 'faded' ? 'text-ink-subtle' : 'text-ink'}`}>
                      {opcion}
                    </span>
                  </button>
                );
              })}
            </div>
            {respondida && (
              <div className="mt-6 animate-fade-up" style={{ animationDelay: '160ms' }}>
                <div
                  className={`card overflow-hidden border p-4 transition-all duration-300 ${
                    seleccion === pregunta.respuesta
                      ? 'border-success/30 bg-success/10'
                      : 'border-danger/30 bg-danger/10'
                  }`}
                >
                  <div
                    className={`mb-3 flex items-center gap-2 ${
                      seleccion === pregunta.respuesta ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {seleccion === pregunta.respuesta ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    <span className="text-body font-semibold">
                      {seleccion === pregunta.respuesta ? 'Correcto' : 'Incorrecto'}
                    </span>
                  </div>
                  <p className="mb-4 text-body text-ink-muted">
                    {pregunta.explicacion || 'Sin explicación disponible.'}
                  </p>
                  <div className="rounded-2xl bg-surface p-3 text-footnote text-ink-muted shadow-glass">
                    <div
                      className={`mb-1 flex items-center gap-2 ${
                        seleccion === pregunta.respuesta ? 'text-success' : 'text-danger'
                      }`}
                    >
                      <BookOpen size={14} />
                      <span className="font-semibold">Norma:</span>
                    </div>
                    <p>{pregunta.norma || 'No especificada'}</p>
                    {pregunta.articulo ? (
                      <p className="mt-1">
                        <span className="font-semibold text-ink">Artículo:</span> {pregunta.articulo}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button onClick={siguiente} className="btn-primary mt-6 w-full">
                  {index + 1 >= preguntas.length ? 'Ver resultado' : 'Siguiente'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card mt-6 border border-dashed border-ink-subtle/30 p-6 text-center">
            <p className="text-body text-ink-muted">No hay preguntas disponibles para este tema aún.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
