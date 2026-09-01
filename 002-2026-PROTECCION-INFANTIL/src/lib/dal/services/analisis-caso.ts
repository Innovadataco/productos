/**
 * SPEC-350 (A-69 · C3 · T030) — DAL del análisis IA del CASO del colegio.
 *
 * Espejo del DAL del padre (`analisis-expediente.ts`) con el dueño
 * `seguimientoCasoId` y boundary de colegio: solo el SCHOOL_ADMIN o el
 * COMITE_CONVIVENCIA del MISMO colegio del caso pueden leer/encolar.
 *
 * La cadena del caso se hashea con el MISMO `calcularHashCadena` del padre,
 * derivando: ultimoEventoEn = fecha del último hecho visible; numEventos =
 * cantidad de hechos; categoriasDominantesJson = conteos por categoría.
 * Cualquier reporte nuevo del identificador cambia el hash → regeneración.
 *
 * Economía heredada completa: TTL, cool-down, tope de fila, huérfanos,
 * agotamiento por FALLIDOs (SPEC-347/348) y escape manual del botón.
 */
import { prisma } from "../../prisma";
import { AppError, ERROR_CODES } from "../../errors";
import { getParametroSistemaValor } from "../../parametros";
import { calcularHashCadena } from "../../expediente/analisis/hash-cadena";
import { cargarCasoConHechos, type CasoConHechos } from "../../caso/hechos-caso";
import { sendAnalisisExpediente, getAnalisisQueueStats } from "../../queue";
import type { CategoriaConducta } from "@prisma/client";

export interface GuiaAccionResumenCaso {
    id: string;
    tituloEmocional: string;
    pasosJson: unknown;
}

export interface AnalisisCasoVigenteDto {
    versionSecuencial: number;
    texto: string;
    corteN: number;
    categoriaDominante: string | null;
    generadoEn: Date;
    guiaAccion: GuiaAccionResumenCaso | null;
}

export type EstadoAnalisisCasoUi = "PUBLICADO" | "GENERANDO" | "FALLIDO" | "SIN_ANALISIS";

export interface EvaluacionCasoDto {
    vigente: AnalisisCasoVigenteDto | null;
    hashActual: string;
    coincide: boolean;
    hechosNuevosDesde: number;
    estado: EstadoAnalisisCasoUi;
    cola: { posicion: number; estimadoSeg: number } | null;
    colaLlena: boolean;
    cooldown: { puedeActualizar: boolean; faltanSeg: number };
    agotadoPorFallos: boolean;
    ultimoMotivoFallo: string | null;
    /** Datos de la pantalla: hechos visibles + curso + estado del caso. */
    caso: CasoConHechos["caso"];
    hechos: CasoConHechos["hechos"];
}

interface UsuarioColegio {
    id: string;
    rol: string;
    colegioId?: string | null;
    comiteColegioId?: string | null;
}

/**
 * Boundary del colegio: SCHOOL_ADMIN (colegioId) o COMITE_CONVIVENCIA
 * (comiteColegioId) del MISMO colegio del caso. Lanza 403/404.
 */
function verificarBoundary(caso: CasoConHechos, usuario: UsuarioColegio): void {
    const colegioDelUsuario = usuario.rol === "SCHOOL_ADMIN"
        ? usuario.colegioId
        : usuario.rol === "COMITE_CONVIVENCIA"
            ? usuario.comiteColegioId
            : null;
    if (!colegioDelUsuario) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    if (caso.caso.colegioId !== colegioDelUsuario) {
        throw new AppError("Caso no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
}

function hashDelCaso(datos: CasoConHechos): string {
    const conteos: Record<string, number> = {};
    for (const h of datos.hechos) {
        if (h.categoria) conteos[h.categoria] = (conteos[h.categoria] ?? 0) + 1;
    }
    const ultimo = datos.hechos.length > 0 ? datos.hechos[datos.hechos.length - 1].fecha : null;
    return calcularHashCadena({
        ultimoEventoEn: ultimo,
        numEventos: datos.hechos.length,
        categoriasDominantesJson: conteos,
    });
}

async function leerVigenteInterno(seguimientoCasoId: string): Promise<AnalisisCasoVigenteDto | null> {
    const vigente = await prisma.analisisExpediente.findFirst({
        where: { seguimientoCasoId, estado: "PUBLICADO", alcance: "COLEGIO_BLINDADO" },
        orderBy: { versionSecuencial: "desc" },
        select: {
            versionSecuencial: true,
            texto: true,
            corteN: true,
            categoriaDominante: true,
            generadoEn: true,
            guiaAccion: { select: { id: true, tituloEmocional: true, pasosJson: true } },
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

function computeCooldown(generadoEn: Date, cooldownMin: number) {
    const pasadoSeg = Math.floor((Date.now() - generadoEn.getTime()) / 1000);
    const totalSeg = cooldownMin * 60;
    if (pasadoSeg >= totalSeg) return { puedeActualizar: true, faltanSeg: 0 };
    return { puedeActualizar: false, faltanSeg: totalSeg - pasadoSeg };
}

async function marcarGenerandoHuerfanoComoFallido(seguimientoCasoId: string, hashCadena: string, edadMinimaSeg: number): Promise<void> {
    const limite = new Date(Date.now() - edadMinimaSeg * 1000);
    const huerfano = await prisma.analisisExpediente.findFirst({
        where: { seguimientoCasoId, hashCadena, estado: "GENERANDO", generadoEn: { lt: limite } },
        select: { id: true },
    });
    if (!huerfano) return;
    await prisma.analisisExpediente.update({
        where: { id: huerfano.id },
        data: { estado: "FALLIDO", motivoFallo: "worker_no_completo" },
    });
}

async function contarFallidosConsecutivos(seguimientoCasoId: string, hashCadena: string, umbral: number) {
    const ultimoPub = await prisma.analisisExpediente.findFirst({
        where: { seguimientoCasoId, estado: "PUBLICADO" },
        orderBy: { versionSecuencial: "desc" },
        select: { versionSecuencial: true },
    });
    const versionMin = ultimoPub?.versionSecuencial ?? 0;
    const fallidos = await prisma.analisisExpediente.findMany({
        where: { seguimientoCasoId, hashCadena, estado: "FALLIDO", versionSecuencial: { gt: versionMin } },
        orderBy: { versionSecuencial: "desc" },
        select: { motivoFallo: true },
    });
    return {
        agotadoPorFallos: fallidos.length >= umbral,
        ultimoMotivoFallo: fallidos[0]?.motivoFallo ?? null,
    };
}

async function marcarGenerando(seguimientoCasoId: string, hashCadena: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`analisis:${seguimientoCasoId}`}))`;
        const existe = await tx.analisisExpediente.findFirst({
            where: { seguimientoCasoId, hashCadena, estado: "GENERANDO" },
            select: { id: true },
        });
        if (existe) return;
        const ultimo = await tx.analisisExpediente.findFirst({
            where: { seguimientoCasoId },
            orderBy: { versionSecuencial: "desc" },
            select: { versionSecuencial: true },
        });
        await tx.analisisExpediente.create({
            data: {
                seguimientoCasoId,
                versionSecuencial: (ultimo?.versionSecuencial ?? 0) + 1,
                alcance: "COLEGIO_BLINDADO",
                hashCadena,
                corteN: 0,
                texto: "",
                modeloUsado: "?",
                promptSistemaHash: "?",
                latenciaMs: 0,
                estado: "GENERANDO",
            },
        });
    });
}

/** El cool-down del caso — para el rechazo temprano del POST (patrón SPEC-348 nº5). */
export async function cooldownDeCaso(
    casoId: string,
    usuario: UsuarioColegio
): Promise<{ vigente: AnalisisCasoVigenteDto | null; cooldown: { puedeActualizar: boolean; faltanSeg: number } }> {
    const datos = await cargarCasoConHechos(casoId);
    if (!datos) throw new AppError("Caso no encontrado", ERROR_CODES.NOT_FOUND, 404);
    verificarBoundary(datos, usuario);
    const vigente = await leerVigenteInterno(casoId);
    const cooldownMinRaw = await getParametroSistemaValor("padre.analisis.cooldown_min");
    const cooldownMin = Number.parseInt(cooldownMinRaw ?? "5", 10);
    const cooldown = vigente
        ? computeCooldown(vigente.generadoEn, cooldownMin)
        : { puedeActualizar: true, faltanSeg: 0 };
    return { vigente, cooldown };
}

export async function evaluarYEncolarCaso(
    casoId: string,
    usuario: UsuarioColegio,
    disparador: "APERTURA" | "ACTUALIZAR"
): Promise<EvaluacionCasoDto> {
    const datos = await cargarCasoConHechos(casoId);
    if (!datos) throw new AppError("Caso no encontrado", ERROR_CODES.NOT_FOUND, 404);
    verificarBoundary(datos, usuario);

    const hashActual = hashDelCaso(datos);

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

    const vigente = await leerVigenteInterno(casoId);
    const coincide = vigente ? await hashVigenteCoincide(casoId, hashActual) : false;
    const hechosNuevosDesde = vigente ? Math.max(0, datos.hechos.length - vigente.corteN) : 0;

    const cooldown = vigente
        ? computeCooldown(vigente.generadoEn, cooldownMin)
        : { puedeActualizar: true, faltanSeg: 0 };

    const ttlObsoleto = vigente
        ? (Date.now() - vigente.generadoEn.getTime()) > ttlHoras * 3600 * 1000
        : false;

    // Caso cerrado: se muestra lo vigente pero NO se gasta modelo (edge de la spec).
    const casoCerrado = datos.caso.estado === "cerrado";
    const debeEncolar = !casoCerrado && datos.hechos.length > 0 && (!vigente || !coincide || ttlObsoleto);

    await marcarGenerandoHuerfanoComoFallido(casoId, hashActual, tiempoEstSeg * 3);

    const { agotadoPorFallos, ultimoMotivoFallo } = await contarFallidosConsecutivos(casoId, hashActual, maxFallidos);
    // El botón Actualizar es la vía de escape (SPEC-348): solo la apertura respeta el corte.
    const bloqueadoPorAgotamiento = agotadoPorFallos && disparador === "APERTURA";

    let cola: { posicion: number; estimadoSeg: number } | null = null;
    let colaLlena = false;
    let estado: EstadoAnalisisCasoUi = vigente ? "PUBLICADO" : "SIN_ANALISIS";

    if (debeEncolar && !bloqueadoPorAgotamiento) {
        const yaEnCurso = await prisma.analisisExpediente.findFirst({
            where: { seguimientoCasoId: casoId, hashCadena: hashActual, estado: "GENERANDO" },
            select: { id: true },
        });
        if (yaEnCurso) {
            estado = "GENERANDO";
            const stats = await getAnalisisQueueStats();
            cola = { posicion: Math.max(1, stats.pendientes), estimadoSeg: Math.max(1, stats.pendientes) * tiempoEstSeg };
        } else {
            const enviado = await sendAnalisisExpediente({
                seguimientoCasoId: casoId,
                hashCadena: hashActual,
                alcance: "COLEGIO_BLINDADO",
                disparador,
                solicitadoEn: new Date().toISOString(),
            });
            if (enviado.encolado) {
                estado = "GENERANDO";
                const stats = await getAnalisisQueueStats();
                cola = { posicion: Math.max(1, stats.pendientes), estimadoSeg: Math.max(1, stats.pendientes) * tiempoEstSeg };
                await marcarGenerando(casoId, hashActual);
            } else if (enviado.motivo === "cola_llena") {
                colaLlena = true;
            }
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
        caso: datos.caso,
        hechos: datos.hechos,
    };
}

async function hashVigenteCoincide(seguimientoCasoId: string, hashActual: string): Promise<boolean> {
    const row = await prisma.analisisExpediente.findFirst({
        where: { seguimientoCasoId, estado: "PUBLICADO" },
        orderBy: { versionSecuencial: "desc" },
        select: { hashCadena: true },
    });
    return row?.hashCadena === hashActual;
}
