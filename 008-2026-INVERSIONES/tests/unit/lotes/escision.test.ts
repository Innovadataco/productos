// Validación del lote de escisión (O2): sale por campo y código, como validarEscision, ANTES de abrir la base.
// Lo que se acepta o se rechaza NO cambia: la caracterización ancla lo que hoy hace registrarLoteEscision con una
// base falsa que solo responde si la validación pasó. Datos inventados.
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { registrarLoteEscision, validarLoteEscision, type DatosLoteEscision } from "@/lotes/escision";

const base: DatosLoteEscision = { destino: "FICTB", fechaEvento: "2027-03-17", cantidad: "4613", costoUnitario: "1237.53" };
const PASO = "PASO_LA_VALIDACION";
/** Una base que nunca se alcanza si la validación falla: si se alcanza, rechaza con PASO. */
const dbFalsa = { $transaction: () => Promise.reject(new Error(PASO)) } as unknown as PrismaClient;

/** [cambio, campos rechazados] — la tabla de lo que hoy acepta (vacío) o rechaza registrarLoteEscision. */
const CASOS: ReadonlyArray<readonly [Partial<DatosLoteEscision>, readonly string[]]> = [
  [{}, []],
  [{ destino: "fictb" }, []],
  [{ cantidad: " 4613 " }, []],
  [{ costoUnitario: "0" }, []],
  [{ costoUnitario: "-0" }, []],
  [{ costoUnitario: "-0.00" }, []],
  [{ costoUnitario: "3.141593" }, []],
  [{ cantidad: "4613/4613" }, ["cantidad"]],
  [{ cantidad: "0" }, ["cantidad"]],
  [{ costoUnitario: "-4.613" }, ["costoUnitario"]],
  [{ costoUnitario: "3.1415926" }, ["costoUnitario"]],
  [{ fechaEvento: "2027-02-30" }, ["fechaEvento"]],
  [{ destino: "", fechaEvento: "", cantidad: "", costoUnitario: "" }, ["destino", "fechaEvento", "cantidad", "costoUnitario"]],
];

describe("registrarLoteEscision · lo que acepta no cambia (caracterización)", () => {
  it.each(CASOS)("%j → %j", async (cambio, campos) => {
    const esperado = campos.length === 0 ? PASO : `DATOS_INVALIDOS:${campos.join(",")}`;
    await expect(registrarLoteEscision(dbFalsa, { ...base, ...cambio })).rejects.toThrow(esperado);
  });
});

describe("validarLoteEscision", () => {
  it("acepta el lote y lo normaliza como lo guardaba registrarLoteEscision", () => {
    const r = validarLoteEscision({ ...base, destino: " fictb ", costoUnitario: "-0.00" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.destino).toBe("FICTB");
    expect(r.valor.fecha.toISOString()).toBe("2027-03-17T00:00:00.000Z");
    expect(r.valor.cantidad).toBe(4613n);
    expect(r.valor.costoUnitario.toString()).toBe("0");
  });

  it.each([
    [{ destino: "FIC.CL" }, "destino", "NEMOTECNICO_FORMATO"],
    [{ fechaEvento: "17/03/2027" }, "fechaEvento", "FECHA_FORMATO"],
    [{ fechaEvento: "2027-02-30" }, "fechaEvento", "FECHA_INVALIDA"],
    [{ cantidad: "4,613" }, "cantidad", "CANTIDAD_FORMATO"],
    [{ cantidad: "" }, "cantidad", "CANTIDAD_FORMATO"],
    [{ cantidad: "37/41" }, "cantidad", "CANTIDAD_FORMATO"],
    [{ cantidad: "41/37" }, "cantidad", "CANTIDAD_INCOHERENTE"],
    [{ cantidad: "0" }, "cantidad", "DEBE_SER_POSITIVO"],
    [{ costoUnitario: "4,613" }, "costoUnitario", "NUMERO_FORMATO"],
    [{ costoUnitario: "3.1415926" }, "costoUnitario", "NUMERO_PRECISION"],
    [{ costoUnitario: "1".repeat(15) }, "costoUnitario", "NUMERO_RANGO"],
    [{ costoUnitario: "-4.613" }, "costoUnitario", "NO_PUEDE_SER_NEGATIVO"],
  ])("rechaza %j en %s con %s (un solo error por campo)", (cambio, campo, codigo) => {
    const r = validarLoteEscision({ ...base, ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toEqual([{ campo, codigo }]);
  });

  it.each(CASOS)("%j: la validación dice lo mismo que la caracterización (%j)", (cambio, campos) => {
    const r = validarLoteEscision({ ...base, ...cambio });
    expect(r.ok).toBe(campos.length === 0);
    if (!r.ok) expect(r.errores.map((e) => e.campo)).toEqual(campos);
  });
});
