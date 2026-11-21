// #11 · un ErrorCifrado DENTRO de la transacción de importación (después de la verificación previa del
// llavero) deja el archivo RECHAZADO con su propio código, fijo y sin valores; no como BASE_ERROR.
// Se fuerza con un doble de `cifrarCrudo`. Datos inventados, contra la base de PRUEBAS.
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { importarArchivoTrii } from "@/importacion/trii/importar";

const falla = vi.hoisted(() => ({ activa: false }));

vi.mock("@/cifrado/campos", async (importarOriginal) => {
  const real = await importarOriginal<typeof import("@/cifrado/campos")>();
  const { ErrorCifrado } = await import("@/cifrado/errores");
  return {
    ...real,
    cifrarCrudo: (...args: Parameters<typeof real.cifrarCrudo>) => {
      if (falla.activa) throw new ErrorCifrado("AUTENTICACION_FALLIDA");
      return real.cifrarCrudo(...args);
    },
  };
});

const db = new PrismaClient();
let duenoId = "";
const corrida = Date.now().toString(16).toUpperCase();
const ticker = `CIM${corrida}`.slice(0, 20);
const archivo = new TextEncoder().encode(`Fecha y hora,Ticker,Estado,Valor total\n2026-01-21,${ticker},,100.0\n2026-04-15,${ticker},,110.0\n`);

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-cim-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});
afterEach(() => {
  falla.activa = false;
});
afterAll(async () => {
  await db.$disconnect();
});

describe("ErrorCifrado dentro de la transacción de importación", () => {
  it("el archivo queda RECHAZADO con el código del cifrado, sin valores, y no se guarda ningún hecho", async () => {
    falla.activa = true;
    const r = await importarArchivoTrii(db, { nombreArchivo: "cim.ficticio.csv", contenido: archivo, usuarioId: duenoId });
    expect(r).toMatchObject({ estado: "RECHAZADO", filasNuevas: 0, errores: [{ fila: 0, columna: null, codigo: "AUTENTICACION_FALLIDA" }] });
    const carga = await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId } });
    expect(carga.estado).toBe("RECHAZADO");
    expect(JSON.stringify(carga.errores)).toContain("AUTENTICACION_FALLIDA");
    expect(JSON.stringify(carga.errores)).not.toMatch(new RegExp(`${ticker}|100\\.0|110\\.0`));
    expect(await db.instrumento.count({ where: { nemotecnico: ticker } })).toBe(0);
    expect(await db.filaFuente.count({ where: { primeraCargaId: r.cargaId } })).toBe(0);
  });

  it("sin la falla, el mismo archivo se carga normalmente", async () => {
    const r = await importarArchivoTrii(db, { nombreArchivo: "cim-2.ficticio.csv", contenido: archivo, usuarioId: duenoId });
    expect(r).toMatchObject({ estado: "CARGADO", filasNuevas: 2 });
  });
});
