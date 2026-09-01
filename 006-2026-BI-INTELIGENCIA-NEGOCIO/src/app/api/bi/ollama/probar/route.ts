import { NextRequest, NextResponse } from "next/server";
import {
    getOllamaBaseUrl,
    isLocalOllamaUrl,
    listOllamaModels,
    type OllamaModelInfo,
} from "@/lib/ai/ollama-config";
import { probarModelo } from "@/lib/ai/ollama-client";

// Prueba en vivo de un modelo contra Ollama: siempre dinámico y en runtime Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// T1/B3: tope del prompt de prueba. Es límite de API, no parámetro de negocio;
// si algún día se vuelve configurable, se mueve a bi_config.
const MAX_PROMPT_CHARS = 4000;

/**
 * Envía un prompt de prueba a un modelo instalado (playground Admin IA).
 * La sesión la exige el middleware; aquí solo se valida y se ejecuta.
 *
 * Body exacto: { modelo: string, prompt: string } — `modelo` es la etiqueta
 * "name:tag" tal como la lista GET /api/bi/ollama/estado. Se rechaza si el
 * modelo no está instalado o es de embeddings (no sirve para chat).
 */
export async function POST(request: NextRequest) {
    let cuerpo: { modelo?: unknown; prompt?: unknown };
    try {
        cuerpo = await request.json();
    } catch {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    const { modelo, prompt } = cuerpo;
    if (
        typeof modelo !== "string" ||
        modelo.trim().length === 0 ||
        typeof prompt !== "string" ||
        prompt.trim().length === 0 ||
        prompt.length > MAX_PROMPT_CHARS
    ) {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    // R2: la URL sale SOLO de la config del servidor — nunca del cliente.
    const baseUrl = await getOllamaBaseUrl();
    if (!isLocalOllamaUrl(baseUrl)) {
        return NextResponse.json({ error: "url_no_local" }, { status: 400 });
    }

    // Validación contra la realidad de Ollama: el modelo debe estar instalado
    // y NO ser de embeddings. 404 indistinto en ambos casos.
    let modelos: OllamaModelInfo[];
    try {
        modelos = await listOllamaModels(baseUrl);
    } catch {
        return NextResponse.json(
            { ok: false, error: "ollama_inalcanzable" },
            { status: 503 }
        );
    }

    const instalado = modelos.some(
        (m) => !m.esEmbedding && `${m.name}:${m.tag}` === modelo
    );
    if (!instalado) {
        return NextResponse.json({ error: "modelo_no_instalado" }, { status: 404 });
    }

    try {
        const { respuesta, metrics } = await probarModelo(modelo, prompt);
        return NextResponse.json({ ok: true, respuesta, metrics });
    } catch {
        // Degradación controlada: si Ollama cae entre el sondeo y la prueba,
        // el playground recibe 503 estructurado, no un 500 opaco.
        return NextResponse.json(
            { ok: false, error: "ollama_inalcanzable" },
            { status: 503 }
        );
    }
}
