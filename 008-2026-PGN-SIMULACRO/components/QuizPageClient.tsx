'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import OptionButton from '@/components/OptionButton';
import FeedbackBox from '@/components/FeedbackBox';
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
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Cargando práctica...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Práctica</h1>
          <span className="text-xs text-slate-500">{index + 1} de {preguntas.length}</span>
        </div>
        <ProgressBar actual={index + (respondida ? 1 : 0)} total={preguntas.length} />

        {pregunta ? (
          <>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium leading-relaxed text-slate-900">{pregunta.enunciado}</p>
            </div>
            <div className="mt-4 space-y-3">
              {pregunta.opciones.map((opcion, i) => {
                const estado = !respondida
                  ? 'default'
                  : i === pregunta.respuesta
                  ? 'correct'
                  : i === seleccion
                  ? 'incorrect'
                  : 'faded';
                return (
                  <OptionButton
                    key={i}
                    label={labels[i]}
                    text={opcion}
                    state={estado}
                    onClick={() => handleSeleccion(i)}
                    disabled={respondida}
                  />
                );
              })}
            </div>
            {respondida && (
              <div className="mt-4">
                <FeedbackBox
                  correcta={seleccion === pregunta.respuesta}
                  explicacion={pregunta.explicacion || 'Sin explicación disponible.'}
                  norma={pregunta.norma}
                  articulo={pregunta.articulo}
                />
                <button
                  onClick={siguiente}
                  className="mt-4 w-full rounded-xl bg-pgn-600 py-3 text-sm font-bold text-white hover:bg-pgn-700"
                >
                  {index + 1 >= preguntas.length ? 'Ver resultado' : 'Siguiente'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">No hay preguntas disponibles para este tema aún.</p>
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
