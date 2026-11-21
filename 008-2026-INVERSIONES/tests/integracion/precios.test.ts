// Integración de INV-SPEC-13 contra la base de PRUEBAS, con un Yahoo falso. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
let instrumentoId = "";
let duenoId = "";
const desde = new Date("2024-03-12T00:00:00Z");
const hasta = new Date("2024-03-13T00:00:00Z");
const T = [Date.UTC(2024, 2, 12, 14, 30) / 1000, Date.UTC(2024, 2, 13, 14, 30) / 1000];
const yahoo = (closes: number[]): Buscar => async () => ({
  ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: { currency: "COP" }, timestamp: T, indicators: { quote: [{ close: closes }] } }] } }),
});
const vigentes = () => db.precioCierre.findMany({ where: { instrumentoId, reemplazadoEn: null }, orderBy: { fecha: "asc" } });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  instrumentoId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRC${corrida}`, nombre: "Ficticia" } })).id;
  duenoId = (await db.usuario.create({ data: { email: `dueno-prc-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("actualizarPrecios", () => {
  it("guarda los cierres nuevos; sin certificación del día quedan NO_VERIFICADO", async () => {
    const r = await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 101]), instrumentoIds: [instrumentoId] });
    expect(r).toMatchObject({ especies: 1, cierresNuevos: 2, cierresRevisados: 0, fallidas: [] });
    expect((await vigentes()).map((p) => [p.precio.toString(), p.estado])).toEqual([["100", "NO_VERIFICADO"], ["101", "NO_VERIFICADO"]]);
  });

  it("repetir con los mismos cierres no cambia nada", async () => {
    const r = await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 101]), instrumentoIds: [instrumentoId] });
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0 });
  });

  it("un cierre revisado por Yahoo reemplaza al vigente y el viejo queda como historia", async () => {
    const r = await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 102]), instrumentoIds: [instrumentoId] });
    expect(r.cierresRevisados).toBe(1);
    expect((await vigentes()).map((p) => p.precio.toString())).toEqual(["100", "102"]);
    expect(await db.precioCierre.count({ where: { instrumentoId, reemplazadoEn: { not: null } } })).toBe(1);
  });

  it("con certificación del mismo día, ±1 % queda VERIFICADO y más allá NO_VERIFICADO", async () => {
    const carga = await db.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "cert.ficticio.pdf", sha256: "c".repeat(64), estado: "CARGADO", cargadoPorId: duenoId } });
    const cert = await db.certificacion.create({ data: { cargaId: carga.id, fechaCorte: hasta, saldoEfectivo: new Prisma.Decimal(0) } });
    await db.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId, cantidad: 10n, precioValoracion: new Prisma.Decimal(103), valorMercado: new Prisma.Decimal(1030) } });
    await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 103.5]), instrumentoIds: [instrumentoId] });
    const dia2 = (await vigentes())[1]!;
    expect([dia2.estado, dia2.fuenteReferencia]).toEqual(["VERIFICADO", "certificacion:2024-03-13"]);
    await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 110]), instrumentoIds: [instrumentoId] });
    expect((await vigentes())[1]!.estado).toBe("NO_VERIFICADO");
  });

  it("si Yahoo falla, no escribe nada y lo informa", async () => {
    const antes = await db.precioCierre.count({ where: { instrumentoId } });
    const r = await actualizarPrecios(db, { desde, hasta, buscar: async () => ({ ok: false, status: 503, json: async () => ({}) }), instrumentoIds: [instrumentoId] });
    expect(r.fallidas).toEqual([{ instrumentoId, codigo: "YAHOO_HTTP_503" }]);
    expect(await db.precioCierre.count({ where: { instrumentoId } })).toBe(antes);
  });
});
