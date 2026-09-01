/**
 * SPEC-351 (A-69 · C5 · T030) — historial INMUTABLE de informes del caso.
 *
 * Mismo contrato que `informes-padre.ts` (A-68): este servicio expone SOLO
 * registrar, listar y buscar. No existe update ni delete en ninguna capa.
 * El correlativo se serializa por caso con `pg_advisory_xact_lock`
 * (patrón I-208: el max+1 sin lock pierde la carrera).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { logAudit } from "../../audit";

export interface InformeCasoRegistrado {
    id: string;
    numeroCorrelativo: number;
    anio: number;
    correlativo: string; // "INF-2026-0001"
    codigoVerificacion: string;
    generadoEn: Date;
    firmadoPorNombre: string;
}

export function formatearCorrelativo(anio: number, numero: number): string {
    return `INF-${anio}-${String(numero).padStart(4, "0")}`;
}

/** Año calendario en Bogotá (el correlativo NO usa el año UTC). */
export function anioBogota(fecha: Date = new Date()): number {
    return Number.parseInt(
        new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/Bogota" }).format(fecha),
        10
    );
}

export async function registrarInformeCaso(input: {
    casoId: string;
    firmadoPorId: string;
    firmadoPorNombre: string;
    firmadoPorDocumento: string;
    pdfHash: string;
    codigoVerificacion: string;
    escudoAssetKey: string | null;
    secciones: string[];
    anio: number;
}): Promise<InformeCasoRegistrado> {
    return prisma.$transaction(async (tx) => {
        // Serializar por caso ANTES de leer el max (carrera I-208).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`informe-caso:${input.casoId}`}))`;

        const ultimo = await tx.informeCaso.findFirst({
            where: { casoId: input.casoId, anio: input.anio },
            orderBy: { numeroCorrelativo: "desc" },
            select: { numeroCorrelativo: true },
        });
        const numeroCorrelativo = (ultimo?.numeroCorrelativo ?? 0) + 1;

        const creado = await tx.informeCaso.create({
            data: {
                casoId: input.casoId,
                numeroCorrelativo,
                anio: input.anio,
                pdfHash: input.pdfHash,
                codigoVerificacion: input.codigoVerificacion,
                firmadoPorNombre: input.firmadoPorNombre,
                firmadoPorDocumento: input.firmadoPorDocumento,
                firmadoPorId: input.firmadoPorId,
                escudoAssetKey: input.escudoAssetKey,
                seccionesJson: input.secciones,
            },
            select: {
                id: true,
                numeroCorrelativo: true,
                anio: true,
                codigoVerificacion: true,
                generadoEn: true,
                firmadoPorNombre: true,
            },
        });

        await logAudit({
            accion: "PDF_GENERADO",
            tipoRecurso: "InformeCaso",
            recursoId: creado.id,
            usuarioId: input.firmadoPorId,
            valorNuevo: JSON.stringify({ casoId: input.casoId, correlativo: formatearCorrelativo(creado.anio, creado.numeroCorrelativo) }),
            tx: tx as Prisma.TransactionClient,
        });

        return { ...creado, correlativo: formatearCorrelativo(creado.anio, creado.numeroCorrelativo) };
    });
}

/** Historial permanente del caso — del más reciente al primero. */
export async function listarInformesCaso(casoId: string): Promise<InformeCasoRegistrado[]> {
    const filas = await prisma.informeCaso.findMany({
        where: { casoId },
        orderBy: [{ anio: "desc" }, { numeroCorrelativo: "desc" }],
        select: {
            id: true,
            numeroCorrelativo: true,
            anio: true,
            codigoVerificacion: true,
            generadoEn: true,
            firmadoPorNombre: true,
        },
    });
    return filas.map((f) => ({ ...f, correlativo: formatearCorrelativo(f.anio, f.numeroCorrelativo) }));
}

/** Verificación pública por hash del PDF (extiende el contrato SPEC-234/346). */
export async function buscarInformeCasoPorHash(pdfHash: string) {
    return prisma.informeCaso.findUnique({
        where: { pdfHash },
        select: { id: true, casoId: true, numeroCorrelativo: true, anio: true, generadoEn: true, firmadoPorNombre: true },
    });
}

/** Verificación pública por el CÓDIGO impreso al pie (16 hex). */
export async function buscarInformeCasoPorCodigo(codigo: string) {
    return prisma.informeCaso.findUnique({
        where: { codigoVerificacion: codigo },
        select: { id: true, casoId: true, numeroCorrelativo: true, anio: true, generadoEn: true, firmadoPorNombre: true },
    });
}

// ─── SPEC-351 · consultas de las rutas (Q-3: prisma no sale del DAL) ─────────

export interface ContextoInforme {
    caso: { id: string; colegioId: string; tipoSujeto: string; curso: string | null };
    rector: { id: string; nombre: string; documento: string } | null; // null si faltan datos de firma
    colegio: { nombre: string; nit: string; escudoAssetKey: string | null };
    notas: Array<{ fecha: Date; autor: string; texto: string }>;
    analisisComite: { texto: string; firmadoPor: string | null } | null;
}

/**
 * Contexto completo para generar/regenerar el informe. Boundary: el usuario
 * debe ser SCHOOL_ADMIN del colegio del caso (404 si no). Los hechos NO van
 * acá — vienen de `cargarCasoConHechos` (SPEC-350), ya blindados.
 */
export async function cargarContextoInforme(casoId: string, usuarioId: string): Promise<ContextoInforme | null> {
    const seguimiento = await prisma.seguimientoCaso.findUnique({
        where: { id: casoId },
        select: {
            id: true,
            colegioId: true,
            colegio: { select: { nombre: true, nit: true, escudoAssetKey: true } },
            notas: {
                orderBy: { creadoEn: "asc" },
                select: { texto: true, creadoEn: true, autor: { select: { nombre: true, email: true } } },
            },
            alerta: {
                select: {
                    tipoSujeto: true,
                    identificadorEstudiante: { select: { estudiante: { select: { curso: { select: { nombre: true } } } } } },
                    solicitudComite: { select: { resolucion: true, integranteFirmante: { select: { nombres: true } } } },
                },
            },
        },
    });
    if (!seguimiento) return null;

    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nombre: true, apellidos: true, documentoNumero: true, colegioId: true },
    });
    if (!usuario?.colegioId || usuario.colegioId !== seguimiento.colegioId) return null;

    const nombreRector = [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ").trim();

    return {
        caso: {
            id: seguimiento.id,
            colegioId: seguimiento.colegioId,
            tipoSujeto: seguimiento.alerta.tipoSujeto,
            curso: seguimiento.alerta.identificadorEstudiante?.estudiante.curso.nombre ?? null,
        },
        rector: nombreRector && usuario.documentoNumero
            ? { id: usuario.id, nombre: nombreRector, documento: usuario.documentoNumero }
            : null,
        colegio: seguimiento.colegio,
        notas: seguimiento.notas.map((n) => ({
            fecha: n.creadoEn,
            autor: n.autor.nombre?.trim() || n.autor.email,
            texto: n.texto,
        })),
        analisisComite: seguimiento.alerta.solicitudComite?.resolucion
            ? {
                texto: seguimiento.alerta.solicitudComite.resolucion,
                firmadoPor: seguimiento.alerta.solicitudComite.integranteFirmante?.nombres ?? null,
            }
            : null,
    };
}

/**
 * Genera y registra en UNA transacción: el correlativo se decide bajo el
 * advisory-lock, el callback renderiza el PDF con ese correlativo, el hash
 * del buffer FINAL se persiste. El render corre DENTRO de la tx a propósito:
 * el correlativo impreso y el registrado no pueden divergir.
 */
export async function generarYRegistrarInforme(input: {
    casoId: string;
    anio: number;
    firmadoPorId: string;
    firmadoPorNombre: string;
    firmadoPorDocumento: string;
    codigoVerificacion: string;
    escudoAssetKey: string | null;
    secciones: string[];
    render: (correlativo: string) => Promise<Buffer>;
    hashDelBuffer: (buffer: Buffer) => string;
}): Promise<{ id: string; correlativo: string; pdfHash: string; buffer: Buffer; generadoEn: Date }> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`informe-caso:${input.casoId}`}))`;
        const ultimo = await tx.informeCaso.findFirst({
            where: { casoId: input.casoId, anio: input.anio },
            orderBy: { numeroCorrelativo: "desc" },
            select: { numeroCorrelativo: true },
        });
        const numero = (ultimo?.numeroCorrelativo ?? 0) + 1;
        const correlativo = formatearCorrelativo(input.anio, numero);

        const buffer = await input.render(correlativo);
        const pdfHash = input.hashDelBuffer(buffer);

        const creado = await tx.informeCaso.create({
            data: {
                casoId: input.casoId,
                numeroCorrelativo: numero,
                anio: input.anio,
                pdfHash,
                codigoVerificacion: input.codigoVerificacion,
                firmadoPorNombre: input.firmadoPorNombre,
                firmadoPorDocumento: input.firmadoPorDocumento,
                firmadoPorId: input.firmadoPorId,
                escudoAssetKey: input.escudoAssetKey,
                seccionesJson: input.secciones,
            },
            select: { id: true, generadoEn: true },
        });
        return { id: creado.id, correlativo, pdfHash, buffer, generadoEn: creado.generadoEn };
    });
}

/** El informe por hash, verificando que pertenece al caso Y al colegio del usuario. */
export async function cargarInformePorHash(casoId: string, pdfHash: string, usuarioId: string) {
    const informe = await prisma.informeCaso.findUnique({
        where: { pdfHash },
        select: {
            casoId: true, numeroCorrelativo: true, anio: true, codigoVerificacion: true,
            firmadoPorNombre: true, firmadoPorDocumento: true, escudoAssetKey: true,
            seccionesJson: true, generadoEn: true, pdfHash: true,
            caso: { select: { colegioId: true } },
        },
    });
    if (!informe || informe.casoId !== casoId) return null;
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { colegioId: true } });
    if (usuario?.colegioId !== informe.caso.colegioId) return null;
    return informe;
}
