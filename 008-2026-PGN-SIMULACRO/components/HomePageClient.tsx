'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Target, Clock, BookOpen, Loader2 } from 'lucide-react';
import Header from './Header';
import TopicCard from './TopicCard';
import StatCard from './StatCard';
import { Perfil, Tema, Pregunta, Resultado } from '../lib/types';
import { getPerfilActivo, setPerfilActivo, getPerfiles, getTemas, getPreguntas, getResultados } from '../lib/client-data';

interface HomePageClientProps {
  version: string;
  build: string;
}

export default function HomePageClient({ version, build }: HomePageClientProps) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }

    Promise.all([getPerfiles(), getTemas(), getPreguntas(), getResultados(codigo)])
      .then(([perfiles, allTemas, allPreguntas, allResultados]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        if (!p) {
          router.replace('/');
          return;
        }
        setPerfil(p);
        setTemas(allTemas.filter((t) => t.perfil_codigo === codigo));
        setPreguntas(allPreguntas.filter((q) => q.perfil_codigo === codigo));
        setResultados(allResultados.filter((r) => r.perfil_codigo === codigo));
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !perfil) {
    return (
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" />
      </main>
    );
  }

  const intentosTotales = resultados.length;
  const correctasTotales = resultados.reduce((acc, r) => acc + r.correctas, 0);
  const preguntasTotales = resultados.reduce((acc, r) => acc + r.total, 0);
  const promedio = preguntasTotales > 0 ? Math.round((correctasTotales / preguntasTotales) * 100) : 0;

  return (
    <main className="page-shell">
      <Header
        perfilCodigo={perfil.codigo}
        perfilNombre={perfil.nombre}
        onCambiarPerfil={() => {
          setPerfilActivo('');
          router.push('/');
        }}
      />

      <section className="px-4 py-6">
        <div className="mb-6 animate-fade-up opacity-0">
          <h1 className="text-headline text-ink">Resumen</h1>
          <p className="text-callout text-ink-muted">Tu progreso de estudio</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 animate-fade-up opacity-0" style={{ animationDelay: '80ms' }}>
          <StatCard label="Promedio" value={`${promedio}%`} icon={BarChart3} trend={promedio >= 65 ? 'up' : 'down'} />
          <StatCard label="Intentos" value={intentosTotales} icon={Target} trend="neutral" />
          <StatCard label="Preguntas" value={preguntasTotales} icon={BookOpen} trend="neutral" />
          <StatCard label="Minutos" value={Math.round(resultados.reduce((a, r) => a + r.duracion_seg, 0) / 60)} icon={Clock} trend="neutral" />
        </div>

        <div className="mb-8 flex gap-3 animate-fade-up opacity-0" style={{ animationDelay: '160ms' }}>
          <button onClick={() => router.push('/diagnostico')} className="btn-primary flex-1">
            Diagnóstico
          </button>
          <button onClick={() => router.push('/simulacro')} className="btn-secondary flex-1">
            Simulacro
          </button>
        </div>

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '240ms' }}>
          Temas del perfil
        </h2>
        <div className="space-y-3">
          {temas.map((tema, i) => {
            const intentosTema = resultados.filter((r) => r.tema_id === tema.id);
            const totalTema = intentosTema.reduce((a, r) => a + r.total, 0);
            const correctasTema = intentosTema.reduce((a, r) => a + r.correctas, 0);
            const promedioTema = totalTema > 0 ? (correctasTema / totalTema) * 100 : 0;
            const totalBanco = preguntas.filter((q) => q.tema_id === tema.id).length;
            return (
              <div
                key={tema.id}
                className="animate-fade-up opacity-0"
                style={{ animationDelay: `${300 + i * 80}ms` }}
              >
                <TopicCard
                  tema={tema}
                  progreso={correctasTema}
                  promedio={promedioTema}
                  totalPreguntas={totalBanco}
                  onClick={() => router.push(`/tema/${tema.clave}`)}
                />
              </div>
            );
          })}
        </div>

        <footer className="mt-12 animate-fade-up opacity-0 text-center" style={{ animationDelay: '600ms' }}>
          <p className="text-caption text-ink-subtle">
            v{version} · build {build}
          </p>
        </footer>
      </section>
    </main>
  );
}
