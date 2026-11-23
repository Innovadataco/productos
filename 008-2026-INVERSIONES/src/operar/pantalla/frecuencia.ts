/**
 * El límite del simulador de /operar, en memoria del proceso (la app es un solo contenedor), además del tope general de
 * /api por IP (src/proxy.ts): SIMULACIONES_POR_MINUTO por usuario en una ventana fija. Vive en globalThis (como el
 * turno de las proyecciones), con su propia clave: no comparte la cuota con el simulador de Proyecciones. El cálculo es
 * corto (sin azar ni trayectorias): no hace falta un turno del proceso. Puro (sin base).
 */
import { crearLimitador, type Decision, type Limitador } from "@/auth/limite-api";

export const SIMULACIONES_POR_MINUTO = 20;
const MINUTO_MS = 60_000;
/** Usuarios distintos que se recuerdan en la ventana (la app tiene un dueño y su familia; el tope acota la memoria). */
const MAX_USUARIOS = 100;
const CLAVE = Symbol.for("inv008.operar.simulador.frecuencia");

const nuevo = (): Limitador => crearLimitador({ maximo: SIMULACIONES_POR_MINUTO, ventanaMs: MINUTO_MS, maxRedes: MAX_USUARIOS });

function limitador(): Limitador {
  const g = globalThis as Record<symbol, Limitador | undefined>;
  g[CLAVE] ??= nuevo();
  return g[CLAVE];
}

export const permitidoSimular = (usuarioId: string, ahoraMs: number): Decision => limitador().registrar(usuarioId, ahoraMs);

/** Solo para las pruebas: la cuota parte de cero. */
export function reiniciarFrecuenciaSimulador(): void {
  (globalThis as Record<symbol, Limitador | undefined>)[CLAVE] = nuevo();
}
