import { randomInt } from "node:crypto";

/// Genera una clave temporal que cumple la política (≥8, mayúscula, minúscula, dígito, símbolo).
/// Nunca se almacena en claro ni se loguea; se envía por la interfaz de correo (D-048).
export function generarClaveTemporal(): string {
  const n = randomInt(100_000, 1_000_000).toString();
  return `Sic0v-${n}!`;
}

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Validación mínima de correo (evita crear nada con un correo inválido — edge case 009).
export function esCorreoValido(correo: string): boolean {
  return CORREO_RE.test(correo);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// El token de empresa se persiste en `tpv_token @db.Uuid`: debe ser un UUID válido.
export function esUuid(valor: string): boolean {
  return UUID_RE.test(valor);
}
