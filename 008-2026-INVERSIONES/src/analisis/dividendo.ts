/**
 * Rendimiento por dividendo de 12 meses y próxima fecha ex de una especie. Puro.
 * - Dividendos por acción de `dividendosPorAccion` (src/proyecciones/dividendos.ts, la regla de la historia y del plan)
 *   con pago en (hoy − 12 meses, hoy], sumados y divididos por el último cierre del tablero.
 * - Próxima fecha ex: el decreto con la fecha ex más próxima, hoy o después (en un empate, por id). «Que cuenta» es el
 *   filtro del lector (DECRETOS_QUE_CUENTAN de src/datos-oficiales/decretos/vigentes.ts: vigente y no anulado) sobre
 *   las especies que se tienen hoy; la tenencia de ese día ex no se sabe todavía.
 */
import type { Prisma } from "@prisma/client";
import { diaIso } from "../precios/horario";
import { dividendosPorAccion } from "../proyecciones/dividendos";
import type { AccionEntrada, CodigoAviso, Dia } from "../proyecciones/tipos";
import { restarMeses } from "./dias";
import { compararTexto, redondear } from "./numeros";
import type { RendimientoDividendo } from "./tipos";

const MESES_DIVIDENDO = 12;
/** Los avisos de un pago de Trii que no entró (src/proyecciones/dividendos.ts). */
const DESCARTES: ReadonlySet<CodigoAviso> = new Set(["DIVIDENDO_SIN_TENENCIA", "DIVIDENDO_TENENCIA_CAMBIA", "DIVIDENDO_DECRETO_EN_DUDA", "DIVIDENDO_EX_DISTINTAS"]);

export function rendimientoDividendo12m(accion: AccionEntrada, hoy: Date, ultimoCierre: Prisma.Decimal): RendimientoDividendo {
  if (!ultimoCierre.gt(0)) throw new RangeError("El último cierre debe ser positivo.");
  const hasta = diaIso(hoy);
  const desde = restarMeses(hasta, MESES_DIVIDENDO);
  const dentro = (d: Dia | null): boolean => d !== null && d > desde && d <= hasta;
  const div = dividendosPorAccion(accion, hoy);
  const pagos = div.pagos.filter((p) => dentro(p.dia));
  const porAccion = pagos.reduce((s, p) => s + p.porAccion, 0);
  return {
    fraccion: redondear(porAccion / ultimoCierre.toNumber()),
    pagos: pagos.length,
    conBruto: pagos.some((p) => p.origen === "DECRETO"),
    descartados: div.avisos.filter((a) => DESCARTES.has(a.codigo) && dentro(a.dia)).length,
  };
}

export function proximaFechaEx(accion: AccionEntrada, hoy: Date): { readonly dia: Dia; readonly decretoId: string } | null {
  const proximos = accion.decretos
    .filter((d) => d.fechaEx >= hoy)
    .map((d) => ({ dia: diaIso(d.fechaEx), decretoId: d.id }))
    .sort((a, b) => compararTexto(a.dia, b.dia) || compararTexto(a.decretoId, b.decretoId));
  return proximos[0] ?? null;
}
