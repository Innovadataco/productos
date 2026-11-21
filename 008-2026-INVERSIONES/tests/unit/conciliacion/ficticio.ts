/** Lecturas ficticias de la conciliación para las pruebas de pantalla (datos inventados, FICT…). */
import { Prisma } from "@prisma/client";
import type { ControlLeido, CorteDisponible, LecturaConciliacion } from "@/conciliacion/leer";

export const D = (v: string) => new Prisma.Decimal(v);
export const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const accion = (nemo: string) => ({ nemotecnico: nemo, nombre: `Acción ${nemo}`, tipo: "ACCION" as const });

export function control(c: Partial<ControlLeido> & Pick<ControlLeido, "tipo">): ControlLeido {
  return { instrumentoId: null, esperado: null, real: null, diferencia: null, tolerancia: null, resultado: "CUADRA", codigoMotivo: null, detalle: null, instrumento: null, ...c };
}

export const CONTROLES: readonly ControlLeido[] = [
  control({ tipo: "CANTIDAD", instrumentoId: "a", esperado: D("100"), real: D("100"), diferencia: D("0"), tolerancia: D("0"), instrumento: accion("FICTA") }),
  control({ tipo: "VALOR", instrumentoId: "a", esperado: D("110000"), real: D("110000"), diferencia: D("0"), tolerancia: D("0.005"), instrumento: accion("FICTA") }),
  control({ tipo: "CANTIDAD", instrumentoId: "c", esperado: D("10"), real: D("10"), diferencia: D("0"), tolerancia: D("0"), instrumento: accion("FICTC") }),
  control({ tipo: "VALOR", instrumentoId: "c", real: D("5050"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", instrumento: accion("FICTC") }),
  control({ tipo: "CANTIDAD", instrumentoId: "i", esperado: D("-10"), real: D("0"), diferencia: D("10"), tolerancia: D("0"), resultado: "NO_CUADRA", codigoMotivo: "no_certificada", instrumento: accion("FICTI") }),
  control({ tipo: "VALOR", real: D("115050"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", detalle: { alcance: "total_acciones" } }),
  control({ tipo: "FONDO", instrumentoId: "f", real: D("6250000"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "fondo_sin_unidades", instrumento: { nemotecnico: null, nombre: "Fondo ficticio uno", tipo: "FIC" } }),
  control({ tipo: "EFECTIVO", esperado: D("250"), real: D("1000"), diferencia: D("750"), tolerancia: D("1"), resultado: "NO_CUADRA", codigoMotivo: "partida_sin_fuente", detalle: { sinExplicar: "750" } }),
];

export const LECTURA: LecturaConciliacion = {
  fechaCorte: dia("2024-11-22"),
  conciliacion: { id: "k1", fechaCorte: dia("2024-11-22"), calculadaEn: new Date("2024-11-23T03:05:09Z"), versionCalculo: "conciliacion-v1", resultado: "NO_CUADRA", controles: CONTROLES },
  frescura: "AL_DIA",
  porLiquidar: [{ nemotecnico: "FICTB", operacion: "VENTA", cantidad: 20n, fechaOperacion: dia("2024-11-21"), fechaLiquidacion: dia("2024-11-25") }],
};

export const CORTES: readonly CorteDisponible[] = [
  { fechaCorte: dia("2024-11-22"), resultado: "NO_CUADRA" },
  { fechaCorte: dia("2024-11-14"), resultado: "PARCIAL" },
];
