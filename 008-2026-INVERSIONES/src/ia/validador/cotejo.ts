/**
 * RENDER_CIFRA, el cotejo del texto final (condición 2 de PI). No confía en el render: recibe el texto final y las citas
 * del texto del modelo, en orden, y busca, desde un cursor, la presentación DEL PAQUETE CONSTRUIDO de cada cita (la que
 * calculó el código desde el valor fuente; nunca lo que repitió el modelo). Rechaza si:
 * - una cita no es de un hecho del paquete, o su presentación no aparece desde el cursor;
 * - el tramo saltado antes de una presentación, o lo que sobra al final, lleva un dígito (de cualquier sistema), un
 *   símbolo de cifra («$», «%», «‰»…) o un signo («+», «-», «−», «±»): la cifra no salió del paquete o cambió de signo;
 * - dos presentaciones quedan pegadas (nada, «,» o «.» entre ellas): «7» y «7» se leerían «77» o «7,7».
 * Así, todo dígito del texto final cae dentro de una presentación del paquete, en el lugar de su cita.
 */
import type { PaqueteHechos } from "../contrato";
import { esPaqueteConstruido } from "../paquete";
import { hechosPorId } from "./hechos";

const CARACTER_DE_CIFRA = /[\p{N}\p{Sc}%‰‱+\-−±]/u;
const SEPARACIONES_PEGADAS: ReadonlySet<string> = new Set(["", ",", "."]);

export function cotejarCifras(textoFinal: string, citas: readonly string[], paquete: PaqueteHechos): boolean {
  if (!esPaqueteConstruido(paquete)) return false;
  const porId = hechosPorId(paquete);
  let cursor = 0;
  for (let i = 0; i < citas.length; i += 1) {
    const presentacion = porId.get(citas[i] as string)?.presentacion;
    if (presentacion === undefined) return false;
    const donde = textoFinal.indexOf(presentacion, cursor);
    if (donde < 0) return false;
    const saltado = textoFinal.slice(cursor, donde);
    if (CARACTER_DE_CIFRA.test(saltado) || (i > 0 && SEPARACIONES_PEGADAS.has(saltado))) return false;
    cursor = donde + presentacion.length;
  }
  return !CARACTER_DE_CIFRA.test(textoFinal.slice(cursor));
}
