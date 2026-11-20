import { describe, expect, it } from "vitest";
import { asignarClaves, claveNatural } from "@/importacion/trii/clave";
import { detectarTipo, ENCABEZADOS } from "@/importacion/trii/formatos";
import { interpretarFila, type Registro } from "@/importacion/trii/filas";

const registro = (r: ReturnType<typeof interpretarFila>): Registro => {
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.registro;
};

describe("detectarTipo", () => {
  it("reconoce los tres archivos de Trii por su encabezado exacto", () => {
    expect(detectarTipo(ENCABEZADOS.TRII_CAJA)).toBe("TRII_CAJA");
    expect(detectarTipo(ENCABEZADOS.TRII_ORDENES)).toBe("TRII_ORDENES");
    expect(detectarTipo(ENCABEZADOS.TRII_DIVIDENDOS)).toBe("TRII_DIVIDENDOS");
  });

  it("no reconoce encabezados distintos, incompletos o en otro orden", () => {
    expect(detectarTipo(["Fecha", "Tipo", "Estado", "Valor"])).toBeNull();
    expect(detectarTipo([...ENCABEZADOS.TRII_CAJA].reverse())).toBeNull();
    expect(detectarTipo(ENCABEZADOS.TRII_ORDENES.slice(0, 9))).toBeNull();
  });
});

describe("interpretarFila", () => {
  it("lee un movimiento de caja", () => {
    const r = registro(interpretarFila("TRII_CAJA", ["12 may 2025, 4:42 p. m.", "Depósito", "Aprobado", "100000.0"], 2));
    expect(r.hecho).toMatchObject({ tipo: "DEPOSITO", estado: "APROBADO", monto: "100000.0" });
  });

  it("lee una orden con «1412/1412» y comisión con decimales", () => {
    const r = registro(
      interpretarFila("TRII_ORDENES", ["3 jul 2025, 10:15 a. m.", "ficta", "Compra", "Aprobado", "1412/1412", "0", "1000.5", "1412706.0", "1234.56", "1413940.56"], 2),
    );
    expect(r.hecho).toMatchObject({ nemotecnico: "FICTA", lado: "COMPRA", cantidadCompletada: 1412n, cantidadSolicitada: 1412n, comision: "1234.56" });
  });

  it("lee un dividendo con «Estado» vacío", () => {
    const r = registro(interpretarFila("TRII_DIVIDENDOS", ["2026-10-19", "FICTA", "", "23778.4"], 2));
    expect(r.hecho).toMatchObject({ nemotecnico: "FICTA", montoNeto: "23778.4" });
  });

  it("los errores dicen fila, columna y código, nunca el valor", () => {
    const r = interpretarFila("TRII_CAJA", ["32 may 2025, 4:42 p. m.", "Transferencia", "Aprobado", "1.234,56"], 7);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual([
      { fila: 7, columna: "Fecha y hora", codigo: "FECHA_HORA_INVALIDA" },
      { fila: 7, columna: "Tipo de movimiento", codigo: "CATEGORIA_DESCONOCIDA" },
      { fila: 7, columna: "Valor total", codigo: "NUMERO_FORMATO" },
    ]);
    expect(JSON.stringify(r.errores)).not.toMatch(/Transferencia|1\.234/);
  });

  it("rechaza una fila con otro número de columnas", () => {
    expect(interpretarFila("TRII_CAJA", ["a", "b"], 3)).toEqual({ ok: false, errores: [{ fila: 3, columna: null, codigo: "COLUMNAS_INCORRECTAS" }] });
  });
});

describe("clave natural", () => {
  const orden = (estado: string, comision: string) =>
    registro(interpretarFila("TRII_ORDENES", ["3 jul 2025, 10:15 a. m.", "FICTA", "Compra", estado, "10", "0", "100", "1000", comision, "1010"], 2));

  it("no depende del estado ni de la comisión (Trii puede cambiarlos entre exportaciones)", () => {
    expect(claveNatural(orden("Aprobado", "10"))).toBe(claveNatural(orden("Cancelado", "12.5")));
  });

  it("la ocurrencia no depende del orden de las filas en el archivo", () => {
    const a = orden("Aprobado", "10");
    const b = orden("Cancelado", "0");
    const ida = asignarClaves([{ registro: a, fila: 2 }, { registro: b, fila: 3 }]);
    const vuelta = asignarClaves([{ registro: b, fila: 2 }, { registro: a, fila: 3 }]);
    const ocurrenciaDe = (lista: typeof ida, r: typeof a) => lista.find((x) => x.registro === r)!.ocurrencia;
    expect(ocurrenciaDe(ida, a)).toBe(ocurrenciaDe(vuelta, a));
    expect(ocurrenciaDe(ida, b)).toBe(ocurrenciaDe(vuelta, b));
  });

  it("cambia si cambia un campo que identifica la fila", () => {
    const a = registro(interpretarFila("TRII_CAJA", ["12 may 2025, 4:42 p. m.", "Depósito", "Aprobado", "100"], 2));
    const b = registro(interpretarFila("TRII_CAJA", ["12 may 2025, 4:42 p. m.", "Depósito", "Aprobado", "101"], 3));
    expect(claveNatural(a)).not.toBe(claveNatural(b));
  });

  it("dos filas idénticas legítimas reciben ocurrencias 1 y 2", () => {
    const r = registro(interpretarFila("TRII_CAJA", ["12 may 2025, 4:42 p. m.", "Depósito", "Aprobado", "100"], 2));
    const claves = asignarClaves([{ registro: r, fila: 2 }, { registro: r, fila: 3 }]);
    expect(claves.map((c) => c.ocurrencia)).toEqual([1, 2]);
    expect(claves[0]!.clave).toBe(claves[1]!.clave);
  });
});
