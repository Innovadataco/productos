/**
 * Rutas públicas (D-014, PLAN-DESPLIEGUE-VPS §6). Coincidencia EXACTA de método y ruta: todo lo demás
 * exige sesión, también lo que agreguen otros frentes. Los estáticos ni pasan por el proxy (matcher).
 * Las del segundo paso (TOTP) no exigen sesión en el proxy porque exigen la PRE-sesión en el servidor
 * (`exigirPresesion` / `exigirPresesionApi`, con candado en tests/unit/auth/candados.test.ts); el proxy
 * nunca lee la pre-sesión. Regenerar los códigos (/totp/codigos) exige la sesión completa. Módulo puro.
 */
const SEGUNDO_PASO: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["/totp", new Set(["GET", "HEAD"])],
  ["/totp/enrolar", new Set(["GET", "HEAD"])],
  ["/api/sesion/totp", new Set(["POST"])],
  ["/api/sesion/totp/enrolar", new Set(["POST"])],
]);

const PUBLICAS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["/ingresar", new Set(["GET", "HEAD"])],
  ["/definir-clave", new Set(["GET", "HEAD"])],
  ["/api/salud", new Set(["GET", "HEAD"])],
  ["/api/sesion/ingresar", new Set(["POST"])],
  ["/api/sesion/definir-clave", new Set(["POST"])],
  ...SEGUNDO_PASO,
]);

/** Las rutas que exigen la pre-sesión en el servidor (para los candados). */
export const RUTAS_SEGUNDO_PASO: ReadonlySet<string> = new Set(SEGUNDO_PASO.keys());

export function esPublica(metodo: string, ruta: string): boolean {
  return PUBLICAS.get(ruta)?.has(metodo.toUpperCase()) ?? false;
}

export const esApi = (ruta: string): boolean => ruta === "/api" || ruta.startsWith("/api/");
