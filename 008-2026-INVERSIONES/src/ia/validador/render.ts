/**
 * El render: cada cita `{Hnn}` de un hecho del paquete se cambia por su presentación, la del paquete construido (la
 * cadena es-CO que calculó el código). El reemplazo es una función: un «$» de la presentación no se interpreta. Una
 * cita que no está en el paquete queda tal cual (la rechaza HECHO_DESCONOCIDO, y el cotejo no la acepta).
 */
import type { PaqueteHechos } from "../contrato";
import { hechosPorId } from "./hechos";
import { PATRON_CITA } from "./texto";

export function renderizarFrase(texto: string, paquete: PaqueteHechos): string {
  const porId = hechosPorId(paquete);
  return texto.replace(new RegExp(PATRON_CITA.source, PATRON_CITA.flags), (cita) => porId.get(cita.slice(1, -1))?.presentacion ?? cita);
}
