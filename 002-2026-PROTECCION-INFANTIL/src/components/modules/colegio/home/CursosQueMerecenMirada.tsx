import Link from "next/link";
import type { CursoMirada } from "@/lib/dal/repositories/colegio-resumen";

/**
 * SPEC-143 (US3, FR-007) — Cursos que merecen mirada: hasta 3 cursos ordenados por
 * reportes de los últimos 30 días (métrica D2), con su profesor titular (o "sin
 * titular asignado") y enlace al curso. Sin actividad → copy positivo: ningún
 * curso con reportes recientes. La pantalla termina en un verbo: "mira este curso".
 */

interface CursosQueMerecenMiradaProps {
    cursos: CursoMirada[];
    className?: string;
}

export function CursosQueMerecenMirada({ cursos, className = "" }: CursosQueMerecenMiradaProps) {
    return (
        <section aria-label="Cursos que merecen mirada" className={`glass rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}>
            <h2 className="titular-seccion text-body">Cursos que merecen mirada</h2>

            {cursos.length === 0 ? (
                <p className="cuerpo mt-4 text-muted">
                    Ningún curso con reportes en los últimos 30 días — tus cursos están en calma.
                </p>
            ) : (
                <ol className="mt-4 divide-y divide-tinta/10">
                    {cursos.map((curso, indice) => (
                        <li key={curso.cursoId}>
                            <Link
                                href={`/dashboard/colegio/cursos/${curso.cursoId}`}
                                className="group flex min-h-12 items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-tinta/5"
                            >
                                <span className="cifra microetiqueta w-6 shrink-0" aria-hidden="true">
                                    #{indice + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-body group-hover:text-accent">
                                        {curso.nombre}
                                    </span>
                                    <span className="block text-xs text-subtle">
                                        {curso.profesorTitular ? `Prof. ${curso.profesorTitular}` : "Sin titular asignado"}
                                    </span>
                                </span>
                                <span className="cifra shrink-0 text-sm text-muted">
                                    {curso.alertas30d} {curso.alertas30d === 1 ? "reporte" : "reportes"} · 30 días
                                </span>
                                <span aria-hidden="true" className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">
                                    →
                                </span>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}

            <Link
                href="/dashboard/colegio/cursos"
                className="mt-4 inline-flex min-h-12 items-center rounded-xl px-2 py-2 text-sm font-semibold text-accent transition hover:underline"
            >
                Ver todos los cursos →
            </Link>
        </section>
    );
}
