'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import ScoreRing from '../../components/ScoreRing';
import StatCard from '../../components/StatCard';
import { Perfil, Resultado } from '../../lib/types';
import { getPerfilActivo, getPerfiles, getResultados } from '../../lib/client-data';
import { Trophy, Clock, RotateCcw, TrendingUp, PartyPopper } from 'lucide-react';

const confetti = [
  { top: '12%', left: '18%', size: 8, color: 'bg-pgn-500', delay: '0ms' },
  { top: '22%', left: '78%', size: 6, color: 'bg-success', delay: '120ms' },
  { top: '8%', left: '62%', size: 10, color: 'bg-pgn-400', delay: '240ms' },
  { top: '34%', left: '10%', size: 7, color: 'bg-warning', delay: '80ms' },
  { top: '38%', left: '86%', size: 9, color: 'bg-danger', delay: '200ms' },
  { top: '18%', left: '42%', size: 5, color: 'bg-pgn-500', delay: '160ms' },
];

function ResultadoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const correctas = parseInt(searchParams.get('correctas') || '0', 10);
  const total = parseInt(searchParams.get('total') || '0', 10);
  const duracion = parseInt(searchParams.get('duracion') || '0', 10);
  const tipo = searchParams.get('tipo') || 'quiz';

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [historial, setHistorial] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }
    Promise.all([getPerfiles(), getResultados()])
      .then(([perfiles, allResultados]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        if (!p) {
          router.replace('/');
          return;
        }
        setPerfil(p);
        setHistorial(allResultados.filter((r) => r.perfil_codigo === codigo));
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !perfil) {
    return (
      <main className="page-shell">
        <div className="nav-blur px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-7 w-20" />
          </div>
        </div>
        <section className="px-4 py-6 text-center">
          <div className="mx-auto h-7 w-56 skeleton" />
          <div className="mt-8 flex justify-center">
            <div className="skeleton h-40 w-40 rounded-full" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card h-24 skeleton" />
            ))}
          </div>
          <div className="card mt-6 h-32 skeleton" />
          <div className="mt-6 h-13 w-full rounded-2xl skeleton" />
        </section>
      </main>
    );
  }

  const porcentaje = total > 0 ? (correctas / total) * 100 : 0;
  const aprobado = porcentaje >= 65;
  const promedioHist = historial.length
    ? Math.round(historial.reduce((a, r) => a + (r.correctas / r.total) * 100, 0) / historial.length)
    : 0;

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
      <section className="px-4 py-6 text-center">
        <h1 className="text-headline text-ink animate-fade-up">
          {tipo === 'diagnostico' ? 'Resultado del diagnóstico' : tipo === 'simulacro' ? 'Resultado del simulacro' : 'Resultado'}
        </h1>

        <div className="relative mt-8 flex justify-center animate-fade-up" style={{ animationDelay: '80ms' }}>
          {aprobado && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {confetti.map((dot, i) => (
                <div
                  key={i}
                  className={`absolute animate-bounce rounded-full opacity-60 ${dot.color}`}
                  style={{
                    top: dot.top,
                    left: dot.left,
                    width: dot.size,
                    height: dot.size,
                    animationDelay: dot.delay,
                  }}
                />
              ))}
            </div>
          )}
          <div className="relative flex flex-col items-center animate-scale-in">
            {aprobado ? (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <PartyPopper className="h-6 w-6 text-success" />
              </div>
            ) : (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
                <Trophy className="h-6 w-6 text-danger" />
              </div>
            )}
            <ScoreRing score={correctas} total={total} size={160} />
          </div>
        </div>

        <p
          className={`mt-5 text-title-2 font-bold animate-fade-up ${
            aprobado ? 'text-success' : 'text-danger'
          }`}
          style={{ animationDelay: '120ms' }}
        >
          {aprobado ? '¡Aprobado!' : 'Necesitas practicar más'}
        </p>
        <p className="mt-1 text-footnote text-ink-muted animate-fade-up" style={{ animationDelay: '140ms' }}>
          Mínimo requerido: 65%
        </p>

        <div
          className="mt-6 grid grid-cols-2 gap-4 text-left animate-fade-up"
          style={{ animationDelay: '160ms' }}
        >
          <StatCard label="Correctas" value={correctas} icon={Trophy} trend="up" />
          <StatCard label="Duración" value={`${duracion}s`} icon={Clock} trend="neutral" />
          <StatCard label="Promedio histórico" value={`${promedioHist}%`} icon={TrendingUp} trend="neutral" />
          <StatCard label="Intentos previos" value={historial.length} icon={RotateCcw} trend="neutral" />
        </div>

        <div className="card mt-6 p-5 text-left animate-fade-up" style={{ animationDelay: '180ms' }}>
          <h3 className="text-callout font-semibold text-ink">Recomendación</h3>
          <p className="mt-2 text-body text-ink-muted">
            {aprobado
              ? 'Buen desempeño. Refuerza los temas donde fallaste para asegurar el puntaje en la prueba oficial.'
              : 'Prioriza los temas con menor puntaje. Repasa resúmenes y flashcards antes de intentar de nuevo.'}
          </p>
        </div>

        <button
          onClick={() => router.push('/home')}
          className="btn-primary mt-6 w-full animate-fade-up"
          style={{ animationDelay: '200ms' }}
        >
          Volver al inicio
        </button>
      </section>
    </main>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense
      fallback={
        <main className="page-shell flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-subtle/20 border-t-pgn-500" />
        </main>
      }
    >
      <ResultadoContent />
    </Suspense>
  );
}
