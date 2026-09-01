/**
 * SPEC-341 (T030+T031) — DAL del análisis IA capa 2 del expediente.
 *
 * Dos entradas:
 *  · `leerVigente(expedienteId, usuarioId)` → última fila `PUBLICADO` con guía
 *    resuelta (o null si nunca hubo). Boundary: PARENT dueña, 403/404 fuera.
 *  · `evaluarYEncolarSiCorresponde(expedienteId, usuarioId, disparador)` →
 *    calcula el hash actual, decide si encolar y devuelve el estado que la
 *    ruta serializa al UI.
 *
 * Reglas cubiertas: FR-001/002/003/007/008-ter/008-quater y FR-017.
 */
import { prisma } from "../../prisma";
import { AppError, ERROR_CODES } from "../../errors";
import { getParametroSistemaValor } from "../../parametros";
import { calcularHashCadena } from "../../expediente/analisis/hash-cadena";
import { sendAnalisisExpediente, getAnalisisQueueStats } from "../../queue";
import type { AlcanceAnalisis } from "@prisma/client";

export interface GuiaAccionResumen {
    id: string;
    tituloEmocional: string;
    pasosJson: unknown;
}

export interface AnalisisVigenteDto {
    versionSecuencial: number;
    texto: string;
    corteN: number;
    categoriaDominante: string | null;
    generadoEn: Date;
    guiaAccion: GuiaAccionResumen | null;
}

export type EstadoAnalisisUi = "PUBLICADO" | "GENERANDO" | "FALLIDO" | "SIN_ANALISIS";

export interface EvaluacionDto {
    vigente: AnalisisVigenteDto | null;
    hashActual: string;
    coincide: boolean;
    hechosNuevosDesde: number;
    estado: EstadoAnalisisUi;
    cola: { posicion: number; estimadoSeg: number } | null;
    colaLlena: boolean;
    cooldown: { puedeActualizar: boolean; faltanSeg: number };
}

async function cargarExpedienteDelPadre(expedienteId: string, usuarioId: string) {
    const exp = await prisma.expediente.findFirst({
        where: { id: expedienteId, padreUsuarioId: usuarioId },
        select: {
            id: true,
            numEventos: true,
            ultimoEventoEn: true,
            categoriasDominantesJson: true,
        },
    });
    if (!exp) throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    return exp;
}

export async function leerVigente(expedienteId: string, usuarioId: string): Promise<AnalisisVigenteDto | null> {
    // Guard de boundary — cargarExpediente lanza 404 si no es dueño.
    await cargarExpedienteDelPadre(expedienteId, usuarioId);

    const vigente = await prisma.analisisExpediente.findFirst({
        where: { expedienteId, estado: "PUBLICADO", alcance: "PADRE_COMPLETO" },
        orderBy: { versionSecuencial: "desc" },
        select: {
            versionSecuencial: true,
            texto: true,
            corteN: true,
            categoriaDominante: true,
            generadoEn: true,
            guiaAccion: {
                select: { id: true, tituloEmocional: true, pasosJson: true },
            },
        },
    });
    if (!vigente) return null;
    return {
        versionSecuencial: vigente.versionSecuencial,
        texto: vigente.texto,
        corteN: vigente.corteN,
        categoriaDominante: vigente.categoriaDominante,
        generadoEn: vigente.generadoEn,
        guiaAccion: vigente.guiaAccion
            ? { id: vigente.guiaAccion.id, tituloEmocional: vigente.guiaAccion.tituloEmocional, pasosJson: vigente.guiaAccion.pasosJson }
            : null,
    };
}

/** Trae el análisis en curso (GENERANDO) si existe, para el aviso "estamos generando". */
async function ultimoGenerandoDe(expedienteId: string, hash: string) {
    return prisma.analisisExpediente.findFirst({
        where: { expedienteId, hashCadena: hash, estado: "GENERANDO" },
        orderBy: { generadoEn: "desc" },
        select: { id: true, generadoEn: true },
    });
}

export async function evaluarYEncolarSiCorresponde(
    expedienteId: string,
    usuarioId: string,
    disparador: "APERTURA" | "ACTUALIZAR",
    alcance: AlcanceAnalisis = "PADRE_COMPLETO"
): Promise<EvaluacionDto> {
    const exp = await cargarExpedienteDelPadre(expedienteId, usuarioId);

    const hashActual = calcularHashCadena({
        ultimoEventoEn: exp.ultimoEventoEn,
        numEventos: exp.numEventos,
        categoriasDominantesJson: exp.categoriasDominantesJson,
    });

    const [cooldownMinRaw, ttlHorasRaw, tiempoEstRaw] = await Promise.all([
        getParametroSistemaValor("padre.analisis.cooldown_min"),
        getParametroSistemaValor("padre.analisis.ttl_horas"),
        getParametroSistemaValor("padre.analisis.tiempo_estimado_seg"),
    ]);
    const cooldownMin = Number.parseInt(cooldownMinRaw ?? "5", 10);
    const ttlHoras = Number.parseInt(ttlHorasRaw ?? "168", 10);
    const tiempoEstSeg = Number.parseInt(tiempoEstRaw ?? "90", 10);

    const vigente = await leerVigente(expedienteId, usuarioId);
    const coincide = vigente ? vigente.texto !== "" && await hashDelVigenteCoincide(expedienteId, hashActual) : false;
    const hechosNuevosDesde = vigente ? Math.max(0, exp.numEventos - vigente.corteN) : 0;

    // Estado del cool-down (medido desde el vigente).
    const cooldown = vigente
        ? computeCooldown(vigente.generadoEn, cooldownMin)
        : { puedeActualizar: true, faltanSeg: 0 };

    // Es TTL-obsoleto si tiene más horas que el TTL parametrizado.
    const ttlObsoleto = vigente
        ? (Date.now() - vigente.generadoEn.getTime()) > ttlHoras * 3600 * 1000
        : false;

    const debeEncolar = exp.numEventos > 0 && (!vigente || !coincide || ttlObsoleto);
    const disparadorEfectivo = disparador; // (idem por ahora; se puede usar para telemetría)

    let cola: { posicion: number; estimadoSeg: number } | null = null;
    let colaLlena = false;
    let estado: EstadoAnalisisUi = vigente ? "PUBLICADO" : "SIN_ANALISIS";

    if (debeEncolar) {
        const yaEnCurso = await ultimoGenerandoDe(expedienteId, hashActual);
        if (yaEnCurso) {
            estado = "GENERANDO";
            const stats = await getAnalisisQueueStats();
            cola = { posicion: Math.max(1, stats.pendientes), estimadoSeg: Math.max(1, stats.pendientes) * tiempoEstSeg };
        } else {
            const enviado = await sendAnalisisExpediente({
                expedienteId,
                hashCadena: hashActual,
                alcance,
                disparador: disparadorEfectivo,
                solicitadoEn: new Date().toISOString(),
            });
            if (enviado.encolado) {
                estado = "GENERANDO";
                const stats = await getAnalisisQueueStats();
                cola = { posicion: Math.max(1, stats.pendientes), estimadoSeg: Math.max(1, stats.pendientes) * tiempoEstSeg };
                // Insertamos un "placeholder" GENERANDO para que la UI lo vea sin depender del worker.
                await marcarGenerando(expedienteId, hashActual, alcance);
            } else if (enviado.motivo === "cola_llena") {
                colaLlena = true;
            }
            // "duplicado" ya está cubierto por la búsqueda de yaEnCurso.
        }
    }

    return {
        vigente,
        hashActual,
        coincide,
        hechosNuevosDesde,
        estado,
        cola,
        colaLlena,
        cooldown,
    };
}

function computeCooldown(generadoEn: Date, cooldownMin: number) {
    const pasadoSeg = Math.floor((Date.now() - generadoEn.getTime()) / 1000);
    const totalSeg = cooldownMin * 60;
    if (pasadoSeg >= totalSeg) return { puedeActualizar: true, faltanSeg: 0 };
    return { puedeActualizar: false, faltanSeg: totalSeg - pasadoSeg };
}

async function hashDelVigenteCoincide(expedienteId: string, hashActual: string): Promise<boolean> {
    const row = await prisma.analisisExpediente.findFirst({
        where: { expedienteId, estado: "PUBLICADO" },
        orderBy: { versionSecuencial: "desc" },
        select: { hashCadena: true },
    });
    return row?.hashCadena === hashActual;
}

/**
 * Inserta una fila GENERANDO para que la UI sepa que hay un análisis en marcha,
 * sin depender de que el worker haya arrancado el job. Usa el mismo advisory
 * lock por expediente que el worker (patrón I-208 · sin choques de versionSecuencial).
 */
async function marcarGenerando(expedienteId: string, hashCadena: string, alcance: AlcanceAnalisis): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`analisis:${expedienteId}`}))`;

        // Si ya hay uno GENERANDO con el mismo hash (raza contra el worker), no dupliques.
        const existe = await tx.analisisExpediente.findFirst({
            where: { expedienteId, hashCadena, estado: "GENERANDO" },
            select: { id: true },
        });
        if (existe) return;

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
                corteN: 0, // el worker lo actualiza al publicar (nueva fila, no update)
                texto: "",
                modeloUsado: "?",
                promptSistemaHash: "?",
                latenciaMs: 0,
                estado: "GENERANDO",
            },
        });
    });
}
