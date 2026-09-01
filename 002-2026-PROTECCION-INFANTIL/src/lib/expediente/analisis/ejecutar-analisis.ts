/**
 * SPEC-341 (T018) — el orquestador del worker: arma datos, llama al modelo,
 * valida la salida, y persiste el `AnalisisExpediente` con estado PUBLICADO
 * (o FALLIDO con motivo). No lanza excepción hacia pg-boss: el fallo se ve
 * en la fila del `AnalisisExpediente`, no en la métrica del worker.
 */
import { prisma } from "../../prisma";
import { logger } from "../../logger";
import { getParametroSistemaValor } from "../../parametros";
import { llamarOllamaStructured } from "../../ai/ollama-client";
import { armarPayload, type HechoPadre, type PayloadAnalisis } from "./armar-payload";
import { resolverPromptSistema } from "./prompt";
import { validarSalida } from "./validar-salida";
import type { AlcanceAnalisis, CategoriaConducta, Prisma } from "@prisma/client";

export interface EjecutarAnalisisArgs {
    expedienteId: string;
    hashCadena: string;
    alcance: AlcanceAnalisis;
}

interface AnalisisSalida {
    texto: string;
}

// JSON Schema para forzar salida del modelo.
const SALIDA_SCHEMA = {
    type: "object",
    properties: {
        texto: { type: "string", minLength: 40, maxLength: 4000 },
    },
    required: ["texto"],
    additionalProperties: false,
};

/** Punto único de entrada del worker. */
export async function ejecutarAnalisisJob(args: EjecutarAnalisisArgs): Promise<void> {
    const { expedienteId, hashCadena, alcance } = args;

    try {
        // 1. Cargar expediente + eventos + (si aplica) hijo cruzado.
        const expediente = await prisma.expediente.findUnique({
            where: { id: expedienteId },
            select: {
                id: true,
                identificadorReportado: true,
                padreUsuarioId: true,
                numEventos: true,
                categoriasDominantesJson: true,
                eventos: {
                    orderBy: { fechaEvento: "asc" },
                    select: {
                        fechaEvento: true,
                        categoriaDetectada: true,
                        plataforma: true,
                        reporte: { select: { ciudad: true, pais: true, edadVictima: true } },
                    },
                },
            },
        });
        if (!expediente) {
            logger.warn(`[analisis] expediente ${expedienteId} desapareció antes del job — abort`);
            return;
        }

        // 2. Mapear hechos al shape del armador de padre.
        const hechos: HechoPadre[] = expediente.eventos.map((e) => ({
            fecha: e.fechaEvento,
            ciudad: e.reporte?.ciudad ?? null,
            pais: e.reporte?.pais ?? null,
            plataforma: e.plataforma ?? null,
            categoria: (e.categoriaDetectada as CategoriaConducta | null) ?? null,
            edadReportada: e.reporte?.edadVictima ?? null,
        }));

        // Cruce con hijo (solo edad/sexo, jamás nombre).
        const hijoCruzado = expediente.padreUsuarioId
            ? await cargarHijoCruzado(expediente.padreUsuarioId, expediente.identificadorReportado)
            : null;

        // 3. Armar payload según alcance.
        const payload: PayloadAnalisis = alcance === "PADRE_COMPLETO"
            ? armarPayload({ alcance: "PADRE_COMPLETO", hechos, hijoCruzado })
            : armarPayload({ alcance: "COLEGIO_BLINDADO", agregados: [] }); // C3 lo llamará con su propio armador

        // 4. Resolver prompt y modelo.
        const { texto: promptSistema, hash: promptSistemaHash } = await resolverPromptSistema(alcance);
        const modelo = (await getParametroSistemaValor(alcance === "PADRE_COMPLETO"
            ? "padre.analisis.modelo"
            : "colegio.analisis.modelo"
        )) ?? "qwen2.5:14b";

        // 5. Llamar al modelo con JSON schema estructurado.
        const inicio = Date.now();
        const { data, metrics } = await llamarOllamaStructured<AnalisisSalida>(
            modelo,
            JSON.stringify(payload, null, 2),
            SALIDA_SCHEMA,
            promptSistema
        );

        // 6. Validar salida anti-frases prohibidas.
        const validacion = await validarSalida(data.texto);
        if (!validacion.ok) {
            await persistirFallo(expediente.id, hashCadena, alcance, modelo, promptSistemaHash, metrics.latenciaMs,
                `${validacion.motivo}: "${validacion.fraseDetectada}"`, hechos.length);
            logger.warn(`[analisis] rechazado por frase prohibida "${validacion.fraseDetectada}" · expediente=${expedienteId}`);
            return;
        }

        // 7. Persistir PUBLICADO con siguiente versionSecuencial.
        await persistirPublicado(
            expediente.id,
            hashCadena,
            alcance,
            data.texto,
            payload,
            modelo,
            promptSistemaHash,
            Date.now() - inicio,
            hechos.length,
        );
        logger.info(`[analisis] PUBLICADO expediente=${expedienteId} hash=${hashCadena.slice(0, 8)}… latencia=${Date.now() - inicio}ms`);
    } catch (err) {
        const motivo = err instanceof Error ? err.message.slice(0, 500) : "error_desconocido";
        logger.error(`[analisis] FALLIDO expediente=${expedienteId}: ${motivo}`);
        await persistirFallo(expedienteId, hashCadena, alcance, "?", "?", 0, motivo, 0).catch(() => null);
    }
}

async function cargarHijoCruzado(padreUsuarioId: string, identificadorReportado: string) {
    const hijo = await prisma.hijo.findFirst({
        where: {
            usuarioId: padreUsuarioId,
            estado: "activo",
            identificadores: { some: { valor: identificadorReportado, activo: true } },
        },
        select: { anioNacimiento: true, sexo: true },
    });
    if (!hijo) return null;
    return {
        edad: hijo.anioNacimiento ? new Date().getFullYear() - hijo.anioNacimiento : null,
        sexo: hijo.sexo,
    };
}

async function persistirPublicado(
    expedienteId: string,
    hashCadena: string,
    alcance: AlcanceAnalisis,
    texto: string,
    payload: PayloadAnalisis,
    modeloUsado: string,
    promptSistemaHash: string,
    latenciaMs: number,
    corteN: number,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        // Serializar por expediente (patrón informes-padre / reportes) para
        // que dos jobs concurrentes generen versionSecuencial únicos.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`analisis:${expedienteId}`}))`;

        const ultimo = await tx.analisisExpediente.findFirst({
            where: { expedienteId },
            orderBy: { versionSecuencial: "desc" },
            select: { versionSecuencial: true },
        });
        const versionSecuencial = (ultimo?.versionSecuencial ?? 0) + 1;

        // Categoría dominante del payload (PADRE) o del primer agregado (COLEGIO).
        const categoriaDominante = payload.alcance === "PADRE_COMPLETO"
            ? payload.categoriaDominante
            : (payload.agregadosPorCategoria[0]?.categoria ?? null);

        // Resolver GuiaAccionCategoria publicada de la categoría dominante (FR-012/013).
        let guiaAccionId: string | null = null;
        if (categoriaDominante) {
            const guia = await tx.guiaAccionCategoria.findFirst({
                where: { categoria: categoriaDominante, estado: "ACTIVA" },
                orderBy: { versionSecuencial: "desc" },
                select: { id: true },
            });
            guiaAccionId = guia?.id ?? null;
        }

        await tx.analisisExpediente.create({
            data: {
                expedienteId,
                versionSecuencial,
                alcance,
                hashCadena,
                corteN,
                texto,
                categoriaDominante,
                guiaAccionId,
                modeloUsado,
                promptSistemaHash,
                latenciaMs,
                estado: "PUBLICADO",
                publicadoEn: new Date(),
            } satisfies Prisma.AnalisisExpedienteUncheckedCreateInput,
        });
    });
}

async function persistirFallo(
    expedienteId: string,
    hashCadena: string,
    alcance: AlcanceAnalisis,
    modeloUsado: string,
    promptSistemaHash: string,
    latenciaMs: number,
    motivoFallo: string,
    corteN: number,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`analisis:${expedienteId}`}))`;
        const ultimo = await tx.analisisExpediente.findFirst({
            where: { expedienteId },
            orderBy: { versionSecuencial: "desc" },
            select: { versionSecuencial: true },
        });
        await tx.analisisExpediente.create({
            data: {
                expedienteId,
                versionSecuencial: (ultimo?.versionSecuencial ?? 0) + 1,
                alcance,
                hashCadena,
                corteN,
                texto: "",
                modeloUsado,
                promptSistemaHash,
                latenciaMs,
                estado: "FALLIDO",
                motivoFallo,
            } satisfies Prisma.AnalisisExpedienteUncheckedCreateInput,
        });
    });
}
