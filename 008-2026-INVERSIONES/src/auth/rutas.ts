/**
 * Rutas públicas (D-014, PLAN-DESPLIEGUE-VPS §6). Coincidencia EXACTA de método y ruta: todo lo demás
 * exige sesión, también lo que agreguen otros frentes. Los estáticos ni pasan por el proxy (matcher).
 * Módulo puro: lo usa el proxy.
 */
const PUBLICAS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["/ingresar", new Set(["GET", "HEAD"])],
  ["/definir-clave", new Set(["GET", "HEAD"])],
  ["/api/salud", new Set(["GET", "HEAD"])],
  ["/api/sesion/ingresar", new Set(["POST"])],
  ["/api/sesion/definir-clave", new Set(["POST"])],
]);

export function esPublica(metodo: string, ruta: string): boolean {
  return PUBLICAS.get(ruta)?.has(metodo.toUpperCase()) ?? false;
}

export const esApi = (ruta: string): boolean => ruta === "/api" || ruta.startsWith("/api/");
