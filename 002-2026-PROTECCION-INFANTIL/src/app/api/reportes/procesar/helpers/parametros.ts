import { prisma } from "@/lib/prisma";

export interface ParametrosClasificacion {
    modeloEmbedding: string;
    modeloClasificacion: string;
    umbralRevision: number;
    nVotos: number;
    temperaturaVotos: number;
    minScoreCategoria: number;
    ollamaNumParallel: number;
    modeloDesempate: string | undefined;
    umbralSpam: number;
    rafagaN: number;
    rafagaHoras: number;
    ragTopK: number;
    modeloAnonimizacion: string;
}

export async function cargarParametrosClasificacion(override?: { modeloClasificacion?: string }): Promise<ParametrosClasificacion> {
    const paramEmbedding = await prisma.parametroSistema.findUnique({
        where: { clave: "reportes.embedding_model" },
    });
    const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";

    const paramModelo = await prisma.parametroSistema.findUnique({
        where: { clave: "reportes.classification_model" },
    });
    const modeloClasificacion = paramModelo?.valor || "ornith:9b";

    const paramAnonModelo = await prisma.parametroSistema.findUnique({
        where: { clave: "reportes.anonymization_model" },
    });
    const modeloAnonimizacion = paramAnonModelo?.valor || modeloClasificacion;

    const paramUmbral = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.umbral_revision" } });
    const umbralRevision = parseFloat(paramUmbral?.valor || "1.0");

    const paramNVotos = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.n_votos" } });
    const nVotos = parseInt(paramNVotos?.valor || "5", 10);

    const paramTemperatura = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.temperatura_votos" } });
    const temperaturaVotos = parseFloat(paramTemperatura?.valor || "0.7");

    const paramMinScore = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.min_score_categoria" } });
    const minScoreCategoria = parseFloat(paramMinScore?.valor || "0.3");

    const paramParallel = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.ollama_num_parallel" } });
    const ollamaNumParallel = parseInt(paramParallel?.valor || process.env.OLLAMA_NUM_PARALLEL || "2", 10);

    const paramModeloDesempate = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.modelo_desempate" } });
    const modeloDesempate = paramModeloDesempate?.valor || undefined;

    const paramUmbralSpam = await prisma.parametroSistema.findUnique({ where: { clave: "clasificacion.umbral_spam" } });
    const umbralSpam = parseFloat(paramUmbralSpam?.valor || "0.7");

    const paramRagTopK = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.rag_top_k" } });
    const ragTopK = parseInt(paramRagTopK?.valor || "3", 10);

    const paramRafagaN = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.rafaga.n_reportes" } });
    const rafagaN = parseInt(paramRafagaN?.valor || "3", 10);

    const paramRafagaHoras = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.rafaga.ventana_horas" } });
    const rafagaHoras = parseInt(paramRafagaHoras?.valor || "24", 10);

    return {
        modeloEmbedding,
        modeloClasificacion: override?.modeloClasificacion || modeloClasificacion,
        modeloAnonimizacion,
        umbralRevision,
        nVotos,
        temperaturaVotos,
        minScoreCategoria,
        ollamaNumParallel,
        modeloDesempate,
        umbralSpam,
        rafagaN,
        rafagaHoras,
        ragTopK,
    };
}
