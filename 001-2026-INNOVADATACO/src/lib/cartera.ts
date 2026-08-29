/**
 * Agregados de cartera de proyectos (spec 014, US1 / FR-006).
 *
 * Puro y separado de la ruta y del render. Los agregados se **derivan** al leer
 * —no se persisten—: presupuesto, avance y riesgos abiertos cambian con cada
 * partida, entregable o riesgo, y un campo guardado se desincronizaría al primer
 * olvido (mismo criterio que la indexabilidad de la spec 013).
 */
import { nombreDeFase } from "./fasesPm2";
import { esRiesgoAbierto } from "./riesgo";

/** Lo mínimo que hace falta de un proyecto para calcular su fila de cartera. */
export interface ProyectoParaCartera {
  id: string;
  codigo: string;
  nombre: string;
  cliente: string;
  currentPhase: string;
  entregables: Array<{ avance: number }>;
  partidas: Array<{ montoPlaneado: unknown }>;
  riesgos: Array<{ estado: string }>;
}

export interface AgregadosProyecto {
  id: string;
  codigo: string;
  nombre: string;
  cliente: string;
  fase: string;
  faseNombre: string;
  presupuestoTotal: number;
  /** Media del avance de los entregables (0-100), o `null` si no hay ninguno. */
  avancePromedio: number | null;
  riesgosAbiertos: number;
}

/**
 * Avance agregado = **media simple** del avance de los entregables.
 *
 * El modelo `Entregable` no tiene peso, así que "ponderado por entregable" es
 * cada entregable pesando igual. Sin entregables devuelve `null` —no 0—: no es
 * lo mismo "al 0%" que "no hay nada que medir", y la cartera lo muestra como
 * "—" en vez de un cero engañoso.
 */
export function avancePromedio(entregables: Array<{ avance: number }>): number | null {
  if (entregables.length === 0) return null;
  const suma = entregables.reduce((acc, e) => acc + (Number(e.avance) || 0), 0);
  return Math.round(suma / entregables.length);
}

/** Presupuesto total = suma de lo planeado. Acepta los `Decimal` (string) de Prisma. */
export function presupuestoTotal(partidas: Array<{ montoPlaneado: unknown }>): number {
  return partidas.reduce((acc, p) => acc + Number(p.montoPlaneado), 0);
}

/** Riesgos abiertos = los que no están cerrados (FR-005). */
export function contarRiesgosAbiertos(riesgos: Array<{ estado: string }>): number {
  return riesgos.filter((r) => esRiesgoAbierto(r.estado)).length;
}

/** Fila de cartera de un proyecto. */
export function calcularAgregados(proyecto: ProyectoParaCartera): AgregadosProyecto {
  return {
    id: proyecto.id,
    codigo: proyecto.codigo,
    nombre: proyecto.nombre,
    cliente: proyecto.cliente,
    fase: proyecto.currentPhase,
    faseNombre: nombreDeFase(proyecto.currentPhase),
    presupuestoTotal: presupuestoTotal(proyecto.partidas),
    avancePromedio: avancePromedio(proyecto.entregables),
    riesgosAbiertos: contarRiesgosAbiertos(proyecto.riesgos),
  };
}
