/**
 * Ajustes de los retornos de cierres SIN ajustar (Yahoo `.CL` sin ajustar, como los guarda precio_cierre). Puro.
 * Devuelven correcciones (día, columna, factor) y avisos; la historia las aplica.
 * - Escisión: el día del primer cierre propio del origen en o después de la fecha del evento, quien tenía una acción
 *   madre tiene P_o + razón × P_d (razón = acciones nuevas por acción madre; P_d, el cierre propio del destino ese
 *   día). Factor = (P_o + Σ razón × P_d) / P_o del día anterior. Varios destinos el mismo día se suman. Sin razón,
 *   sin cierre del destino ese día o encadenada (el destino también se escinde ese día): el día queda en 1 (no se
 *   inventa el valor recibido) y se avisa. Un evento cuyo día cae antes de la ventana no entra en ningún retorno.
 * - Salto sin evento: un factor fuera de [SALTO_MIN, SALTO_MAX] que ninguna escisión explica es casi seguro un evento
 *   no registrado (un desdoblamiento, por ejemplo): queda en 1 y se avisa.
 */
import { diaIso } from "../precios/horario";
import { SALTO_MAX, SALTO_MIN } from "./metodo";
import type { AvisoCrudo, CodigoAviso, Dia, EscisionLeida } from "./tipos";

export interface Correccion {
  /** Índice del retorno (día dias[t + 1]). */
  readonly t: number;
  readonly k: number;
  readonly factor: number;
}

export interface ColumnaAjuste {
  readonly instrumentoId: string;
  readonly nombre: string;
  /** Días propios (con cierre), ordenados: todos, no solo los de la ventana. */
  readonly diasPropios: readonly Dia[];
}

export interface ContextoAjuste {
  readonly dias: readonly Dia[];
  readonly K: number;
  readonly columnas: readonly ColumnaAjuste[];
  /** D × K, con el último precio arrastrado. */
  readonly precios: Float64Array;
  /** Cierres propios por especie (posiciones y destinos), por día. */
  readonly cierres: ReadonlyMap<string, ReadonlyMap<Dia, number>>;
}

export interface Ajustes {
  readonly correcciones: readonly Correccion[];
  readonly avisos: readonly AvisoCrudo[];
}

/** Primer índice i con lista[i] ≥ x (lista ordenada); lista.length si no hay. */
export function primerIndiceDesde(lista: readonly Dia[], x: Dia): number {
  let bajo = 0;
  let alto = lista.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >>> 1;
    if (lista[medio]! < x) bajo = medio + 1;
    else alto = medio;
  }
  return bajo;
}

const avisoDe = (c: ColumnaAjuste, codigo: CodigoAviso, dia: Dia): AvisoCrudo => ({ codigo, instrumentoId: c.instrumentoId, nombre: c.nombre, dia, dato: null });

/** El día (índice de la rejilla, ≥ 1) en que la escisión mueve el precio del origen; null si no entra. */
function diaDelEvento(indice: ReadonlyMap<Dia, number>, c: ColumnaAjuste, e: EscisionLeida): number | null {
  const propio = c.diasPropios[primerIndiceDesde(c.diasPropios, diaIso(e.fecha))];
  const j = propio === undefined ? undefined : indice.get(propio);
  return j === undefined || j < 1 ? null : j;
}

function problema(ctx: ContextoAjuste, todas: readonly EscisionLeida[], grupo: readonly EscisionLeida[], dia: Dia): CodigoAviso | null {
  if (grupo.some((e) => e.razon === null)) return "ESCISION_SIN_RAZON";
  if (grupo.some((e) => todas.some((o) => o.origenId === e.destinoId && diaIso(o.fecha) === diaIso(e.fecha)))) return "ESCISION_ENCADENADA";
  if (grupo.some((e) => ctx.cierres.get(e.destinoId)?.get(dia) === undefined)) return "ESCISION_SIN_CIERRE_DESTINO";
  return null;
}

export function ajustesPorEscision(ctx: ContextoAjuste, escisiones: readonly EscisionLeida[]): Ajustes {
  const indice = new Map(ctx.dias.map((d, j) => [d, j]));
  const correcciones: Correccion[] = [];
  const avisos: AvisoCrudo[] = [];
  ctx.columnas.forEach((c, k) => {
    const grupos = new Map<number, EscisionLeida[]>();
    for (const e of escisiones.filter((x) => x.origenId === c.instrumentoId)) {
      const j = diaDelEvento(indice, c, e);
      if (j !== null) grupos.set(j, [...(grupos.get(j) ?? []), e]);
    }
    for (const [j, grupo] of [...grupos].sort(([a], [b]) => a - b)) {
      const dia = ctx.dias[j]!;
      const codigo = problema(ctx, escisiones, grupo, dia);
      if (codigo) {
        avisos.push(avisoDe(c, codigo, dia));
        correcciones.push({ t: j - 1, k, factor: 1 });
        continue;
      }
      const recibido = grupo.reduce((s, e) => s + e.razon! * ctx.cierres.get(e.destinoId)!.get(dia)!, 0);
      correcciones.push({ t: j - 1, k, factor: (ctx.precios[j * ctx.K + k]! + recibido) / ctx.precios[(j - 1) * ctx.K + k]! });
    }
  });
  return { correcciones, avisos };
}

/** Saltos sin evento sobre los factores ya corregidos; `explicados` = t·K + k de los días de escisión. */
export function ajustesPorSalto(ctx: ContextoAjuste, factores: Float64Array, explicados: ReadonlySet<number>): Ajustes {
  const correcciones: Correccion[] = [];
  const avisos: AvisoCrudo[] = [];
  const T = ctx.dias.length - 1;
  ctx.columnas.forEach((c, k) => {
    for (let t = 0; t < T; t += 1) {
      const f = factores[t * ctx.K + k]!;
      if (explicados.has(t * ctx.K + k) || (f >= SALTO_MIN && f <= SALTO_MAX)) continue;
      correcciones.push({ t, k, factor: 1 });
      avisos.push(avisoDe(c, "SALTO_SIN_EVENTO", ctx.dias[t + 1]!));
    }
  });
  return { correcciones, avisos };
}
