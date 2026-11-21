// El importador de Trii y el de la certificación pueden crear la misma especie a la vez (candados distintos): el
// choque es un P2002. La certificación se relee y se reintenta UNA vez antes de rechazarse (database-reviewer
// MEDIO). Se fuerza con un doble de `resolverEspecies`. Datos inventados, contra la base de PRUEBAS.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { importarCertificacion } from "@/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../fixtures/av/certificacion.ficticio";

const choques = vi.hoisted(() => ({ pendientes: 0 }));

vi.mock("@/importacion/av/guardar", async (importarOriginal) => {
  const real = await importarOriginal<typeof import("@/importacion/av/guardar")>();
  const { Prisma: P } = await import("@prisma/client");
  return {
    ...real,
    resolverEspecies: (...args: Parameters<typeof real.resolverEspecies>) => {
      if (choques.pendientes > 0) {
        choques.pendientes -= 1;
        throw new P.PrismaClientKnownRequestError("choque ficticio", { code: "P2002", clientVersion: "5.22.0" });
      }
      return real.resolverEspecies(...args);
    },
  };
});

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
let duenoId = "";
let n = 0;

function archivo() {
  n += 1;
  const fecha = new Date(Date.UTC(2027, 10, 3) + (n - 1) * 7 * 86_400_000);
  const nit = `99600000${n}-0`;
  const nemos = ["A", "B", "C"].map((l) => `R${corrida}${n}${l}`);
  const espec = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit }],
    rentaVariable: CERTIFICACION_FICTICIA.rentaVariable.map((f, i) => ({ ...f, nemo: nemos[[0, 0, 1, 2][i]!]! })),
    creadoEn: `D:${new Date(fecha.getTime() + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
  };
  return { fecha, codigoFic: `44${n}${corrida.replace(/\D/g, "0").slice(0, 3)}`, contenido: generarCertificacionPdf(espec), hoy: new Date(fecha.getTime() + 2 * 86_400_000) };
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-reintento-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});
afterEach(() => {
  choques.pendientes = 0;
});
afterAll(async () => {
  await db.$disconnect();
});

describe("importarCertificacion: reintento ante un choque de especies", () => {
  it("un P2002 se reintenta una vez y la certificación queda CARGADA", async () => {
    const a = archivo();
    await db.instrumento.create({ data: { tipo: "FIC", codigoFic: a.codigoFic, nombre: "Fondo ficticio" } });
    choques.pendientes = 1;
    const r = await importarCertificacion(db, { contenido: a.contenido, usuarioId: duenoId, fechaCorte: a.fecha, fondoCodigo: a.codigoFic, hoy: a.hoy });
    expect([r.estado, r.errores]).toEqual(["CARGADO", []]);
  });

  it("dos choques seguidos: RECHAZADO con BASE_P2002 (no reintenta sin fin)", async () => {
    const a = archivo();
    await db.instrumento.create({ data: { tipo: "FIC", codigoFic: a.codigoFic, nombre: "Fondo ficticio" } });
    choques.pendientes = 2;
    const r = await importarCertificacion(db, { contenido: a.contenido, usuarioId: duenoId, fechaCorte: a.fecha, fondoCodigo: a.codigoFic, hoy: a.hoy });
    expect(r.errores.map((e) => e.codigo)).toEqual(["BASE_P2002"]);
  });
});

void Prisma;
