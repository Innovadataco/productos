// Detección común de los choques de concurrencia con la base (src/lib/choques.ts): P2002 (índice único), P2034
// (serialización: conflicto de escritura o bloqueo mutuo) y 23P01 (exclusión de vigencias, que Prisma 5.22 entrega
// como PrismaClientUnknownRequestError, sin código y con el SQLSTATE en el mensaje). Fija las dos formas, a propósito:
// por el campo `code` (los caminos de precios, fondo y series, cuyas pruebas usan errores falsos con ese campo) y la
// estricta, que exige la clase de Prisma (decretos, rendimientos, certificación, conciliación y escisiones).
// Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CODIGO_SERIALIZACION, CODIGO_UNICIDAD, esErrorPrisma, esExclusion, esUnicidad, tieneCodigo } from "@/lib/choques";

const VERSION = "5.22.0";
const conocido = (code: string) => new Prisma.PrismaClientKnownRequestError(`fallo ficticio ${code} con 4613.27`, { code, clientVersion: VERSION, meta: { target: ["ficticia"] } });
const desconocido = (mensaje: string) => new Prisma.PrismaClientUnknownRequestError(mensaje, { clientVersion: VERSION });
/** Como los falsos de tests/unit/precios/actualizar.test.ts y tests/unit/fondo/actualizar.test.ts: un Error con nombre y código. */
const falso = (code: string) => Object.assign(new Error("valor 37911.47 en la consulta"), { name: "PrismaClientKnownRequestError", code });
const EXCLUSION = 'Error occurred during query execution: PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint" }';

describe("códigos", () => {
  it("P2002 es la unicidad y P2034 la serialización", () => {
    expect(CODIGO_UNICIDAD).toBe("P2002");
    expect(CODIGO_SERIALIZACION).toBe("P2034");
  });
});

describe("tieneCodigo y esUnicidad (por el campo `code`, sin exigir la clase)", () => {
  it.each([
    ["un error de Prisma", conocido("P2002")],
    ["un falso con nombre y código", falso("P2002")],
    ["un objeto suelto con el código", { code: "P2002" }],
  ])("%s con P2002: sí", (_n, e) => {
    expect(esUnicidad(e)).toBe(true);
    expect(tieneCodigo(e, "P2002")).toBe(true);
  });

  it.each([
    ["otro código", conocido("P2034")],
    ["un código que no es texto", { code: 2002 }],
    ["sin código", new Error("P2002")],
    ["null", null],
    ["undefined", undefined],
    ["un texto", "P2002"],
    ["un número", 2002],
    ["la exclusión (sin código)", desconocido(EXCLUSION)],
  ])("%s: no", (_n, e) => {
    expect(esUnicidad(e)).toBe(false);
  });

  it("varios códigos: cualquiera de ellos (las series reintentan P2002 y P2034)", () => {
    expect(tieneCodigo(conocido("P2034"), "P2002", "P2034")).toBe(true);
    expect(tieneCodigo(falso("P2002"), "P2002", "P2034")).toBe(true);
    expect(tieneCodigo(conocido("P2028"), "P2002", "P2034")).toBe(false);
    expect(tieneCodigo(conocido("P2002"))).toBe(false);
  });
});

describe("esExclusion (23P01: solo el SQLSTATE del mensaje, por el nombre de la clase)", () => {
  it("el PrismaClientUnknownRequestError con 23P01 en el mensaje: sí", () => {
    expect(esExclusion(desconocido(EXCLUSION))).toBe(true);
  });

  it("un Error con ese nombre y el SQLSTATE también (se mira el nombre, no la clase)", () => {
    expect(esExclusion(Object.assign(new Error(EXCLUSION), { name: "PrismaClientUnknownRequestError" }))).toBe(true);
  });

  it.each([
    ["otro error desconocido", desconocido("Error occurred during query execution: timeout")],
    ["el SQLSTATE pegado a otra palabra", desconocido("código X23P01 y 23P012")],
    ["un error conocido con 23P01 en el mensaje", new Prisma.PrismaClientKnownRequestError(EXCLUSION, { code: "P2010", clientVersion: VERSION })],
    ["un Error común con 23P01", new Error(EXCLUSION)],
    ["un objeto que no es Error", { name: "PrismaClientUnknownRequestError", message: EXCLUSION }],
    ["null", null],
  ])("%s: no", (_n, e) => {
    expect(esExclusion(e)).toBe(false);
  });
});

describe("esErrorPrisma (estricto: la clase de Prisma y el código)", () => {
  it("un PrismaClientKnownRequestError con ese código: sí; con otro, no", () => {
    expect(esErrorPrisma(conocido("P2002"), CODIGO_UNICIDAD)).toBe(true);
    expect(esErrorPrisma(conocido("P2034"), CODIGO_SERIALIZACION)).toBe(true);
    expect(esErrorPrisma(conocido("P2034"), CODIGO_UNICIDAD)).toBe(false);
  });

  it("un falso con el mismo nombre y código no pasa (a diferencia de esUnicidad)", () => {
    expect(esErrorPrisma(falso("P2002"), CODIGO_UNICIDAD)).toBe(false);
    expect(esErrorPrisma({ code: "P2002" }, CODIGO_UNICIDAD)).toBe(false);
    expect(esErrorPrisma(null, CODIGO_UNICIDAD)).toBe(false);
  });

  it("estrecha el tipo: deja leer `meta` (lo usa la escisión para saber qué índice chocó)", () => {
    const e: unknown = conocido("P2002");
    if (!esErrorPrisma(e, CODIGO_UNICIDAD)) throw new Error("debía ser P2002");
    expect(e.meta?.["target"]).toEqual(["ficticia"]);
  });
});
