'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, TrendingDown, BookOpen, Calendar, Loader2 } from 'lucide-react';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import ProgressBar from '../../components/ProgressBar';
import { Perfil, Resultado, Tema } from '../../lib/types';
import { getPerfilActivo, getPerfiles, getResultados, getTemas } from '../../lib/client-data';

export default function AnalisisPage() {
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
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" />
      </main>
    );
  }

  const correctasTotales = resultados.reduce((a, r) => a + r.correctas, 0);
  const preguntasTotales = resultados.reduce((a, r) => a + r.total, 0);
  const promedioGeneral = preguntasTotales > 0 ? (correctasTotales / preguntasTotales) * 100 : 0;

  const statsPorTema = temas.map((tema) => {
    const intentos = resultados.filter((r) => r.tema_id === tema.id);
    const total = intentos.reduce((a, r) => a + r.total, 0);
    const correctas = intentos.reduce((a, r) => a + r.correctas, 0);
    const promedio = total > 0 ? (correctas / total) * 100 : 0;
    return { tema, intentos: intentos.length, promedio };
  });

  const temasDebiles = statsPorTema
    .filter((s) => s.promedio < 65 && s.intentos > 0)
    .sort((a, b) => a.promedio - b.promedio);

  const evolucion = resultados.slice(0, 10).map((r) => ({
    fecha: new Date(r.created_at).toLocaleDateString('es-CO'),
    puntaje: r.total > 0 ? Math.round((r.correctas / r.total) * 100) : 0,
  }));

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />

      <section className="px-4 py-6">
        <div className="mb-6 animate-fade-up opacity-0">
          <h1 className="text-headline text-ink">Análisis de desempeño</h1>
          <p className="text-callout text-ink-muted">Revisa tu progreso y áreas de mejora</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 animate-fade-up opacity-0" style={{ animationDelay: '80ms' }}>
          <StatCard label="Promedio general" value={`${Math.round(promedioGeneral)}%`} icon={BookOpen} trend={promedioGeneral >= 65 ? 'up' : 'down'} />
          <StatCard label="Temas débiles" value={temasDebiles.length} icon={AlertTriangle} trend={temasDebiles.length ? 'down' : 'up'} />
        </div>

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '160ms' }}>
          Promedio por tema
        </h2>
        <div className="space-y-3">
          {statsPorTema.map((s, i) => (
            <div
              key={s.tema.id}
              className="card p-4 animate-fade-up opacity-0"
              style={{ animationDelay: `${200 + i * 60}ms` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-title-2 font-semibold text-ink">{s.tema.nombre}</span>
                <span className="text-footnote text-ink-muted">{s.intentos} intentos · {Math.round(s.promedio)}%</span>
              </div>
              <ProgressBar actual={s.intentos > 0 ? Math.round(s.promedio) : 0} total={100} />
            </div>
          ))}
        </div>

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '240ms' }}>
          Temas debajo de 65%
        </h2>
        <div className="space-y-3 animate-fade-up opacity-0" style={{ animationDelay: '280ms' }}>
          {temasDebiles.length === 0 && (
            <div className="card border-dashed border-ink-subtle/30 p-6 text-center">
              <p className="text-body text-ink-muted">No tienes temas debajo del umbral.</p>
            </div>
          )}
          {temasDebiles.map((s) => (
            <div key={s.tema.id} className="glass flex items-center gap-3 bg-danger/10 p-4">
              <TrendingDown size={20} className="text-danger" />
              <div>
                <p className="text-title-2 font-semibold text-ink">{s.tema.nombre}</p>
                <p className="text-footnote text-ink-muted">Promedio {Math.round(s.promedio)}%</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '320ms' }}>
          Evolución temporal
        </h2>
        <div className="space-y-3">
          {evolucion.length === 0 && (
            <div className="card border-dashed border-ink-subtle/30 p-6 text-center animate-fade-up opacity-0" style={{ animationDelay: '360ms' }}>
              <p className="text-body text-ink-muted">Sin intentos registrados aún.</p>
            </div>
          )}
          {evolucion.map((e, i) => (
            <div
              key={i}
              className="card flex items-center justify-between p-4 animate-fade-up opacity-0"
              style={{ animationDelay: `${360 + i * 60}ms` }}
            >
              <div className="flex items-center gap-3 text-body text-ink-muted">
                <Calendar size={18} className="text-pgn-600" />
                {e.fecha}
              </div>
              <span className="text-title-1 text-ink">{e.puntaje}%</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
