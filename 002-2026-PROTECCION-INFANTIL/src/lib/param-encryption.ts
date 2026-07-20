import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ENCRYPTED_PREFIX = "enc:";

type EncryptedBlob = {
    iv: string;
    tag: string;
    ciphertext: string;
};

function parseKey(raw: string | undefined): Buffer | null {
    if (!raw) return null;
    // Soportar base64 (44 chars para 32 bytes) o cadena UTF-8 de 32 chars.
    const base64 = Buffer.from(raw, "base64");
    if (base64.length === KEY_LENGTH) return base64;
    const utf8 = Buffer.from(raw, "utf8");
    if (utf8.length === KEY_LENGTH) return utf8;
    return null;
}

/**
 * Obtiene la clave de cifrado de parámetros desde la variable de entorno PARAM_ENCRYPTION_KEY.
 * Acepta una clave en base64 de 32 bytes o una cadena UTF-8 de 32 caracteres.
 *
 * @returns Buffer de 32 bytes listo para usar con AES-256-GCM, o null si no está configurada o es inválida.
 */
export function getEncryptionKey(): Buffer | null {
    return parseKey(process.env.PARAM_ENCRYPTION_KEY);
}

function encodeBlob(blob: EncryptedBlob): string {
    return (
        ENCRYPTED_PREFIX +
        JSON.stringify({
            iv: blob.iv,
            tag: blob.tag,
            v: blob.ciphertext,
        })
    );
}

function decodeBlob(value: string): EncryptedBlob | null {
    if (!value.startsWith(ENCRYPTED_PREFIX)) return null;
    try {
        const parsed = JSON.parse(value.slice(ENCRYPTED_PREFIX.length)) as {
            iv?: string;
            tag?: string;
            v?: string;
        };
        if (!parsed.iv || !parsed.tag || !parsed.v) return null;
        return { iv: parsed.iv, tag: parsed.tag, ciphertext: parsed.v };
    } catch {
        return null;
    }
}

/**
 * Indica si una cadena tiene el formato de un valor cifrado por este módulo.
 * No verifica la integridad criptográfica ni la clave.
 *
 * @param value - Cadena a evaluar.
 * @returns true si comienza con el prefijo "enc:" y puede parsearse como blob cifrado.
 */
export function isEncryptedValue(value: string): boolean {
    return decodeBlob(value) !== null;
}

/**
 * Cifra un texto plano usando AES-256-GCM con una clave de 32 bytes.
 * Si no se proporciona clave, utiliza la configurada en la variable de entorno.
 *
 * @param plaintext - Texto plano a cifrar.
 * @param key - Clave de 32 bytes (opcional).
 * @returns Cadena con prefijo "enc:" que contiene el IV, tag y ciphertext en formato JSON.
 * @throws Error si no hay clave configurada o es inválida.
 */
export function encryptParameter(plaintext: string, key?: Buffer): string {
    const k = key ?? getEncryptionKey();
    if (!k) {
        throw new Error("PARAM_ENCRYPTION_KEY no configurada o inválida (se requieren 32 bytes)");
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, k, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return encodeBlob({
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        ciphertext: ciphertext.toString("hex"),
    });
}

/**
 * Descifra un valor previamente cifrado por este módulo.
 * Si el valor no tiene el prefijo "enc:", se devuelve tal cual para compatibilidad con migraciones.
 *
 * @param encrypted - Valor cifrado con prefijo "enc:" o texto plano.
 * @param key - Clave de 32 bytes (opcional).
 * @returns Texto plano descifrado, o el mismo valor si no estaba cifrado.
 * @throws Error si no hay clave configurada, el formato es inválido o la autenticación GCM falla.
 */
export function decryptParameter(encrypted: string, key?: Buffer): string {
    const k = key ?? getEncryptionKey();
    if (!k) {
        throw new Error("PARAM_ENCRYPTION_KEY no configurada o inválida (se requieren 32 bytes)");
    }
    const blob = decodeBlob(encrypted);
    if (!blob) {
        // Si no tiene prefijo, se asume texto plano (compatibilidad con migración gradual).
        return encrypted;
    }

    const iv = Buffer.from(blob.iv, "hex");
    const tag = Buffer.from(blob.tag, "hex");
    const ciphertext = Buffer.from(blob.ciphertext, "hex");

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
        throw new Error("Formato de valor cifrado inválido");
    }

    const decipher = createDecipheriv(ALGORITHM, k, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
}

/**
 * Verifica que una clave pueda cifrar y descifrar un valor de prueba.
 * Útil antes de una migración masiva para evitar pérdida de datos.
 *
 * @param key - Clave de 32 bytes a verificar (opcional; por defecto usa la clave del entorno).
 * @returns true si la clave puede realizar una ronda de cifrado/descifrado exitosa; false en caso contrario.
 */
export function verifyEncryptionKey(key?: Buffer): boolean {
    try {
        const k = key ?? getEncryptionKey();
        if (!k) return false;
        const original = `verify-${Date.now()}-${Math.random()}`;
        const encrypted = encryptParameter(original, k);
        const decrypted = decryptParameter(encrypted, k);
        return timingSafeEqual(Buffer.from(original, "utf8"), Buffer.from(decrypted, "utf8"));
    } catch {
        return false;
    }
}
