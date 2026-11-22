/**
 * El turno de las proyecciones (frente proyecciones-pantalla; contrato de src/proyecciones/proyectar.ts). El cálculo es
 * síncrono (bloquea el proceso mientras dura), así que, en memoria del proceso (la app es un solo contenedor):
 * - una proyección en vuelo por usuario: la segunda se rechaza (EN_VUELO);
 * - un límite de frecuencia por usuario: PROYECCIONES_POR_MINUTO en una ventana fija (FRECUENCIA);
 * - en todo el proceso, un cálculo a la vez con una cola chica; llena, se rechaza (OCUPADO).
 * Vive en globalThis (como src/auth/carga.ts): la página y la ruta comparten la misma instancia aunque Next cargue el
 * módulo dos veces. El tope general de /api por IP (src/proxy.ts) sigue aparte. Puro (sin base).
 */
import { ErrorOcupado, crearSemaforo, type Semaforo } from "@/auth/carga";
import { crearLimitador, type Limitador } from "@/auth/limite-api";

export const PROYECCIONES_POR_MINUTO = 30;
const MINUTO_MS = 60_000;
const A_LA_VEZ = 1;
const EN_ESPERA = 2;
/** Usuarios distintos que se recuerdan en la ventana (la app tiene un dueño; el tope solo acota la memoria). */
const MAX_USUARIOS = 100;
const REINTENTO_S = 1;

export type MotivoTurno = "EN_VUELO" | "FRECUENCIA" | "OCUPADO";
export type Turno<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly motivo: MotivoTurno; readonly reintentarEnS: number };

interface Estado {
  readonly enVuelo: Set<string>;
  readonly frecuencia: Limitador;
  readonly proceso: Semaforo;
}

const CLAVE = Symbol.for("inv008.proyecciones.turno");

const nuevo = (): Estado => ({
  enVuelo: new Set(),
  frecuencia: crearLimitador({ maximo: PROYECCIONES_POR_MINUTO, ventanaMs: MINUTO_MS, maxRedes: MAX_USUARIOS }),
  proceso: crearSemaforo({ maximo: A_LA_VEZ, maxEspera: EN_ESPERA }),
});

function estado(): Estado {
  const g = globalThis as Record<symbol, Estado | undefined>;
  g[CLAVE] ??= nuevo();
  return g[CLAVE];
}

/** Solo para las pruebas: un turno limpio. */
export function reiniciarTurnoParaPruebas(): void {
  (globalThis as Record<symbol, Estado | undefined>)[CLAVE] = nuevo();
}

export async function conTurno<T>(usuarioId: string, ahoraMs: number, tarea: () => Promise<T>): Promise<Turno<T>> {
  const e = estado();
  if (e.enVuelo.has(usuarioId)) return { ok: false, motivo: "EN_VUELO", reintentarEnS: REINTENTO_S };
  const decision = e.frecuencia.registrar(usuarioId, ahoraMs);
  if (!decision.permitido) return { ok: false, motivo: "FRECUENCIA", reintentarEnS: decision.reintentarEnS };
  e.enVuelo.add(usuarioId);
  try {
    return { ok: true, valor: await e.proceso.con(tarea) };
  } catch (error) {
    if (error instanceof ErrorOcupado) return { ok: false, motivo: "OCUPADO", reintentarEnS: REINTENTO_S };
    throw error;
  } finally {
    e.enVuelo.delete(usuarioId);
  }
}
