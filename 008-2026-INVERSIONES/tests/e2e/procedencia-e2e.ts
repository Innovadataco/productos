/**
 * Lo esperado de la procedencia de cada dato en el E2E (frente fecha-hora-datos), leído de la base e2e: cuándo trajo 008
 * el cierre (o el valor de la serie) y de qué fuente. La hora de Colombia se calcula aquí con Intl en America/Bogota,
 * NO con el código de la app: así el E2E comprueba la zona horaria de punta a punta. Solo lectura de la base e2e.
 */
import { fecha } from "../../src/app/tablero/formato";
import { baseE2E } from "./cuentas";

const BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** El instante en hora de Colombia, según Intl: el día «AAAA-MM-DD» y la hora «HH:MM». */
export function enBogota(d: Date): { readonly dia: string; readonly hhmm: string } {
  const p = Object.fromEntries(BOGOTA.formatToParts(d).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}` };
}

export interface Origen { readonly traido: { readonly dia: string; readonly hhmm: string }; readonly fuente: string }

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** El cierre vigente de una especie en un día, el que elige el tablero (el traído más recientemente). */
export async function origenDelCierre(nemotecnico: string, iso: string): Promise<Origen> {
  const c = await baseE2E().precioCierre.findFirstOrThrow({
    where: { instrumento: { nemotecnico }, fecha: dia(iso), reemplazadoEn: null },
    orderBy: [{ traidoEn: "desc" }, { id: "desc" }],
    select: { traidoEn: true, fuente: true },
  });
  return { traido: enBogota(c.traidoEn), fuente: c.fuente };
}

/** El último valor vigente de una serie oficial (el que muestra su tarjeta). */
export async function origenDeLaSerie(serie: string): Promise<Origen> {
  const v = await baseE2E().valorSerieOficial.findFirstOrThrow({
    where: { serie, reemplazadoEn: null },
    orderBy: [{ desde: "desc" }],
    select: { traidoEn: true, fuente: true },
  });
  return { traido: enBogota(v.traidoEn), fuente: v.fuente };
}

/**
 * «<fuente> · traído 18:04» si se trajo el mismo día del dato; si no, «<fuente> · traído 26-nov 09:10» (con el año si
 * cambia respecto del día del dato). Como lo pinta la app para una fuente que no tiene nombre propio (y, como todo
 * cierre, sin retraso: el retraso solo va en un precio de la rueda).
 */
export function traido(o: Origen, diaDelDato: string): string {
  const mismoDia = o.traido.dia === diaDelDato;
  const conAnio = o.traido.dia.slice(0, 4) !== diaDelDato.slice(0, 4);
  const cuando = mismoDia ? o.traido.hhmm : `${conAnio ? fecha(o.traido.dia) : fecha(o.traido.dia).replace(/-\d{4}$/, "")} ${o.traido.hhmm}`;
  return `${o.fuente} · traído ${cuando}`;
}

/** El día del dato como lo dice la línea: «22-nov», o «22-nov-2024» si se trajo en otro año. */
export function diaDeLaLinea(diaDelDato: string, o: Origen): string {
  return o.traido.dia.slice(0, 4) === diaDelDato.slice(0, 4) ? fecha(diaDelDato).replace(/-\d{4}$/, "") : fecha(diaDelDato);
}

/** El detalle accesible de una fuente que la tabla no conoce: sin retraso inventado, con la hora de Colombia. */
export const detalleDeFuenteDesconocida = (o: Origen): string =>
  `Fuente: ${o.fuente}. Retraso conocido: sin dato de esta fuente. Traído el ${fecha(o.traido.dia)} a las ${o.traido.hhmm} (hora de Colombia).`;
