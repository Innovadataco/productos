/**
 * Vista serializada de la conciliación (PR-C, GATE 1 aprobada): una fila por especie (cantidad y valor juntos,
 * por nemotécnico), filas aparte para el total de acciones, cada fondo y el efectivo, el % de diferencia en
 * Decimal con 2 decimales, «calculada el …» en hora de Colombia y la lista de lo que está por liquidar.
 * Datos inventados (FICT…).
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ControlLeido, CorteDisponible, LecturaConciliacion } from "@/conciliacion/leer";
import { MOTIVOS } from "@/app/conciliacion/motivos";
import { aCortes, aVistaCorte } from "@/app/conciliacion/serializar";

const D = (v: string) => new Prisma.Decimal(v);
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const accion = (nemo: string) => ({ nemotecnico: nemo, nombre: `Acción ${nemo}`, tipo: "ACCION" as const });

function control(c: Partial<ControlLeido> & Pick<ControlLeido, "tipo">): ControlLeido {
  return { instrumentoId: null, esperado: null, real: null, diferencia: null, tolerancia: null, resultado: "CUADRA", codigoMotivo: null, detalle: null, instrumento: null, ...c };
}

const CONTROLES: ControlLeido[] = [
  control({ tipo: "VALOR", instrumentoId: "b", esperado: D("153040"), real: D("153040"), diferencia: D("0"), tolerancia: D("0.005"), instrumento: accion("FICTB") }),
  control({ tipo: "CANTIDAD", instrumentoId: "b", esperado: D("80"), real: D("80"), diferencia: D("0"), tolerancia: D("0"), instrumento: accion("FICTB") }),
  control({ tipo: "CANTIDAD", instrumentoId: "a", esperado: D("100"), real: D("100"), diferencia: D("0"), tolerancia: D("0"), instrumento: accion("FICTA") }),
  control({
    tipo: "VALOR", instrumentoId: "a", esperado: D("110000"), real: D("112000"), diferencia: D("2000"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "precio_distinto",
    detalle: { precioValoracion: "1120", cierre: "1100" }, instrumento: accion("FICTA"),
  }),
  control({ tipo: "CANTIDAD", instrumentoId: "i", esperado: D("-10"), real: D("0"), diferencia: D("10"), tolerancia: D("0"), resultado: "NO_CUADRA", codigoMotivo: "no_certificada", instrumento: accion("FICTI") }),
  control({ tipo: "CANTIDAD", instrumentoId: "c", esperado: D("100"), real: D("80"), diferencia: D("-20"), tolerancia: D("0"), resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", detalle: { operada: "80", pendientes: 1 }, instrumento: accion("FICTC") }),
  control({ tipo: "VALOR", instrumentoId: "c", real: D("4040"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", instrumento: accion("FICTC") }),
  control({ tipo: "VALOR", esperado: D("263040"), real: D("269080"), diferencia: D("6040"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "por_especies", detalle: { alcance: "total_acciones" } }),
  control({ tipo: "FONDO", instrumentoId: "f", real: D("6250000"), tolerancia: D("0.005"), resultado: "NO_CUADRA", codigoMotivo: "fondo_sin_unidades", instrumento: { nemotecnico: null, nombre: "Fondo ficticio uno", tipo: "FIC" } }),
  control({ tipo: "EFECTIVO", esperado: D("250"), real: D("1000"), diferencia: D("750"), tolerancia: D("1"), resultado: "NO_CUADRA", codigoMotivo: "partida_sin_fuente", detalle: { sinExplicar: "750" } }),
];

const LECTURA: LecturaConciliacion = {
  fechaCorte: dia("2024-11-22"),
  conciliacion: { id: "k1", fechaCorte: dia("2024-11-22"), calculadaEn: new Date("2024-11-23T03:05:09Z"), versionCalculo: "conciliacion-v1", resultado: "NO_CUADRA", controles: CONTROLES },
  frescura: "DESACTUALIZADA",
  porLiquidar: [
    { nemotecnico: "FICTC", operacion: "VENTA", cantidad: 20n, fechaOperacion: dia("2024-11-21"), fechaLiquidacion: dia("2024-11-25") },
    { nemotecnico: "FICTE", operacion: "ESCISION", cantidad: 3n, fechaOperacion: dia("2024-11-22"), fechaLiquidacion: dia("2024-11-26") },
  ],
};

describe("aVistaCorte", () => {
  const v = aVistaCorte(LECTURA);
  const c = v.conciliacion!;

  it("una fila por especie, por nemotécnico, con cantidad y valor de A&V frente al sistema", () => {
    expect(c.especies.map((e) => e.nemo)).toEqual(["FICTA", "FICTB", "FICTC", "FICTI"]);
    expect(c.especies[1]).toEqual({
      id: "b", nemo: "FICTB", cantidadAv: "80", cantidadSistema: "80", diferenciaCantidad: "0", valorAv: "153040", valorSistema: "153040", diferenciaPct: "0.00", precios: null,
      estado: { texto: "Cuadra", tono: "cuadra" }, porque: [],
    });
  });

  it("el % es (A&V − sistema) / |A&V| × 100 con 2 decimales, y trae el cierre frente al precio de A&V si difiere el precio", () => {
    expect(c.especies[0]).toMatchObject({ diferenciaPct: "1.79", precios: { cierre: "1100", precioAv: "1120" }, estado: { texto: "No cuadra", tono: "no-cuadra" }, porque: [MOTIVOS.precio_distinto] });
  });

  it("la fila toma el peor estado de sus dos controles y junta sus porqués, cantidad primero", () => {
    expect(c.especies[2]).toMatchObject({ cantidadAv: "80", cantidadSistema: "100", diferenciaCantidad: "-20", valorAv: "4040", valorSistema: null, diferenciaPct: null });
    expect(c.especies[2]!.estado).toEqual({ texto: "No se pudo verificar", tono: "sin-verificar" });
    expect(c.especies[2]!.porque).toEqual([MOTIVOS.t_mas_2, MOTIVOS.sin_precio_al_corte]);
  });

  it("una especie solo del sistema no tiene valor; su porqué es que A&V no la trae", () => {
    expect(c.especies[3]).toMatchObject({ cantidadAv: "0", cantidadSistema: "-10", valorAv: null, valorSistema: null, estado: { tono: "no-cuadra" }, porque: [MOTIVOS.no_certificada] });
  });

  it("filas aparte para el total de acciones, cada fondo (por su nombre) y el efectivo", () => {
    expect(c.total).toMatchObject({ etiqueta: "Total de acciones", av: "269080", sistema: "263040", diferencia: "6040", diferenciaPct: "2.24", porque: [MOTIVOS.por_especies] });
    expect(c.fondos).toEqual([
      { id: "f", etiqueta: "Fondo ficticio uno", av: "6250000", sistema: null, diferencia: null, diferenciaPct: null, estado: { texto: "No se pudo verificar", tono: "sin-verificar" }, porque: [MOTIVOS.fondo_sin_unidades] },
    ]);
    expect(c.efectivo).toMatchObject({ etiqueta: "Efectivo", av: "1000", sistema: "250", diferencia: "750", diferenciaPct: "75.00", estado: { tono: "no-cuadra" }, porque: [MOTIVOS.partida_sin_fuente] });
  });

  it("arriba: el resultado global en palabras, «calculada el …» en hora de Colombia, la frescura y las cuentas", () => {
    expect(c.resultado).toEqual({ texto: "No cuadra", tono: "no-cuadra" });
    expect(c.calculadaEn).toBe("2024-11-22 22:05");
    expect(c.frescura).toBe("DESACTUALIZADA");
    expect(c.cuentas).toEqual({ cuadra: 3, noCuadra: 4, porLiquidar: 1, sinVerificar: 2 });
    expect(c.noReconocidos).toBe(0);
    expect(v.fechaCorte).toBe("2024-11-22");
  });

  it("lo que está por liquidar, con la operación en palabras y las fechas como día", () => {
    expect(v.porLiquidar).toEqual([
      { nemo: "FICTC", operacion: "Venta", cantidad: "20", fechaOperacion: "2024-11-21", fechaLiquidacion: "2024-11-25" },
      { nemo: "FICTE", operacion: "Escisión", cantidad: "3", fechaOperacion: "2024-11-22", fechaLiquidacion: "2024-11-26" },
    ]);
  });

  it("PARCIAL se dice «Cuadra, con operaciones por liquidar»; sin conciliación, la vista lo dice con null", () => {
    const parcial = aVistaCorte({ ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, resultado: "PARCIAL" } });
    expect(parcial.conciliacion!.resultado).toEqual({ texto: "Cuadra, con operaciones por liquidar", tono: "por-liquidar" });
    expect(aVistaCorte({ ...LECTURA, conciliacion: null, frescura: null }).conciliacion).toBeNull();
  });

  it("un control de un tipo que la pantalla no conoce se cuenta aparte y no rompe nada", () => {
    const raro = control({ tipo: "PRECIO", instrumentoId: "a", resultado: "CUADRA", instrumento: accion("FICTA") });
    const conRaro = aVistaCorte({ ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, controles: [...CONTROLES, raro] } });
    expect(conRaro.conciliacion!.noReconocidos).toBe(1);
    expect(conRaro.conciliacion!.especies).toHaveLength(4);
  });

  it("un detalle con otra forma no se pinta: sin precios ni excepción", () => {
    const valor = CONTROLES[3]!;
    for (const detalle of [null, ["1100"], { cierre: 1100, precioValoracion: "1120" }, { cierre: "<b>1</b>", precioValoracion: "1120" }] as Prisma.JsonValue[]) {
      const otra = aVistaCorte({ ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, controles: CONTROLES.map((x) => (x === valor ? { ...x, detalle } : x)) } });
      expect(otra.conciliacion!.especies[0]!.precios).toBeNull();
    }
  });

  it("A&V en cero (o sin cifra) deja el % sin calcular, nunca infinito", () => {
    const efectivoCero = CONTROLES.map((x) => (x.tipo === "EFECTIVO" ? { ...x, real: D("0"), diferencia: D("-250") } : x));
    expect(aVistaCorte({ ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, controles: efectivoCero } }).conciliacion!.efectivo!.diferenciaPct).toBeNull();
  });
});

describe("aCortes", () => {
  const cortes: CorteDisponible[] = [
    { fechaCorte: dia("2024-11-22"), resultado: "NO_CUADRA" },
    { fechaCorte: dia("2024-11-14"), resultado: "PARCIAL" },
    { fechaCorte: dia("2024-10-31"), resultado: null },
  ];

  it("cada corte con el resultado de su última conciliación en palabras, y cuál es el que se ve", () => {
    expect(aCortes(cortes, "2024-11-14")).toEqual([
      { fecha: "2024-11-22", texto: "No cuadra", actual: false },
      { fecha: "2024-11-14", texto: "Cuadra, con operaciones por liquidar", actual: true },
      { fecha: "2024-10-31", texto: "Sin conciliar", actual: false },
    ]);
  });

  it("sin corte elegido, ninguno está marcado", () => {
    expect(aCortes(cortes, null).some((x) => x.actual)).toBe(false);
  });
});
