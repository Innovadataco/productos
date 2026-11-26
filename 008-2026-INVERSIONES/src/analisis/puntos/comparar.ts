/**
 * La comparación de los puntos del antes y el después. La identidad de un punto es su clave más su sujeto. Hay cuatro
 * cambios (APARECE, DESAPARECE, SUBE y BAJA, por el ordinal del rango); con el mismo rango no se emite nada, y si un lado
 * no se calculó (null) tampoco, para no inventar «desaparece». Orden: importancia (la mayor entre antes y después), peso
 * de la especie (los del portafolio pesan 1), APARECE, SUBE, BAJA, DESAPARECE, orden del catálogo y sujeto. Puro.
 */
import { CLAVES_PUNTO, identidadDe, type Importancia, type LadoDelCambio, type Punto, type PuntoCambio, type TipoCambio } from "./tipos";
import { ordinalDe } from "./rangos";

export interface LadosComparacion {
  /** null: el análisis de ese lado no se calculó. */
  readonly antes: readonly Punto[] | null;
  readonly despues: readonly Punto[] | null;
  /** Lo que cada lado no pudo calcular (identidades): ahí un punto ausente no es un cambio. */
  readonly sinCalcular?: { readonly antes: readonly string[]; readonly despues: readonly string[] };
  /** Peso de cada especie (id) en el análisis de cada lado. */
  readonly pesos: { readonly antes: Readonly<Record<string, number>>; readonly despues: Readonly<Record<string, number>> };
}

const RANGO_IMPORTANCIA: Readonly<Record<Importancia, number>> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const RANGO_CAMBIO: Readonly<Record<TipoCambio, number>> = { APARECE: 0, SUBE: 1, BAJA: 2, DESAPARECE: 3 };
const CATALOGO = new Map(CLAVES_PUNTO.map((c, i) => [c, i]));

const identidad = (p: Punto): string => identidadDe(p.clave, p.sujeto);
const lado = (p: Punto | undefined): LadoDelCambio | null => (p === undefined ? null : { rango: p.rango, importancia: p.importancia, medido: p.medido });
const mayor = (a: Importancia | undefined, b: Importancia | undefined): Importancia =>
  (RANGO_IMPORTANCIA[a ?? "BAJA"] <= RANGO_IMPORTANCIA[b ?? "BAJA"] ? a : b) ?? "BAJA";

function tipoDe(antes: Punto | undefined, despues: Punto | undefined): TipoCambio | null {
  if (antes === undefined) return despues === undefined ? null : "APARECE";
  if (despues === undefined) return "DESAPARECE";
  const d = ordinalDe(antes.clave, despues.rango) - ordinalDe(antes.clave, antes.rango);
  return d === 0 ? null : d > 0 ? "SUBE" : "BAJA";
}

function pesoDe(p: Punto, e: LadosComparacion): number {
  if (p.sujeto.tipo === "PORTAFOLIO") return 1;
  return e.pesos.despues[p.sujeto.instrumentoId] ?? e.pesos.antes[p.sujeto.instrumentoId] ?? 0;
}

export function compararPuntos(e: LadosComparacion): readonly PuntoCambio[] {
  if (e.antes === null || e.despues === null) return [];
  const antes = new Map(e.antes.map((p) => [identidad(p), p] as const));
  const despues = new Map(e.despues.map((p) => [identidad(p), p] as const));
  const sinCalcularAntes = new Set(e.sinCalcular?.antes ?? []);
  const sinCalcularDespues = new Set(e.sinCalcular?.despues ?? []);
  const cambios = [...new Set([...antes.keys(), ...despues.keys()])].flatMap((id): PuntoCambio[] => {
    const a = antes.get(id);
    const d = despues.get(id);
    const cambio = tipoDe(a, d);
    if ((cambio === "DESAPARECE" && sinCalcularDespues.has(id)) || (cambio === "APARECE" && sinCalcularAntes.has(id))) return [];
    const base = (d ?? a)!;
    if (cambio === null) return [];
    return [{ clave: base.clave, sujeto: base.sujeto, cambio, antes: lado(a), despues: lado(d), importancia: mayor(a?.importancia, d?.importancia), pesoEspecie: pesoDe(base, e) }];
  });
  return cambios.sort(
    (x, y) =>
      RANGO_IMPORTANCIA[x.importancia] - RANGO_IMPORTANCIA[y.importancia] ||
      y.pesoEspecie - x.pesoEspecie ||
      RANGO_CAMBIO[x.cambio] - RANGO_CAMBIO[y.cambio] ||
      CATALOGO.get(x.clave)! - CATALOGO.get(y.clave)! ||
      (JSON.stringify(x.sujeto) < JSON.stringify(y.sujeto) ? -1 : JSON.stringify(x.sujeto) > JSON.stringify(y.sujeto) ? 1 : 0),
  );
}
