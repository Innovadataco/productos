import { NextResponse } from "next/server";
import {
    getModeloSql,
    getOllamaBaseUrl,
    isLocalOllamaUrl,
    listOllamaModels,
    type OllamaModelInfo,
} from "@/lib/ai/ollama-config";

// Sondeo en vivo contra Ollama (Tailscale · Mac Studio): siempre dinámico y
// en runtime Node (fetch a red privada; Prisma no corre en edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const aEtiqueta = (m: OllamaModelInfo): string => `${m.name}:${m.tag}`;

/**
 * Estado del cerebro IA del 006: alcanzabilidad + modelos instalados.
 * La sesión la exige el middleware; aquí solo se sondea.
 *
 * R2: la URL sale SOLO de la config del servidor (bi_config / OLLAMA_BASE_URL
 * vía getOllamaBaseUrl) — jamás se sondea una URL enviada por el cliente.
 *
 * Decisión de exposición (documentada): la URL base NO se devuelve, ni
 * enmascarada. La UI solo necesita saber si Ollama está alcanzable y qué
 * modelos hay; exponer host/puerto revelaría topología interna de Tailscale
 * sin aportar nada a la operación. Se devuelve únicamente `alcanzable`.
 *
 * Degradación controlada: Ollama caído = 503 con error estructurado,
 * nunca una excepción no controlada.
 */
export async function GET() {
    const baseUrl = await getOllamaBaseUrl();
    if (!isLocalOllamaUrl(baseUrl)) {
        return NextResponse.json({ error: "url_no_local" }, { status: 400 });
    }

    let modelos: OllamaModelInfo[];
    try {
        modelos = await listOllamaModels(baseUrl);
    } catch {
        return NextResponse.json(
            { ok: false, error: "ollama_inalcanzable" },
            { status: 503 }
        );
    }

    return NextResponse.json({
        ok: true,
        alcanzable: true,
        totalModelos: modelos.length,
        modeloActual: await getModeloSql(),
        modelosClasificacion: modelos.filter((m) => !m.esEmbedding).map(aEtiqueta),
        modelosEmbedding: modelos.filter((m) => m.esEmbedding).map(aEtiqueta),
    });
}
