"use client";

/**
 * SPEC-340 (A-68 §3.3) — «Ver análisis».
 *
 * A-70 · F11: lo que el padre ve acá es el RESULTADO REAL de la clasificación
 * IA —categoría, confianza y secundarias del `ClasificacionIA`—, con la misma
 * transición "en proceso → procesado" del reporte anónimo, más la ficha del
 * hecho. Antes se mostraba el parámetro `padre.analisis.explicacion.<CAT>`
 * presentado como si fuera el análisis: eso era una plantilla por categoría,
 * idéntica para todos los reportes de la misma clase. Ahora esa frase baja a
 * una línea rotulada "Qué significa", que es lo que siempre fue.
 *
 * Sin clasificación (o en revisión manual) NO se inventa nada: se dice el
 * estado honesto y la transición queda en "en proceso".
 */
import { useState } from "react";
import { EstadoTransicion } from "@/components/modules/EstadoTransicion";
import { fechaHoraSinMinutos } from "@/lib/format/fecha";

export interface AnalisisIaDto {
    categoriaLabel: string;
    confianza: number;
    secundarias: Array<{ categoriaLabel: string; confianza: number }>;
    modeloUsado: string;
    esManual: boolean;
}

export interface FichaHechoDto {
    pais: string | null;
    ciudad: string | null;
    edadVictima: number | null;
    origen: "anonimo" | "padre";
}

interface VerAnalisisProps {
    /** null = aún sin clasificar. */
    categoriaLabel: string | null;
    /** A-70 · F11: la frase por categoría — "Qué significa", NO el análisis. */
    explicacion: string | null;
    /** A-70 · F11: el resultado real del motor; null mientras no terminó. */
    analisisIa?: AnalisisIaDto | null;
    /** A-70 · F11: la ficha bajo el análisis. */
    ficha?: FichaHechoDto | undefined;
    /** Fecha del hecho, para la ficha (G20: se muestra sin minutos). */
    fechaIncidente?: string | undefined;
    /** Estado del reporte — distingue "en revisión por una persona". */
    estado?: string | undefined;
}

function porcentaje(confianza: number): string {
    return `${Math.round(confianza * 100)}%`;
}

export function VerAnalisis({
    categoriaLabel,
    explicacion,
    analisisIa = null,
    ficha,
    fechaIncidente,
    estado,
}: VerAnalisisProps) {
    const [abierto, setAbierto] = useState(false);
    const enRevisionHumana = estado === "REVISION_MANUAL";
    const enProceso = !analisisIa;

    return (
        <div>
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="text-xs font-medium text-pino underline-offset-2 hover:underline"
                aria-expanded={abierto}
            >
                Ver análisis
            </button>
            {abierto && (
                <div className="mt-2 space-y-3 rounded-xl border border-tinta/10 bg-papel/60 p-3 text-sm dark:border-papel/10 dark:bg-tinta/40">
                    {/* La misma transición del reporte anónimo (F11). */}
                    <EstadoTransicion enProceso={enProceso} />

                    {analisisIa ? (
                        <>
                            <div>
                                <div className="flex flex-wrap items-baseline gap-2">
                                    <p className="font-medium text-body">{analisisIa.categoriaLabel}</p>
                                    <span className="text-xs text-muted">
                                        {porcentaje(analisisIa.confianza)} de confianza
                                    </span>
                                    {analisisIa.esManual && (
                                        <span className="text-xs text-muted" title="Un revisor humano clasificó este caso">
                                            · revisado por una persona
                                        </span>
                                    )}
                                </div>
                                {analisisIa.secundarias.length > 0 && (
                                    <p className="mt-1 text-xs text-muted">
                                        También consideró:{" "}
                                        {analisisIa.secundarias
                                            .map((s) => `${s.categoriaLabel} (${porcentaje(s.confianza)})`)
                                            .join(" · ")}
                                    </p>
                                )}
                            </div>

                            {explicacion && (
                                <div className="rounded-lg bg-papel/80 p-2 dark:bg-tinta/60">
                                    <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                                        Qué significa
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted">{explicacion}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-muted">
                            {enRevisionHumana
                                ? "En revisión por una persona de nuestro equipo. Te avisamos apenas termine."
                                : "Estamos analizando lo que contaste. En unos minutos verás el resultado acá."}
                        </p>
                    )}

                    {/* A-70 · F11: la ficha de datos del hecho. */}
                    {ficha && (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-tinta/10 pt-2 text-xs dark:border-papel/10">
                            {categoriaLabel && (
                                <>
                                    <dt className="text-subtle">Clasificación</dt>
                                    <dd className="text-body">{categoriaLabel}</dd>
                                </>
                            )}
                            {ficha.pais && (
                                <>
                                    <dt className="text-subtle">País</dt>
                                    <dd className="text-body">{ficha.pais}</dd>
                                </>
                            )}
                            {ficha.ciudad && (
                                <>
                                    <dt className="text-subtle">Ciudad</dt>
                                    <dd className="text-body">{ficha.ciudad}</dd>
                                </>
                            )}
                            {ficha.edadVictima !== null && ficha.edadVictima !== undefined && (
                                <>
                                    <dt className="text-subtle">Edad del menor</dt>
                                    <dd className="text-body">{ficha.edadVictima} años</dd>
                                </>
                            )}
                            {fechaIncidente && (
                                <>
                                    <dt className="text-subtle">Fecha del hecho</dt>
                                    <dd className="text-body">{fechaHoraSinMinutos(fechaIncidente)}</dd>
                                </>
                            )}
                            <dt className="text-subtle">Origen</dt>
                            <dd className="text-body">{ficha.origen === "anonimo" ? "Anónimo" : "Tu cuenta"}</dd>
                        </dl>
                    )}
                </div>
            )}
        </div>
    );
}
