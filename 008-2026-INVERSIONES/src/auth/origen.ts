/**
 * CSRF por Origin (D-014). Todo método que no sea GET o HEAD exige un `Origin` de la lista permitida;
 * no se compara contra `Host`, que detrás del túnel no es confiable.
 * - Producción: solo APP_ORIGEN (obligatoria, https y sin ruta; p. ej. https://inversiones.innovadataco.com).
 * - Desarrollo: la app local en el 5008, por http (`npm run dev`) o https (`npm run dev:https`).
 * Si llega `Sec-Fetch-Site`, además debe ser `same-origin`. Módulo puro: lo usa también el proxy.
 */
export const ORIGENES_DESARROLLO: readonly string[] = [
  "http://127.0.0.1:5008",
  "http://localhost:5008",
  "https://127.0.0.1:5008",
  "https://localhost:5008",
];

const METODOS_SEGUROS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export interface FuenteOrigen {
  readonly NODE_ENV?: string;
  readonly APP_ORIGEN?: string;
}

export class ErrorOrigen extends Error {
  override readonly name = "ErrorOrigen";
}

function origenDeProduccion(valor: string | undefined): string {
  const error = new ErrorOrigen("APP_ORIGEN debe ser el origen https de la app, sin ruta (p. ej. https://inversiones.innovadataco.com).");
  if (!valor) throw error;
  try {
    const u = new URL(valor);
    if (u.protocol !== "https:" || u.origin !== valor) throw error;
    return u.origin;
  } catch {
    throw error;
  }
}

/** La lista de orígenes permitidos. En producción sin APP_ORIGEN válida, lanza (falla cerrada). */
export function origenesPermitidos(env: FuenteOrigen): readonly string[] {
  return env.NODE_ENV === "production" ? [origenDeProduccion(env.APP_ORIGEN)] : ORIGENES_DESARROLLO;
}

export const esMetodoSeguro = (metodo: string): boolean => METODOS_SEGUROS.has(metodo.toUpperCase());

export function origenValido(metodo: string, cabeceras: Headers, permitidos: readonly string[]): boolean {
  if (esMetodoSeguro(metodo)) return true;
  const origen = cabeceras.get("origin");
  if (!origen || !permitidos.includes(origen)) return false;
  const sitio = cabeceras.get("sec-fetch-site");
  return sitio === null || sitio === "same-origin";
}
