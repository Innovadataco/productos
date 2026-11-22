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

/** «22-nov-2026 a las 18:04», el instante en hora de Colombia, según Intl. */
export function enBogota(d: Date): string {
  const p = Object.fromEntries(BOGOTA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${fecha(`${p.year}-${p.month}-${p.day}`)} a las ${p.hour}:${p.minute}`;
}

export interface Origen { readonly traido: string; readonly fuente: string }

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

/** «traído el … (hora de Colombia) · <fuente>», como lo pinta la app para una fuente que no tiene nombre propio. */
export const traido = (o: Origen): string => `traído el ${o.traido} (hora de Colombia) · ${o.fuente}`;
