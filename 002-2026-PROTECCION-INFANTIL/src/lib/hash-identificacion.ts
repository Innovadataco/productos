import { createHmac } from "crypto";
import { getEncryptionKey } from "@/lib/param-encryption";

/**
 * Hash determinístico de un número de identificación para detectar duplicados
 * sin exponer el valor en claro ni depender de cifrados no determinísticos.
 * Usa HMAC-SHA256 con la misma clave de cifrado de parámetros.
 */
export function hashIdentificacion(valor: string): string {
    const key = getEncryptionKey();
    if (!key) {
        throw new Error("PARAM_ENCRYPTION_KEY no configurada o inválida (se requieren 32 bytes)");
    }
    return createHmac("sha256", key).update(valor).digest("hex");
}
