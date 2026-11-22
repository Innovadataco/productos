import "server-only";
/**
 * El límite de frecuencia de las acciones de /edicion/ia (E8), por usuario y en memoria del proceso (la app es un solo
 * contenedor), además del tope general de las API por IP del proxy: «Identificar modelos» y «Probar» comparten uno (un
 * pedido cada pocos segundos: cada uno puede llegar al Mac de PI), y guardar tiene el suyo. Como en PI.
 */
import { crearLimitador, type Decision, type Limitador } from "@/auth/limite-api";

/** Una acción al Mac (identificar o probar) cada 5 s por usuario. */
export const VENTANA_OLLAMA_MS = 5000;
/** Una versión nueva cada 3 s por usuario (un doble clic no crea dos). */
export const VENTANA_GUARDAR_MS = 3_000;
/** Pocos usuarios: solo el dueño (y quien lo intente). */
const MAX_USUARIOS = 100;

const crear = (ventanaMs: number): Limitador => crearLimitador({ maximo: 1, ventanaMs, maxRedes: MAX_USUARIOS });
let ollama = crear(VENTANA_OLLAMA_MS);
let guardar = crear(VENTANA_GUARDAR_MS);

export const permitidoOllama = (usuarioId: string, ahoraMs: number): Decision => ollama.registrar(usuarioId, ahoraMs);
export const permitidoGuardar = (usuarioId: string, ahoraMs: number): Decision => guardar.registrar(usuarioId, ahoraMs);

/** Solo para las pruebas: parte de cero. */
export function reiniciarFrecuenciasIa(): void {
  ollama = crear(VENTANA_OLLAMA_MS);
  guardar = crear(VENTANA_GUARDAR_MS);
}
