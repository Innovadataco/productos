/** Base64 estricta: alfabeto estándar, con relleno y en forma canónica (sin bits sobrantes). */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Los bytes de `texto` si es base64 estricta; si no, null. `Buffer.from` sola acepta casi cualquier cosa. */
export function decodificarBase64Estricta(texto: string): Buffer | null {
  if (!BASE64.test(texto)) return null;
  const bytes = Buffer.from(texto, "base64");
  return bytes.toString("base64") === texto ? bytes : null;
}
