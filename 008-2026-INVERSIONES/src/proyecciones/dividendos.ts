/**
 * Dividendos por acción de una especie, para sumarlos a los retornos de la historia (los cierres no están ajustados:
 * el día del pago se suma lo cobrado y el salto ex queda compensado en el mismo bloque casi siempre). Puro.
 * - Pagos de Trii: la base guarda el neto por TODA la tenencia, sin fecha ex ni valor por acción. Por acción =
 *   neto / tenencia del día del pago (la misma regla de src/plan/dividendos.ts). Se omite (y se avisa) si ese día
 *   no había tenencia o si la tenencia cambió en los VENTANA_EX_DIAS anteriores: no se sabe qué acciones cobraron.
 * - Decretos: cada pago de Trii va al grupo de decretos (misma fecha de pago) que le asigna la ventana del cruce
 *   (src/datos-oficiales/decretos/ventana.ts: la misma asignación de la pantalla, C5b). Un grupo con un pago asignado que
 *   ENTRÓ a la historia no se suma: ese pago ya es el dividendo y sumarlo lo contaría dos veces. Si sus pagos se
 *   omitieron (sin tenencia o con la tenencia cambiando) o no tiene, sus decretos entran con su valor por acción
 *   (BRUTO, con aviso): así no se pierden. Si dos ventanas se tocan, la asignación es una suposición (la pantalla lo
 *   marca PAGO_EN_DISPUTA). Los de pago futuro solo se cuentan: la tasa histórica ya los representa. `recibido` y el
 *   enlace (`decretadoId`) son de las columnas viejas, siempre vacías.
 */
import { agruparPorFechaDePago, asignarPagos, claveDePago } from "../datos-oficiales/decretos/ventana";
import { sumarDias } from "../plan/fechas";
import { constanteEn, tenenciaEn } from "../plan/tenencia";
import { diaIso } from "../precios/horario";
import { VENTANA_EX_DIAS } from "./metodo";
import type { AccionEntrada, AvisoCrudo, Dia } from "./tipos";

export interface PagoPorAccion {
  readonly dia: Dia;
  readonly porAccion: number;
  readonly origen: "PAGO" | "DECRETO";
}

export interface DividendosEspecie {
  /** Ordenados por día. */
  readonly pagos: readonly PagoPorAccion[];
  readonly avisos: readonly AvisoCrudo[];
  readonly decretosFuturos: number;
}

const aviso = (a: AccionEntrada, codigo: AvisoCrudo["codigo"], fecha: Date): AvisoCrudo =>
  ({ codigo, instrumentoId: a.instrumentoId, nombre: a.nombre, dia: diaIso(fecha), dato: null });

/** Las claves de los grupos de decretos con algún pago asignado que entró a la historia (índices de `a.dividendos`). */
function gruposCruzados(a: AccionEntrada, entraron: ReadonlySet<number>): Set<string> {
  const grupos = agruparPorFechaDePago(a.decretos.map((dc) => ({ instrumentoId: a.instrumentoId, fechaPago: dc.fechaPago })));
  const { porGrupo } = asignarPagos(grupos, a.dividendos.map((d, i) => ({ instrumentoId: a.instrumentoId, fechaPago: d.fechaPago, i })));
  return new Set([...porGrupo].filter(([, asignados]) => asignados.some((p) => entraron.has(p.i))).map(([clave]) => clave));
}

export function dividendosPorAccion(a: AccionEntrada, hoy: Date): DividendosEspecie {
  const pagos: PagoPorAccion[] = [];
  const avisos: AvisoCrudo[] = [];
  const entraron = new Set<number>();
  a.dividendos.forEach((d, i) => {
    const tenencia = tenenciaEn(a.movimientos, d.fechaPago);
    if (tenencia <= 0n) avisos.push(aviso(a, "DIVIDENDO_SIN_TENENCIA", d.fechaPago));
    else if (!constanteEn(a.movimientos, sumarDias(d.fechaPago, -VENTANA_EX_DIAS), d.fechaPago)) avisos.push(aviso(a, "DIVIDENDO_TENENCIA_CAMBIA", d.fechaPago));
    else {
      pagos.push({ dia: diaIso(d.fechaPago), porAccion: d.montoNeto / Number(tenencia), origen: "PAGO" });
      entraron.add(i);
    }
  });
  const cruzados = gruposCruzados(a, entraron);
  const enlazados = new Set(a.dividendos.flatMap((d) => (d.decretadoId ? [d.decretadoId] : [])));
  let decretosFuturos = 0;
  for (const dc of a.decretos) {
    if (dc.recibido || enlazados.has(dc.id) || cruzados.has(claveDePago(a.instrumentoId, dc.fechaPago))) continue;
    if (dc.fechaPago > hoy) {
      decretosFuturos += 1;
      continue;
    }
    pagos.push({ dia: diaIso(dc.fechaPago), porAccion: dc.valorPorAccion, origen: "DECRETO" });
    avisos.push(aviso(a, "DECRETO_BRUTO", dc.fechaPago));
  }
  return { pagos: pagos.sort((x, y) => (x.dia < y.dia ? -1 : x.dia > y.dia ? 1 : 0)), avisos, decretosFuturos };
}
