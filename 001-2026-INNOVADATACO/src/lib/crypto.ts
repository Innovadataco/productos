import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret || secret.length < 32) {
        throw new Error("ENCRYPTION_KEY no configurada o menor a 32 caracteres.");
    }
    return scryptSync(secret, "innovadataco-salt", 32);
}

export function encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALG, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encrypted: string): string {
    const data = Buffer.from(encrypted, "base64");
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encryptedText = data.subarray(32);
    const decipher = createDecipheriv(ALG, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString("utf8");
}