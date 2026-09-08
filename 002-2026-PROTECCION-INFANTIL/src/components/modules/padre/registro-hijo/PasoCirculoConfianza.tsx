"use client";

import { useState, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { PreviewCirculoVivo } from "./PreviewCirculoVivo";
import type { DatosHijoForm } from "./types";

/**
 * SPEC-599 · Paso 3 del wizard: cómo queda el hijo en el círculo de confianza.
 * Incluye el SIMULADOR aprobado por el dueño (parte del onboarding): un switch
 * que finge un reporte sobre una cuenta del hijo y pinta su anillo en ámbar,
 * para que el padre aprenda el significado de los tonos antes de necesitarlo.
 * Nunca rojo, nunca alarma: «1 reporte en revisión» es lo máximo que se dice.
 */
export function PasoCirculoConfianza({
    tituloRef,
    form,
    totalCuentas,
    guardando,
    onAtras,
    onConfirmar,
}: {
    tituloRef: Ref<HTMLHeadingElement>;
    form: DatosHijoForm;
    totalCuentas: number;
    guardando: boolean;
    onAtras: () => void;
    onConfirmar: () => void;
}) {
    const [simulando, setSimulando] = useState(false);
    const nombreCorto = form.nombre.trim().split(/\s+/)[0] || "tu hijo";

    return (
        <div>
            <div className="grid items-center gap-8 lg:grid-cols-2">
                <div>
                    <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-estado-pino">
                        <span aria-hidden="true" className="h-0.5 w-[22px] rounded-full bg-pino" />
                        Paso 3 de 4
                    </p>
                    <h2 ref={tituloRef} tabIndex={-1} className="text-2xl font-bold leading-tight tracking-tight text-body sm:text-3xl">
                        Así queda <em className="font-serif font-normal italic text-estado-pino">{nombreCorto}</em> en tu
                        círculo.
                    </h2>
                    <ol className="mt-5 grid">
                        {[
                            {
                                titulo: "Queda dentro de tu círculo.",
                                texto: "Su avatar con su inicial, alrededor de ti. El anillo verde dice que todo está bien.",
                            },
                            {
                                titulo: "Vigilamos sus cuentas.",
                                texto: "Cada cuenta que registraste queda protegida. Si la comunidad reporta una, lo sabes de inmediato.",
                            },
                            {
                                titulo: "Si algo pasa, el anillo se pone en ámbar.",
                                texto: "Nada de alarmas: te mostramos cuántos reportes hay y en qué estado están, con lenguaje claro.",
                            },
                        ].map((paso, i) => (
                            <li
                                key={paso.titulo}
                                className="flex gap-3.5 border-b border-dashed border-tinta/15 py-3.5 text-sm leading-relaxed text-muted last:border-b-0"
                            >
                                <span
                                    aria-hidden="true"
                                    className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[9px] bg-cielo/15 text-xs font-bold text-primary-700 dark:text-cielo"
                                >
                                    {i + 1}
                                </span>
                                <span>
                                    <strong className="font-semibold text-body">{paso.titulo}</strong> {paso.texto}
                                </span>
                            </li>
                        ))}
                    </ol>

                    {/* Simulador (onboarding): aprende los tonos sin riesgo real. */}
                    <div className="mt-5 rounded-2xl border border-dashed border-ambar/50 bg-ambar/10 p-4">
                        <p className="mb-2.5 text-xs leading-relaxed text-muted">
                            <strong className="font-semibold text-body">Prueba la interacción:</strong> simula que alguien
                            reportó una cuenta de tu hijo y mira cómo cambia su anillo.
                        </p>
                        <div className="flex items-center gap-3 text-sm font-semibold text-body">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={simulando}
                                aria-label="Simular un reporte sobre una cuenta de tu hijo"
                                onClick={() => setSimulando((v) => !v)}
                                className={`relative h-[26px] w-[46px] flex-shrink-0 cursor-pointer rounded-full transition ease-barrido ${
                                    simulando ? "bg-ambar" : "bg-tinta/20"
                                }`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-papel shadow-sm transition ease-barrido ${
                                        simulando ? "translate-x-5" : "translate-x-0"
                                    }`}
                                />
                            </button>
                            <span aria-live="polite">{simulando ? "Reporte simulado · anillo en ámbar" : "Simular reporte"}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-tinta/10 bg-papel/60 p-5 shadow-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-body">Tu círculo de confianza</p>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-estado-pino">
                            <i aria-hidden="true" className="anim-pulso inline-block h-[7px] w-[7px] rounded-full bg-pino" />
                            Vista previa
                        </span>
                    </div>
                    <p className="mb-2 text-xs text-subtle">Tu hijo ya está dentro. Así lo verás siempre.</p>
                    <PreviewCirculoVivo
                        nombre={form.nombre}
                        apellidos={form.apellidos}
                        edad={form.edad}
                        totalCuentas={totalCuentas}
                        tono={simulando ? "ambar" : "verde"}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-dashed border-tinta/15 pt-2.5 text-[11.5px] text-subtle">
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden="true" className="h-2 w-2 rounded-full bg-pino" /> Sin reportes
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden="true" className="h-2 w-2 rounded-full bg-ambar" /> Requiere atención
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={onAtras}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 12H5m6 6-6-6 6-6" />
                    </svg>
                    Corregir datos
                </Button>
                <Button type="button" onClick={onConfirmar} isLoading={guardando} disabled={guardando}>
                    Confirmar registro
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 13 4 4L19 7" />
                    </svg>
                </Button>
            </div>
        </div>
    );
}
