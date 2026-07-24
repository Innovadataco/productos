import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buscarHibrida } from "@/lib/search/hibrida";
import { resolverModeloEmbeddings, ModeloEmbeddingsNoConfigurado } from "@/lib/ragConfig";
import { embedText } from "@/lib/modelClients";
import { auditLog } from "@/lib/audit";
import { esquemaBusquedaDocumentos, validar } from "@/lib/esquemas";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    // Validación con Zod (spec 009, FR-008). Añade el tope de §2.6 —500
    // caracteres— que la ruta no aplicaba: aceptaba una consulta de cualquier
    // tamaño y la mandaba a embeder.
    const validacion = validar(esquemaBusquedaDocumentos, await req.json());
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.mensaje }, { status: 400 });
    }
    const { query, tipo, entidad, sector, fechaDesde, fechaHasta } = validacion.datos;

    // Modelo de embeddings vigente: define el espacio vectorial de la rama semántica
    // (FR-021b). Si no está configurado, la búsqueda degrada a solo FTS (US4-4), que
    // cubre todo el corpus desde el primer día (D-019).
    let embeddingModel = "";
    let enrichConfig = "none";
    let queryEmbedding: number[] | null = null;
    let parametros;

    try {
      const modelo = await resolverModeloEmbeddings(prisma);
      embeddingModel = modelo.modelPath;
      enrichConfig = modelo.enrichConfigHuella;
      parametros = modelo.parametros;
      const emb = await embedText(
        { provider: "ollama", modelPath: modelo.modelPath, baseUrl: modelo.baseUrl, config: "{}" },
        query,
      );
      if (emb.ok) queryEmbedding = emb.embedding;
    } catch (err: unknown) {
      // Sin modelo configurado: no es un error de búsqueda, se sigue con FTS.
      if (!(err instanceof ModeloEmbeddingsNoConfigurado)) throw err;
    }

    const start = Date.now();
    const resultados = await buscarHibrida(prisma, {
      query,
      filtros: { tipo, entidad, sector, fechaDesde, fechaHasta },
      parametros: parametros ?? (await import("@/lib/ragConfig")).PARAMETROS_RAG_DEFAULT,
      embeddingModel,
      enrichConfig,
      queryEmbedding,
    });

    // Métrica de la búsqueda (FR-025): modelo, latencia, recuperados, si hubo evidencia.
    await auditLog({
      action: "search",
      entityType: "DocumentoOficial",
      status: "success",
      message: `Búsqueda híbrida: ${resultados.length} resultados`,
      metadata: {
        modelo: embeddingModel || "solo-fts",
        vectorial: queryEmbedding !== null,
        recuperados: resultados.length,
        evidencia: resultados.length > 0,
      },
      latencyMs: Date.now() - start,
    });

    return NextResponse.json(resultados);
  } catch (err: unknown) {
    return apiError("Documentos", "POST search", "Error en búsqueda", 500, err);
  }
}
