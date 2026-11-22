/**
 * De la lectura de los decretos (C5b: Decimal, bigint y Date; src/datos-oficiales/decretos/leer.ts) a la vista de la
 * sección de /datos-oficiales (texto) (frente datos-oficiales-decretos-pantalla, C6b). Cálculo puro: solo importa tipos.
 * - Los montos, exactos desde el Decimal (`toFixed()` sin argumento: sin notación exponencial ni redondeo); las
 *   tenencias, del bigint; las fechas, el día UTC de la columna DATE (serializar.ts).
 * - La especie sale del instrumento (el nemotécnico o, si no tiene, el nombre, como en la conciliación); la referencia
 *   y la versión de cada decreto del cruce, de su fila. Las dos se leen en la misma foto que el cruce (datos.ts): si
 *   falta una es un defecto y se lanza; no se inventa un «—».
 * - El cruce, lo más reciente primero (C5b lo da por fecha de pago ascendente); los próximos, en el orden de C5b; los
 *   grupos que no esperaban pago, contados por decreto.
 */
import type { Prisma } from "@prisma/client";
import type { DecretoCruzado, FilaCruce } from "@/datos-oficiales/decretos/cruce";
import type { LecturaDecretos } from "@/datos-oficiales/decretos/leer";
import type { Proximo } from "@/datos-oficiales/decretos/proximos";
import { dia } from "./serializar";
import type { DecretoDelCruceVista, DecretosVista, FilaCruceVista, ProximoVista } from "./tipos";

export interface EspecieLeida {
  readonly nemotecnico: string | null;
  readonly nombre: string;
}

export interface ReferenciaLeida {
  readonly referenciaOficial: string;
  readonly version: number;
}

/** Lo que leyó datos.ts de los decretos, en la misma transacción que las series. */
export interface LecturaDecretosPantalla {
  /** Desde qué fecha de pago se muestra el cruce. */
  readonly desde: Date;
  readonly lectura: LecturaDecretos;
  /** Por id de instrumento: las especies del cruce y de los próximos. */
  readonly especies: ReadonlyMap<string, EspecieLeida>;
  /** Por id de decreto: los del cruce. */
  readonly referencias: ReadonlyMap<string, ReferenciaLeida>;
}

const decimal = (d: Prisma.Decimal): string => d.toFixed();
const decimalONulo = (d: Prisma.Decimal | null): string | null => (d === null ? null : decimal(d));

function especieDe(especies: LecturaDecretosPantalla["especies"], instrumentoId: string): string {
  const e = especies.get(instrumentoId);
  if (e === undefined) throw new Error("Falta la especie de una fila de los decretos en la lectura.");
  return e.nemotecnico ?? e.nombre;
}

function referenciaDe(referencias: LecturaDecretosPantalla["referencias"], decretoId: string): ReferenciaLeida {
  const r = referencias.get(decretoId);
  if (r === undefined) throw new Error("Falta la referencia de un decreto del cruce en la lectura.");
  return r;
}

const proximo = (l: LecturaDecretosPantalla) => (p: Proximo): ProximoVista => ({
  clave: p.id, especie: p.nemotecnico ?? especieDe(l.especies, p.instrumentoId), tipo: p.tipo, cuota: p.cuota, valorPorAccion: decimal(p.valorPorAccion),
  fechaEx: dia(p.fechaEx), fechaPago: dia(p.fechaPago), referencia: p.referenciaOficial, version: p.version, tenencia: p.tenencia.toString(),
  brutoEstimado: decimalONulo(p.brutoEstimado),
});

const decretoDelCruce = (l: LecturaDecretosPantalla) => (d: DecretoCruzado): DecretoDelCruceVista => {
  const r = referenciaDe(l.referencias, d.decretoId);
  return {
    clave: d.decretoId, tipo: d.tipo, cuota: d.cuota, fechaEx: dia(d.fechaEx), valorPorAccion: decimal(d.valorPorAccion),
    tenenciaAntesDeLaEx: d.tenenciaAntesDeLaEx.toString(), bruto: decimal(d.bruto), referencia: r.referenciaOficial, version: r.version,
  };
};

/** Cada decreto y cada pago están en una sola fila (C5b): el primero la identifica. Sin ninguno es un defecto: lanza. */
function claveDeFila(f: FilaCruce): string {
  const clave = f.decretos[0]?.decretoId ?? f.pagos[0]?.id;
  if (clave === undefined) throw new Error("Una fila del cruce sin decreto ni pago en la lectura.");
  return clave;
}

const filaDelCruce = (l: LecturaDecretosPantalla) => (f: FilaCruce): FilaCruceVista => ({
  clave: claveDeFila(f),
  estado: f.estado, especie: especieDe(l.especies, f.instrumentoId), fechaPago: dia(f.fechaPago),
  decretos: f.decretos.map(decretoDelCruce(l)),
  pagos: f.pagos.map((p) => ({ clave: p.id, fechaPago: dia(p.fechaPago), montoNeto: decimal(p.montoNeto) })),
  brutoEsperado: decimalONulo(f.brutoEsperado), netoRecibido: decimalONulo(f.netoRecibido), diferenciaBrutoNeto: decimalONulo(f.diferenciaBrutoNeto),
  motivos: [...f.motivos],
});

export function aDecretosVista(l: LecturaDecretosPantalla): DecretosVista {
  const { cruce, proximos } = l.lectura;
  return {
    desde: dia(l.desde),
    proximos: proximos.map(proximo(l)),
    cruce: [...cruce.filas].reverse().map(filaDelCruce(l)),
    sinTenencia: cruce.sinTenencia.reduce((n, s) => n + s.decretoIds.length, 0),
  };
}
