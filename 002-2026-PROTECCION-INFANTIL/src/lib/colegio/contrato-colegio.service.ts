/**
 * SPEC-796 · Servicio del contrato firmado del colegio: ADJUNTAR (admin) · VER (dueño/admin).
 *
 * - El archivo va cifrado y opaco (contrato-colegio-storage); en el REGISTRO durable
 *   (ContratoColegio) se guarda el `archivoId` opaco + sha256, NUNCA la ruta ni el contenido.
 * - La identidad del colegio se congela en `colegioSnapshot` (id · nombre · NIT) para que la prueba
 *   siga siendo atribuible tras el SET NULL del borrado operativo.
 * - El HECHO (quién adjuntó, cuándo) es el propio registro, append-only (reemplazar = hecho nuevo).
 * - Q-3: no importa el singleton de Prisma; usa el DAL (que recibe el cliente) y el storage.
 *
 * NO decide retención: el plazo es `[ABOGADO]` sin valor (I-434). El borrado operativo PRESERVA
 * (FK SetNull); la purga demo borra (y llama a `eliminarContrato`). Ninguno de los dos vive acá.
 */
import type { Prisma } from "@prisma/client";
import { ContratoColegioRepository } from "@/lib/dal/repositories/contrato-colegio";
import { guardarContrato, leerContrato, validarContratoSubido } from "./contrato-colegio-storage";

export interface ColegioParaContrato {
    id: string;
    nombre: string;
    nit: string;
}
export interface AdminQueAdjunta {
    id: string;
    nombre?: string | null;
    email: string;
}

/** Identidad DURABLE del colegio (sobrevive al SET NULL). */
export function componerColegioSnapshot(c: ColegioParaContrato): string {
    return `${c.id} · ${c.nombre} · NIT ${c.nit}`;
}
/** Quién adjuntó, como snapshot (no FK: la responsabilidad no se vacía al borrar la cuenta). */
export function componerAdminSnapshot(a: AdminQueAdjunta): string {
    return `${a.id} · ${a.nombre?.trim() || a.email}`;
}

export type ResultadoAdjuntar =
    | { ok: true; contratoId: string; adjuntadoEn: Date }
    | { ok: false; motivo: string };

/**
 * Adjunta el contrato firmado a la suscripción de un colegio. El llamador (endpoint admin) ya
 * resolvió el colegio (desde la suscripción) y el admin (desde la sesión). Valida PDF, cifra y
 * guarda el archivo, y registra el hecho append-only.
 */
export async function adjuntarContratoColegio(
    input: {
        colegio: ColegioParaContrato;
        suscripcionId: string | null;
        buffer: Buffer;
        admin: AdminQueAdjunta;
        maxBytes: number;
        maxMb: number;
    },
    db?: Prisma.TransactionClient,
): Promise<ResultadoAdjuntar> {
    const v = validarContratoSubido(input.buffer, { maxBytes: input.maxBytes, maxMb: input.maxMb, sujeto: "El contrato" });
    if (!v.ok) return { ok: false, motivo: v.motivo };

    const { archivoId, sha256 } = await guardarContrato(input.buffer);
    const adjuntadoEn = new Date();
    const registro = await new ContratoColegioRepository(db).crear({
        colegioId: input.colegio.id,
        suscripcionId: input.suscripcionId,
        colegioSnapshot: componerColegioSnapshot(input.colegio),
        archivoId,
        sha256,
        adjuntadoEn,
        adjuntadoPorSnapshot: componerAdminSnapshot(input.admin),
    });
    return { ok: true, contratoId: registro.id, adjuntadoEn };
}

/** Lo que ve el colegio dueño: SOLO si hay contrato y SOLO cuándo. Sin archivoId, sin ruta. */
export interface ContratoColegioVista {
    adjuntadoEn: string;
}

/** DTO de la vista del colegio. `null` = estado SIN contrato (el texto ámbar intacto). */
export async function contratoColegioVista(colegioId: string, db?: Prisma.TransactionClient): Promise<ContratoColegioVista | null> {
    const vig = await new ContratoColegioRepository(db).vigentePorColegio(colegioId);
    if (!vig) return null;
    return { adjuntadoEn: vig.adjuntadoEn.toISOString() };
}

/** El PDF descifrado del contrato VIGENTE de un colegio, para el endpoint guardado. `null` si no hay. */
export async function leerContratoColegioVigente(colegioId: string, db?: Prisma.TransactionClient): Promise<Buffer | null> {
    const vig = await new ContratoColegioRepository(db).vigentePorColegio(colegioId);
    if (!vig) return null;
    return leerContrato(vig.archivoId);
}
