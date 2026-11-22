/**
 * Dividendos por acción de una especie, para sumarlos a los retornos de la historia (los cierres no están ajustados:
 * el día del pago se suma lo cobrado y el salto ex queda compensado en el mismo bloque casi siempre). Puro.
 * - Pagos de Trii: la base guarda el neto por TODA la tenencia, sin valor por acción. Por acción = neto / la tenencia que
 *   lo cobró, con la MISMA regla que los dividendos del plan (src/plan/dividendos.ts, fase C, C5c; la prueba
 *   tests/unit/proyecciones/dividendos-fecha-ex.test.ts fija que den lo mismo, pago por pago):
 *   - cada pago va al grupo de decretos (los que cuentan de la especie con la misma fecha de pago) cuya ventana lo
 *     contiene, con la asignación del cruce (src/datos-oficiales/decretos/ventana.ts, C5b), hecha por pago;
 *   - CON grupo manda la fecha ex: lo cobró la tenencia del cierre del día anterior a la ex (tenenciaAntesDeLaEx de
 *     src/plan/tenencia.ts). No entra (y se avisa) si cabe en la ventana de dos grupos o llegó antes de alguna ex de su
 *     grupo (DIVIDENDO_DECRETO_EN_DUDA), si el grupo junta ex distintas y la tenencia cambió entre ellas
 *     (DIVIDENDO_EX_DISTINTAS) o si antes de la ex no había tenencia (DIVIDENDO_SIN_TENENCIA);
 *   - SIN grupo, la aproximación de siempre: la tenencia del día del pago, que debe ser positiva
 *     (DIVIDENDO_SIN_TENENCIA, que va primero, como antes; en el plan la tenencia positiva es un motivo del tramo) y
 *     quedar quieta en los VENTANA_EX_DIAS anteriores (DIVIDENDO_TENENCIA_CAMBIA).
 *   Lo del plan que depende del tramo (la base de la decisión) no aplica: el motor mide la especie, no un tramo.
 * - Decretos: un grupo con un pago que ENTRÓ a la historia no se suma: ese pago ya es el dividendo y sumarlo lo contaría
 *   dos veces. Es por pago, como el plan: si otra fila del mismo grupo no entró, se pierde con su aviso. Un grupo sin
 *   pago que entró (no tiene, o sus pagos no entraron) entra con el valor por acción de sus decretos (BRUTO, con aviso):
 *   así no se pierden (historia.ts solo avisa el bruto de los que caen en la ventana). Los de pago futuro solo se
 *   cuentan: la tasa histórica ya los representa. `recibido` y el enlace (`decretadoId`) son de las columnas viejas,
 *   siempre vacías.
 */
import { agruparPorFechaDePago, asignarPagos, claveDePago, type GrupoDePago } from "../datos-oficiales/decretos/ventana";
import { sumarDias } from "../plan/fechas";
import { constanteEn, tenenciaAntesDeLaEx, tenenciaEn, type MovimientoTenencia } from "../plan/tenencia";
import { diaIso } from "../precios/horario";
import { VENTANA_EX_DIAS } from "./metodo";
import type { AccionEntrada, AvisoCrudo, CodigoAviso, DecretoLeido, Dia, DividendoLeido } from "./tipos";

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

type Grupo = GrupoDePago<DecretoLeido & { readonly instrumentoId: string }>;
/** Quién cobró un pago de Trii: la tenencia (y el grupo que cruza, si fue por decreto), o por qué no se sabe. */
type Cobro = { readonly tenencia: bigint; readonly grupo: string | null } | { readonly aviso: CodigoAviso };

const aviso = (a: AccionEntrada, codigo: CodigoAviso, fecha: Date): AvisoCrudo =>
  ({ codigo, instrumentoId: a.instrumentoId, nombre: a.nombre, dia: diaIso(fecha), dato: null });

/** Sin decreto: la tenencia del día del pago, quieta en los VENTANA_EX_DIAS anteriores. */
function cobroSinDecreto(fechaPago: Date, movimientos: readonly MovimientoTenencia[]): Cobro {
  const tenencia = tenenciaEn(movimientos, fechaPago);
  if (tenencia <= 0n) return { aviso: "DIVIDENDO_SIN_TENENCIA" };
  if (!constanteEn(movimientos, sumarDias(fechaPago, -VENTANA_EX_DIAS), fechaPago)) return { aviso: "DIVIDENDO_TENENCIA_CAMBIA" };
  return { tenencia, grupo: null };
}

/** Con su grupo (ya sin disputa): la tenencia del día anterior a la primera ex, si es la misma hasta la última. */
function cobroConDecreto(fechaPago: Date, grupo: Grupo, movimientos: readonly MovimientoTenencia[]): Cobro {
  const exs = grupo.decretos.map((d) => d.fechaEx.getTime());
  const exMin = new Date(Math.min(...exs));
  const exMax = new Date(Math.max(...exs));
  if (fechaPago < exMax) return { aviso: "DIVIDENDO_DECRETO_EN_DUDA" };
  if (!constanteEn(movimientos, sumarDias(exMin, -1), sumarDias(exMax, -1))) return { aviso: "DIVIDENDO_EX_DISTINTAS" };
  const tenencia = tenenciaAntesDeLaEx(movimientos, exMin);
  return tenencia > 0n ? { tenencia, grupo: grupo.clave } : { aviso: "DIVIDENDO_SIN_TENENCIA" };
}

/** La asignación es por pago: el veredicto de uno no depende de qué otros pagos tiene la especie. */
function cobroDe(a: AccionEntrada, d: DividendoLeido, grupos: readonly Grupo[]): Cobro {
  const { porGrupo, enDisputa } = asignarPagos(grupos, [{ instrumentoId: a.instrumentoId, fechaPago: d.fechaPago }]);
  if (enDisputa.size > 0) return { aviso: "DIVIDENDO_DECRETO_EN_DUDA" };
  const grupo = grupos.find((g) => porGrupo.has(g.clave));
  return grupo ? cobroConDecreto(d.fechaPago, grupo, a.movimientos) : cobroSinDecreto(d.fechaPago, a.movimientos);
}

export function dividendosPorAccion(a: AccionEntrada, hoy: Date): DividendosEspecie {
  const grupos = agruparPorFechaDePago(a.decretos.map((dc) => ({ ...dc, instrumentoId: a.instrumentoId })));
  const pagos: PagoPorAccion[] = [];
  const avisos: AvisoCrudo[] = [];
  const cruzados = new Set<string>();
  for (const d of a.dividendos) {
    const cobro = cobroDe(a, d, grupos);
    if ("aviso" in cobro) {
      avisos.push(aviso(a, cobro.aviso, d.fechaPago));
      continue;
    }
    pagos.push({ dia: diaIso(d.fechaPago), porAccion: d.montoNeto / Number(cobro.tenencia), origen: "PAGO" });
    if (cobro.grupo !== null) cruzados.add(cobro.grupo);
  }
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
