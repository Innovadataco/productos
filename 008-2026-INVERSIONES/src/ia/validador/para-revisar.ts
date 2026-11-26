/**
 * PARA_REVISAR (solo SIMULACION): los ítems de «Para revisar» (el encabezado y la numeración los pone el código). Son
 * nominales, apuntan a un punto del paquete, van de mayor a menor importancia y no se repiten:
 * - SIN_PUNTO: el ítem no cita ningún hecho que no sea un nombre;
 * - VERBO: el ítem tiene un verbo (una forma conjugada de `VERBOS_NEUTROS`);
 * - ORDEN: un ítem de menor importancia antes que uno de mayor (ALTA, MEDIA, BAJA);
 * - REPETIDO: el mismo punto en dos ítems;
 * - FALTA: un punto de importancia ALTA que no se cita ni en las frases ni en los ítems;
 * - LONGITUD: más ítems que `LIMITES_SIMULACION.maxRevisar`.
 */
import type { Hecho, IdHecho, Importancia, PaqueteHechos } from "../contrato";
import { LIMITES_SIMULACION } from "./codigos";
import { esNombre, type HechosPorId } from "./hechos";
import { plegarTildes } from "./patron";
import { VERBOS_NEUTROS } from "./vocabulario";

const RANGO_DE_IMPORTANCIA: Readonly<Record<Importancia, number>> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const VERBOS: ReadonlySet<string> = new Set(VERBOS_NEUTROS);

export interface ItemAnalizado {
  readonly texto: string;
  readonly citados: readonly IdHecho[];
}

const palabrasDe = (texto: string): readonly string[] => (plegarTildes(texto.toLowerCase()).replace(/\{h[0-9]{2}\}/gu, " ").match(/\p{L}+/gu) ?? []);

/** La menor posición (la más importante) de los hechos que cita; sin importancia cuenta como BAJA. */
function posicionDeImportancia(item: ItemAnalizado, porId: HechosPorId): number {
  return Math.min(...item.citados.map((id) => RANGO_DE_IMPORTANCIA[(porId.get(id) as Hecho).importancia ?? "BAJA"]), RANGO_DE_IMPORTANCIA.BAJA);
}

export function revisarParaRevisar(items: readonly ItemAnalizado[], paquete: PaqueteHechos, porId: HechosPorId, citadosEnTodo: ReadonlySet<string>): readonly string[] {
  const patrones = new Set<string>();
  if (items.length > LIMITES_SIMULACION.maxRevisar) patrones.add("PARA_REVISAR.LONGITUD");
  const vistos = new Set<string>();
  const textos = new Set<string>();
  let anterior = -1;
  for (const item of items) {
    const puntos = item.citados.filter((id) => !esNombre(porId.get(id)));
    if (puntos.length === 0) patrones.add("PARA_REVISAR.SIN_PUNTO");
    if (palabrasDe(item.texto).some((p) => VERBOS.has(p))) patrones.add("PARA_REVISAR.VERBO");
    if (puntos.some((id) => vistos.has(id)) || textos.has(item.texto)) patrones.add("PARA_REVISAR.REPETIDO");
    for (const id of puntos) vistos.add(id);
    textos.add(item.texto);
    const posicion = posicionDeImportancia({ ...item, citados: puntos }, porId);
    if (puntos.length > 0 && posicion < anterior) patrones.add("PARA_REVISAR.ORDEN");
    if (puntos.length > 0) anterior = Math.max(anterior, posicion);
  }
  if (paquete.hechos.some((h) => h.importancia === "ALTA" && !citadosEnTodo.has(h.id))) patrones.add("PARA_REVISAR.FALTA");
  return Object.freeze([...patrones]);
}
