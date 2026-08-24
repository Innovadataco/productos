"use client";

import { useState } from "react";
import { ExpedienteCard } from "./ExpedienteCard";
import { AutoSuggestExpediente } from "./AutoSuggestExpediente";
import { grupoEstado, debeMostrarAutoSuggest } from "@/lib/padre/expediente-ui";
import type { EstadoExpediente, ScoreGravedad } from "@prisma/client";

interface ExpedienteItem {
    id: string;
    identificadorReportado: string;
    estado: EstadoExpediente;
    scoreGravedadActual: ScoreGravedad;
    fechaApertura: Date;
    ultimoEventoEn: Date | null;
    numEventos: number;
}

type FiltroEstado = "todos" | "activos" | "en_revision" | "cerrados";

export function ExpedientesListClient({ expedientes }: { expedientes: ExpedienteItem[] }) {
    const [filtro, setFiltro] = useState<FiltroEstado>("todos");

    const filtrados = expedientes.filter((exp) => {
        if (filtro === "todos") return true;
        return grupoEstado(exp.estado) === filtro;
    });

    const expedienteActivoParaSugerir = expedientes.find(
        (exp) => exp.estado === "ACTIVO" && debeMostrarAutoSuggest(exp.ultimoEventoEn)
    );

    return (
        <div>
            {expedienteActivoParaSugerir && (
                <AutoSuggestExpediente
                    expedienteId={expedienteActivoParaSugerir.id}
                    identificadorReportado={expedienteActivoParaSugerir.identificadorReportado}
                    ultimoEventoEn={expedienteActivoParaSugerir.ultimoEventoEn}
                />
            )}

            <div className="mb-6 flex flex-wrap gap-2">
                {(
                    [
                        { key: "todos", label: "Todos" },
                        { key: "activos", label: "Activos" },
                        { key: "en_revision", label: "En revisión" },
                        { key: "cerrados", label: "Cerrados" },
                    ] as const
                ).map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setFiltro(f.key)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            filtro === f.key
                                ? "bg-sky-600 text-white shadow-lg shadow-sky-500/25"
                                : "text-sky-900/70 hover:bg-sky-100 hover:text-sky-900 dark:text-sky-200/70 dark:hover:bg-sky-900/40 dark:hover:text-sky-100"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {filtrados.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-muted">No tienes expedientes en este estado.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtrados.map((exp) => (
                        <ExpedienteCard
                            key={exp.id}
                            id={exp.id}
                            identificadorReportado={exp.identificadorReportado}
                            estado={exp.estado}
                            scoreGravedadActual={exp.scoreGravedadActual}
                            fechaApertura={exp.fechaApertura}
                            ultimoEventoEn={exp.ultimoEventoEn}
                            numEventos={exp.numEventos}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
