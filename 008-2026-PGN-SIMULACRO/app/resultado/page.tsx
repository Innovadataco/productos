'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import ScoreRing from '../../components/ScoreRing';
import StatCard from '../../components/StatCard';
import { Perfil, Resultado } from '../../lib/types';
import { getPerfilActivo, getPerfiles, getResultados } from '../../lib/client-data';
import { Trophy, Clock, RotateCcw, TrendingUp } from 'lucide-react';

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
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Cargando resultado...</p>
      </main>
    );
  }

  const porcentaje = total > 0 ? (correctas / total) * 100 : 0;
  const aprobado = porcentaje >= 65;
  const promedioHist = historial.length
    ? Math.round(historial.reduce((a, r) => a + (r.correctas / r.total) * 100, 0) / historial.length)
    : 0;

  return (
    <main className="min-h-screen pb-8">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
      <section className="px-4 py-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">
          {tipo === 'diagnostico' ? 'Resultado del diagnóstico' : tipo === 'simulacro' ? 'Resultado del simulacro' : 'Resultado'}
        </h1>

        <div className="mt-6 flex justify-center">
          <ScoreRing score={correctas} total={total} size={140} />
        </div>

        <p className={`mt-4 text-lg font-bold ${aprobado ? 'text-emerald-600' : 'text-red-600'}`}>
          {aprobado ? '¡Aprobado!' : 'Necesitas practicar más'}
        </p>
        <p className="mt-1 text-sm text-slate-500">Mínimo requerido: 65%</p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <StatCard label="Correctas" value={correctas} icon={Trophy} trend="up" />
          <StatCard label="Duración" value={`${duracion}s`} icon={Clock} trend="neutral" />
          <StatCard label="Promedio histórico" value={`${promedioHist}%`} icon={TrendingUp} trend="neutral" />
          <StatCard label="Intentos previos" value={historial.length} icon={RotateCcw} trend="neutral" />
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left">
          <h3 className="text-sm font-bold text-slate-900">Recomendación</h3>
          <p className="mt-1 text-sm text-slate-600">
            {aprobado
              ? 'Buen desempeño. Refuerza los temas donde fallaste para asegurar el puntaje en la prueba oficial.'
              : 'Prioriza los temas con menor puntaje. Repasa resúmenes y flashcards antes de intentar de nuevo.'}
          </p>
        </div>

        <button onClick={() => router.push('/home')} className="mt-6 w-full rounded-xl bg-pgn-600 py-3 text-sm font-bold text-white hover:bg-pgn-700">
          Volver al inicio
        </button>
      </section>
    </main>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-sm text-slate-500">Cargando...</p></div>}>
      <ResultadoContent />
    </Suspense>
  );
}
