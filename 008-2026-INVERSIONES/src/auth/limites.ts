/**
 * Límites del login (D-014, PLAN-DESPLIEGUE-VPS.md §6). Módulo puro: lo usa también el proxy.
 * Un solo lugar para cada número: la sesión, el bloqueo, los topes y los largos.
 */

/** La sesión dura 8 horas. */
export const SESION_SEGUNDOS = 8 * 60 * 60;

/** Ventana de conteo de fallos y duración del bloqueo de una cuenta: 15 minutos. */
export const VENTANA_FALLOS_MS = 15 * 60 * 1000;
export const BLOQUEO_MS = 15 * 60 * 1000;

/** 5 fallos por usuario en la ventana bloquean la cuenta; 20 por IP cortan esa IP. */
export const FALLOS_POR_USUARIO = 5;
export const FALLOS_POR_IP = 20;

/** Tope general de las API por IP (requisito #10 del CEO de PI): 60 por minuto. */
export const API_POR_MINUTO = 60;
export const VENTANA_API_MS = 60 * 1000;

/** Contraseña de 12 a 72 bytes UTF-8: el tope sale del límite de bcrypt. */
export const CLAVE_MIN_BYTES = 12;
export const CLAVE_MAX_BYTES = 72;
export const COSTO_BCRYPT = 12;

/** Enlace de un solo uso para definir la clave: 32 bytes aleatorios, vence a los 30 minutos. */
export const TOKEN_BYTES = 32;
export const VIDA_TOKEN_MS = 30 * 60 * 1000;

/** El secreto que firma la sesión: 32 bytes o más. */
export const SECRETO_MIN_BYTES = 32;

/** Cuerpo máximo del POST de ingreso. */
export const CUERPO_MAX_BYTES = 4096;

/** Largo máximo de un correo (RFC 5321). */
export const EMAIL_MAX = 254;
