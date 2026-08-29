import type { PrismaClient } from "@prisma/client";
import type { EntradaMotor, RespuestaMotor } from "./tipos";
import { evaluarPreGuard } from "./pre-guard";
import { evaluarTenancy } from "./tenancy-guard";
import { construirSchemaJSON } from "./catalogo";
import { vectorizar } from "./embedding";
import { buscarSimilar } from "./cache-semantico";
import { generarSql as vannaGenerarSql } from "./vanna-client";
import { validarSqlGenerado } from "./post-validator";
import { sanearFilas } from "./sanitizer";
import { elegirPlantilla } from "./plantillas";

export interface DependenciasMotor {
    prisma: PrismaClient;
    vectorizarFn?: typeof vectorizar;
    vannaGenerarFn?: typeof vannaGenerarSql;
    buscarSimilarFn?: typeof buscarSimilar;
    construirSchemaFn?: typeof construirSchemaJSON;
}

async function crearLog(
    prisma: PrismaClient,
    input: EntradaMotor,
): Promise<string> {
    const row = await prisma.bIConsultaLog.create({
        data: {
            usuarioId: input.usuario.id,
            preguntaNL: input.preguntaNL,
            estado: "pendiente",
        },
        select: { id: true },
    });
    return row.id;
}

async function cerrarLog(
    prisma: PrismaClient,
    id: string,
    patch: {
        estado: string;
        latenciaMs: number;
        sqlGenerado?: string | null;
        fuenteCache?: boolean;
        error?: string | null;
    },
): Promise<void> {
    await prisma.bIConsultaLog.update({
        where: { id },
        data: patch,
    });
}

export async function preguntar(
    input: EntradaMotor,
    deps: DependenciasMotor,
): Promise<RespuestaMotor> {
    const t0 = Date.now();
    const prisma = deps.prisma;
    const vectorizarFn = deps.vectorizarFn ?? vectorizar;
    const vannaFn = deps.vannaGenerarFn ?? vannaGenerarSql;
    const buscarFn = deps.buscarSimilarFn ?? buscarSimilar;
    const schemaFn = deps.construirSchemaFn ?? construirSchemaJSON;

    const consultaLogId = await crearLog(prisma, input).catch(() => "");

    const pre = evaluarPreGuard(input.preguntaNL);
    if (!pre.permitido) {
        const latenciaMs = Date.now() - t0;
        if (consultaLogId) {
            await cerrarLog(prisma, consultaLogId, {
                estado: "RECHAZADO",
                latenciaMs,
                error: pre.razon,
            }).catch(() => undefined);
        }
        return {
            estado: "RECHAZADO",
            razon: pre.razon,
            llamadasLlm: 0,
            latenciaMs,
            cacheHit: false,
            consultaLogId,
        };
    }

    const ten = evaluarTenancy(input.usuario);
    if (!ten.permite) {
        const latenciaMs = Date.now() - t0;
        if (consultaLogId) {
            await cerrarLog(prisma, consultaLogId, {
                estado: "RECHAZADO",
                latenciaMs,
                error: ten.razon,
            }).catch(() => undefined);
        }
        return {
            estado: "RECHAZADO",
            razon: ten.razon,
            llamadasLlm: 0,
            latenciaMs,
            cacheHit: false,
            consultaLogId,
        };
    }

    const emb = await vectorizarFn(input.preguntaNL);
    const hit = await buscarFn(prisma, emb);
    let sqlEjecutar: string | undefined;
    let cacheHit = false;
    let llamadasLlm = 0;
    let votosJurado;

    if (hit) {
        sqlEjecutar = hit.sqlAprobado;
        cacheHit = true;
    } else {
        const { catalogoResuelto, catalogoParaVanna } = await schemaFn(prisma, input.usuario.rol);
        const resVanna = await vannaFn({
            preguntaNL: input.preguntaNL,
            catalogo: catalogoParaVanna,
        });
        llamadasLlm = resVanna.votosJurado?.length ?? 0;
        votosJurado = resVanna.votosJurado;

        if (!resVanna.consenso || !resVanna.sqlGenerado) {
            const latenciaMs = Date.now() - t0;
            if (consultaLogId) {
                await cerrarLog(prisma, consultaLogId, {
                    estado: "REVISION",
                    latenciaMs,
                    error: resVanna.razon || resVanna.error || "sin_consenso",
                }).catch(() => undefined);
            }
            return {
                estado: "REVISION",
                razon: resVanna.razon || resVanna.error || "sin_consenso",
                llamadasLlm,
                latenciaMs,
                cacheHit: false,
                consultaLogId,
                votosJurado,
            };
        }

        const val = validarSqlGenerado(resVanna.sqlGenerado, catalogoResuelto, input.usuario.rol);
        if (!val.valido) {
            const latenciaMs = Date.now() - t0;
            if (consultaLogId) {
                await cerrarLog(prisma, consultaLogId, {
                    estado: "RECHAZADO",
                    latenciaMs,
                    sqlGenerado: resVanna.sqlGenerado,
                    error: val.razon,
                }).catch(() => undefined);
            }
            return {
                estado: "RECHAZADO",
                razon: val.razon,
                sqlGenerado: resVanna.sqlGenerado,
                llamadasLlm,
                latenciaMs,
                cacheHit: false,
                consultaLogId,
                votosJurado,
            };
        }
        sqlEjecutar = resVanna.sqlGenerado;
    }

    let filas: Array<Record<string, unknown>> = [];
    try {
        filas = (await prisma.$queryRawUnsafe(sqlEjecutar!)) as Array<
            Record<string, unknown>
        >;
    } catch (e) {
        const latenciaMs = Date.now() - t0;
        const err = e instanceof Error ? e.message : "sql_execution_error";
        if (consultaLogId) {
            await cerrarLog(prisma, consultaLogId, {
                estado: "RECHAZADO",
                latenciaMs,
                sqlGenerado: sqlEjecutar,
                fuenteCache: cacheHit,
                error: `sql_execution_error:${err}`,
            }).catch(() => undefined);
        }
        return {
            estado: "RECHAZADO",
            razon: "sql_execution_error",
            sqlGenerado: sqlEjecutar,
            llamadasLlm,
            latenciaMs,
            cacheHit,
            consultaLogId,
            votosJurado,
        };
    }

    const san = sanearFilas(filas);
    const plantilla = elegirPlantilla(san.filas);
    const latenciaMs = Date.now() - t0;

    if (consultaLogId) {
        await cerrarLog(prisma, consultaLogId, {
            estado: "OK",
            latenciaMs,
            sqlGenerado: sqlEjecutar,
            fuenteCache: cacheHit,
        }).catch(() => undefined);
    }

    return {
        estado: "OK",
        plantilla: plantilla.plantilla,
        respuestaNarrativa: plantilla.respuestaNarrativa,
        graficoSpec: plantilla.graficoSpec,
        filas: san.filas,
        sqlGenerado: sqlEjecutar,
        llamadasLlm,
        latenciaMs,
        cacheHit,
        consultaLogId,
        votosJurado,
    };
}

// Legacy stub kept exported for the pre-existing tests/unit/motor.test.ts
export async function preguntarVanna(_pregunta: string): Promise<string> {
    return "Motor BI no disponible aún · Fase 2";
}
