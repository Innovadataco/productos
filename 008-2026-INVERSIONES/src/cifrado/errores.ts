/**
 * Errores del cifrado de campos sensibles (#11). El mensaje es fijo por código y a lo sumo nombra
 * la versión de la clave («v2»): nunca trae la clave, el texto en claro, el sobre ni la causa de Node.
 */
export type CodigoCifrado =
  | "CLAVE_ACTIVA_AUSENTE"
  | "CLAVE_ACTIVA_INVALIDA"
  | "CLAVE_AUSENTE"
  | "CLAVE_INVALIDA"
  | "CLAVE_NOMBRE_INVALIDO"
  | "CLAVE_NO_DISPONIBLE"
  | "SOBRE_INVALIDO"
  | "AUTENTICACION_FALLIDA"
  | "CONTENIDO_INVALIDO";

const MENSAJES: Readonly<Record<CodigoCifrado, (version: string) => string>> = {
  CLAVE_ACTIVA_AUSENTE: () => "Falta CIFRADO_CLAVE_ACTIVA (la versión con la que se cifra, por ejemplo «v1»).",
  CLAVE_ACTIVA_INVALIDA: () => "CIFRADO_CLAVE_ACTIVA debe ser «v» seguida de un número desde 1 (por ejemplo «v1»).",
  CLAVE_AUSENTE: (v) => `Falta la clave de la versión activa ${v} (CIFRADO_CLAVE_${v.toUpperCase()}).`,
  CLAVE_INVALIDA: (v) => `La clave de cifrado ${v} no es base64 estricta de 32 bytes.`,
  CLAVE_NOMBRE_INVALIDO: () => "Hay una variable CIFRADO_CLAVE_V… con un nombre que no es CIFRADO_CLAVE_V<n> (n desde 1, sin ceros a la izquierda).",
  CLAVE_NO_DISPONIBLE: (v) => `El dato está cifrado con la versión ${v}, cuya clave no está cargada.`,
  SOBRE_INVALIDO: () => "El valor no es un sobre cifrado válido.",
  AUTENTICACION_FALLIDA: () => "El sobre no se pudo autenticar: fue alterado, se movió de lugar o la clave no corresponde.",
  CONTENIDO_INVALIDO: () => "El contenido descifrado no tiene la forma esperada.",
};

export class ErrorCifrado extends Error {
  constructor(readonly codigo: CodigoCifrado, version = "") {
    super(MENSAJES[codigo](version));
    this.name = "ErrorCifrado";
  }
}
