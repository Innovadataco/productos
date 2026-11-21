/**
 * ¿Lo guardado sigue al día? La pantalla de la conciliación recalcula en solo lectura (mismas reglas, misma
 * instantánea) y compara con la última conciliación guardada. Cálculo puro.
 * Solo cuenta el fondo: el orden de los controles (`createMany` no lo garantiza), el orden de las claves del
 * `detalle` (JSONB las reordena) y la escala de los decimales («1.500000» = «1.5») no cuentan.
 * Un `detalle` guardado con una forma inesperada cuenta como distinto: nunca lanza.
 */
import { Prisma } from "@prisma/client";
import type { Conciliado, Control } from "./controles";

type Cifra = Prisma.Decimal | null;

/** Un control tal como lo devuelve la base (`select` explícito de ControlConciliacion). */
export interface ControlGuardado {
  readonly tipo: string;
  readonly instrumentoId: string | null;
  readonly esperado: Cifra;
  readonly real: Cifra;
  readonly diferencia: Cifra;
  readonly tolerancia: Cifra;
  readonly resultado: string;
  readonly codigoMotivo: string | null;
  readonly detalle: Prisma.JsonValue | null;
}

export interface ConciliacionGuardada {
  readonly versionCalculo: string;
  readonly resultado: string;
  readonly controles: readonly ControlGuardado[];
}

export type ConciliacionRecalculada = Conciliado & { readonly versionCalculo: string };

/** `detalle` en forma canónica: claves ordenadas y valores como texto; null si no es un objeto plano de escalares. */
function detalleCanonico(detalle: unknown): string | null {
  if (detalle === null || detalle === undefined) return "";
  if (typeof detalle !== "object" || Array.isArray(detalle)) return null;
  const pares: [string, string][] = [];
  for (const [clave, valor] of Object.entries(detalle)) {
    if (typeof valor !== "string" && typeof valor !== "number") return null;
    pares.push([clave, String(valor)]);
  }
  // Las claves de un objeto no se repiten: nunca hay empate.
  return JSON.stringify(pares.sort(([a], [b]) => (a < b ? -1 : 1)));
}

const alcanceDe = (detalle: unknown): string =>
  detalle !== null && typeof detalle === "object" && !Array.isArray(detalle) && typeof (detalle as Record<string, unknown>).alcance === "string"
    ? String((detalle as Record<string, unknown>).alcance)
    : "";

const llave = (c: { tipo: string; instrumentoId: string | null; detalle: unknown }) => `${c.tipo}|${c.instrumentoId ?? ""}|${alcanceDe(c.detalle)}`;

function mismaCifra(guardada: Cifra, recalculada: string | null): boolean {
  if (guardada === null || recalculada === null) return guardada === null && recalculada === null;
  return guardada.eq(recalculada);
}

function mismoControl(g: ControlGuardado, r: Control): boolean {
  const detalle = detalleCanonico(g.detalle);
  return (
    detalle !== null && detalle === detalleCanonico(r.detalle) &&
    g.resultado === r.resultado && g.codigoMotivo === r.codigoMotivo &&
    mismaCifra(g.esperado, r.esperado) && mismaCifra(g.real, r.real) &&
    mismaCifra(g.diferencia, r.diferencia) && mismaCifra(g.tolerancia, r.tolerancia)
  );
}

export function mismaConciliacion(guardada: ConciliacionGuardada, recalculada: ConciliacionRecalculada): boolean {
  if (guardada.versionCalculo !== recalculada.versionCalculo || guardada.resultado !== recalculada.resultado) return false;
  if (guardada.controles.length !== recalculada.controles.length) return false;
  const porLlave = new Map<string, Control>();
  for (const r of recalculada.controles) {
    if (porLlave.has(llave(r))) return false;
    porLlave.set(llave(r), r);
  }
  const vistas = new Set<string>();
  for (const g of guardada.controles) {
    const k = llave(g);
    const r = porLlave.get(k);
    if (r === undefined || vistas.has(k) || !mismoControl(g, r)) return false;
    vistas.add(k);
  }
  return true;
}
