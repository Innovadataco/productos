/**
 * Verificación de arranque (D-014): la corre `src/instrumentation.ts` al iniciar el servidor de Next
 * (no en `next build`). Falla cerrada: si lanza, el servidor no arranca.
 * - Siempre: un secreto de sesión válido (AUTH_SECRET o AUTH_SECRET_FILE, 32 bytes o más).
 * - En producción: además APP_ORIGEN válida (https, sin ruta), para el CSRF y el enlace de definir clave.
 */
import { readFileSync } from "node:fs";
import { origenesPermitidos, type FuenteOrigen } from "./origen";
import { leerSecreto, type FuenteSecreto } from "./secreto";

export function verificarArranque(env: FuenteSecreto & FuenteOrigen): void {
  leerSecreto(env, (ruta) => readFileSync(ruta, "utf8"));
  origenesPermitidos(env);
}
