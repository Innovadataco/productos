/**
 * El correo que reciben los CLI que crean o tocan la cuenta del dueño: scripts/importar-trii.ts y
 * scripts/crear-acceso-inicial.ts (O1). Puro. Una opción nunca es el correo: lo que empieza por «-» se rechaza
 * (también «--d@x.invalid», que tiene forma de correo), igual que los caracteres de control, invisibles o de
 * dirección de texto (no llegan ni a la base ni a la consola) y lo que pasa de EMAIL_MAX.
 */
import { EMAIL_MAX } from "../auth/limites";

const FORMA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Controles (C0, DEL, C1) e invisibles o de dirección de texto (desfiguran lo que se ve en la consola). */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/;

/** El correo sin espacios a los lados, o null si no sirve. */
export function correoDeCli(texto: string | undefined): string | null {
  const correo = (texto ?? "").trim();
  if (correo === "" || correo.length > EMAIL_MAX || correo.startsWith("-") || CONTROL.test(correo)) return null;
  return FORMA.test(correo) ? correo : null;
}
