/**
 * El secreto TOTP en la base: SIEMPRE cifrado con el llavero de src/cifrado (AES-256-GCM con clave
 * versionada), como sobre en `Usuario.totpSecreto`, y atado a su fila con el AAD propio
 * ["usuario.totp", id]: un sobre copiado a otra cuenta no se autentica. Dentro va el base32 del secreto.
 * Falla cerrado (ErrorCifrado) sin llavero o con un sobre que no cuadra. `necesitaRecifrar` dice si el
 * sobre usa una clave que ya no es la activa: se re-cifra en cada éxito (rotación sin script aparte).
 */
import type { Prisma } from "@prisma/client";
import { ErrorCifrado } from "../cifrado/errores";
import { obtenerLlavero, type Llavero } from "../cifrado/llavero";
import { cifrar, descifrar, esSobre, type Contexto, type Sobre } from "../cifrado/sobre";
import { TOTP_SECRETO_BYTES } from "./limites";
import { codificarBase32, decodificarBase32 } from "./totp";

export const contextoTotp = (usuarioId: string): Contexto => ["usuario.totp", usuarioId];

/** El sobre listo para la columna Json de Prisma. */
export function cifrarSecretoTotp(secreto: Uint8Array, usuarioId: string, llavero?: Llavero): Prisma.InputJsonObject {
  const sobre: Sobre = cifrar(codificarBase32(secreto), contextoTotp(usuarioId), llavero);
  return { ...sobre };
}

/** Los 20 bytes del secreto. Lanza ErrorCifrado si el sobre no es válido, no es de esta cuenta o no trae un secreto. */
export function descifrarSecretoTotp(valor: unknown, usuarioId: string, llavero?: Llavero): Buffer {
  const secreto = decodificarBase32(descifrar(valor, contextoTotp(usuarioId), llavero));
  if (!secreto || secreto.length !== TOTP_SECRETO_BYTES) throw new ErrorCifrado("CONTENIDO_INVALIDO");
  return secreto;
}

/** true si el sobre se cifró con una clave que no es la activa (hay que re-cifrarlo con la activa). */
export function necesitaRecifrar(valor: unknown, llavero: Llavero = obtenerLlavero()): boolean {
  return esSobre(valor) && valor.kid !== llavero.activa;
}
