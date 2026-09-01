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
    /**
     * Audit 87c311a0 · fix nº2: tras N FALLIDOs consecutivos por el mismo
     * hashActual, la UI muestra "no pudimos generarlo, reintentaremos" en
     * vez de re-encolar y re-prometer "~2 minutos" en bucle. N =
     * padre.analisis.max_fallidos_consecutivos (default 3).
     */
    agotadoPorFallos: boolean;
    ultimoMotivoFallo: string | null;
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

/**
 * Audit #214 · un placeholder GENERANDO más viejo que `expireInSeconds`
 * del job (tiempo_estimado_seg * 3) es huérfano — el worker se cayó o el
 * job expiró en pg-boss. Se marca FALLIDO para que la UI deje de esperar,
 * y el flujo sigue como si no hubiera nada en curso (re-encola).
 */
async function marcarGenerandoHuerfanoComoFallido(
    expedienteId: string,
    hashCadena: string,
    edadMinimaSeg: number,
): Promise<boolean> {
    const limite = new Date(Date.now() - edadMinimaSeg * 1000);
    const huerfano = await prisma.analisisExpediente.findFirst({
        where: { expedienteId, hashCadena, estado: "GENERANDO", generadoEn: { lt: limite } },
        select: { id: true },
    });
    if (!huerfano) return false;
    await prisma.analisisExpediente.update({
        where: { id: huerfano.id },
        data: { estado: "FALLIDO", motivoFallo: "worker_no_completo" },
    });
    return true;
}

/**
 * Audit #214 · fix nº5: para el POST del botón "Actualizar", el cooldown
 * se chequea ANTES de tocar la cola. Sin este split, un padre que aprieta
 * el botón durante el cooldown gatilla evaluación completa (que puede
 * encolar en `debeEncolar=true`) antes de que el POST responda "cooldown".
 * Devuelve solo lo necesario para decidir el rechazo temprano.
 */
export async function cooldownDeExpediente(
    expedienteId: string,
    usuarioId: string
): Promise<{ vigente: AnalisisVigenteDto | null; cooldown: { puedeActualizar: boolean; faltanSeg: number } }> {
    const vigente = await leerVigente(expedienteId, usuarioId); // lanza 404 si no dueña
    const cooldownMinRaw = await getParametroSistemaValor("padre.analisis.cooldown_min");
    const cooldownMin = Number.parseInt(cooldownMinRaw ?? "5", 10);
    const cooldown = vigente
        ? computeCooldown(vigente.generadoEn, cooldownMin)
        : { puedeActualizar: true, faltanSeg: 0 };
    return { vigente, cooldown };
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

    const [cooldownMinRaw, ttlHorasRaw, tiempoEstRaw, maxFallidosRaw] = await Promise.all([
        getParametroSistemaValor("padre.analisis.cooldown_min"),
        getParametroSistemaValor("padre.analisis.ttl_horas"),
        getParametroSistemaValor("padre.analisis.tiempo_estimado_seg"),
        getParametroSistemaValor("padre.analisis.max_fallidos_consecutivos"),
    ]);
    const cooldownMin = Number.parseInt(cooldownMinRaw ?? "5", 10);
    const ttlHoras = Number.parseInt(ttlHorasRaw ?? "168", 10);
    const tiempoEstSeg = Number.parseInt(tiempoEstRaw ?? "90", 10);
    const maxFallidos = Number.parseInt(maxFallidosRaw ?? "3", 10);

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

    // Audit #214: si hay un placeholder GENERANDO huérfano (worker cayó / job
    // expiró), lo marcamos FALLIDO ANTES de decidir. `expireInSeconds` del
    // job = tiempo_estimado_seg * 3 en el helper de la cola; usamos la misma
    // ventana acá para coherencia.
    await marcarGenerandoHuerfanoComoFallido(expedienteId, hashActual, tiempoEstSeg * 3);

    // Audit 87c311a0 · fix nº2: contar FALLIDOs del mismo hash. Si superan el
    // umbral, la UI muestra estado terminal ("no pudimos generarlo") en vez
    // de re-encolar en bucle.
    const { agotadoPorFallos, ultimoMotivoFallo } = await contarFallidosConsecutivos(
        expedienteId, hashActual, maxFallidos
    );

    if (debeEncolar && !agotadoPorFallos) {
        const yaEnCurso = await ultimoGenerandoDe(expedienteId, hashActual);
        if (yaEnCurso) {
            estado = "GENERANDO";
            const stats = await getAnalisisQueueStats();
            // Audit #214 · fix nº4: "pendientes" es el TOTAL de la cola, no la
            // posición del job de este expediente. Sin API que devuelva la fila
            // exacta, cambiamos el texto a "hay N trabajos en la fila" — honesto,
            // sin fingir precisión. El polling refresca cada 15 s.
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
                // Placeholder GENERANDO para que la UI lo vea sin depender del worker.
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
        agotadoPorFallos,
        ultimoMotivoFallo,
    };
}

/**
 * Cuenta cuántos FALLIDOS del mismo `hashCadena` ocurrieron DESPUÉS del último
 * PUBLICADO del expediente. Si superan el umbral, se considera "agotado" —
 * la UI muestra estado terminal en vez de re-encolar y re-prometer.
 */
async function contarFallidosConsecutivos(
    expedienteId: string,
    hashCadena: string,
    umbral: number,
): Promise<{ agotadoPorFallos: boolean; ultimoMotivoFallo: string | null }> {
    const ultimoPub = await prisma.analisisExpediente.findFirst({
        where: { expedienteId, estado: "PUBLICADO" },
        orderBy: { versionSecuencial: "desc" },
        select: { versionSecuencial: true },
    });
    const versionMin = ultimoPub?.versionSecuencial ?? 0;
    const fallidos = await prisma.analisisExpediente.findMany({
        where: { expedienteId, hashCadena, estado: "FALLIDO", versionSecuencial: { gt: versionMin } },
        orderBy: { versionSecuencial: "desc" },
        select: { motivoFallo: true },
    });
    return {
        agotadoPorFallos: fallidos.length >= umbral,
        ultimoMotivoFallo: fallidos[0]?.motivoFallo ?? null,
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
