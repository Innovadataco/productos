"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ComparativaCursos } from "@/lib/colegio/comparativa";

type Criterio = "grado" | "anioLectivo";

interface SeccionComparativaProps {
    comparativa: ComparativaCursos;
    onCambiarCriterio: (criterio: Criterio) => void;
}

export function SeccionComparativa({ comparativa, onCambiarCriterio }: SeccionComparativaProps) {
    const [criterio, setCriterio] = useState<Criterio>(comparativa.agruparPor);

    const cambiar = (nuevo: Criterio) => {
        setCriterio(nuevo);
        onCambiarCriterio(nuevo);
    };

    return (
        <GlassCard>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">Comparativa entre cursos</h2>
                    <p className="text-sm text-muted">Agrupado por {criterio === "grado" ? "grado" : "año lectivo"}</p>
                </div>
                <div role="group" aria-label="Criterio de agrupación" className="flex gap-1">
                    <button
                        type="button"
                        aria-pressed={criterio === "grado"}
                        onClick={() => cambiar("grado")}
                        className={`min-h-12 rounded-xl px-4 py-2 text-sm font-medium transition ${
                            criterio === "grado" ? "accent-gradient text-white shadow-sm" : "text-muted hover:text-body"
                        }`}
                    >
                        Grado
                    </button>
                    <button
                        type="button"
                        aria-pressed={criterio === "anioLectivo"}
                        onClick={() => cambiar("anioLectivo")}
                        className={`min-h-12 rounded-xl px-4 py-2 text-sm font-medium transition ${
                            criterio === "anioLectivo" ? "accent-gradient text-white shadow-sm" : "text-muted hover:text-body"
                        }`}
                    >
                        Año lectivo
                    </button>
                </div>
            </div>

            {comparativa.grupos.length === 0 ? (
                <p className="text-sm text-muted">No hay cursos para comparar.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-pino/20">
                                <th className="py-3 pr-4 font-semibold text-subtle">{criterio === "grado" ? "Grado" : "Año lectivo"}</th>
                                <th className="py-3 pr-4 text-right font-semibold text-subtle">Cursos</th>
                                <th className="py-3 pr-4 text-right font-semibold text-subtle">Estudiantes</th>
                                <th className="py-3 pr-4 text-right font-semibold text-subtle">Identificadores</th>
                                <th className="py-3 pr-4 text-right font-semibold text-subtle">Alertas</th>
                                <th className="py-3 text-right font-semibold text-subtle">Prom. estudiantes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparativa.grupos.map((grupo) => (
                                <tr key={grupo.grupo} className="border-b border-pino/10 last:border-b-0">
                                    <td className="py-3 pr-4 text-body">{grupo.grupo}</td>
                                    <td className="py-3 pr-4 text-right text-body">{grupo.cursos}</td>
                                    <td className="py-3 pr-4 text-right text-body">{grupo.estudiantes}</td>
                                    <td className="py-3 pr-4 text-right text-body">{grupo.identificadores}</td>
                                    <td className="py-3 pr-4 text-right text-body">{grupo.alertas}</td>
                                    <td className="py-3 text-right text-body">{grupo.promedioEstudiantes}</td>
                                </tr>
                            ))}
                            <tr className="font-semibold">
                                <td className="py-3 pr-4 text-body">Total</td>
                                <td className="py-3 pr-4 text-right text-body">{comparativa.totales.cursos}</td>
                                <td className="py-3 pr-4 text-right text-body">{comparativa.totales.estudiantes}</td>
                                <td className="py-3 pr-4 text-right text-body">{comparativa.totales.identificadores}</td>
                                <td className="py-3 pr-4 text-right text-body">{comparativa.totales.alertas}</td>
                                <td className="py-3 text-right text-body">—</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </GlassCard>
    );
}
