/**
 * La procedencia de los cierres de /analisis (frente fuente-retraso): cada cierre con su día, la hora de Colombia en que
 * lo trajo 008, su fuente y los días hábiles de atraso, con el mismo patrón de tablero/serializar.ts (`atraso`: el reloj y
 * el calendario de la BVC). Puro. Sin calendario que cubra el tramo, el aviso es aproximado, no se apaga.
 */
import { atrasoParaAviso, camposDeAtraso } from "@/precios/atraso";
import { diaIso } from "@/precios/horario";
import type { Tablero } from "@/tablero/calculo";
import { horaColombia } from "../_comun/fecha-dato/hora";
import type { Procedencia } from "../_comun/fecha-dato/tipos";
import type { ContextoAtraso } from "../tablero/serializar";

export function procedenciasDeCierres(tablero: Tablero, atraso: ContextoAtraso): readonly Procedencia[] {
  return tablero.filas.flatMap((f) =>
    f.cierre === null
      ? []
      : [{
          dia: diaIso(f.cierre.fecha), traidoEn: f.cierre.traidoEn ? horaColombia(f.cierre.traidoEn) : null, fuente: f.cierre.fuente ?? null,
          ...camposDeAtraso(atrasoParaAviso(f.cierre.fecha, atraso.ahora, atraso.calendario)),
        }],
  );
}
