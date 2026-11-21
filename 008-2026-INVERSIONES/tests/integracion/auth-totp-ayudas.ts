// Ayudas de las pruebas de integración del TOTP. Datos inventados: el secreto es el del apéndice de
// RFC 6238 (público) y se cifra con la clave aleatoria de la corrida (vitest.integracion.config.ts).
import type { PrismaClient } from "@prisma/client";
import { cifrarSecretoTotp } from "@/auth/secreto-totp";
import { hotp, pasoDe } from "@/auth/totp";

/** El secreto de los apéndices de RFC 4226 y RFC 6238: público, nunca uno real. */
export const SECRETO_RFC = Buffer.from("12345678901234567890", "ascii");

/** Deja la cuenta con el TOTP activo, como lo deja el enrolamiento, y el último paso dado. */
export async function activarTotp(db: PrismaClient, usuarioId: string, ahora: Date, ultimoPaso = 0, secreto: Buffer = SECRETO_RFC): Promise<void> {
  await db.usuario.update({
    where: { id: usuarioId },
    data: { totpSecreto: cifrarSecretoTotp(secreto, usuarioId), totpActivadoEn: ahora, totpUltimoPaso: ultimoPaso },
  });
}

/** El código TOTP de un instante (o de un paso relativo a él). */
export const codigoEn = (ahora: Date, delta = 0, secreto: Buffer = SECRETO_RFC): string => hotp(secreto, pasoDe(ahora.getTime()) + delta);

/** Un código de 6 dígitos que NO vale en ese instante (ni en el paso anterior ni en el siguiente). */
export function codigoMalo(ahora: Date, secreto: Buffer = SECRETO_RFC): string {
  const validos = new Set([-1, 0, 1].map((d) => codigoEn(ahora, d, secreto)));
  for (let k = 0; ; k += 1) {
    const codigo = String(k).padStart(6, "0");
    if (!validos.has(codigo)) return codigo;
  }
}
