import { ERROR_CODES } from "@/lib/errors";
import { NextResponse } from "next/server";

export function esErrorTransitorio(error: unknown): boolean {
    if (error && typeof error === "object" && "retryable" in error && error.retryable === false) {
        return false;
    }
    if (error && typeof error === "object" && "retryable" in error && error.retryable === true) {
        return true;
    }
    const msg = error instanceof Error ? error.message : String(error);
    const patrones = [
        /ollama/i,
        /embedding/i,
        /clasificaci[oó]n/i,
        /anonimiz/i,
        /pii/i,
        /timeout/i,
        /fetch/i,
        /network/i,
        /econnrefused/i,
        /socket/i,
        /abort/i,
        /temporalmente/i,
        /no disponible/i,
    ];
    return patrones.some((p) => p.test(msg));
}

export const ESTADOS_FINALES = new Set([
    "CLASIFICADO",
    "CORREGIDO",
    "DUPLICADO",
    "POSIBLE_SPAM",
    "REVISION_MANUAL",
    "REQUIERE_ANONIMIZACION",
]);

export function respuestaTransitoria() {
    return NextResponse.json(
        { error: { message: "Error transitorio procesando el reporte", code: ERROR_CODES.INTERNAL_ERROR, retryable: true } },
        { status: 500 }
    );
}

export function respuestaErrorProcesamiento(errorCode: string) {
    return NextResponse.json(
        { error: { message: "Error procesando el reporte", code: errorCode, retryable: false } },
        { status: 500 }
    );
}
