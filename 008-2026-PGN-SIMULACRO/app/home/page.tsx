'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Target, Clock, BookOpen, Loader2 } from 'lucide-react';
import Header from '../../components/Header';
import TopicCard from '../../components/TopicCard';
import StatCard from '../../components/StatCard';
import { Perfil, Tema, Resultado } from '../../lib/types';
import { getPerfilActivo, setPerfilActivo, getPerfiles, getTemas, getResultados } from '../../lib/client-data';

export default function HomePage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }

    Promise.all([getPerfiles(), getTemas(), getResultados()])
      .then(([perfiles, allTemas, allResultados]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        if (!p) {
          router.replace('/');
          return;
        }
        setPerfil(p);
        setTemas(allTemas.filter((t) => t.perfil_codigo === codigo));
        setResultados(allResultados.filter((r) => r.perfil_codigo === codigo));
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !perfil) {
    return (
      <main className="ios-page flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-ios-primary" />
      </main>
    );
  }

  const intentosTotales = resultados.length;
  const correctasTotales = resultados.reduce((acc, r) => acc + r.correctas, 0);
  const preguntasTotales = resultados.reduce((acc, r) => acc + r.total, 0);
  const promedio = preguntasTotales > 0 ? Math.round((correctasTotales / preguntasTotales) * 100) : 0;

  return (
    <main className="ios-page">
      <Header
        perfilCodigo={perfil.codigo}
        perfilNombre={perfil.nombre}
        onCambiarPerfil={() => {
          setPerfilActivo('');
          router.push('/');
        }}
      />

      <section className="py-6">
        <div className="ios-content mb-6">
          <h1 className="text-ios-title-2 text-ios-label">Resumen</h1>
          <p className="text-ios-subhead text-ios-label-secondary">Tu progreso de estudio</p>
        </div>

        <div className="ios-content mb-6 grid grid-cols-2 gap-3">
          <StatCard label="Promedio" value={`${promedio}%`} icon={BarChart3} trend={promedio >= 65 ? 'up' : 'down'} />
          <StatCard label="Intentos" value={intentosTotales} icon={Target} trend="neutral" />
          <StatCard label="Preguntas" value={preguntasTotales} icon={BookOpen} trend="neutral" />
          <StatCard label="Minutos" value={Math.round(resultados.reduce((a, r) => a + r.duracion_seg, 0) / 60)} icon={Clock} trend="neutral" />
        </div>

        <div className="ios-content mb-8 flex gap-3">
          <button onClick={() => router.push('/diagnostico')} className="ios-button flex-1">
            Diagnóstico
          </button>
          <button onClick={() => router.push('/simulacro')} className="ios-button-secondary flex-1">
            Simulacro
          </button>
        </div>

        <h2 className="ios-section-title">Temas del perfil</h2>
        <div className="ios-content space-y-3">
          {temas.map((tema) => {
            const intentosTema = resultados.filter((r) => r.tema_id === tema.id);
            const totalTema = intentosTema.reduce((a, r) => a + r.total, 0);
            const correctasTema = intentosTema.reduce((a, r) => a + r.correctas, 0);
            const promedioTema = totalTema > 0 ? (correctasTema / totalTema) * 100 : 0;
            return (
              <TopicCard
                key={tema.id}
                tema={tema}
                progreso={correctasTema}
                promedio={promedioTema}
                totalPreguntas={0}
                onClick={() => router.push(`/tema/${tema.clave}`)}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
