/**
 * SPEC-341 (T018) — el orquestador del worker: arma datos, llama al modelo,
 * valida la salida, y persiste el `AnalisisExpediente` con estado PUBLICADO
 * (o FALLIDO con motivo). No lanza excepción hacia pg-boss: el fallo se ve
 * en la fila del `AnalisisExpediente`, no en la métrica del worker.
 *
 * SPEC-350 (A-69 C3): el mismo orquestador atiende jobs del CASO del colegio
 * (`seguimientoCasoId` + alcance COLEGIO_BLINDADO) sin ramas de negocio
 * nuevas — cambia el cargador de datos (agregados anónimos del caso) y el
 * dueño de la persistencia. El pipeline modelo→validación→persistencia es
 * exactamente el mismo.
 */
import { prisma } from "../../prisma";
import { logger } from "../../logger";
import { getParametroSistemaValor } from "../../parametros";
import { llamarOllamaStructured } from "../../ai/ollama-client";
import { armarPayload, type HechoPadre, type PayloadAnalisis } from "./armar-payload";
import { resolverPromptSistema } from "./prompt";
import { validarSalida } from "./validar-salida";
import { cargarCasoConHechos } from "../../caso/hechos-caso";
import type { AlcanceAnalisis, CategoriaConducta, Prisma } from "@prisma/client";

export interface EjecutarAnalisisArgs {
    /** SPEC-350: exactamente UNO de los dos dueños. */
    expedienteId?: string;
    seguimientoCasoId?: string;
    hashCadena: string;
    alcance: AlcanceAnalisis;
}

/**
 * Dueño del análisis. String plano = expedienteId (compatibilidad con los
 * llamadores de SPEC-341); objeto = caso del colegio.
 */
export type DuenoAnalisis = string | { seguimientoCasoId: string };

interface DuenoNormalizado {
    expedienteId: string | null;
    seguimientoCasoId: string | null;
    lockKey: string;
}

function normalizarDueno(dueno: DuenoAnalisis): DuenoNormalizado {
    if (typeof dueno === "string") {
        return { expedienteId: dueno, seguimientoCasoId: null, lockKey: `analisis:${dueno}` };
    }
    return {
        expedienteId: null,
        seguimientoCasoId: dueno.seguimientoCasoId,
        lockKey: `analisis:${dueno.seguimientoCasoId}`,
    };
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

/** Punto único de entrada del worker — despacha por dueño. */
export async function ejecutarAnalisisJob(args: EjecutarAnalisisArgs): Promise<void> {
    const { expedienteId, seguimientoCasoId, hashCadena, alcance } = args;

    if (seguimientoCasoId) {
        await ejecutarJobCaso(seguimientoCasoId, hashCadena);
        return;
    }
    if (!expedienteId) {
        logger.error("[analisis] job sin dueño (ni expedienteId ni seguimientoCasoId) — descartado");
        return;
    }
    await ejecutarJobPadre(expedienteId, hashCadena, alcance);
}

async function ejecutarJobPadre(expedienteId: string, hashCadena: string, alcance: AlcanceAnalisis): Promise<void> {
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
                        // Audit 615 chars · fix nº2: EventoExpediente.plataforma /
                        // categoriaDetectada quedan null si el flujo no los rellenó
                        // (típico: hilo padre sin categoría directa). Los campos
                        // autoritativos viven en Reporte.
                        reporte: {
                            select: {
                                ciudad: true,
                                pais: true,
                                edadVictima: true,
                                fechaIncidente: true,
                                plataforma: { select: { clave: true } },
                                clasificacion: { select: { categoria: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!expediente) {
            logger.warn(`[analisis] expediente ${expedienteId} desapareció antes del job — abort`);
            return;
        }

        // 2. Mapear hechos al shape del armador de padre.
        // Audit 615 chars (fix nº1 y nº2):
        //  · fecha: preferir Reporte.fechaIncidente (día y hora real del hecho,
        //    la que Jelkin lee en el mockup), no EventoExpediente.fechaEvento
        //    (que puede coincidir con creadoEn del evento en UTC).
        //  · plataforma / categoría: cuando el EventoExpediente no las trae,
        //    tomarlas del Reporte enlazado. En un hilo del padre lo común es
        //    que la fuente autoritativa sea Reporte.
        const hechos: HechoPadre[] = expediente.eventos.map((e) => ({
            fecha: e.reporte?.fechaIncidente ?? e.fechaEvento,
            ciudad: e.reporte?.ciudad ?? null,
            pais: e.reporte?.pais ?? null,
            plataforma: e.plataforma ?? e.reporte?.plataforma?.clave ?? null,
            categoria: ((e.categoriaDetectada as CategoriaConducta | null)
                ?? (e.reporte?.clasificacion?.categoria ?? null)),
            edadReportada: e.reporte?.edadVictima ?? null,
        }));

        // Cruce con hijo (solo edad/sexo, jamás nombre).
        const hijoCruzado = expediente.padreUsuarioId
            ? await cargarHijoCruzado(expediente.padreUsuarioId, expediente.identificadorReportado)
            : null;

        // 3. Armar payload según alcance.
        const payload: PayloadAnalisis = alcance === "PADRE_COMPLETO"
            ? armarPayload({ alcance: "PADRE_COMPLETO", hechos, hijoCruzado })
            : armarPayload({ alcance: "COLEGIO_BLINDADO", agregados: [] });

        await generarYPersistir(expediente.id, hashCadena, alcance, payload, hechos.length);
    } catch (err) {
        const motivo = err instanceof Error ? err.message.slice(0, 500) : "error_desconocido";
        logger.error(`[analisis] FALLIDO expediente=${expedienteId}: ${motivo}`);
        await cerrarPlaceholderFallando(expedienteId, hashCadena, alcance, "?", "?", 0, motivo).catch(() => null);
    }
}

/**
 * SPEC-349 (audit 615 chars) · serializa las fechas del payload en TZ Bogota
 * ANTES de pasarlo al modelo. Sin esto, `JSON.stringify` las convierte a UTC
 * y el modelo interpreta "09:19Z" como "franja matutina" cuando el hecho
 * ocurrió a las 21:15 hora Bogota (noche). Devuelve un objeto plano listo
 * para stringify — el shape es igual al `PayloadAnalisis` original pero con
 * `fecha: string`.
 */
const fmtFechaBogota = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
});

export function payloadParaModelo(payload: PayloadAnalisis): unknown {
    if (payload.alcance === "PADRE_COMPLETO") {
        return {
            ...payload,
            hechos: payload.hechos.map((h) => ({
                ...h,
                fecha: fmtFechaBogota.format(h.fecha),
            })),
        };
    }
    return payload; // COLEGIO_BLINDADO no lleva fechas individuales
}

/**
 * SPEC-350: job del caso del colegio. Carga los hechos que el colegio puede
 * ver (fecha/lugar/clasificación — cero texto, cero identidad) y arma el
 * payload BLINDADO de agregados anónimos.
 */
async function ejecutarJobCaso(seguimientoCasoId: string, hashCadena: string): Promise<void> {
    const dueno: DuenoAnalisis = { seguimientoCasoId };
    try {
        const casoConHechos = await cargarCasoConHechos(seguimientoCasoId);
        if (!casoConHechos) {
            logger.warn(`[analisis] caso ${seguimientoCasoId} desapareció antes del job — abort`);
            return;
        }

        const payload = armarPayload({ alcance: "COLEGIO_BLINDADO", agregados: casoConHechos.agregados });
        await generarYPersistir(dueno, hashCadena, "COLEGIO_BLINDADO", payload, casoConHechos.hechos.length);
    } catch (err) {
        const motivo = err instanceof Error ? err.message.slice(0, 500) : "error_desconocido";
        logger.error(`[analisis] FALLIDO caso=${seguimientoCasoId}: ${motivo}`);
        await cerrarPlaceholderFallando(dueno, hashCadena, "COLEGIO_BLINDADO", "?", "?", 0, motivo).catch(() => null);
    }
}

/** Pipeline compartido: prompt → modelo → validaciones → persistencia. */
async function generarYPersistir(
    dueno: DuenoAnalisis,
    hashCadena: string,
    alcance: AlcanceAnalisis,
    payload: PayloadAnalisis,
    corteN: number,
): Promise<void> {
    const etiqueta = typeof dueno === "string" ? `expediente=${dueno}` : `caso=${dueno.seguimientoCasoId}`;

    // 4. Resolver prompt y modelo.
    const { texto: promptSistema, hash: promptSistemaHash } = await resolverPromptSistema(alcance);
    const modelo = (await getParametroSistemaValor(alcance === "PADRE_COMPLETO"
        ? "padre.analisis.modelo"
        : "colegio.analisis.modelo"
    )) ?? "qwen2.5:14b";

    // 5. Llamar al modelo con JSON schema estructurado.
    // SPEC-349: las fechas van serializadas en TZ Bogota (payloadParaModelo) —
    // sin esto, Date → UTC ISO y el modelo lee un hecho nocturno como matutino.
    const inicio = Date.now();
    const { data, metrics } = await llamarOllamaStructured<AnalisisSalida>(
        modelo,
        JSON.stringify(payloadParaModelo(payload), null, 2),
        SALIDA_SCHEMA,
        promptSistema
    );

    // 6a. Validar longitud del texto (movido acá porque el schema JSON no
    // puede llevar minLength/maxLength — rompe la gramática GBNF de Ollama).
    if (data.texto.length < TEXTO_MIN_CHARS || data.texto.length > TEXTO_MAX_CHARS) {
        await cerrarPlaceholderFallando(dueno, hashCadena, alcance, modelo, promptSistemaHash, metrics.latenciaMs,
            `longitud_fuera_de_rango: ${data.texto.length} chars (rango ${TEXTO_MIN_CHARS}-${TEXTO_MAX_CHARS})`);
        logger.warn(`[analisis] texto fuera de rango · ${etiqueta} · chars=${data.texto.length}`);
        return;
    }

    // 6b. Validar salida anti-frases prohibidas.
    const validacion = await validarSalida(data.texto);
    if (!validacion.ok) {
        await cerrarPlaceholderFallando(dueno, hashCadena, alcance, modelo, promptSistemaHash, metrics.latenciaMs,
            `${validacion.motivo}: "${validacion.fraseDetectada}"`);
        logger.warn(`[analisis] rechazado por frase prohibida "${validacion.fraseDetectada}" · ${etiqueta}`);
        return;
    }

    // 7. Persistir PUBLICADO sobre el placeholder.
    await cerrarPlaceholderPublicando(
        dueno,
        hashCadena,
        alcance,
        data.texto,
        payload,
        modelo,
        promptSistemaHash,
        Date.now() - inicio,
        corteN,
    );
    logger.info(`[analisis] PUBLICADO ${etiqueta} hash=${hashCadena.slice(0, 8)}… latencia=${Date.now() - inicio}ms`);
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
 * al abrir (audit #214 · candado 1: cerrar la fila, no crear una nueva — si
 * no, el placeholder queda eterno y la UI hace polling infinito). Si por
 * alguna raza NO existe placeholder, se crea una fila con `versionSecuencial`
 * nuevo por respaldo.
 *
 * SPEC-350: `dueno` acepta el expedienteId plano (padre, compatibilidad) o
 * `{ seguimientoCasoId }` (caso del colegio).
 */
export async function cerrarPlaceholderPublicando(
    dueno: DuenoAnalisis,
    hashCadena: string,
    alcance: AlcanceAnalisis,
    texto: string,
    payload: PayloadAnalisis,
    modeloUsado: string,
    promptSistemaHash: string,
    latenciaMs: number,
    corteN: number,
): Promise<void> {
    const d = normalizarDueno(dueno);
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.lockKey}))`;

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

        const whereDueno = d.expedienteId
            ? { expedienteId: d.expedienteId }
            : { seguimientoCasoId: d.seguimientoCasoId };

        const placeholder = await tx.analisisExpediente.findFirst({
            where: { ...whereDueno, hashCadena, estado: "GENERANDO" },
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
            where: whereDueno,
            orderBy: { versionSecuencial: "desc" },
            select: { versionSecuencial: true },
        });
        await tx.analisisExpediente.create({
            data: {
                expedienteId: d.expedienteId,
                seguimientoCasoId: d.seguimientoCasoId,
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
    dueno: DuenoAnalisis,
    hashCadena: string,
    alcance: AlcanceAnalisis,
    modeloUsado: string,
    promptSistemaHash: string,
    latenciaMs: number,
    motivoFallo: string,
): Promise<void> {
    const d = normalizarDueno(dueno);
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.lockKey}))`;

        const whereDueno = d.expedienteId
            ? { expedienteId: d.expedienteId }
            : { seguimientoCasoId: d.seguimientoCasoId };

        const placeholder = await tx.analisisExpediente.findFirst({
            where: { ...whereDueno, hashCadena, estado: "GENERANDO" },
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
            where: whereDueno,
            orderBy: { versionSecuencial: "desc" },
            select: { versionSecuencial: true },
        });
        await tx.analisisExpediente.create({
            data: {
                expedienteId: d.expedienteId,
                seguimientoCasoId: d.seguimientoCasoId,
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
