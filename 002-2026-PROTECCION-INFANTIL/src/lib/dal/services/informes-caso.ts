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
