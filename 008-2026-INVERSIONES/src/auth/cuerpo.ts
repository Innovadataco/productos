/**
 * Cuerpo de los POST de sesión (D-014): JSON de 4 KB como máximo, con EXACTAMENTE los campos de texto
 * esperados. Se lee en trozos y se corta al pasar el tope: un cuerpo enorme no se carga entero en memoria.
 */
import { CUERPO_MAX_BYTES, EMAIL_MAX } from "./limites";

/** Una clave de más de 72 bytes ya no entra; este tope solo evita valores absurdos. */
const TEXTO_MAX = 1024;

/** El cuerpo como texto, cortado al pasar `maxBytes` (null); lo usa también POST /api/proyecciones con su tope. */
export async function textoAcotado(pedido: Request, maxBytes: number = CUERPO_MAX_BYTES): Promise<string | null> {
  if (Number(pedido.headers.get("content-length") ?? "0") > maxBytes) return null;
  if (!pedido.body) return "";
  const lector = pedido.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel();
      return null;
    }
    trozos.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(trozos));
}

/** Un objeto JSON con exactamente `campos`, todos texto no vacío de hasta 1024 caracteres; o null. */
async function leerCampos<C extends string>(pedido: Request, campos: readonly C[]): Promise<Readonly<Record<C, string>> | null> {
  if (!(pedido.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return null;
  const texto = await textoAcotado(pedido);
  if (texto === null) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) return null;
  const registro = datos as Record<string, unknown>;
  if (Object.keys(registro).sort().join(",") !== [...campos].sort().join(",")) return null;
  const valido = campos.every((c) => typeof registro[c] === "string" && registro[c] !== "" && (registro[c] as string).length <= TEXTO_MAX);
  return valido ? (registro as Record<C, string>) : null;
}

export interface Credenciales {
  readonly email: string;
  readonly clave: string;
}

/** Las credenciales del POST de ingreso, o null si el cuerpo no es válido. */
export async function leerCredenciales(pedido: Request): Promise<Credenciales | null> {
  const datos = await leerCampos(pedido, ["email", "clave"] as const);
  const email = datos?.email.trim() ?? "";
  if (!datos || !email || email.length > EMAIL_MAX) return null;
  return { email, clave: datos.clave };
}

export interface NuevaClave {
  readonly token: string;
  readonly clave: string;
}

/** El token del enlace y la clave nueva del POST de definir clave, o null si el cuerpo no es válido. */
export async function leerNuevaClave(pedido: Request): Promise<NuevaClave | null> {
  const datos = await leerCampos(pedido, ["token", "clave"] as const);
  return datos ? { token: datos.token, clave: datos.clave } : null;
}

/** Un código del segundo paso (TOTP o de recuperación) no pasa de esto, con guiones y espacios. */
const CODIGO_MAX = 64;

/** El código del POST del segundo paso (`{ "codigo": "…" }`), o null si el cuerpo no es válido. */
export async function leerCodigo(pedido: Request): Promise<string | null> {
  const datos = await leerCampos(pedido, ["codigo"] as const);
  return datos && datos.codigo.length <= CODIGO_MAX ? datos.codigo : null;
}
