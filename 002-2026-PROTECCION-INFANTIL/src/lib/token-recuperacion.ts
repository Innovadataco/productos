import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export function generarTokenRecuperacion(): string {
    return randomBytes(32).toString("hex");
}

export async function hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 12);
}

export async function verificarTokenHash(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
}
