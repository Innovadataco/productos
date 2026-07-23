/// Redacción RECURSIVA de campos sensibles + truncado, ANTES de persistir en la bitácora (013).
/// Corrección ZEUS-003: la redacción recorre TODO el árbol JSON (objetos y arrays anidados a
/// cualquier profundidad), no solo el primer nivel. Nunca se persisten valores de tokens/cabeceras
/// — solo sus nombres. Truncado a 8 KB por columna jsonb (documentado).

const CLAVES_SENSIBLES = new Set([
  "clave",
  "contrasena",
  "contraseña",
  "password",
  "token",
  "tokenautorizado",
  "tokenexterno",
  "tokenparametrico",
  "authorization",
  "bearer",
  "secret",
  "apikey",
  "api_key",
]);

const REDACTADO = "***";
export const LIMITE_BYTES = 8 * 1024;

function esSensible(clave: string): boolean {
  return CLAVES_SENSIBLES.has(clave.toLowerCase());
}

/// Redacta recursivamente: cualquier propiedad cuyo NOMBRE sea sensible → "***", a cualquier
/// profundidad, dentro de objetos y arrays.
export function redactar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map((v) => redactar(v));
  if (valor !== null && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[k] = esSensible(k) ? REDACTADO : redactar(v);
    }
    return salida;
  }
  return valor;
}

/// Trunca el valor serializado si excede el límite (evita filas gigantes sin romper la bitácora).
export function truncar(valor: unknown, limiteBytes = LIMITE_BYTES): unknown {
  const json = JSON.stringify(valor);
  if (json === undefined) return valor;
  if (Buffer.byteLength(json, "utf8") <= limiteBytes) return valor;
  return { _truncado: true, bytes: Buffer.byteLength(json, "utf8"), contenido: json.slice(0, limiteBytes) };
}

/// Pipeline estándar para persistir: redacta y luego trunca.
export function redactarYTruncar(valor: unknown): unknown {
  return truncar(redactar(valor));
}
