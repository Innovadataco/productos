/**
 * Fases de la metodología PM2 de IDC (spec 008).
 *
 * A diferencia de los estados de oportunidad —un catálogo configurable en BD
 * (SPEC-007)— las fases son **fijas**: forman parte de la metodología, no de la
 * configuración del cliente. No se añaden ni se quitan desde la UI, así que
 * viven en código y no en una tabla. Es una diferencia deliberada, no un olvido.
 */

export interface FasePm2 {
  /** Clave persistida en `Proyecto.currentPhase`. */
  key: string;
  /** Nombre para el usuario. */
  nombre: string;
}

/**
 * Las cuatro fases, en orden de metodología.
 *
 * Las claves son las que ya escribe el dato vivo (`currentPhase` tiene default
 * `initiation` y el formulario ya guardaba `planning`/`execution`), así que
 * ningún proyecto existente necesita migración. `closing` es nueva **en la UI**:
 * el formulario solo ofrecía tres fases y "Cierre" era inalcanzable.
 */
export const FASES_PM2: readonly FasePm2[] = [
  { key: "initiation", nombre: "Inicio" },
  { key: "planning", nombre: "Planeación" },
  { key: "execution", nombre: "Ejecución" },
  { key: "closing", nombre: "Cierre" },
] as const;

/** ¿La clave corresponde a una fase PM2? Las rutas lo exigen antes de persistir (§5.2). */
export function esFasePm2(key: string): boolean {
  return FASES_PM2.some((fase) => fase.key === key);
}

/**
 * Nombre visible de una fase.
 *
 * Ante una clave desconocida devuelve la propia clave en vez de vaciarse: un
 * proyecto con una fase heredada rara sigue siendo visible y legible, igual que
 * las tarjetas huérfanas de SPEC-007 no rompen el tablero.
 */
export function nombreDeFase(key: string): string {
  return FASES_PM2.find((fase) => fase.key === key)?.nombre ?? key;
}
