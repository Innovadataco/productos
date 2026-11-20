// Integración de INV-SPEC-10 contra la base de PRUEBAS. Datos inventados.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorEvento, registrarEscision, validarEscision } from "@/eventos/escision";
import { importarArchivoTrii } from "@/importacion/trii/importar";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = (b: string) => `${b}${corrida}`;
let duenoId = "";

const valido = (d: Parameters<typeof validarEscision>[0]) => {
  const r = validarEscision(d);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.valor;
};
const dividendos = (texto: string) =>
  importarArchivoTrii(db, { nombreArchivo: "div.ficticio.csv", contenido: new TextEncoder().encode(`Fecha y hora,Ticker,Estado,Valor total\n${texto}`), usuarioId: duenoId });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-esc-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  for (const n of ["A", "B", "C"]) await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo(n), nombre: `Ficticia ${n}` } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("eventos de escisión en cadena", () => {
  it("con los dos eventos registrados antes, las dos fracciones se cargan como fracción y el resto como ordinario", async () => {
    const e1 = await registrarEscision(db, valido({ origen: nemo("A"), destino: nemo("B"), fecha: "2024-02-12", pagoFraccion: "2024-02-23", nota: "por confirmar" }));
    const e2 = await registrarEscision(db, valido({ origen: nemo("B"), destino: nemo("C"), fecha: "2024-02-26", razon: "0.5", pagoFraccion: "2024-03-08" }));
    expect(e1.dividendosYaImportados).toBe(0);
    const r = await dividendos(`2024-02-23,${nemo("B")},,300.0\n2024-03-08,${nemo("C")},,200.0\n2024-04-15,${nemo("C")},,50.0\n`);
    expect(r.estado).toBe("CARGADO");
    const filas = await db.dividendo.findMany({ where: { instrumento: { nemotecnico: { in: [nemo("B"), nemo("C")] } } }, orderBy: { fechaPago: "asc" } });
    expect(filas.map((d) => [d.tipo, d.eventoId])).toEqual([
      ["FRACCION_ESCISION", e1.eventoId],
      ["FRACCION_ESCISION", e2.eventoId],
      ["ORDINARIO", null],
    ]);
  });

  it("no registra dos veces el mismo evento", async () => {
    await expect(registrarEscision(db, valido({ origen: nemo("A"), destino: nemo("B"), fecha: "2024-02-12" }))).rejects.toThrow(ErrorEvento);
    await expect(registrarEscision(db, valido({ origen: nemo("A"), destino: nemo("B"), fecha: "2024-02-12" }))).rejects.toThrow(/EVENTO_DUPLICADO/);
  });

  it("dos registros simultáneos del mismo evento: la base deja pasar solo uno", async () => {
    const datos = valido({ origen: nemo("C"), destino: nemo("A"), fecha: "2024-05-06" });
    const resultados = await Promise.allSettled([registrarEscision(db, datos), registrarEscision(db, datos)]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rechazo.reason).toMatchObject({ codigo: "EVENTO_DUPLICADO" });
  });

  it("un mismo pago de fracción no puede pertenecer a dos eventos (la importación casaría solo uno)", async () => {
    await expect(
      registrarEscision(db, valido({ origen: nemo("C"), destino: nemo("B"), fecha: "2024-02-20", pagoFraccion: "2024-02-23" })),
    ).rejects.toMatchObject({ codigo: "PAGO_FRACCION_DUPLICADO" });
  });

  it("no crea instrumentos: un nemotécnico mal escrito se rechaza", async () => {
    await expect(registrarEscision(db, valido({ origen: nemo("A"), destino: "NOEXISTE9", fecha: "2024-02-12" }))).rejects.toThrow(/INSTRUMENTO_DESCONOCIDO/);
  });

  it("si el dividendo ya se importó como ordinario, avisa cuántos hay que revertir", async () => {
    const d = nemo("D");
    await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: d, nombre: "Ficticia D" } });
    await dividendos(`2025-09-01,${d},,10.0\n`);
    const r = await registrarEscision(db, valido({ origen: nemo("A"), destino: d, fecha: "2025-08-20", pagoFraccion: "2025-09-01" }));
    expect(r.dividendosYaImportados).toBe(1);
  });
});
