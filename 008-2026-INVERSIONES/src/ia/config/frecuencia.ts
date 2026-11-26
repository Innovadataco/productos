import "server-only";
/**
 * El límite de las acciones al Mac de /edicion/ia (E8), en memoria del proceso (la app es un solo contenedor), además del
 * tope general de las API por IP del proxy. «Identificar modelos» y «Probar» (cada una puede llegar al Mac de PI):
 * - un pedido cada pocos segundos por usuario, como en PI;
 * - una sola acción a la vez en el proceso (revisión de seguridad, M2: «Probar» puede tardar minutos).
 * Guardar no tiene límite propio: tras un error se corrige y se reenvía enseguida, y un doble envío no duplica (la
 * versión de partida da 409).
 */
import { crearLimitador, type Decision, type Limitador } from "@/auth/limite-api";

/** Una acción al Mac (identificar o probar) cada 5 s por usuario. */
export const VENTANA_OLLAMA_MS = 5000;
/** Un pedido de análisis («Analizar con IA») cada 3 s por usuario: el servicio pone el resto (1 en curso, 1 en espera, 2 min). */
export const VENTANA_ANALISIS_MS = 3000;
/** Pocos usuarios: solo el dueño (y quien lo intente). */
const MAX_USUARIOS = 100;

const crear = (): Limitador => crearLimitador({ maximo: 1, ventanaMs: VENTANA_OLLAMA_MS, maxRedes: MAX_USUARIOS });
let ollama = crear();
let analisis = crearLimitador({ maximo: 1, ventanaMs: VENTANA_ANALISIS_MS, maxRedes: MAX_USUARIOS });
let enCurso = false;

export const permitidoOllama = (usuarioId: string, ahoraMs: number): Decision => ollama.registrar(usuarioId, ahoraMs);

export const permitidoAnalisis = (usuarioId: string, ahoraMs: number): Decision => analisis.registrar(usuarioId, ahoraMs);

/** El turno de la única acción al Mac a la vez: una función para soltarlo, o null si ya hay una en curso. */
export function tomarTurnoOllama(): (() => void) | null {
  if (enCurso) return null;
  enCurso = true;
  let suelto = false;
  return () => {
    if (suelto) return;
    suelto = true;
    enCurso = false;
  };
}

/** Solo para las pruebas: el límite por usuario parte de cero (el turno lo suelta la acción al terminar). */
export function reiniciarFrecuenciasIa(): void {
  ollama = crear();
  analisis = crearLimitador({ maximo: 1, ventanaMs: VENTANA_ANALISIS_MS, maxRedes: MAX_USUARIOS });
}
