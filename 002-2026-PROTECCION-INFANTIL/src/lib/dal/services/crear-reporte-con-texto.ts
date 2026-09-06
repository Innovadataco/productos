import { type OrigenEvidencia, type Prisma, type Reporte } from "@prisma/client";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";

/**
 * S-D (D-116/D-117) · ÚNICA vía de escritura de un `Reporte`.
 *
 * `Reporte.texto`/`textoOriginal` ya NO existen: el relato vive SOLO cifrado en
 * `ContenidoReporte` (DEK por denuncia). Este factory sella el texto (crea `ContenidoReporte`
 * + `LlaveReporte`) y crea el `Reporte` con `contenidoId` NOT NULL — en ese orden, dentro de
 * la misma transacción, para cerrar la Trampa A.
 *
 * REGLA (arch:check): `tx.reporte.create` directo está PROHIBIDO fuera de este archivo. Un
 * reporte sin su contenido cifrado no puede existir; todo escritor pasa por acá.
 */
export async function crearReporteConTexto(
    tx: Prisma.TransactionClient,
    args: {
        /** El relato del reportante. Se cifra; nunca se guarda en claro. */
        texto: string;
        /** Original-evidencia. Por defecto = `texto` (al crear, el original es el relato). */
        textoOriginal?: string;
        /** Por defecto ORIGINAL. Nunca marcar ORIGINAL un texto ya anonimizado. */
        origenEvidencia?: OrigenEvidencia;
        /** Resto de columnas del Reporte (sin `contenidoId`: lo pone el factory). */
        reporte: Omit<Prisma.ReporteUncheckedCreateInput, "contenidoId">;
    }
): Promise<Reporte> {
    // `args` calza con la firma de `sellarTextoNuevo` (los opcionales coinciden; la
    // propiedad extra `reporte` se tolera al pasar una variable, no un literal).
    const { contenidoId } = await sellarTextoNuevo(tx, args);
    // eslint-disable-next-line no-restricted-syntax -- ÚNICA vía autorizada (S-D · arch:check).
    return tx.reporte.create({ data: { ...args.reporte, contenidoId } });
}
