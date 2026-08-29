import { prisma } from "./prisma";
import { guardarDocumentoCifrado, sha256Hex } from "./apelacion-storage";
import { calcularPlazoRespuesta } from "./apelaciones";
import type { EstadoApelacion } from "@prisma/client";

/**
 * SPEC-110 — Fixtures de apelación para los tests del comité y del mantenimiento.
 * Crea la apelación con su documento de evidencia real (cifrado en disco), para
 * ejercitar el efecto de visibilidad, la descarga y la purga sin depender del upload.
 */

export const PDF_PRUEBA = Buffer.from("%PDF-1.4\nevidencia de prueba del titular", "ascii");

export async function crearApelacionConDocumento(opts: {
    usuarioId: string;
    identificador: string;
    plataformaId: string;
    estado?: EstadoApelacion;
    comiteId?: string | null;
    creadoEn?: Date;
    resueltoEn?: Date;
    decision?: string | null;
}) {
    const documentoId = crypto.randomUUID();
    const rutaArchivo = await guardarDocumentoCifrado(documentoId, PDF_PRUEBA);
    const creadoEn = opts.creadoEn ?? new Date();
    const apelacion = await prisma.apelacion.create({
        data: {
            numero: `APL-T-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
            usuarioId: opts.usuarioId,
            identificador: opts.identificador,
            plataformaId: opts.plataformaId,
            motivo: "Soy el titular y los reportes no corresponden.",
            estado: opts.estado ?? "RECIBIDA",
            comiteId: opts.comiteId ?? null,
            asignadoEn: opts.comiteId ? new Date() : null,
            plazoRespuestaEn: await calcularPlazoRespuesta(creadoEn),
            creadoEn,
            resueltoEn: opts.resueltoEn ?? null,
            decision: opts.decision ?? null,
            documentos: {
                create: {
                    id: documentoId,
                    nombreOriginal: "evidencia.pdf",
                    rutaArchivo,
                    hashSha256: sha256Hex(PDF_PRUEBA),
                    tamanoBytes: PDF_PRUEBA.length,
                    mimeType: "application/pdf",
                },
            },
        },
        include: { documentos: true },
    });
    return { apelacion, documento: apelacion.documentos[0], pdfBuffer: PDF_PRUEBA };
}

export async function crearReporteParaIdentificador(opts: {
    identificador: string;
    plataformaId: string;
    estado?: "PENDIENTE" | "CLASIFICADO" | "REVISION_MANUAL";
}) {
    return prisma.reporte.create({
        data: {
            identificador: opts.identificador,
            plataformaId: opts.plataformaId,
            texto: "Texto anonimizado de prueba del reporte.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: opts.estado ?? "CLASIFICADO",
            numeroSeguimiento: `RPT-T-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
        },
    });
}
