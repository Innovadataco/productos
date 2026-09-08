"use client";

import type { Ref } from "react";
import { Button } from "@/components/ui/Button";
import { PreviewCirculoVivo } from "./PreviewCirculoVivo";

/**
 * SPEC-599 · Paso 1 del wizard: bienvenida y propuesta de valor. El hijo del
 * ejemplo es FICTIONAL (la nota lo dice); la ilustración usa el preview con
 * datos de muestra para mostrar la metáfora antes de pedir nada.
 */
export function PasoBienvenidaRegistro({
    tituloRef,
    onSiguiente,
    onVerCirculo,
}: {
    tituloRef: Ref<HTMLHeadingElement>;
    onSiguiente: () => void;
    onVerCirculo: () => void;
}) {
    return (
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
                <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-estado-pino">
                    <span aria-hidden="true" className="h-0.5 w-[22px] rounded-full bg-pino" />
                    A quién protejo
                </p>
                <h2 ref={tituloRef} tabIndex={-1} className="max-w-[22ch] text-2xl font-bold leading-tight tracking-tight text-body sm:text-3xl">
                    Registra a tu hijo y entérate{" "}
                    <em className="font-serif font-normal italic text-estado-pino">antes que nadie</em>{" "}
                    si algo pasa.
                </h2>
                <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
                    Toma dos minutos. Registras a tus hijos con las cuentas que usan —su Roblox,
                    su teléfono, su correo— y si alguien reporta una de esas cuentas en la
                    plataforma, tú te enteras con información clara y sin alarmismo.
                </p>
                <ul className="mt-5 grid max-w-[52ch] gap-3">
                    {[
                        {
                            titulo: "Alerta temprana.",
                            texto:
                                "Si una cuenta de tu hijo aparece en un reporte de la comunidad, te avisamos y te explicamos qué significa.",
                        },
                        {
                            titulo: "Todo en tu círculo de confianza.",
                            texto:
                                "Tus hijos quedan al centro, contigo, y ves el estado de cada cuenta de un vistazo.",
                        },
                        {
                            titulo: "Tus datos, protegidos.",
                            texto:
                                "La información de tu hijo se cifra y solo tú (y el otro progenitor) la pueden ver.",
                        },
                    ].map((b) => (
                        <li key={b.titulo} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                            <span
                                aria-hidden="true"
                                className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-[11px] bg-pino/15 text-estado-pino"
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3 L20 7 v5 c0 5-3.5 8-8 9 c-4.5-1-8-4-8-9 V7 Z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>
                            </span>
                            <span>
                                <strong className="font-semibold text-body">{b.titulo}</strong> {b.texto}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Button type="button" onClick={onSiguiente}>
                        Registrar a mi hijo
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14m-6-6 6 6-6 6" />
                        </svg>
                    </Button>
                    <Button type="button" variant="ghost" onClick={onVerCirculo}>
                        ¿Cómo se ve en mi círculo?
                    </Button>
                </div>
                <p className="mt-4 flex max-w-[56ch] items-start gap-2 text-xs leading-relaxed text-subtle">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8h.01M11 12h1v4h1" />
                    </svg>
                    <span>
                        Los nombres y cuentas de ejemplo son ficticios y solo ilustran la propuesta.
                        Esto no es vigilancia: es cuidar a los tuyos.
                    </span>
                </p>
            </div>

            <div className="rounded-2xl border border-tinta/10 bg-papel/60 p-5 shadow-sm dark:border-tinta/10">
                <p className="text-sm font-semibold text-body">Tu círculo de confianza</p>
                <p className="mb-2 text-xs text-subtle">Así se verá tu hijo, contigo al centro.</p>
                <PreviewCirculoVivo nombre="Sara" apellidos="Valentina (ejemplo)" edad={9} totalCuentas={2} tono="verde" />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-dashed border-tinta/15 pt-2.5 text-[11.5px] text-subtle">
                    <span className="inline-flex items-center gap-1.5">
                        <i aria-hidden="true" className="h-2 w-2 rounded-full bg-pino" /> Sin reportes
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <i aria-hidden="true" className="h-2 w-2 rounded-full bg-ambar" /> Requiere atención
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <i aria-hidden="true" className="h-2 w-2 rounded-full bg-tinta/30" /> Lugar libre
                    </span>
                </div>
            </div>
        </div>
    );
}
