/**
 * ETIQUETA.SIN_CITA: una cláusula que nombra la ETIQUETA de un hecho del paquete sin citarlo. Sin este control, «… y la
 * ganancia total subió» (sin su `{Hnn}`) se atribuía por cercanía a OTRO dato de la frase y publicaba una dirección que
 * ningún hecho respaldaba. Vale para los hechos obligatorios y los que tienen dirección (los demás no afirman un
 * movimiento): la etiqueta, tal cual (palabras completas, en orden, sin tildes ni mayúsculas), debe ir con la cita de un
 * hecho de esa etiqueta en la MISMA cláusula (`clausulasDe`: la cortan «. ; ! ?» y las conjunciones). Una etiqueta
 * contenida en otra más larga que aparece en la cláusula («valor de las acciones» dentro de «variación del día del valor
 * de las acciones») no cuenta: la cubre la larga. No ve variantes de la etiqueta (plurales, otro orden): es un candado
 * contra el descuido del modelo, no una comprensión del texto.
 */
import type { PaqueteHechos } from "../contrato";
import { esNombre } from "./hechos";
import { plegarTildes } from "./patron";
import type { Token } from "./texto";

export const PATRON_SIN_CITA = "ETIQUETA.SIN_CITA";

const palabrasDe = (texto: string): readonly string[] => (texto.match(/\p{L}+/gu) ?? []).map((p) => plegarTildes(p.toLowerCase()));

interface Etiqueta {
  readonly palabras: readonly string[];
  /** Los ids de los hechos del paquete con esa etiqueta. */
  readonly ids: ReadonlySet<string>;
  /** ¿Alguno de ellos es obligatorio o tiene dirección? Solo entonces la etiqueta se exige; las demás solo cubren a las contenidas. */
  readonly exigible: boolean;
}

/** Las etiquetas de los hechos del paquete (que no son nombres), por texto de etiqueta. */
function etiquetasDelPaquete(paquete: PaqueteHechos): readonly Etiqueta[] {
  const porTexto = new Map<string, { readonly ids: Set<string>; exigible: boolean }>();
  for (const h of paquete.hechos) {
    if (esNombre(h)) continue;
    const entrada = porTexto.get(h.etiqueta) ?? { ids: new Set<string>(), exigible: false };
    entrada.ids.add(h.id);
    entrada.exigible ||= h.obligatorio || h.direccion !== "NO_APLICA";
    porTexto.set(h.etiqueta, entrada);
  }
  return [...porTexto].map(([texto, e]) => ({ palabras: palabrasDe(texto), ids: e.ids, exigible: e.exigible })).filter((e) => e.palabras.length > 0);
}

interface Aparicion {
  readonly etiqueta: Etiqueta;
  readonly desde: number;
  readonly hasta: number;
}

/** Dónde aparece cada etiqueta entre las palabras (tokens consecutivos) de una cláusula. */
function apariciones(clausula: readonly Token[], etiquetas: readonly Etiqueta[]): readonly Aparicion[] {
  const hallazgos: Aparicion[] = [];
  for (const etiqueta of etiquetas) {
    const n = etiqueta.palabras.length;
    for (let i = 0; i + n <= clausula.length; i += 1) {
      const coincide = etiqueta.palabras.every((palabra, k) => {
        const t = clausula[i + k] as Token;
        return t.tipo === "PALABRA" && plegarTildes(t.texto) === palabra;
      });
      if (coincide) hallazgos.push({ etiqueta, desde: i, hasta: i + n });
    }
  }
  return hallazgos;
}

const contenida = (a: Aparicion, otras: readonly Aparicion[]): boolean =>
  otras.some((o) => o !== a && o.desde <= a.desde && a.hasta <= o.hasta && o.hasta - o.desde > a.hasta - a.desde);

/** Los patrones de ETIQUETA_NO_COINCIDE por etiquetas nombradas sin su cita (vacío si no hay). */
export function revisarEtiquetasSinCita(clausulas: readonly (readonly Token[])[], paquete: PaqueteHechos): readonly string[] {
  const etiquetas = etiquetasDelPaquete(paquete);
  for (const clausula of clausulas) {
    const citadas = new Set(clausula.flatMap((t) => (t.tipo === "CITA" ? [t.id] : [])));
    const vistas = apariciones(clausula, etiquetas);
    const sinCita = vistas.some((a) => a.etiqueta.exigible && !contenida(a, vistas) && ![...a.etiqueta.ids].some((id) => citadas.has(id)));
    if (sinCita) return [PATRON_SIN_CITA];
  }
  return [];
}
