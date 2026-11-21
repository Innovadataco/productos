/**
 * Valores y filas de la certificación (PR-B): de las celdas de la tabla a cifras validadas, con el crudo en
 * lista blanca (sin el nombre del titular ni la cuenta). Una fila inválida rechaza el archivo entero; el error
 * lleva página, fila, columna y código, nunca el texto. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { interpretarFilas } from "@/importacion/av/filas";
import { extraerLineas } from "@/importacion/av/pdf/lector";
import { leerTablaCertificacion, type FilaTabla } from "@/importacion/av/tabla";
import { leerCantidadAcciones, leerDigitos, leerMontoCop, leerNit } from "@/importacion/av/valores";
import { generarCertificacionPdf } from "../../../fixtures/av/certificacion.ficticio";

describe("valores de la certificación", () => {
  it("lee montos «COP 1.234,56» como decimal canónico", () => {
    expect(leerMontoCop("COP 1.234,56")).toEqual({ ok: true, valor: "1234.56" });
    expect(leerMontoCop("COP 6.250.000,00")).toEqual({ ok: true, valor: "6250000" });
    expect(leerMontoCop("COP 20,00")).toEqual({ ok: true, valor: "20" });
    expect(leerMontoCop("COP 0,05")).toEqual({ ok: true, valor: "0.05" });
  });

  it("acepta un monto negativo solo donde se permite (el saldo en efectivo)", () => {
    expect(leerMontoCop("COP -1.000,00")).toEqual({ ok: false, codigo: "MONTO_NEGATIVO" });
    expect(leerMontoCop("COP -1.000,00", { negativo: true })).toEqual({ ok: true, valor: "-1000" });
  });

  it("rechaza montos mal formados", () => {
    for (const t of ["1.234,56", "COP 1,234.56", "COP 1.23,45", "COP 12345,6", "COP 1.234", "$ 1.234,56", "COP 1.234,567", "COP ,50"]) {
      expect(leerMontoCop(t), t).toEqual({ ok: false, codigo: "MONTO_FORMATO" });
    }
  });

  it("lee cantidades enteras positivas, con o sin punto de miles", () => {
    expect(leerCantidadAcciones("1234")).toEqual({ ok: true, valor: 1234n });
    expect(leerCantidadAcciones("1.234")).toEqual({ ok: true, valor: 1234n });
    for (const t of ["0", "-5", "1,5", "12.34", "1.2345", "abc"]) expect(leerCantidadAcciones(t), t).toMatchObject({ ok: false });
  });

  it("lee el NIT con dígito de verificación y los identificadores en dígitos", () => {
    expect(leerNit("999000111-0")).toEqual({ ok: true, valor: "999000111-0" });
    expect(leerNit("999000111")).toEqual({ ok: false, codigo: "NIT_FORMATO" });
    expect(leerDigitos("000000001", "ENCARGO_FORMATO")).toEqual({ ok: true, valor: "000000001" });
    expect(leerDigitos("00-1", "ENCARGO_FORMATO")).toEqual({ ok: false, codigo: "ENCARGO_FORMATO" });
  });
});

const tabla = (pdf = generarCertificacionPdf()) => leerTablaCertificacion(extraerLineas(pdf));
const rv = (pagina: number, numero: number, celdas: string[]): FilaTabla => ({ seccion: "RENTA_VARIABLE", pagina, numero, celdas });
const EFECTIVO: FilaTabla = { seccion: "EFECTIVO", pagina: 2, numero: 9, celdas: ["Titular Ficticio Uno", "00000", "COP 1.000,00"] };

describe("interpretarFilas: el PDF ficticio", () => {
  it("da los lotes, el fondo y el efectivo con su página y su fila", () => {
    const r = interpretarFilas(tabla());
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    expect(r.valor.lotes.map((l) => [l.nemo, l.cantidad, l.precio, l.valor, l.pagina, l.numero])).toEqual([
      ["FICT1", 100n, "1000", "100000", 1, 2], ["FICT1", 50n, "1000", "50000.01", 1, 3], ["FICT2", 2000n, "20", "40000", 1, 4], ["FICT3", 10n, "32500", "325000", 1, 5],
    ]);
    expect(r.valor.fondos.map((f) => [f.nit, f.encargo, f.saldo, f.pagina, f.numero])).toEqual([["999000111-0", "000000001", "6250000", 1, 1]]);
    expect([r.valor.efectivo.saldo, r.valor.efectivo.pagina, r.valor.efectivo.numero]).toEqual(["1000", 2, 6]);
  });

  it("el crudo va en lista blanca: sin el nombre del titular ni la cuenta", () => {
    const r = interpretarFilas(tabla());
    if (!r.ok) throw new Error("no leyó");
    expect(r.valor.efectivo.crudo).toEqual({ seccion: "SALDO EN EFECTIVO", pagina: "2", SALDO: "COP 1.000,00" });
    expect(JSON.stringify(r.valor, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(/Titular|"00000"/);
    expect(r.valor.lotes[0]!.crudo).toEqual({ seccion: "RENTA VARIABLE", pagina: "1", NEMOTÉCNICO: "FICT1", CANTIDAD: "100", "PRECIO VALORACIÓN": "COP 1.000,00", "VALOR DE MERCADO": "COP 100.000,00" });
    expect(r.valor.fondos[0]!.crudo).toMatchObject({ seccion: "FONDOS DE INVERSIÓN", "NIT DEL FONDO": "999000111-0", ENCARGO: "000000001" });
  });
});

describe("interpretarFilas: una fila inválida rechaza el archivo entero (con página, fila y columna; sin texto)", () => {
  const errores = (filas: FilaTabla[]) => {
    const r = interpretarFilas(filas);
    if (r.ok) throw new Error("debía rechazar");
    return r.errores;
  };

  it("cantidad × precio que no da el valor (columnas corridas o un número mal leído)", () => {
    expect(errores([rv(1, 1, ["FICT1", "100", "COP 1.000,00", "COP 100.500,00"]), EFECTIVO])).toEqual([{ pagina: 1, fila: 1, columna: "VALOR DE MERCADO", codigo: "VALOR_INCOHERENTE" }]);
  });

  it("acepta el redondeo del precio a centavos (medio centavo por acción)", () => {
    expect(interpretarFilas([rv(1, 1, ["FICT1", "3", "COP 3,33", "COP 10,00"]), EFECTIVO]).ok).toBe(true);
  });

  it("junta todos los errores de todas las filas, cada uno con su columna", () => {
    const filas = [rv(1, 1, ["fict 1", "0", "COP 1,00", "COP x"]), rv(1, 2, ["FICT2", "10", "COP 1,00", "COP 10,00"]), EFECTIVO];
    expect(errores(filas)).toEqual([
      { pagina: 1, fila: 1, columna: "NEMOTÉCNICO", codigo: "NEMOTECNICO_FORMATO" },
      { pagina: 1, fila: 1, columna: "CANTIDAD", codigo: "CANTIDAD_FORMATO" },
      { pagina: 1, fila: 1, columna: "VALOR DE MERCADO", codigo: "MONTO_FORMATO" },
    ]);
  });

  it("un fondo con NIT, encargo o saldo inválidos, o una descripción con caracteres raros", () => {
    const fondo = (celdas: string[]): FilaTabla => ({ seccion: "FONDOS", pagina: 1, numero: 1, celdas });
    expect(errores([fondo(["FONDO FICTICIO UNO", "999-0", "000000001", "COP 1,00"]), EFECTIVO])).toEqual([{ pagina: 1, fila: 1, columna: "NIT DEL FONDO", codigo: "NIT_FORMATO" }]);
    expect(errores([fondo(["FONDO FICTICIO UNO", "999000111-0", "x1", "COP -1,00"]), EFECTIVO]).map((e) => e.codigo)).toEqual(["ENCARGO_FORMATO", "MONTO_NEGATIVO"]);
    expect(errores([fondo(["", "999000111-0", "1", "COP 1,00"]), EFECTIVO]).map((e) => e.codigo)).toEqual(["DESCRIPCION_FORMATO"]);
  });

  it("un efectivo con cuenta inválida; el saldo puede ser negativo", () => {
    expect(interpretarFilas([rv(1, 1, ["FICT1", "1", "COP 1,00", "COP 1,00"]), { ...EFECTIVO, celdas: ["Titular Ficticio", "00000", "COP -5,00"] }]).ok).toBe(true);
    expect(errores([{ ...EFECTIVO, celdas: ["Titular Ficticio", "cta 0", "COP 5,00"] }]).map((e) => [e.columna, e.codigo])).toEqual([["CUENTA", "CUENTA_FORMATO"]]);
  });

  it("sin fila de efectivo, o con más de una cuenta", () => {
    expect(errores([rv(1, 1, ["FICT1", "1", "COP 1,00", "COP 1,00"])])).toEqual([{ pagina: 0, fila: 0, columna: null, codigo: "EFECTIVO_FALTANTE" }]);
    expect(errores([EFECTIVO, { ...EFECTIVO, numero: 10 }])).toEqual([{ pagina: 2, fila: 10, columna: null, codigo: "VARIAS_CUENTAS" }]);
  });

  it("el mismo fondo (NIT) dos veces", () => {
    const f = (numero: number): FilaTabla => ({ seccion: "FONDOS", pagina: 1, numero, celdas: ["FONDO FICTICIO UNO", "999000111-0", "1", "COP 1,00"] });
    expect(errores([f(1), f(2), EFECTIVO])).toEqual([{ pagina: 1, fila: 2, columna: "NIT DEL FONDO", codigo: "FONDO_DUPLICADO" }]);
  });

  it("los errores no traen el texto de ninguna celda", () => {
    const r = interpretarFilas([rv(1, 1, ["FICT9", "77", "COP 1,00", "COP 99,00"]), EFECTIVO]);
    expect(JSON.stringify(r)).not.toMatch(/FICT9|77|99/);
  });
});
