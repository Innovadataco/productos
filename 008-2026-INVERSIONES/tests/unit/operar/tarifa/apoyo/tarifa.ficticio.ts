/**
 * Tarifas INVENTADAS para las pruebas de O5 (porcentajes y montos raros, fechas de 2027): no son la tarifa de ninguna
 * casa de bolsa. Los decimales van como texto: nunca pasan por punto flotante.
 */
import { Prisma, type LadoOrden } from "@prisma/client";
import type { TarifaSimulada } from "@/operar/simulador/tipos";
import type { TarifaLeida } from "@/operar/tarifa/leer";

const D = (v: string): Prisma.Decimal => new Prisma.Decimal(v);

/** 0,2731 % (mínimo $ 7,13) + fijo $ 1,37, IVA 17,31 %, un cargo de 0,0137 % y otro fijo de $ 2,11. */
export const tarifa = (cambios: Partial<TarifaSimulada> = {}): TarifaSimulada => ({
  version: 3,
  comisionista: "TRII",
  lado: "COMPRA",
  porcentaje: D("0.2731"),
  minimoPorOrden: D("7.13"),
  fijoPorOrden: D("1.37"),
  ivaPct: D("17.31"),
  otrosCargos: [
    { nombre: "Cargo ficticio", tipo: "PCT", valor: D("0.0137") },
    { nombre: "Otro ficticio", tipo: "FIJO", valor: D("2.11") },
  ],
  vigenteDesde: new Date(Date.UTC(2027, 0, 11)),
  ...cambios,
});

/** Solo el porcentaje (0,2731 %): sin mínimo, fijo, IVA ni otros cargos. */
export const tarifaSimple = (lado: LadoOrden = "COMPRA", cambios: Partial<TarifaSimulada> = {}): TarifaSimulada =>
  tarifa({ lado, minimoPorOrden: D("0"), fijoPorOrden: D("0"), ivaPct: D("0"), otrosCargos: [], ...cambios });

export const leida = (t: TarifaSimulada, motivo = "motivo ficticio"): TarifaLeida => ({ ...t, motivo, creadaEn: new Date(Date.UTC(2027, 0, 11, 23, 41)) });

/** El cuerpo que manda el formulario de /edicion/tarifas (válido). */
export const cuerpoTarifa = (cambios: Record<string, unknown> = {}): Record<string, unknown> => ({
  versionBase: 2,
  comisionista: "TRII",
  lado: "VENTA",
  porcentaje: "0,2731",
  minimoPorOrden: "7,13",
  fijoPorOrden: "1,37",
  ivaPct: "17,31",
  otrosCargos: [{ nombre: "Cargo ficticio", tipo: "PCT", valor: "0,0137" }],
  vigenteDesde: "2027-01-11",
  motivo: "Tarifa ficticia de prueba",
  ...cambios,
});
