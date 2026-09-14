'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import ProgressBar from '../../components/ProgressBar';
import OptionButton from '../../components/OptionButton';
import FeedbackBox from '../../components/FeedbackBox';
import { Perfil, Pregunta } from '../../lib/types';
import { getPerfilActivo, getPerfiles, getPreguntas } from '../../lib/client-data';

const TOTAL_SIMULACRO = 50;
const labels = ['A', 'B', 'C', 'D'];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function SimulacroPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
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
    Promise.all([getPerfiles(), getPreguntas()])
      .then(([perfiles, allPreguntas]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        if (!p) {
          router.replace('/');
          return;
        }
        setPerfil(p);
        const delPerfil = allPreguntas.filter((q) => q.perfil_codigo === codigo);
        setPreguntas(shuffle(delPerfil).slice(0, TOTAL_SIMULACRO));
      })
      .finally(() => setLoading(false));
  }, [router]);

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
        tema_id: null,
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
        router.push(`/resultado?correctas=${c}&total=${preguntas.length}&tipo=simulacro&duracion=${duracion}`);
      });
      return;
    }
    setIndex((i) => i + 1);
    setSeleccion(null);
    setRespondida(false);
  };

  if (loading || !perfil) {
    return (
      <main className="ios-page">
        <div className="ios-nav-blur px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-ios-gray-5" />
            <div className="h-7 w-20 animate-pulse rounded-lg bg-ios-gray-5" />
          </div>
        </div>
        <section className="ios-content py-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-7 w-36 animate-pulse rounded bg-ios-gray-5" />
            <div className="h-4 w-20 animate-pulse rounded bg-ios-gray-5" />
          </div>
          <div className="h-2 w-full animate-pulse rounded-full bg-ios-gray-5" />
          <div className="mt-8 space-y-6">
            <div className="ios-card h-40 animate-pulse" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[72px] w-full animate-pulse rounded-ios-xl bg-ios-gray-5" />
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ios-page">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
      <section className="ios-content py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-ios-title-2 text-ios-label">Simulacro mixto</h1>
          <span className="text-ios-caption-1 text-ios-label-secondary">
            Pregunta {index + 1} de {preguntas.length}
          </span>
        </div>
        <ProgressBar actual={index + (respondida ? 1 : 0)} total={preguntas.length} />

        {pregunta ? (
          <>
            <div className="ios-card mt-6 p-5">
              <p className="text-ios-body leading-relaxed text-ios-label">{pregunta.enunciado}</p>
            </div>
            <div className="mt-5 space-y-3">
              {pregunta.opciones.map((opcion, i) => {
                const estado = !respondida
                  ? 'default'
                  : i === pregunta.respuesta
                  ? 'correct'
                  : i === seleccion
                  ? 'incorrect'
                  : 'faded';
                return <OptionButton key={i} label={labels[i]} text={opcion} state={estado} onClick={() => handleSeleccion(i)} disabled={respondida} />;
              })}
            </div>
            {respondida && (
              <div className="mt-6 transition-all duration-300 ease-ios">
                <FeedbackBox
                  correcta={seleccion === pregunta.respuesta}
                  explicacion={pregunta.explicacion || 'Sin explicación disponible.'}
                  norma={pregunta.norma}
                  articulo={pregunta.articulo}
                />
                <button onClick={siguiente} className="ios-button mt-6 w-full text-ios-body">
                  {index + 1 >= preguntas.length ? 'Ver resultado' : 'Siguiente'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="ios-card mt-6 border border-dashed border-ios-gray-4 p-6 text-center">
            <p className="text-ios-body text-ios-label-secondary">No hay preguntas cargadas para el simulacro aún.</p>
            <Link href="/home" className="ios-button-secondary mt-4 w-full">
              Volver al inicio
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
