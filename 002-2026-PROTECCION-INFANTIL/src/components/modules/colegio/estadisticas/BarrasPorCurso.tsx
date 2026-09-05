import Link from "next/link";
import type { CSSProperties } from "react";
import type { BarraCurso } from "@/lib/dal/repositories/colegio-resumen";

/**
 * SPEC-158 (T006, US3, FR-005) — Barras por curso: el top por curso reusado de
 * la home (30 días, métrica D2, límite alto) como lista de barras con nombre y
 * enlace a la vista del curso (SPEC-147). La barra es SVG propio que se dibuja
 * al entrar con la curva única (anim-dibujo, dashoffset) — reduced-motion la
 * deja completa sin animación. Sin actividad → copy positivo. La pantalla
 * termina en un verbo: "mira este curso".
 */

interface BarrasPorCursoProps {
    cursos: BarraCurso[];
    className?: string;
}

const ANCHO = 200;
const ALTO = 8;
const MARGEN = 4;

export function BarrasPorCurso({ cursos, className = "" }: BarrasPorCursoProps) {
    const maximo = Math.max(0, ...cursos.map((c) => c.reportes30d));

    return (
        <section aria-label="Cursos con más reportes" className={`glass rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}>
            <h2 className="titular-seccion text-body">¿Dónde poner la atención?</h2>
            <p className="mt-1 text-sm text-muted">Reportes por curso · últimos 30 días</p>

            {cursos.length === 0 ? (
                <p className="cuerpo mt-4 text-muted">
                    Ningún curso con reportes en los últimos 30 días — sus cursos están en calma.
                </p>
            ) : (
                <ol className="mt-4 space-y-1">
                    {cursos.map((curso, indice) => {
                        const largo = maximo > 0 ? (curso.reportes30d / maximo) * (ANCHO - MARGEN * 2) : 0;
                        return (
                            <li key={curso.cursoId}>
                                <Link
                                    href={`/dashboard/colegio/cursos/${curso.cursoId}`}
                                    className="group block min-h-12 rounded-xl px-2 py-2 transition hover:bg-tinta/5"
                                >
                                    <span className="flex items-baseline justify-between gap-3">
                                        <span className="truncate text-sm font-semibold text-body group-hover:text-accent">
                                            {curso.nombre}
                                        </span>
                                        <span className="cifra shrink-0 text-sm text-muted">
                                            {curso.reportes30d} {curso.reportes30d === 1 ? "reporte" : "reportes"}
                                        </span>
                                    </span>
                                    <svg
                                        viewBox={`0 0 ${ANCHO} ${ALTO}`}
                                        preserveAspectRatio="none"
                                        className="mt-1.5 h-2 w-full"
                                        aria-hidden="true"
                                    >
                                        {/* Riel: la escala completa (el curso con más reportes). */}
                                        <line
                                            x1={MARGEN}
                                            y1={ALTO / 2}
                                            x2={ANCHO - MARGEN}
                                            y2={ALTO / 2}
                                            strokeWidth={ALTO}
                                            strokeLinecap="round"
                                            className="stroke-tinta opacity-10"
                                        />
                                        <line
                                            data-barra={curso.cursoId}
                                            x1={MARGEN}
                                            y1={ALTO / 2}
                                            x2={MARGEN + largo}
                                            y2={ALTO / 2}
                                            strokeWidth={ALTO}
                                            strokeLinecap="round"
                                            strokeDasharray={largo}
                                            strokeDashoffset={0}
                                            className="anim-dibujo stroke-cielo"
                                            style={{ "--dash-inicial": largo, "--anim-retardo": `${indice * 60}ms` } as CSSProperties}
                                        />
                                    </svg>
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
