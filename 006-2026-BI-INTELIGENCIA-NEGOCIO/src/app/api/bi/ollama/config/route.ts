import { NextRequest, NextResponse } from "next/server";
import {
    getModeloSql,
    getOllamaBaseUrl,
    isLocalOllamaUrl,
    listOllamaModels,
    type OllamaModelInfo,
} from "@/lib/ai/ollama-config";
import { setConfig } from "@/lib/config";
import { leerSesion } from "@/lib/auth/sesion";
import { registrarEventoAudit, ACCION_AUDIT } from "@/lib/bitacora/audit";

// Lee/escribe bi_config y sondea Ollama: siempre dinámico y en runtime Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// B3: el modelo de chat NL→SQL vive en bi_config, jamás quemado en código.
const CLAVE_MODELO_SQL = "ia.ollama.modelo_sql";

/**
 * Modelo de chat configurado actualmente (fallback al default/env si la
 * clave aún no existe en bi_config — lo resuelve getModeloSql).
 */
export async function GET() {
    return NextResponse.json({ modelo: await getModeloSql() });
}

/**
 * Persiste el modelo de chat NL→SQL en bi_config. Body exacto: { modelo }.
 * Antes de guardar se valida contra Ollama: el modelo debe estar instalado
 * y NO ser de embeddings — nunca se persiste un modelo que no puede responder.
 */
export async function PUT(request: NextRequest) {
    let cuerpo: { modelo?: unknown };
    try {
        cuerpo = await request.json();
    } catch {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    const { modelo } = cuerpo;
    if (typeof modelo !== "string" || modelo.trim().length === 0) {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    // R2: la URL sale SOLO de la config del servidor — nunca del cliente.
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

    const instalado = modelos.some(
        (m) => !m.esEmbedding && `${m.name}:${m.tag}` === modelo
    );
    if (!instalado) {
        return NextResponse.json({ error: "modelo_no_instalado" }, { status: 404 });
    }

    await setConfig(CLAVE_MODELO_SQL, modelo);

    // Bitácora general: quién cambió el modelo y a cuál (fail-open).
    const sesion = await leerSesion();
    await registrarEventoAudit({
        accion: ACCION_AUDIT.CONFIG_CAMBIO,
        email: sesion?.email ?? "desconocido",
        detalle: { clave: CLAVE_MODELO_SQL, valorNuevo: modelo },
    });

    return NextResponse.json({ ok: true, modelo });
}
