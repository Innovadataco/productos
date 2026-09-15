'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  Loader2,
  RotateCcw,
  Target,
  TrendingDown,
} from 'lucide-react';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import { AnalisisData, Perfil } from '../../lib/types';
import { getPerfilActivo, getPerfiles } from '../../lib/client-data';

function formatearFecha(ts: number): string {
  return new Date(ts).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

function colorPorPorcentaje(porcentaje: number): string {
  if (porcentaje < 65) return 'text-danger';
  if (porcentaje < 80) return 'text-warning';
  return 'text-success';
}

function barraPorPorcentaje(porcentaje: number): string {
  if (porcentaje < 65) return 'from-danger to-rose-300';
  if (porcentaje < 80) return 'from-warning to-amber-300';
  return 'from-pgn-600 to-pgn-300';
}

function MiniBarra({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${barraPorPorcentaje(porcentaje)} transition-all duration-500 ease-spring`}
        style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
      />
    </div>
  );
}

function GraficoEvolucion({ evolucion }: { evolucion: AnalisisData['evolucion'] }) {
  const datos = useMemo(() => {
    if (evolucion.length <= 1) return evolucion;
    // Si hay muchos días, tomar los últimos 14 para mantener legibilidad móvil.
    return evolucion.slice(-14);
  }, [evolucion]);

  if (datos.length === 0) {
    return (
      <div className="card border-dashed border-ink-subtle/30 p-6 text-center">
        <p className="text-body text-ink-muted">Sin intentos registrados aún.</p>
      </div>
    );
  }

  const width = 320;
  const height = 140;
  const padding = { top: 16, right: 12, bottom: 36, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxPct = Math.max(100, ...datos.map((d) => d.porcentaje));

  const xFor = (i: number) => padding.left + (i / Math.max(1, datos.length - 1)) * chartWidth;
  const yFor = (pct: number) => padding.top + chartHeight - (pct / maxPct) * chartHeight;

  const puntos = datos.map((d, i) => `${xFor(i)},${yFor(d.porcentaje)}`).join(' ');

  return (
    <div className="card overflow-x-auto p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: width }}
      >
        {/* Eje Y */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {/* Eje X */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {/* Líneas de referencia */}
        {[0, 50, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={padding.left}
              y1={yFor(pct)}
              x2={padding.left + chartWidth}
              y2={yFor(pct)}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={yFor(pct) + 4}
              textAnchor="end"
              className="fill-ink-muted text-[10px]"
            >
              {pct}%
            </text>
          </g>
        ))}
        {/* Área bajo la línea */}
        <polygon
          points={`${padding.left},${padding.top + chartHeight} ${puntos} ${padding.left + chartWidth},${padding.top + chartHeight}`}
          fill="rgba(13, 148, 136, 0.1)"
        />
        {/* Línea de evolución */}
        <polyline
          points={puntos}
          fill="none"
          stroke="#0d9488"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Puntos */}
        {datos.map((d, i) => (
          <circle
            key={d.dia}
            cx={xFor(i)}
            cy={yFor(d.porcentaje)}
            r={4}
            fill="#0d9488"
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
        {/* Etiquetas de fecha en X */}
        {datos.map((d, i) => {
          const label = new Date(d.dia).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
          return (
            <text
              key={`label-${d.dia}`}
              x={xFor(i)}
              y={padding.top + chartHeight + 18}
              textAnchor="middle"
              className="fill-ink-muted text-[9px]"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function AnalisisPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [data, setData] = useState<AnalisisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }

    getPerfiles()
      .then((perfiles) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        if (!p) {
          router.replace('/');
          return;
        }
        setPerfil(p);
        return fetch(`/api/analisis?perfil_codigo=${encodeURIComponent(codigo)}`);
      })
      .then(async (res) => {
        if (!res) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        const json = (await res.json()) as AnalisisData;
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando análisis'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !perfil) {
    return (
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="page-shell">
        <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
        <section className="px-4 py-6 text-center">
          <div className="card p-6">
            <AlertTriangle size={32} className="mx-auto mb-3 text-danger" />
            <p className="text-body text-ink">No se pudo cargar el análisis.</p>
            <p className="mt-1 text-footnote text-ink-muted">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary mt-4 inline-flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Reintentar
            </button>
          </div>
        </section>
      </main>
    );
  }

  const hayIntentos = data.intentos_totales > 0;

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />

      <section className="px-4 py-6">
        <div className="mb-6 animate-fade-up opacity-0">
          <h1 className="text-headline text-ink">Análisis de desempeño</h1>
          <p className="text-callout text-ink-muted">Dónde estás perdiendo puntos y qué repasar</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 animate-fade-up opacity-0" style={{ animationDelay: '80ms' }}>
          <StatCard
            label="Promedio general"
            value={`${data.promedio_general}%`}
            icon={Target}
            trend={data.promedio_general >= 65 ? 'up' : 'down'}
          />
          <StatCard
            label="Intentos"
            value={data.intentos_totales}
            icon={BarChart3}
            trend={data.intentos_totales > 0 ? 'up' : 'neutral'}
          />
          <StatCard
            label="Preguntas"
            value={`${data.total_correctas}/${data.total_preguntas}`}
            sub="correctas"
            icon={BookOpen}
            trend={data.promedio_general >= 65 ? 'up' : 'down'}
          />
          <StatCard
            label="Temas débiles"
            value={data.temas_debiles.length}
            icon={AlertTriangle}
            trend={data.temas_debiles.length === 0 ? 'up' : 'down'}
          />
        </div>

        {!hayIntentos && (
          <div className="card mb-6 border-dashed border-ink-subtle/30 p-6 text-center animate-fade-up opacity-0" style={{ animationDelay: '120ms' }}>
            <p className="text-body text-ink-muted">Aún no tienes intentos registrados.</p>
            <p className="mt-1 text-footnote text-ink-muted">Haz quizzes o un simulacro para ver tu análisis.</p>
          </div>
        )}

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '160ms' }}>
          Promedio por tema
        </h2>
        <div className="grid gap-3">
          {data.temas.map((t, i) => {
            const debil = t.intentos > 0 && (t.porcentaje ?? 0) < 65;
            return (
              <div
                key={t.tema_id}
                className={`card p-4 animate-fade-up opacity-0 ${debil ? 'border-danger/20 bg-danger/[0.03]' : ''}`}
                style={{ animationDelay: `${200 + i * 40}ms` }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-title-2 font-semibold text-ink ${debil ? 'text-danger' : ''}`}>
                        {t.nombre}
                      </span>
                      {debil && <TrendingDown size={16} className="shrink-0 text-danger" />}
                    </div>
                    <p className="text-footnote text-ink-muted">
                      {t.intentos === 0 ? 'Sin intentos' : `${t.intentos} intento${t.intentos === 1 ? '' : 's'}`}
                      {t.ultimo_intento ? ` · último ${formatearFecha(t.ultimo_intento)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-title-1 font-bold ${colorPorPorcentaje(t.porcentaje ?? 0)}`}>
                      {t.intentos > 0 ? `${t.porcentaje}%` : '—'}
                    </span>
                    {t.ultimo_puntaje !== null && t.ultimo_puntaje !== undefined && (
                      <p className="text-footnote text-ink-muted">último {t.ultimo_puntaje}%</p>
                    )}
                  </div>
                </div>
                <MiniBarra porcentaje={t.intentos > 0 ? t.porcentaje ?? 0 : 0} />
              </div>
            );
          })}
        </div>

        {data.temas_debiles.length > 0 && (
          <>
            <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '240ms' }}>
              Temas a reforzar (&lt; 65%)
            </h2>
            <div className="space-y-3 animate-fade-up opacity-0" style={{ animationDelay: '280ms' }}>
              {data.temas_debiles.map((t) => (
                <div
                  key={`debil-${t.tema_id}`}
                  className="glass flex items-center justify-between gap-3 border-danger/20 bg-danger/10 p-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/20">
                      <TrendingDown size={20} className="text-danger" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-title-2 font-semibold text-ink truncate">{t.nombre}</p>
                      <p className="text-footnote text-ink-muted">{t.intentos} intentos</p>
                    </div>
                  </div>
                  <span className="text-title-1 font-bold text-danger">{t.porcentaje}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        {data.normas_error.length > 0 && (
          <>
            <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '320ms' }}>
              Normas a repasar
            </h2>
            <div className="space-y-3 animate-fade-up opacity-0" style={{ animationDelay: '360ms' }}>
              {data.normas_error.map((n, i) => (
                <div
                  key={n.norma}
                  className="card p-4 animate-fade-up opacity-0"
                  style={{ animationDelay: `${400 + i * 40}ms` }}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-title-2 font-semibold text-ink">{n.norma}</p>
                    <span className="text-title-2 font-bold text-danger">{n.tasa_error}% error</span>
                  </div>
                  <MiniBarra porcentaje={n.tasa_error} />
                  <p className="mt-2 text-footnote text-ink-muted">
                    {n.falladas} fallos de {n.intentos} intentos
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {data.preguntas_falladas.length > 0 && (
          <>
            <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '400ms' }}>
              Preguntas falladas más de una vez
            </h2>
            <div className="space-y-3 animate-fade-up opacity-0" style={{ animationDelay: '440ms' }}>
              {data.preguntas_falladas.map((p, i) => (
                <div
                  key={p.pregunta_id}
                  className="card p-4 animate-fade-up opacity-0"
                  style={{ animationDelay: `${480 + i * 40}ms` }}
                >
                  <p className="text-body text-ink line-clamp-2">{p.enunciado}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-footnote text-ink-muted">{p.tema_nombre}</span>
                    <span className="rounded-full bg-danger/10 px-2.5 py-1 text-footnote font-semibold text-danger">
                      {p.veces} veces
                    </span>
                  </div>
                  {p.norma && <p className="mt-2 text-footnote text-pgn-700">{p.norma}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '480ms' }}>
          Evolución temporal
        </h2>
        <div className="animate-fade-up opacity-0" style={{ animationDelay: '520ms' }}>
          <GraficoEvolucion evolucion={data.evolucion} />
        </div>

        {data.evolucion.length > 0 && (
          <div className="mt-4 space-y-2 animate-fade-up opacity-0" style={{ animationDelay: '560ms' }}>
            {data.evolucion.slice(-5).reverse().map((e) => (
              <div
                key={e.dia}
                className="card flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-2 text-footnote text-ink-muted">
                  <Calendar size={14} className="text-pgn-600" />
                  {new Date(e.dia).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
                  <span className="rounded-full bg-surface px-2 py-0.5 text-caption text-ink-muted">
                    {e.intentos} intento{e.intentos === 1 ? '' : 's'}
                  </span>
                </div>
                <span className={`text-title-2 font-bold ${colorPorPorcentaje(e.porcentaje)}`}>
                  {e.porcentaje}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
