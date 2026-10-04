import { type OrigenEvidencia, type Prisma, type Reporte } from "@prisma/client";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";
import { marcarReporteSimulacro } from "@/lib/dal/demo-exclusion";

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
        /**
         * SPEC-863 (I-400): marca el reporte como SIMULACRO (no real) en `demo_marcado`
         * dentro de ESTA MISMA tx. El simulador de abusos lo pasa; así un reporte de prueba
         * NUNCA existe sin su marca (atomicidad — el candado de control positivo lo exige).
         * El poblador demo marca por su cuenta (no pasa esto). Atomicidad garantizada igual
         * que el sellado del texto: el llamador debe pasar un `tx` real (lo hace la ruta).
         */
        marcaSimulacro?: { origen: string };
    }
): Promise<Reporte> {
    // `args` calza con la firma de `sellarTextoNuevo` (los opcionales coinciden; las
    // propiedades extra `reporte`/`marcaSimulacro` se toleran al pasar una variable, no un literal).
    const { contenidoId } = await sellarTextoNuevo(tx, args);
    // ÚNICA vía autorizada de `tx.reporte.create` (S-D · D-116); lo verifica arch:check (g).
    const reporte = await tx.reporte.create({ data: { ...args.reporte, contenidoId } });
    // SPEC-863: la marca de simulacro viaja en la MISMA tx que el reporte (nunca uno sin la otra).
    if (args.marcaSimulacro) {
        await marcarReporteSimulacro(tx, reporte.id, args.marcaSimulacro.origen);
    }
    return reporte;
}
