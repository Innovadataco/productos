import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * S-D · Registro de llaves y cripto con AAD del TEXTO del reporte (la evidencia
 * más sensible del producto).
 *
 * Llave PROPIA (`REPORTE_TEXTO_KEY_V<n>`), separada a propósito de
 * `PARAM_ENCRYPTION_KEY` (param-encryption.ts): el relato de la denuncia no comparte
 * llave con los parámetros de configuración.
 *
 * En el modelo de LLAVE POR DENUNCIA (dirección de Jelkin) estas llaves de entorno
 * son la KEK que ENVUELVE la DEK por denuncia. Por eso `cifrarConLlave` /
 * `descifrarConLlave` son key-agnósticas (reciben la llave por argumento): la misma
 * primitiva cifra el texto con la DEK y envuelve la DEK con la KEK, sin cambiar de firma.
 *
 * Diferencias DURAS con param-encryption.ts, exigidas por la revisión adversarial v3:
 *  - `parseKeyEstricta`: round-trip base64 canónico; se ELIMINA la rama UTF-8 (hueco #15).
 *  - AAD obligatorio (`contenidoId | campo | llaveVersion`): ata el ciphertext a SU fila.
 *  - `descifrarConLlave` FALLA RUIDOSO ante GCM inválido; nunca devuelve el valor crudo
 *    (a diferencia del fail-open legado de `decryptParameter`).
 */

const ALGORITMO = "aes-256-gcm";
const IV_BYTES = 12; // estándar GCM (96 bits)
const TAG_BYTES = 16;
const LLAVE_BYTES = 32;
const PREFIJO_VAR = "REPORTE_TEXTO_KEY_V";

/**
 * Parsea una llave de 32 bytes en base64 CANÓNICO. Lanza (nunca devuelve null) ante
 * cualquier otra cosa: frases UTF-8, base64url, con espacios o padding no estándar.
 *
 * El criterio load-bearing es el ROUND-TRIP (`buf.toString("base64") === raw`), no la
 * longitud: `Buffer.from(raw,"base64")` de Node descarta en silencio los bytes que no
 * reconoce, así que una frase de 43–49 chars puede decodificar a 32 bytes y colarse por
 * longitud sola. El round-trip obliga al alfabeto base64 estándar con padding — los 44
 * chars exactos de `openssl rand -base64 32`.
 */
export function parseKeyEstricta(raw: string | undefined, nombreVar: string): Buffer {
    if (typeof raw !== "string" || raw.length === 0) {
        throw new Error(`[reporte-texto-llaves] ${nombreVar} no está definida`);
    }
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== LLAVE_BYTES) {
        throw new Error(
            `[reporte-texto-llaves] ${nombreVar} no decodifica a ${LLAVE_BYTES} bytes (usá 'openssl rand -base64 32')`
        );
    }
    if (buf.toString("base64") !== raw) {
        throw new Error(
            `[reporte-texto-llaves] ${nombreVar} no es base64 canónico (¿frase, espacios, base64url o padding no estándar?)`
        );
    }
    return buf;
}

function nombreVarVersion(version: number): string {
    return `${PREFIJO_VAR}${version}`;
}

/**
 * Llave de la versión `n` desde el entorno. Lanza si no está provisionada o es inválida.
 * No cachea: parsear 32 bytes es barato y una llave de entorno no cambia en caliente,
 * así el módulo no arrastra estado global entre corridas de test.
 */
export function llavePorVersion(version: number): Buffer {
    if (!Number.isInteger(version) || version < 1) {
        throw new Error(`[reporte-texto-llaves] versión de llave inválida: ${version}`);
    }
    const nombre = nombreVarVersion(version);
    return parseKeyEstricta(process.env[nombre], nombre);
}

/**
 * Versión activa (con la que se cifra HOY) y su material. La versión sale de
 * `REPORTE_TEXTO_KEY_ACTIVA` (default 1). Rotar = provisionar `REPORTE_TEXTO_KEY_V<n+1>`
 * y subir el puntero, dejando la versión vieja cargada para descifrar filas anteriores.
 */
export function llaveActiva(): { version: number; key: Buffer } {
    const crudo = process.env.REPORTE_TEXTO_KEY_ACTIVA ?? "1";
    const version = Number(crudo);
    if (!Number.isInteger(version) || version < 1) {
        throw new Error(`[reporte-texto-llaves] REPORTE_TEXTO_KEY_ACTIVA inválida: ${crudo}`);
    }
    return { version, key: llavePorVersion(version) };
}

/** Campos cifrables de `ContenidoReporte`. */
export type CampoContenido = "texto" | "textoOriginal";

/**
 * AAD que ata el ciphertext a SU fila y SU campo. Formato: `pi:v1:<contenidoId>:<campo>`.
 *
 * - Anclado en `contenidoId` (PK inmutable de la fila que carga el cifrado), NO en
 *   `reporteId` — que `borrar-reporte.ts:91` pone en NULL antes de borrar (revisión #10).
 * - Incluir `campo` impide intercambiar `textoCifrado` ↔ `textoOriginalCifrado`.
 * - SIN versión de KEK: el texto va bajo una DEK única por fila; la versión de la KEK vive
 *   SOLO en la envoltura de la DEK (`LlaveReporte.kekVersion`), para que rotar la KEK
 *   re-envuelva DEKs sin re-cifrar relatos (v4.1 §1.3).
 * - ⚠️ El `v1` es un marcador de formato del AAD **CONSTANTE** — NUNCA la `kekVersion`.
 *   Atarlo a la KEK haría que cada rotación cueste un re-cifrado completo (orden del CEO, 22:39).
 */
export function aadDe(contenidoId: string, campo: CampoContenido): Buffer {
    return Buffer.from(`pi:v1:${contenidoId}:${campo}`, "utf8");
}

type Sobre = { iv: string; tag: string; ct: string };

/**
 * Cifra `plano` con `llave` (32 bytes) y `aad`. Devuelve el sobre como JSON (iv/tag/ct
 * en base64). Key-agnóstico: la llave se pasa por argumento (la DEK para el texto, o la
 * KEK para envolver la DEK).
 */
export function cifrarConLlave(plano: string, llave: Buffer, aad: Buffer): string {
    if (llave.length !== LLAVE_BYTES) {
        throw new Error(`[reporte-texto-llaves] la llave de cifrado no es de ${LLAVE_BYTES} bytes`);
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITMO, llave, iv);
    cipher.setAAD(aad);
    const ct = Buffer.concat([cipher.update(plano, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const sobre: Sobre = {
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ct: ct.toString("base64"),
    };
    return JSON.stringify(sobre);
}

/**
 * Descifra un sobre de `cifrarConLlave`. FALLA RUIDOSO ante cualquier problema (formato,
 * llave o AAD equivocados): nunca devuelve el valor tal cual. Es la diferencia deliberada
 * con `decryptParameter`, que hace fail-open y devolvería el cifrado como si fuera plano.
 */
export function descifrarConLlave(cifrado: string, llave: Buffer, aad: Buffer): string {
    let sobre: Sobre;
    try {
        sobre = JSON.parse(cifrado) as Sobre;
    } catch {
        throw new Error("[reporte-texto-llaves] sobre cifrado ilegible (no es JSON)");
    }
    if (
        !sobre ||
        typeof sobre.iv !== "string" ||
        typeof sobre.tag !== "string" ||
        typeof sobre.ct !== "string"
    ) {
        throw new Error("[reporte-texto-llaves] sobre cifrado sin iv/tag/ct");
    }
    const iv = Buffer.from(sobre.iv, "base64");
    const tag = Buffer.from(sobre.tag, "base64");
    const ct = Buffer.from(sobre.ct, "base64");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error("[reporte-texto-llaves] sobre cifrado con iv/tag de tamaño inválido");
    }
    const decipher = createDecipheriv(ALGORITMO, llave, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
