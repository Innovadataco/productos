"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Accordion } from "@/components/ui/Accordion";

type LogContextoModalProps = {
    isOpen: boolean;
    onClose: () => void;
    contextoJson: unknown;
};

type ContextoObjeto = Record<string, unknown>;

type ReglaHumanizacion = (contexto: ContextoObjeto) => string | null;

function esObjeto(valor: unknown): valor is ContextoObjeto {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function extraerString(valor: unknown): string | undefined {
    return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}

function pluralizarRegistros(cantidad: number): string {
    return `${cantidad} registro${cantidad === 1 ? "" : "s"}`;
}

const reglaSignal: ReglaHumanizacion = (contexto) => {
    const signal = extraerString(contexto.signal);
    if (signal === "SIGTERM") return "Worker recibió señal de cierre normal";
    if (signal === "SIGKILL") return "Worker fue terminado forzosamente";
    return null;
};

const reglaReporteId: ReglaHumanizacion = (contexto) => {
    const reporteId = extraerString(contexto.reporteId);
    if (reporteId) return `Procesando reporte ${reporteId}`;
    return null;
};

const reglaError: ReglaHumanizacion = (contexto) => {
    const errorMsg = extraerString(contexto.error) ?? extraerString(contexto.message);
    const stack = extraerString(contexto.stack);
    const servicio = extraerString(contexto.servicio) ?? extraerString(contexto.service);
    if (!errorMsg && !stack) return null;
    const prefijo = servicio ? `Error ejecutando ${servicio}` : "Error ejecutando el servicio";
    return errorMsg ? `${prefijo}: ${errorMsg}` : prefijo;
};

const reglaPurga: ReglaHumanizacion = (contexto) => {
    const filasBorradas = typeof contexto.filasBorradas === "number" ? contexto.filasBorradas : undefined;
    const motivo = extraerString(contexto.motivo);
    if (filasBorradas === undefined && !motivo) return null;
    if (filasBorradas !== undefined && motivo) {
        return `Purga de logs completada: ${pluralizarRegistros(filasBorradas)} eliminados (${motivo})`;
    }
    if (filasBorradas !== undefined) {
        return `Purga de logs completada: ${pluralizarRegistros(filasBorradas)} eliminados`;
    }
    return `Purga de logs solicitada: ${motivo}`;
};

const reglaJobId: ReglaHumanizacion = (contexto) => {
    const jobId = extraerString(contexto.jobId);
    if (jobId) return `Trabajo encolado ${jobId}`;
    return null;
};

const reglaTarea: ReglaHumanizacion = (contexto) => {
    const duracionMs = typeof contexto.duracionMs === "number" ? contexto.duracionMs : undefined;
    const tarea = extraerString(contexto.tarea);
    if (duracionMs === undefined && !tarea) return null;
    const partes: string[] = [];
    partes.push(tarea ? `Tarea "${tarea}"` : "Tarea");
    partes.push(duracionMs !== undefined ? `completada en ${duracionMs} ms` : "completada");
    return partes.join(" ");
};

const REGLAS: ReglaHumanizacion[] = [reglaSignal, reglaReporteId, reglaError, reglaPurga, reglaJobId, reglaTarea];

/**
 * Convierte el contexto técnico de un WorkerLog en una descripción legible
 * para operadores. Si no reconoce el patrón, devuelve null y se muestra solo
 * el JSON como debug.
 */
function humanizarContexto(contexto: unknown): string | null {
    if (!esObjeto(contexto)) return null;
    for (const regla of REGLAS) {
        const mensaje = regla(contexto);
        if (mensaje) return mensaje;
    }
    return null;
}

export function LogContextoModal({ isOpen, onClose, contextoJson }: LogContextoModalProps) {
    const [seccionesAbiertas, setSeccionesAbiertas] = useState<string[]>([]);

    const mensajeHumano = useMemo(() => humanizarContexto(contextoJson), [contextoJson]);
    const tieneContexto = contextoJson !== null && contextoJson !== undefined;
    const jsonFormateado = useMemo(() => JSON.stringify(contextoJson, null, 2), [contextoJson]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Contexto del log" size="lg">
            <div className="space-y-4">
                {!tieneContexto ? (
                    <p className="text-sm text-subtle">No hay contexto adicional para este log.</p>
                ) : (
                    <>
                        {mensajeHumano ? (
                            <div className="rounded-xl bg-tinta/10 p-4 dark:bg-tinta/20">
                                <p className="text-sm font-medium text-body">{mensajeHumano}</p>
                            </div>
                        ) : null}
                        <Accordion
                            secciones={[
                                {
                                    id: "debug",
                                    titulo: "Contexto técnico (debug)",
                                    contenido: (
                                        <div className="rounded-xl bg-tinta/90 p-4 dark:bg-tinta/95">
                                            <pre className="max-h-[40vh] overflow-auto text-xs text-fondo font-mono">
                                                {jsonFormateado}
                                            </pre>
                                        </div>
                                    ),
                                },
                            ]}
                            abiertos={seccionesAbiertas}
                            onToggle={(id) =>
                                setSeccionesAbiertas((prev) =>
                                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                                )
                            }
                        />
                    </>
                )}
            </div>
        </Modal>
    );
}
