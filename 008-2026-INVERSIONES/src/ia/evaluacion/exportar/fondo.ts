/**
 * El fondo del paquete DIARIO en el export (E7), puro, desde lo que ya leyó y calculó la proyección (los lectores de la
 * pantalla de proyecciones, `leerEntradas` y `calcularProyeccion`): nada se calcula aquí a mano.
 * - el valor de hoy: el que valoró la proyección para el fondo (unidades × valor de unidad); null si no lo valoró;
 * - el último valor de unidad hasta hoy, el anterior y su fecha (la SFC publica con T−2);
 * - atrasado: el último valor es anterior a hoy − DIAS_ATRASO_AVISO (la misma regla de src/fondo/guardar.ts).
 * El armador lleva UN fondo: con varios fondos vivos no se elige a ciegas (sin fondo, FONDOS_VARIOS).
 */
import { Prisma } from "@prisma/client";
import { DIAS_ATRASO_AVISO } from "../../../fondo/guardar";
import { MS_POR_DIA } from "../../../plan/fechas";
import type { EntradasProyeccion, FondoEntrada, ResultadoProyeccion } from "../../../proyecciones/tipos";
import type { FondoParaHechos } from "../../hechos";

const DECIMALES_PESOS = 2;

export type AvisoFondo = "FONDOS_VARIOS" | "FONDO_SIN_VALOR";

export interface FondoExportado {
  readonly fondo: FondoParaHechos | null;
  readonly aviso: AvisoFondo | null;
}

const decimal = (n: number): Prisma.Decimal => new Prisma.Decimal(n);

export function fondoParaHechos(entradas: EntradasProyeccion, resultado: ResultadoProyeccion | null, hoy: Date): FondoExportado {
  const fondos = entradas.posiciones.filter((p): p is FondoEntrada => p.tipo === "FONDO");
  if (fondos.length === 0) return Object.freeze({ fondo: null, aviso: null });
  if (fondos.length > 1) return Object.freeze({ fondo: null, aviso: "FONDOS_VARIOS" });
  const [f] = fondos as [FondoEntrada];
  const hastaHoy = f.valores.filter((v) => v.dia.getTime() <= hoy.getTime());
  const ultimo = hastaHoy.at(-1);
  if (ultimo === undefined) return Object.freeze({ fondo: null, aviso: "FONDO_SIN_VALOR" });
  const anterior = hastaHoy.at(-2) ?? null;
  const valorHoy = resultado?.supuestos.posiciones.find((p) => p.tipo === "FONDO" && p.instrumentoId === f.instrumentoId)?.valorHoy ?? null;
  return Object.freeze({
    fondo: Object.freeze({
      valorUnidad: decimal(ultimo.valorUnidad),
      valorUnidadAnterior: anterior === null ? null : decimal(anterior.valorUnidad),
      fecha: ultimo.dia,
      atrasado: ultimo.dia.getTime() < hoy.getTime() - DIAS_ATRASO_AVISO * MS_POR_DIA,
      valor: valorHoy === null ? null : new Prisma.Decimal(valorHoy.toFixed(DECIMALES_PESOS)),
    }),
    aviso: null,
  });
}
