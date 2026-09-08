"use client";

import Link from "next/link";
import type { Ref } from "react";
import { Button } from "@/components/ui/Button";

/**
 * SPEC-599 · Paso 4 del wizard: confirmación del registro con el resumen de lo
 * cargado y las salidas (registrar a otro hijo / ir al círculo de confianza).
 */
export function ResumenRegistro({
    tituloRef,
    nombreCorto,
    nombreCompleto,
    edadTexto,
    cuentasTexto,
    onOtro,
}: {
    tituloRef: Ref<HTMLHeadingElement>;
    nombreCorto: string;
    nombreCompleto: string;
    edadTexto: string;
    cuentasTexto: string;
    onOtro: () => void;
}) {
    return (
        <div className="py-2 text-center">
            <div
                aria-hidden="true"
                className="mx-auto mb-5 grid h-[84px] w-[84px] animate-floatUp place-items-center rounded-full bg-pino/15 text-estado-pino"
            >
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4.5 12.5 5 5L20 6.5" />
                </svg>
            </div>
            <p className="mb-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-estado-pino">
                <span aria-hidden="true" className="h-0.5 w-[22px] rounded-full bg-pino" />
                Registro completo
            </p>
            <h2
                ref={tituloRef}
                tabIndex={-1}
                className="mx-auto max-w-[24ch] text-2xl font-bold leading-tight tracking-tight text-body sm:text-3xl"
            >
                Listo. Ya estás cuidando a{" "}
                <em className="font-serif font-normal italic text-estado-pino">{nombreCorto}</em>.
            </h2>
            <p className="mx-auto mt-3 max-w-[58ch] text-[15.5px] leading-relaxed text-muted">
                Desde ahora sus cuentas quedan vigiladas. Si algo se reporta, te avisamos por correo y
                verás su anillo en ámbar en tu círculo de confianza.
            </p>

            <dl className="mx-auto mt-6 grid max-w-[460px] gap-2.5 rounded-2xl border border-tinta/10 bg-papel/60 p-5 text-left text-sm">
                <div className="flex justify-between gap-4">
                    <dt className="text-subtle">Nombre</dt>
                    <dd className="text-right font-semibold text-body">{nombreCompleto}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-subtle">Edad</dt>
                    <dd className="text-right font-semibold text-body">{edadTexto}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-subtle">Cuentas protegidas</dt>
                    <dd className="text-right font-semibold text-body">{cuentasTexto}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-subtle">Estado</dt>
                    <dd className="text-right font-semibold text-body">Sin reportes · anillo verde</dd>
                </div>
            </dl>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button type="button" onClick={onOtro}>
                    Registrar a otro hijo
                </Button>
                <Link
                    href="/dashboard/padre/circulo-confianza"
                    className="btn-ds btn-ds--fantasma inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold"
                >
                    Ir a mi círculo de confianza
                </Link>
            </div>
        </div>
    );
}
