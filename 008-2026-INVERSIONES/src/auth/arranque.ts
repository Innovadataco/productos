/**
 * Verificación de arranque (D-014 y TOTP): la corre `src/instrumentation.ts` al iniciar el servidor de Next
 * (no en `next build`). Falla cerrada: si lanza, el servidor no arranca.
 * - Siempre: un secreto de sesión válido (AUTH_SECRET o AUTH_SECRET_FILE, 32 bytes o más).
 * - Siempre: el llavero de cifrado (CIFRADO_CLAVE_ACTIVA y su CIFRADO_CLAVE_V<n>): el secreto TOTP se guarda
 *   cifrado y, sin llavero, el segundo paso no podría verificar a nadie.
 * - En producción: además APP_ORIGEN válida (https, sin ruta), para el CSRF y el enlace de definir clave.
 * Los mensajes dicen qué falta, nunca un valor.
 */
import { readFileSync } from "node:fs";
import { obtenerLlavero, type Entorno } from "../cifrado/llavero";
import { origenesPermitidos, type FuenteOrigen } from "./origen";
import { leerSecreto, type FuenteSecreto } from "./secreto";

export function verificarArranque(env: FuenteSecreto & FuenteOrigen & Entorno): void {
  leerSecreto(env, (ruta) => readFileSync(ruta, "utf8"));
  obtenerLlavero(env);
  origenesPermitidos(env);
}
