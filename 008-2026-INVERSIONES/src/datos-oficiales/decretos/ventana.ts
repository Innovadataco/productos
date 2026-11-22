/**
 * Ventana del cruce de un decreto con los pagos de Trii, y a qué decreto va cada pago (fase C, C5b). Pura: solo fechas.
 * - Un pago de Trii cabe en la ventana de un decreto de su especie si llega entre VENTANA_PAGO_ANTES_DIAS antes y
 *   VENTANA_PAGO_DESPUES_DIAS después de la fecha de pago del decreto: días calendario, con los dos bordes incluidos. Es
 *   una APROXIMACIÓN: cuándo acredita Trii frente a la fecha de pago del emisor está por verificar (P12); los días de
 *   antes son tolerancia para una fecha mal registrada. Un pago que llega después de la ventana no cruza: queda
 *   SIN_DECRETO y su decreto NO_RECIBIDO, a la vista (cruce.ts).
 * - Los decretos de una especie con la misma fecha de pago son un grupo (Trii no distingue el tipo y puede pagarlos en
 *   una sola fila). Cada pago va a un solo grupo: el ÚLTIMO cuya fecha de pago ya llegó (Trii no paga antes que el
 *   emisor; también por verificar, P12) y, si ninguno llegó, el más cercano por venir. Si la ventana del pago la
 *   comparten dos grupos, la asignación es una suposición: los dos quedan en disputa (el cruce los marca REVISAR).
 * La usan el cruce (cruce.ts) y el motor de proyecciones (src/proyecciones/dividendos.ts): los dos cruzan igual
 * (candado tests/unit/proyecciones/servidor.test.ts: el motor solo importa módulos puros).
 */
import { sumarDias } from "../../plan/fechas";
import { diaIso } from "../../precios/horario";

export const VENTANA_PAGO_ANTES_DIAS = 3;
export const VENTANA_PAGO_DESPUES_DIAS = 10;

export const inicioVentana = (fechaPago: Date): Date => sumarDias(fechaPago, -VENTANA_PAGO_ANTES_DIAS);
export const finVentana = (fechaPago: Date): Date => sumarDias(fechaPago, VENTANA_PAGO_DESPUES_DIAS);

/** ¿El pago de Trii del día `fechaPagoTrii` cae en la ventana del decreto con pago `fechaPagoDecreto`? */
export function enVentanaDePago(fechaPagoDecreto: Date, fechaPagoTrii: Date): boolean {
  const t = fechaPagoTrii.getTime();
  return t >= inicioVentana(fechaPagoDecreto).getTime() && t <= finVentana(fechaPagoDecreto).getTime();
}

/** Lo que el agrupamiento y la asignación necesitan de un decreto o de un pago. */
export interface ConFechaDePago {
  readonly instrumentoId: string;
  readonly fechaPago: Date;
}

export interface GrupoDePago<D extends ConFechaDePago> {
  /** `instrumentoId|AAAA-MM-DD` de la fecha de pago. */
  readonly clave: string;
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  readonly decretos: readonly D[];
}

export interface AsignacionDePagos<P> {
  /** Solo los grupos con algún pago. */
  readonly porGrupo: ReadonlyMap<string, readonly P[]>;
  /** Grupos cuya ventana contiene un pago que también cabía en la de otro. */
  readonly enDisputa: ReadonlySet<string>;
  readonly sinGrupo: readonly P[];
}

export const claveDePago = (instrumentoId: string, fechaPago: Date): string => `${instrumentoId}|${diaIso(fechaPago)}`;
const porFecha = (a: ConFechaDePago, b: ConFechaDePago): number => a.fechaPago.getTime() - b.fechaPago.getTime();
const porEspecieYFecha = (a: ConFechaDePago, b: ConFechaDePago): number =>
  (a.instrumentoId < b.instrumentoId ? -1 : a.instrumentoId > b.instrumentoId ? 1 : 0) || porFecha(a, b);

/** Los grupos por especie y fecha de pago, en ese orden; dentro, los decretos en el orden dado. */
export function agruparPorFechaDePago<D extends ConFechaDePago>(decretos: readonly D[], orden: (a: D, b: D) => number = () => 0): GrupoDePago<D>[] {
  const porClave = new Map<string, D[]>();
  for (const d of decretos) {
    const clave = claveDePago(d.instrumentoId, d.fechaPago);
    porClave.set(clave, [...(porClave.get(clave) ?? []), d]);
  }
  return [...porClave]
    .map(([clave, ds]): GrupoDePago<D> => ({ clave, instrumentoId: ds[0]!.instrumentoId, fechaPago: ds[0]!.fechaPago, decretos: [...ds].sort(orden) }))
    .sort(porEspecieYFecha);
}

/** El último grupo cuya fecha de pago ya llegó; si ninguno, el más cercano por venir. */
function elegir<G extends ConFechaDePago>(candidatos: readonly G[], fechaPagoTrii: Date): G {
  const enOrden = [...candidatos].sort(porFecha);
  const llegados = enOrden.filter((g) => g.fechaPago.getTime() <= fechaPagoTrii.getTime());
  return llegados.length > 0 ? llegados[llegados.length - 1]! : enOrden[0]!;
}

/** Cada pago al grupo de su especie que le toca (ver arriba), o sin grupo si ninguna ventana lo contiene. */
export function asignarPagos<P extends ConFechaDePago>(grupos: readonly GrupoDePago<ConFechaDePago>[], pagos: readonly P[]): AsignacionDePagos<P> {
  const porGrupo = new Map<string, P[]>();
  const enDisputa = new Set<string>();
  const sinGrupo: P[] = [];
  for (const p of pagos) {
    const candidatos = grupos.filter((g) => g.instrumentoId === p.instrumentoId && enVentanaDePago(g.fechaPago, p.fechaPago));
    if (candidatos.length === 0) {
      sinGrupo.push(p);
      continue;
    }
    if (candidatos.length > 1) for (const g of candidatos) enDisputa.add(g.clave);
    const { clave } = elegir(candidatos, p.fechaPago);
    porGrupo.set(clave, [...(porGrupo.get(clave) ?? []), p]);
  }
  return { porGrupo, enDisputa, sinGrupo };
}
