"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { EstadisticasCurso } from "@/lib/colegio/estadisticas";

interface TablaDesgloseCursosProps {
    cursos: EstadisticasCurso[];
}

export function TablaDesgloseCursos({ cursos }: TablaDesgloseCursosProps) {
    return (
        <GlassCard>
            <h2 className="mb-4 text-lg font-semibold text-body">Desglose por curso</h2>
            {cursos.length === 0 ? (
                <p className="text-sm text-muted">No hay cursos registrados en este colegio.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-emerald-100 dark:border-emerald-900/30">
                                <th className="py-3 pr-4 font-semibold text-subtle">Curso</th>
                                <th className="py-3 pr-4 font-semibold text-subtle">Grado</th>
                                <th className="py-3 pr-4 text-right font-semibold text-subtle">Estudiantes</th>
                                <th className="py-3 pr-4 text-right font-semibold text-subtle">Identificadores</th>
                                <th className="py-3 text-right font-semibold text-subtle">Alertas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cursos.map((curso) => (
                                <tr key={curso.cursoId} className="border-b border-emerald-50 dark:border-emerald-950/20 last:border-b-0">
                                    <td className="py-3 pr-4 text-body">{curso.nombre}</td>
                                    <td className="py-3 pr-4 text-muted">{curso.grado ?? "—"}</td>
                                    <td className="py-3 pr-4 text-right text-body">{curso.alumnos}</td>
                                    <td className="py-3 pr-4 text-right text-body">{curso.identificadores}</td>
                                    <td className="py-3 text-right text-body">{curso.alertas}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </GlassCard>
    );
}
