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
// Audit 87c311a0 · Ollama compilaba la gramática GBNF con `minLength`/`maxLength`
// y respondía 400 "Failed to initialize samplers: failed to parse grammar" en
// cada intento (nunca tocaba al modelo). El embudo de la rúbrica no usa esos
// campos — imitamos: solo tipos básicos + required + additionalProperties.
// El rango de longitud del texto se valida DESPUÉS del parseo, no en el schema.
const SALIDA_SCHEMA = {
    type: "object",
    properties: {
        texto: { type: "string" },
    },
    required: ["texto"],
    additionalProperties: false,
};

/** Rangos aceptables del texto — validados post-parseo. */
const TEXTO_MIN_CHARS = 40;
const TEXTO_MAX_CHARS = 4000;

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

        // 6a. Validar longitud del texto (movido acá porque el schema JSON no
        // puede llevar minLength/maxLength — rompe la gramática GBNF de Ollama).
        if (data.texto.length < TEXTO_MIN_CHARS || data.texto.length > TEXTO_MAX_CHARS) {
            await cerrarPlaceholderFallando(expediente.id, hashCadena, alcance, modelo, promptSistemaHash, metrics.latenciaMs,
                `longitud_fuera_de_rango: ${data.texto.length} chars (rango ${TEXTO_MIN_CHARS}-${TEXTO_MAX_CHARS})`);
            logger.warn(`[analisis] texto fuera de rango · expediente=${expedienteId} · chars=${data.texto.length}`);
            return;
        }

        // 6b. Validar salida anti-frases prohibidas.
        const validacion = await validarSalida(data.texto);
        if (!validacion.ok) {
            await cerrarPlaceholderFallando(expediente.id, hashCadena, alcance, modelo, promptSistemaHash, metrics.latenciaMs,
                `${validacion.motivo}: "${validacion.fraseDetectada}"`);
            logger.warn(`[analisis] rechazado por frase prohibida "${validacion.fraseDetectada}" · expediente=${expedienteId}`);
            return;
        }

        // 7. Persistir PUBLICADO con siguiente versionSecuencial.
        await cerrarPlaceholderPublicando(
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
        await cerrarPlaceholderFallando(expedienteId, hashCadena, alcance, "?", "?", 0, motivo).catch(() => null);
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

/**
 * Fija el resultado sobre EL MISMO placeholder GENERANDO que el DAL insertó
 * al abrir el expediente (audit #214 · candado 1: cerrar la fila, no crear
 * una nueva — si no, el placeholder queda eterno cuando el worker termina y
 * la UI hace polling infinito). Si por alguna raza NO existe placeholder
 * (worker que corrió antes del DAL), se crea una fila con `versionSecuencial`
 * nuevo por respaldo.
 */
export async function cerrarPlaceholderPublicando(
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
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`analisis:${expedienteId}`}))`;

        const categoriaDominante = payload.alcance === "PADRE_COMPLETO"
            ? payload.categoriaDominante
            : (payload.agregadosPorCategoria[0]?.categoria ?? null);

        let guiaAccionId: string | null = null;
        if (categoriaDominante) {
            const guia = await tx.guiaAccionCategoria.findFirst({
                where: { categoria: categoriaDominante, estado: "ACTIVA" },
                orderBy: { versionSecuencial: "desc" },
                select: { id: true },
            });
            guiaAccionId = guia?.id ?? null;
        }

        const placeholder = await tx.analisisExpediente.findFirst({
            where: { expedienteId, hashCadena, estado: "GENERANDO" },
            select: { id: true },
        });

        if (placeholder) {
            await tx.analisisExpediente.update({
                where: { id: placeholder.id },
                data: {
                    corteN,
                    texto,
                    categoriaDominante,
                    guiaAccionId,
                    modeloUsado,
                    promptSistemaHash,
                    latenciaMs,
                    estado: "PUBLICADO",
                    publicadoEn: new Date(),
                },
            });
            return;
        }

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

/**
 * Igual que `cerrarPlaceholderPublicando` pero marca FALLIDO con motivo.
 * La UI lo ve como estado terminal (no como generando eterno).
 */
export async function cerrarPlaceholderFallando(
    expedienteId: string,
    hashCadena: string,
    alcance: AlcanceAnalisis,
    modeloUsado: string,
    promptSistemaHash: string,
    latenciaMs: number,
    motivoFallo: string,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`analisis:${expedienteId}`}))`;

        const placeholder = await tx.analisisExpediente.findFirst({
            where: { expedienteId, hashCadena, estado: "GENERANDO" },
            select: { id: true },
        });

        if (placeholder) {
            await tx.analisisExpediente.update({
                where: { id: placeholder.id },
                data: { modeloUsado, promptSistemaHash, latenciaMs, estado: "FALLIDO", motivoFallo },
            });
            return;
        }

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
                corteN: 0,
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
