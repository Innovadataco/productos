/**
 * Lo que llega en la dirección de las pantallas del plan (`?version=`, `?regla=`, `/decisiones/<id>`). Puro.
 * Solo se acepta un texto con la forma exacta; después, la página lo busca en la base y usa lo que vino de ella.
 * Nunca se repite en la pantalla lo que se escribió en la dirección.
 */
/** Los ids de la base son cuid (minúsculas y dígitos); el guion se admite para los ids de las pruebas. */
const ID = /^[a-z0-9-]{1,64}$/;
/** Un número de versión sin ceros a la izquierda, signos ni decimales. */
const VERSION = /^[1-9]\d{0,8}$/;

export const idDeConsulta = (v: unknown): string | null => (typeof v === "string" && ID.test(v) ? v : null);
export const versionDeConsulta = (v: unknown): number | null => (typeof v === "string" && VERSION.test(v) ? Number(v) : null);
