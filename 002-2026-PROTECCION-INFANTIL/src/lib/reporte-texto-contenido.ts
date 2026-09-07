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

/**
 * Versión BATCH de `descifrarCampo` para lectores de LISTA (bandejas de spam/apelaciones/eventos):
 * descifra el MISMO `campo` de muchos contenidos con SOLO 2 queries (un findMany de contenidos +
 * uno de llaves) en vez de 2N. Desenvuelve la DEK de cada fila con su propio `kekVersion` en
 * memoria. Fail-loud igual que el singular: si un `contenidoId` pedido no tiene contenido o llave
 * LANZA — un reporte vivo siempre tiene su contenido por la FK `Restrict`, así que faltar = corrupción,
 * no un caso borrado (ese ya no está en la lista). Devuelve `Map<contenidoId, textoDescifrado>`.
 */
export async function descifrarCampos(
    tx: Prisma.TransactionClient,
    contenidoIds: string[],
    campo: CampoContenido
): Promise<Map<string, string>> {
    const ids = [...new Set(contenidoIds)];
    const resultado = new Map<string, string>();
    if (ids.length === 0) return resultado; // sin ids no se toca la BD

    const [contenidos, llaves] = await Promise.all([
        tx.contenidoReporte.findMany({ where: { id: { in: ids } } }),
        tx.llaveReporte.findMany({ where: { contenidoId: { in: ids } } }),
    ]);
    const contenidoPorId = new Map(contenidos.map((c) => [c.id, c]));
    const llavePorContenido = new Map(llaves.map((l) => [l.contenidoId, l]));

    for (const id of ids) {
        const contenido = contenidoPorId.get(id);
        const llave = llavePorContenido.get(id);
        if (!contenido || !llave) {
            throw new Error(
                `[reporte-texto-contenido] descifrarCampos: falta ${!contenido ? "contenido" : "llave"} para ${id}. ` +
                    "Un reporte vivo siempre tiene su contenido (FK Restrict); esto es corrupción, no un caso borrado."
            );
        }
        const kek = llavePorVersion(llave.kekVersion);
        const dek = Buffer.from(descifrarConLlave(llave.dekCifrada, kek, aadEnvoltura(id)), "base64");
        const cifrado = campo === "texto" ? contenido.textoCifrado : contenido.textoOriginalCifrado;
        resultado.set(id, descifrarConLlave(cifrado, dek, aadDe(id, campo)));
    }
    return resultado;
}

/**
 * Campo re-sellable POST-alta: SOLO el texto de TRABAJO. `textoOriginal` NO entra acá — es
 * evidencia legal inmutable (se fija en el alta y después solo se PURGA con `purgadoEn` +
 * `origenEvidencia`, jamás se sobreescribe). Cerrado en el TIPO a propósito (CEO 06-09): que
 * la anonimización no pueda pisar el original con una línea. Ampliar este union es una
 * decisión de política, no un ajuste de firma.
 */
export type CampoResellable = "texto";

/**
 * ÚNICA vía de cambio del texto de TRABAJO post-alta (anonimización, corrección, reactivación):
 * desenvuelve la DEK EXISTENTE (por su `kekVersion` — no se rota la DEK), re-cifra el nuevo
 * plano con la MISMA DEK y el AAD por fila+campo, y actualiza SOLO `textoCifrado`.
 *
 * NUNCA toca `textoOriginalCifrado`: el original es inmutable. La DEK no sale de este módulo —
 * el llamador pasa texto plano, jamás llaves. El AAD no cambia (`contenidoId|texto`), así que
 * el resellado no invalida nada de lo ya cifrado.
 */
export async function resellarCampo(
    tx: Prisma.TransactionClient,
    contenidoId: string,
    campo: CampoResellable,
    nuevoPlano: string
): Promise<void> {
    // Cinturón además del tipo cerrado: si alguien fuerza el campo por JS (cast a any), muere
    // acá antes de tocar la fila. El original NO se resella; se purga por otra vía.
    if (campo !== "texto") {
        throw new Error(
            `[reporte-texto-contenido] resellarCampo: "${String(campo)}" no es re-sellable — el original es evidencia inmutable (solo se purga).`
        );
    }
    const llave = await tx.llaveReporte.findUniqueOrThrow({ where: { contenidoId } });
    const kek = llavePorVersion(llave.kekVersion);
    const dek = Buffer.from(descifrarConLlave(llave.dekCifrada, kek, aadEnvoltura(contenidoId)), "base64");
    const textoCifrado = cifrarConLlave(nuevoPlano, dek, aadDe(contenidoId, "texto"));
    await tx.contenidoReporte.update({ where: { id: contenidoId }, data: { textoCifrado } });
}

/**
 * Marcador no-identificable de la política D4 (texto de TRABAJO purgado). Se muestra tal cual en
 * las vistas. Mismo valor que el layer legado (`texto-reporte-cifrado.ts`) para consistencia de UI.
 */
export const MARCADOR_TEXTO_PURGADO = "[contenido purgado]";

/**
 * ¿El texto de TRABAJO está purgado (baja D4)? El estado vive en el ESQUEMA (`purgadoEn`), no se
 * infiere comparando el ciphertext — con IV aleatorio la igualdad de marcador nunca vuelve a dar
 * true. Mapea el viejo `reporte.texto === MARCADOR_TEXTO_PURGADO` (reporte-lifecycle.ts:229).
 */
export async function estaPurgado(tx: Prisma.TransactionClient, contenidoId: string): Promise<boolean> {
    const c = await tx.contenidoReporte.findUniqueOrThrow({
        where: { id: contenidoId },
        select: { purgadoEn: true },
    });
    return c.purgadoEn !== null;
}

/**
 * Purga D4 del texto de TRABAJO (baja): sobreescribe `textoCifrado` con el MARCADOR (cifrado con la
 * MISMA DEK) y marca `purgadoEn`. Que el marcador quede CIFRADO en el campo —no solo la bandera— es
 * defensa en profundidad: cualquier lector (descifrarCampo/descifrarCampos) obtiene «[contenido
 * purgado]» sin poder filtrar el texto purgado, aunque olvide chequear `purgadoEn`. NO toca
 * `textoOriginalCifrado` (la evidencia; restaurable con restaurarTextoTrabajo). Mapea el viejo
 * `reporte.texto = MARCADOR_TEXTO_PURGADO` (reporte-lifecycle.ts:113).
 */
export async function purgarTextoTrabajo(tx: Prisma.TransactionClient, contenidoId: string): Promise<void> {
    const llave = await tx.llaveReporte.findUniqueOrThrow({ where: { contenidoId } });
    const kek = llavePorVersion(llave.kekVersion);
    const dek = Buffer.from(descifrarConLlave(llave.dekCifrada, kek, aadEnvoltura(contenidoId)), "base64");
    const textoCifrado = cifrarConLlave(MARCADOR_TEXTO_PURGADO, dek, aadDe(contenidoId, "texto"));
    await tx.contenidoReporte.update({
        where: { id: contenidoId },
        data: { textoCifrado, purgadoEn: new Date() },
    });
}

/**
 * Reactivar (des-purga): restaura el texto de TRABAJO desde la evidencia original SOLO si estaba
 * purgado (igual que el condicional viejo reporte-lifecycle.ts:228-231) y limpia `purgadoEn`. La
 * DEK nunca se tocó (solo cambió el contenido de `textoCifrado`) y el original está intacto, así
 * que el re-sellado con la misma DEK siempre funciona. NUNCA toca `textoOriginalCifrado`.
 */
export async function restaurarTextoTrabajo(tx: Prisma.TransactionClient, contenidoId: string): Promise<void> {
    const { purgadoEn } = await tx.contenidoReporte.findUniqueOrThrow({
        where: { id: contenidoId },
        select: { purgadoEn: true },
    });
    if (purgadoEn !== null) {
        const original = await descifrarCampo(tx, contenidoId, "textoOriginal");
        await resellarCampo(tx, contenidoId, "texto", original);
    }
    await tx.contenidoReporte.update({ where: { id: contenidoId }, data: { purgadoEn: null } });
}

/**
 * Purga de RETENCIÓN del ORIGINAL (evidencia): DESTRUYE `textoOriginalCifrado` sobreescribiéndolo
 * con el MARCADOR (cifrado, misma DEK) y marca `origenEvidencia = PURGADA` + `purgadoEn`.
 *
 * Es la ÚNICA vía que toca el original, y SOLO para destruirlo: NO acepta contenido, así que
 * estructuralmente NO puede reescribir la evidencia con texto real (el original es write-once —
 * anonimizar jamás lo toca, ver `resellarCampo`; purgar por retención lo DESTRUYE, no lo reescribe).
 *
 * Los eventos NO se anonimizan, así que sin esto su relato sensible sobrevive a la retención (el
 * motor no borra filas) — una regresión sobre la promesa central de que el texto se puede destruir.
 * Combinada con `purgarTextoTrabajo`, la purga de retención deja el caso ILEGIBLE en AMBOS campos.
 */
export async function purgarOriginal(tx: Prisma.TransactionClient, contenidoId: string): Promise<void> {
    const llave = await tx.llaveReporte.findUniqueOrThrow({ where: { contenidoId } });
    const kek = llavePorVersion(llave.kekVersion);
    const dek = Buffer.from(descifrarConLlave(llave.dekCifrada, kek, aadEnvoltura(contenidoId)), "base64");
    const textoOriginalCifrado = cifrarConLlave(MARCADOR_TEXTO_PURGADO, dek, aadDe(contenidoId, "textoOriginal"));
    await tx.contenidoReporte.update({
        where: { id: contenidoId },
        data: { textoOriginalCifrado, origenEvidencia: OrigenEvidencia.PURGADA, purgadoEn: new Date() },
    });
}
