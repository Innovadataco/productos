import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { preguntar } from "@/lib/bi/motor";

// Chat NL→SQL (Fase 2): siempre dinámico y en runtime Node — el motor usa
// Prisma (bitácora/cache) y Ollama; nada de esto corre en edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// B3: nada quemado — el largo máximo de la pregunta es parámetro de env
// (default 500, fijado por el contrato de la SPEC: body 1..500 chars).
const MAX_PREGUNTA_CHARS = Number(process.env.BI_PREGUNTA_MAX_CHARS ?? "500");

/**
 * Type guard estricto del payload: objeto plano con EXACTAMENTE la clave
 * `pregunta` (string). Claves extra se rechazan (deny-by-default — en este
 * producto el `rol` jamás viaja por body del cliente).
 */
function esPayloadPregunta(valor: unknown): valor is { pregunta: string } {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
    const claves = Object.keys(valor);
    if (claves.length !== 1 || claves[0] !== "pregunta") return false;
    return typeof (valor as Record<string, unknown>).pregunta === "string";
}

/**
 * POST /api/bi/preguntar — entrada del chat. El middleware ya exige sesión;
 * la verificación aquí es defensa en profundidad (fail-closed, SE2).
 *
 * Contrato:
 * - Body EXACTO { pregunta: string } de 1..500 chars → si no, 400 payload_invalido.
 * - Éxito: 200 con la RespuestaMotor TAL CUAL la devuelve el motor — este
 *   route no toca SQL ni cifras (candados 3 y 10 viven en el motor).
 * - Error inesperado del motor: 500 error_motor, sin detalles internos
 *   (el error crudo puede contener SQL o trazas; solo va al log).
 */
export async function POST(request: Request) {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    let cuerpo: unknown;
    try {
        cuerpo = await request.json();
    } catch {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    if (!esPayloadPregunta(cuerpo)) {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    const pregunta = cuerpo.pregunta.trim();
    if (pregunta.length === 0 || pregunta.length > MAX_PREGUNTA_CHARS) {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    try {
        const respuesta = await preguntar(pregunta, sesion.email);
        return NextResponse.json(respuesta, { status: 200 });
    } catch (error) {
        console.error("[BI] /api/bi/preguntar: el motor lanzó un error inesperado", error);
        return NextResponse.json({ error: "error_motor" }, { status: 500 });
    }
}
