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
    const r = registro(interpretarFila("TRII_CAJA", ["14 mar 2024, 3:27 p. m.", "Depósito", "Aprobado", "100000.0"], 2));
    expect(r.hecho).toMatchObject({ tipo: "DEPOSITO", estado: "APROBADO", monto: "100000" });
  });

  it("lee una orden con «1000/1000» y comisión con decimales", () => {
    const r = registro(
      interpretarFila("TRII_ORDENES", ["5 feb 2024, 10:15 a. m.", "ficta", "Compra", "Aprobado", "1000/1000", "0", "1000.5", "1000500.0", "1234.56", "1001734.56"], 2),
    );
    expect(r.hecho).toMatchObject({ nemotecnico: "FICTA", lado: "COMPRA", cantidadCompletada: 1000n, cantidadSolicitada: 1000n, comision: "1234.56" });
  });

  it("lee un dividendo con «Estado» vacío", () => {
    const r = registro(interpretarFila("TRII_DIVIDENDOS", ["2024-10-17", "FICTA", "", "31415.9"], 2));
    expect(r.hecho).toMatchObject({ nemotecnico: "FICTA", montoNeto: "31415.9" });
  });

  it("los errores dicen fila, columna y código, nunca el valor", () => {
    const r = interpretarFila("TRII_CAJA", ["32 mar 2024, 3:27 p. m.", "Transferencia", "Aprobado", "1.234,56"], 7);
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
    registro(interpretarFila("TRII_ORDENES", ["5 feb 2024, 10:15 a. m.", "FICTA", "Compra", estado, "10", "0", "100", "1000", comision, "1010"], 2));

  it("no depende del estado ni de la comisión (Trii puede cambiarlos entre exportaciones)", () => {
    expect(claveNatural(orden("Aprobado", "10"))).toBe(claveNatural(orden("Cancelado", "12.5")));
  });

  it("la ocurrencia sigue el orden de aparición, no el contenido (estado o cantidades cambian entre exportaciones)", () => {
    const a = orden("Aprobado", "10");
    const b = orden("Cancelado", "0");
    expect(asignarClaves([{ registro: a, fila: 2 }, { registro: b, fila: 3 }]).map((x) => x.ocurrencia)).toEqual([1, 2]);
    // La misma primera fila, ahora con otro estado: sigue siendo la ocurrencia 1.
    const aCambiada = orden("Cancelado", "10");
    expect(asignarClaves([{ registro: aCambiada, fila: 2 }, { registro: b, fila: 3 }])[0]!.ocurrencia).toBe(1);
  });

  it("«1500» y «1500.0» dan la misma clave (no duplican)", () => {
    const fila = (monto: string) => registro(interpretarFila("TRII_CAJA", ["14 mar 2024, 3:27 p. m.", "Depósito", "Aprobado", monto], 2));
    expect(claveNatural(fila("1500"))).toBe(claveNatural(fila("1500.0")));
  });

  it("cambia si cambia un campo que identifica la fila", () => {
    const a = registro(interpretarFila("TRII_CAJA", ["14 mar 2024, 3:27 p. m.", "Depósito", "Aprobado", "100"], 2));
    const b = registro(interpretarFila("TRII_CAJA", ["14 mar 2024, 3:27 p. m.", "Depósito", "Aprobado", "101"], 3));
    expect(claveNatural(a)).not.toBe(claveNatural(b));
  });

  it("dos filas idénticas legítimas reciben ocurrencias 1 y 2", () => {
    const r = registro(interpretarFila("TRII_CAJA", ["14 mar 2024, 3:27 p. m.", "Depósito", "Aprobado", "100"], 2));
    const claves = asignarClaves([{ registro: r, fila: 2 }, { registro: r, fila: 3 }]);
    expect(claves.map((c) => c.ocurrencia)).toEqual([1, 2]);
    expect(claves[0]!.clave).toBe(claves[1]!.clave);
  });
});
