/**
 * Roles con acceso a la web (frente familia-lectura). Módulo puro: sin base ni Next.
 * - Entran el DUENO y la FAMILIA, y nadie más: la lista es cerrada (un valor nuevo del enum no entra solo).
 * - La FAMILIA entra en SOLO LECTURA: lo que escribe o administra es del dueño (`exigirDueno`, src/auth/sesion.ts).
 * - Falla cerrada: solo el valor exacto DUENO es dueño; todo lo demás es de solo lectura. (La marca «Solo lectura» de
 *   la pantalla es solo presentación y por defecto no se pinta: el bloqueo lo hace siempre el servidor.)
 * El rol sale SIEMPRE de la base en cada página y API, nunca del JWT ni del navegador.
 */
export const ROLES_WEB = ["DUENO", "FAMILIA"] as const;

export type RolWeb = (typeof ROLES_WEB)[number];

export const tieneAccesoWeb = (rol: string): rol is RolWeb => (ROLES_WEB as readonly string[]).includes(rol);

export const esDueno = (usuario: { readonly rol: string }): boolean => usuario.rol === "DUENO";

export const esSoloLectura = (usuario: { readonly rol: string }): boolean => !esDueno(usuario);
