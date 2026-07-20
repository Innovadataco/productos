"use client";

import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ResultadoCaso } from "./types";

interface TablaResultadosSimulacionProps {
    resultados: ResultadoCaso[];
}

export function TablaResultadosSimulacion({ resultados }: TablaResultadosSimulacionProps) {
    if (resultados.length === 0) {
        return (
            <GlassCard className="p-5 text-center">
                <p className="text-sm text-muted">No hay resultados disponibles todavía.</p>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="p-5 overflow-auto">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 px-2 text-left text-muted">#</th>
                        <th className="py-2 px-2 text-left text-muted">Identificador</th>
                        <th className="py-2 px-2 text-left text-muted">Esperada</th>
                        <th className="py-2 px-2 text-left text-muted">Asignada</th>
                        <th className="py-2 px-2 text-left text-muted">Confianza</th>
                        <th className="py-2 px-2 text-left text-muted">Estado</th>
                        <th className="py-2 px-2 text-left text-muted">Latencia</th>
                        <th className="py-2 px-2 text-left text-muted">Acierto</th>
                    </tr>
                </thead>
                <tbody>
                    {resultados.map((r) => (
                        <tr key={r.indice} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-2 text-body">{r.indice}</td>
                            <td className="py-2 px-2 font-mono text-xs text-muted">{r.identificador}</td>
                            <td className="py-2 px-2">
                                <Badge variant="neutral">{r.categoriaEsperada ?? "N/A"}</Badge>
                            </td>
                            <td className="py-2 px-2">
                                <Badge variant={r.categoriaAsignada === "DESCONOCIDA" ? "warning" : "default"}>
                                    {r.categoriaAsignada}
                                </Badge>
                            </td>
                            <td className="py-2 px-2 text-muted">
                                {r.confianza !== null ? r.confianza.toFixed(2) : "N/A"}
                            </td>
                            <td className="py-2 px-2">
                                <Badge
                                    variant={
                                        r.estado === "CLASIFICADO"
                                            ? "success"
                                            : r.estado === "REVISION_MANUAL" || r.estado === "POSIBLE_SPAM"
                                              ? "warning"
                                              : r.estado === "FALLIDA"
                                                ? "danger"
                                                : "neutral"
                                    }
                                >
                                    {r.estado}
                                </Badge>
                            </td>
                            <td className="py-2 px-2 text-muted">
                                {r.latenciaMs !== null ? `${r.latenciaMs}ms` : "N/A"}
                            </td>
                            <td className="py-2 px-2">
                                {r.acierto === null ? (
                                    <span className="text-muted">N/A</span>
                                ) : r.acierto ? (
                                    <Badge variant="success">Sí</Badge>
                                ) : (
                                    <Badge variant="danger">No</Badge>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </GlassCard>
    );
}
