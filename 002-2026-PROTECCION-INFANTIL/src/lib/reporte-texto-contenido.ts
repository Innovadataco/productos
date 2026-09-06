import { randomBytes, randomUUID } from "crypto";
import { OrigenEvidencia, type Prisma } from "@prisma/client";
import {
    aadDe,
    cifrarConLlave,
    descifrarConLlave,
    llaveActiva,
    llavePorVersion,
    type CampoContenido,
} from "./reporte-texto-llaves";

/**
 * S-D · Capa DEK-por-denuncia sobre `ContenidoReporte` + `LlaveReporte`.
 *
 * El texto se cifra con una DEK única por fila (nunca con la KEK directo); la KEK solo
 * ENVUELVE la DEK. Borrar el caso quema la DEK (Cascade en LlaveReporte) → cripto-shred.
 * Estos son los helpers de alto nivel que S-C consume desde `textoDe`/`guardarTexto`;
 * la DEK nunca sale de acá (por eso NO se exponen `nuevaDek`/`dekDe` crudos).
 */

/** AAD que ata la DEK ENVUELTA a SU contenido (no se puede mover a otra fila). */
function aadEnvoltura(contenidoId: string): Buffer {
    return Buffer.from(`pi:v1:dek:${contenidoId}`, "utf8");
}

/**
 * Sella un relato NUEVO: pre-genera `contenidoId` + DEK, cifra ambos campos con la DEK
 * (AAD por fila+campo), envuelve la DEK con la KEK activa e inserta `ContenidoReporte` +
 * `LlaveReporte`. Devuelve el `contenidoId` para colgar el Reporte/Evento (NOT NULL).
 *
 * `textoOriginal` por defecto = `texto` (al crear, el original ES el relato del reportante);
 * `origenEvidencia` por defecto = ORIGINAL. Nunca copiar acá un texto ya anonimizado.
 */
export async function sellarTextoNuevo(
    tx: Prisma.TransactionClient,
    datos: { texto: string; textoOriginal?: string; origenEvidencia?: OrigenEvidencia }
): Promise<{ contenidoId: string }> {
    const contenidoId = randomUUID();
    const original = datos.textoOriginal ?? datos.texto;
    const dek = randomBytes(32);
    const textoCifrado = cifrarConLlave(datos.texto, dek, aadDe(contenidoId, "texto"));
    const textoOriginalCifrado = cifrarConLlave(original, dek, aadDe(contenidoId, "textoOriginal"));
    const { version: kekVersion, key: kek } = llaveActiva();
    const dekCifrada = cifrarConLlave(dek.toString("base64"), kek, aadEnvoltura(contenidoId));
    await tx.contenidoReporte.create({
        data: {
            id: contenidoId,
            textoCifrado,
            textoOriginalCifrado,
            origenEvidencia: datos.origenEvidencia ?? OrigenEvidencia.ORIGINAL,
        },
    });
    await tx.llaveReporte.create({ data: { contenidoId, dekCifrada, kekVersion } });
    return { contenidoId };
}

/**
 * Descifra un campo del contenido: desenvuelve la DEK (por `kekVersion`) y descifra con el
 * AAD por fila+campo. Lanza si el contenido o su llave no existen (p.ej. tras cripto-shred:
 * la DEK murió → el texto queda ilegible, que es el borrado real). Nunca fail-open.
 */
export async function descifrarCampo(
    tx: Prisma.TransactionClient,
    contenidoId: string,
    campo: CampoContenido
): Promise<string> {
    const [contenido, llave] = await Promise.all([
        tx.contenidoReporte.findUniqueOrThrow({ where: { id: contenidoId } }),
        tx.llaveReporte.findUniqueOrThrow({ where: { contenidoId } }),
    ]);
    const kek = llavePorVersion(llave.kekVersion);
    const dek = Buffer.from(descifrarConLlave(llave.dekCifrada, kek, aadEnvoltura(contenidoId)), "base64");
    const cifrado = campo === "texto" ? contenido.textoCifrado : contenido.textoOriginalCifrado;
    return descifrarConLlave(cifrado, dek, aadDe(contenidoId, campo));
}
