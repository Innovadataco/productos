'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import ProgressBar from '../../components/ProgressBar';
import { Perfil, Resultado, Tema } from '../../lib/types';
import { getPerfilActivo, getPerfiles, getResultados, getTemas } from '../../lib/client-data';
import { AlertTriangle, TrendingDown, BookOpen, Calendar } from 'lucide-react';

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
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Cargando análisis...</p>
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

  const temasDebiles = statsPorTema.filter((s) => s.promedio < 65 && s.intentos > 0).sort((a, b) => a.promedio - b.promedio);

  const evolucion = resultados.slice(0, 10).map((r) => ({
    fecha: new Date(r.created_at).toLocaleDateString('es-CO'),
    puntaje: r.total > 0 ? Math.round((r.correctas / r.total) * 100) : 0,
  }));

  return (
    <main className="min-h-screen pb-8">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
      <section className="px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">Análisis de desempeño</h1>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="Promedio general" value={`${Math.round(promedioGeneral)}%`} icon={BookOpen} trend={promedioGeneral >= 65 ? 'up' : 'down'} />
          <StatCard label="Temas débiles" value={temasDebiles.length} icon={AlertTriangle} trend={temasDebiles.length ? 'down' : 'up'} />
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-slate-900">Promedio por tema</h2>
          <div className="mt-3 space-y-3">
            {statsPorTema.map((s) => (
              <div key={s.tema.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{s.tema.nombre}</span>
                  <span className="text-slate-500">{s.intentos} intentos · {Math.round(s.promedio)}%</span>
                </div>
                <ProgressBar actual={s.intentos > 0 ? Math.round(s.promedio) : 0} total={100} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-slate-900">Temas debajo de 65%</h2>
          <div className="mt-3 space-y-2">
            {temasDebiles.length === 0 && <p className="text-sm text-slate-500">No tienes temas debajo del umbral.</p>}
            {temasDebiles.map((s) => (
              <div key={s.tema.id} className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3">
                <TrendingDown size={16} className="text-red-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.tema.nombre}</p>
                  <p className="text-xs text-slate-500">Promedio {Math.round(s.promedio)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-slate-900">Evolución temporal</h2>
          <div className="mt-3 space-y-2">
            {evolucion.length === 0 && <p className="text-sm text-slate-500">Sin intentos registrados aún.</p>}
            {evolucion.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={14} className="text-pgn-500" />
                  {e.fecha}
                </div>
                <span className="font-bold text-slate-900">{e.puntaje}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
