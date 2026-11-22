/**
 * Generadores de respuestas de la SFC (datos.gov.co, dataset 32sa-8pi3) para las pruebas de la TRM (C2b). Todo es
 * inventado: las fechas son de marzo de 2027 y los valores no salen de ninguna descarga. Solo la FORMA es la pública
 * (verificada el 2026-11-22 con un GET al recurso): un arreglo de objetos con exactamente `valor` (texto decimal),
 * `unidad` ("COP"), `vigenciadesde` y `vigenciahasta` (timestamp flotante `AAAA-MM-DDT00:00:00.000`), servido como
 * `application/json;charset=utf-8`. Nada de esto se versiona como .json suelto: se arma en código.
 *
 * Calendario de 2027 que usan: el 2027-03-12 es viernes; su TRM (la publicada el jueves) vale solo ese día y la publicada
 * el viernes cubre sábado, domingo y lunes (13 al 15).
 */
import type { BuscarHttp, InitHttp } from "@/lib/http-acotado";

export const TIPO_JSON = { "content-type": "application/json;charset=utf-8" } as const;

export type FilaTrmFicticia = Record<string, unknown>;

/** Una fila con la forma de la fuente: fechas `AAAA-MM-DD` → timestamps flotantes. */
export const fila = (desde: string, hasta: string, valor: unknown = "4127.39", unidad: unknown = "COP"): FilaTrmFicticia => ({
  valor, unidad, vigenciadesde: `${desde}T00:00:00.000`, vigenciahasta: `${hasta}T00:00:00.000`,
});

/** Miércoles a martes de una semana inventada de 2027 (la vigencia del sábado cubre hasta el lunes). */
export const SEMANA_FICTICIA: readonly FilaTrmFicticia[] = [
  fila("2027-03-10", "2027-03-10", "4127.39"),
  fila("2027-03-11", "2027-03-11", "4131.80"),
  fila("2027-03-12", "2027-03-12", "4119.07"),
  fila("2027-03-13", "2027-03-15", "4108.53"),
  fila("2027-03-16", "2027-03-16", "4122.6"),
];

/** Los valores de SEMANA_FICTICIA como los entrega el lector (decimal canónico). */
export const VALORES_SEMANA = ["4127.39", "4131.8", "4119.07", "4108.53", "4122.6"] as const;

/** Fecha de negocio (medianoche UTC). */
export const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export interface Pedido {
  readonly url: string;
  readonly init: InitHttp;
}

/** Un `buscar` que responde siempre el mismo cuerpo (JSON si no es texto) y anota cada pedido. */
export function buscarQueResponde(cuerpo: unknown, init: ResponseInit = { headers: TIPO_JSON }): { buscar: BuscarHttp; pedidos: Pedido[] } {
  const pedidos: Pedido[] = [];
  const texto = typeof cuerpo === "string" ? cuerpo : cuerpo instanceof Uint8Array ? new Uint8Array(cuerpo) : JSON.stringify(cuerpo);
  const buscar: BuscarHttp = async (url, i) => {
    pedidos.push({ url, init: i });
    return new Response(texto, init);
  };
  return { buscar, pedidos };
}

/** Un `buscar` que nunca debe llamarse: si se llama, la prueba lo ve en `llamado()`. */
export function buscarProhibido(): { buscar: BuscarHttp; llamado: () => boolean } {
  let llamado = false;
  return {
    buscar: async () => {
      llamado = true;
      throw new Error("no debía salir a la red");
    },
    llamado: () => llamado,
  };
}
