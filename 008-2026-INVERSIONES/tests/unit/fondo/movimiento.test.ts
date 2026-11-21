/**
 * Validación pura de la constitución del fondo (frente fondo-movimientos, T2): el dueño registra las unidades y el aporte
 * que dice el extracto del FIC; el sistema no los infiere ni los redondea. El contraste con el valor de unidad de la SFC
 * del MISMO día (±0,5 %) no escribe nada: dice si cuadra. Los errores llevan campo y código, nunca el valor.
 * Cifras y fechas inventadas.
 */
import { describe, expect, it } from "vitest";
import { contrastarConValorUnidad, validarConstitucion, type EntradaConstitucion } from "@/fondo/movimiento";

const HOY = new Date("2027-07-14T00:00:00Z");
const BIEN: EntradaConstitucion = { email: "dueno@ejemplo.invalid", fondo: "7316284", fecha: "2027-06-23", unidades: "1031.77246", monto: "4729785.4531" };

const errores = (e: EntradaConstitucion) => {
  const r = validarConstitucion(e, HOY);
  if (r.ok) throw new Error("se esperaba un rechazo");
  return r.errores;
};

describe("validarConstitucion", () => {
  it("lo válido sale con la fecha de negocio y los decimales canónicos, sin redondear", () => {
    expect(validarConstitucion({ ...BIEN, unidades: "01031.772460", monto: "4729785.45310" }, HOY)).toEqual({
      ok: true,
      valor: { email: "dueno@ejemplo.invalid", codigoFic: "7316284", fecha: new Date("2027-06-23T00:00:00Z"), unidades: "1031.77246", monto: "4729785.4531" },
    });
  });

  it("la constitución de hoy vale; la de mañana no (FECHA_FUTURA)", () => {
    expect(validarConstitucion({ ...BIEN, fecha: "2027-07-14" }, HOY).ok).toBe(true);
    expect(errores({ ...BIEN, fecha: "2027-07-15" })).toEqual([{ campo: "fecha", codigo: "FECHA_FUTURA" }]);
  });

  it("una fecha mal escrita o que no existe se rechaza con el código del lector", () => {
    expect(errores({ ...BIEN, fecha: "23/06/2027" })).toEqual([{ campo: "fecha", codigo: "FECHA_FORMATO" }]);
    expect(errores({ ...BIEN, fecha: "2027-02-30" })).toEqual([{ campo: "fecha", codigo: "FECHA_INVALIDA" }]);
  });

  it("unidades con 9 decimales o monto con 5: NUMERO_PRECISION (no se redondea en silencio)", () => {
    expect(errores({ ...BIEN, unidades: "1031.772461234" })).toEqual([{ campo: "unidades", codigo: "NUMERO_PRECISION" }]);
    expect(errores({ ...BIEN, monto: "4729785.45317" })).toEqual([{ campo: "monto", codigo: "NUMERO_PRECISION" }]);
  });

  it("con coma, exponente, separador de miles o signo de pesos: NUMERO_FORMATO", () => {
    for (const unidades of ["1031,77246", "1.03177246e3", "1,031.77246", "$1031"]) {
      expect(errores({ ...BIEN, unidades })).toEqual([{ campo: "unidades", codigo: "NUMERO_FORMATO" }]);
    }
  });

  it("unidades o monto en 0 o negativos: DEBE_SER_POSITIVO", () => {
    expect(errores({ ...BIEN, unidades: "0", monto: "-4729785.4531" })).toEqual([
      { campo: "unidades", codigo: "DEBE_SER_POSITIVO" },
      { campo: "monto", codigo: "DEBE_SER_POSITIVO" },
    ]);
  });

  it("el código del fondo es el de la SFC (de 1 a 12 dígitos) y el correo, uno válido", () => {
    expect(errores({ ...BIEN, fondo: "73A6284" })).toEqual([{ campo: "fondo", codigo: "CODIGO_FIC_FORMATO" }]);
    expect(errores({ ...BIEN, email: "--fondo" })).toEqual([{ campo: "email", codigo: "CORREO_FORMATO" }]);
  });

  it("sin nada: un error por campo obligatorio, y ninguno lleva el valor", () => {
    expect(errores({}).map((e) => e.campo)).toEqual(["email", "fondo", "fecha", "unidades", "monto"]);
    const conDatos = errores({ email: "x", fondo: "y4729785", fecha: "1031.77246", unidades: "4729785,4531", monto: "-1031" });
    const texto = JSON.stringify(conDatos);
    for (const dato of ["4729785", "1031", "y4729785"]) expect(texto).not.toContain(dato);
  });
});

describe("contrastarConValorUnidad (unidades × valor de unidad del mismo día, ±0,5 % del monto)", () => {
  it("dentro de la tolerancia: CUADRA", () => {
    expect(contrastarConValorUnidad("1031.77246", "4729785.4531", "4584.13617")).toBe("CUADRA");
    // 0,4 % por encima de unidades × valor (A&V pudo asignar con el valor de unidad de otro momento del día).
    expect(contrastarConValorUnidad("1031.77246", "4748704.5949", "4584.13617")).toBe("CUADRA");
  });

  it("fuera de la tolerancia, por arriba o por abajo: NO_CUADRA", () => {
    expect(contrastarConValorUnidad("1031.77246", "4760000.1373", "4584.13617")).toBe("NO_CUADRA");
    expect(contrastarConValorUnidad("1031.77246", "4702113.8167", "4584.13617")).toBe("NO_CUADRA");
  });

  it("sin el valor de unidad del día: SIN_VALOR_UNIDAD (nunca se usa el de otro día)", () => {
    expect(contrastarConValorUnidad("1031.77246", "4729785.4531", null)).toBe("SIN_VALOR_UNIDAD");
  });
});
