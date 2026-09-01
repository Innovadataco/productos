/**
 * SPEC-341 (T034 · FR-021/022/023/026/027) — sección "Análisis detallado"
 * bajo el mapa del expediente vivo.
 *
 * Consumidor único de GET/POST /api/padre/expedientes/[id]/analisis. Polling
 * cada 15 s mientras el estado sea GENERANDO (R-7 del research). Cuando llega
 * PUBLICADO, corta el polling. Muestra:
 *  · vigente + sello del corte + etiqueta "análisis asistido"
 *  · guía "Qué puedes hacer ahora" desde GuiaAccionCategoria publicada
 *  · aviso "Hay N hechos nuevos desde este análisis" cuando el hash difiere
 *  · botón "Actualizar análisis" con cool-down (deshabilitado durante GENERANDO)
 *  · banner ExpedienteGenerando cuando no hay vigente o hash cambió
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ExpedienteGenerando } from "./ExpedienteGenerando";

interface GuiaAccionResumen {
    id: string;
    tituloEmocional: string;
    pasos: unknown;
}

interface AnalisisVigenteDto {
    versionSecuencial: number;
    texto: string;
    corteN: number;
    categoriaDominante: string | null;
    generadoEn: string;
    guiaAccion: GuiaAccionResumen | null;
}

interface EvaluacionDto {
    vigente: AnalisisVigenteDto | null;
    hashActual: string;
    coincide: boolean;
    hechosNuevosDesde: number;
    estado: "PUBLICADO" | "GENERANDO" | "FALLIDO" | "SIN_ANALISIS";
    cola: { posicion: number; estimadoSeg: number } | null;
    colaLlena: boolean;
    cooldown: { puedeActualizar: boolean; faltanSeg: number };
    agotadoPorFallos: boolean;
    ultimoMotivoFallo: string | null;
}

const POLL_INTERVAL_MS = 15_000;

const fmtFecha = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
});

function pasosDeGuia(pasos: unknown): Array<{ orden: number; titulo: string; descripcion: string }> {
    if (!Array.isArray(pasos)) return [];
    return pasos.filter((p): p is { orden: number; titulo: string; descripcion: string } =>
        typeof p === "object" && p !== null && "titulo" in p && "descripcion" in p
    );
}

export function AnalisisExpediente({ expedienteId }: { expedienteId: string }) {
    const [data, setData] = useState<EvaluacionDto | null>(null);
    const [error, setError] = useState("");
    const [actualizando, setActualizando] = useState(false);
    const [mensajeActualizar, setMensajeActualizar] = useState("");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`/api/padre/expedientes/${expedienteId}/analisis`, { credentials: "include" });
            if (res.status === 404) {
                setError("Expediente no encontrado");
                return;
            }
            if (!res.ok) throw new Error("No pudimos cargar el análisis.");
            const json = (await res.json()) as EvaluacionDto;
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos cargar el análisis.");
        }
    }, [expedienteId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    // Polling mientras estamos generando (R-7).
    useEffect(() => {
        if (data?.estado === "GENERANDO") {
            timerRef.current = setInterval(() => void cargar(), POLL_INTERVAL_MS);
            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
            };
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return undefined;
    }, [data?.estado, cargar]);

    const actualizar = useCallback(async () => {
        setActualizando(true);
        setMensajeActualizar("");
        try {
            const res = await fetch(`/api/padre/expedientes/${expedienteId}/analisis`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error("No pudimos actualizar el análisis.");
            const body = await res.json();
            if (body.encolado) {
                setMensajeActualizar("Estamos generando un análisis nuevo.");
            } else if (body.motivo === "cooldown") {
                const min = Math.ceil((body.faltanSeg ?? 0) / 60);
                setMensajeActualizar(`Podrás actualizar en ${min} ${min === 1 ? "minuto" : "minutos"}.`);
            } else if (body.motivo === "ya_al_dia") {
                setMensajeActualizar("Tu análisis ya está al día — nada nuevo que interpretar.");
            } else if (body.motivo === "cola_llena") {
                setMensajeActualizar("La cola está llena — vuelve a intentar en unos minutos.");
            } else if (body.motivo === "sin_hechos") {
                setMensajeActualizar("Este expediente aún no tiene eventos analizables.");
            }
            // Refresca el estado tras la respuesta
            await cargar();
        } catch (err) {
            setMensajeActualizar(err instanceof Error ? err.message : "No pudimos actualizar.");
        } finally {
            setActualizando(false);
        }
    }, [expedienteId, cargar]);

    if (error) {
        return (
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <p className="text-sm text-muted">{error}</p>
            </section>
        );
    }

    if (!data) {
        return (
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <p className="text-sm text-muted">Cargando análisis…</p>
            </section>
        );
    }

    const { vigente, estado, cola, hechosNuevosDesde, coincide, cooldown, colaLlena, agotadoPorFallos } = data;
    const generando = estado === "GENERANDO";
    const puedeActualizar = cooldown.puedeActualizar && !generando && !actualizando;
    const guiaPasos = vigente?.guiaAccion ? pasosDeGuia(vigente.guiaAccion.pasos) : [];

    return (
        <section
            className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40"
            aria-label="Análisis detallado del expediente"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium text-body">Análisis detallado</h2>
                <span className="text-xs uppercase tracking-wide text-muted" title="Análisis generado con asistencia de IA">
                    análisis asistido
                </span>
            </div>

            {colaLlena && (
                <p className="mt-2 text-xs text-madera">
                    La cola está llena — vuelve a intentar en unos minutos.
                </p>
            )}

            {agotadoPorFallos && !generando && (
                <div className="mt-3 rounded-2xl border border-madera/30 bg-madera/10 p-4 text-sm text-body">
                    <p className="font-medium">No pudimos generar el análisis todavía.</p>
                    <p className="mt-1 text-muted">
                        Estamos revisándolo por dentro. Puedes volver en un rato y pedirlo con &ldquo;Actualizar análisis&rdquo;.
                    </p>
                </div>
            )}

            {generando && cola && (
                <div className="mt-3">
                    <ExpedienteGenerando
                        trabajosEnFila={cola.posicion}
                        estimadoSeg={cola.estimadoSeg}
                        hechosNuevosDesde={hechosNuevosDesde}
                    />
                </div>
            )}

            {vigente ? (
                <div className="mt-3">
                    <p className="text-xs text-muted">
                        Análisis al corte del {fmtFecha.format(new Date(vigente.generadoEn))} · incluye {vigente.corteN}{" "}
                        {vigente.corteN === 1 ? "hecho" : "hechos"}
                        {!coincide && hechosNuevosDesde > 0 && (
                            <>
                                {" · "}
                                <strong>
                                    Hay {hechosNuevosDesde} {hechosNuevosDesde === 1 ? "hecho nuevo" : "hechos nuevos"} desde este análisis
                                </strong>
                            </>
                        )}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-body">{vigente.texto}</p>

                    {vigente.guiaAccion && guiaPasos.length > 0 && (
                        <div className="mt-4 rounded-xl bg-papel/80 p-3 dark:bg-tinta/60">
                            <p className="font-medium text-body">{vigente.guiaAccion.tituloEmocional}</p>
                            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-body">
                                {guiaPasos.map((p) => (
                                    <li key={p.orden}>
                                        <strong>{p.titulo}.</strong> <span className="text-muted">{p.descripcion}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                    {vigente.guiaAccion && guiaPasos.length === 0 && (
                        <p className="mt-3 text-xs text-muted">Estamos preparando la guía para esta categoría.</p>
                    )}
                </div>
            ) : (
                !generando && (
                    <p className="mt-3 text-sm text-muted">
                        Pide el análisis detallado para la lectura completa de este patrón.
                    </p>
                )
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={actualizar} disabled={!puedeActualizar}>
                    {actualizando ? "Actualizando…" : "Actualizar análisis"}
                </Button>
                {!cooldown.puedeActualizar && !generando && cooldown.faltanSeg > 0 && (
                    <span className="text-xs text-muted">
                        Podrás actualizar en {Math.max(1, Math.ceil(cooldown.faltanSeg / 60))}{" "}
                        {Math.ceil(cooldown.faltanSeg / 60) === 1 ? "minuto" : "minutos"}.
                    </span>
                )}
                {mensajeActualizar && <span className="text-xs text-muted">{mensajeActualizar}</span>}
            </div>
        </section>
    );
}
