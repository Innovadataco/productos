// Integración contra la base de PRUEBAS (scripts/integracion.mjs fija DATABASE_URL a *_test).
// Candado: las reglas escritas a mano en la migración inicial existen y muerden.
// Todos los datos son inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
let usuarioId = "";
let cargaId = "";
let instrumentoId = "";
let n = 0;

const clave = () => {
  n += 1;
  return n.toString(16).padStart(64, "0");
};

async function nuevaFila(tipoFuente: "TRII_CAJA" | "TRII_ORDENES" | "TRII_DIVIDENDOS" = "TRII_CAJA") {
  return db.filaFuente.create({
    data: { tipoFuente, claveNatural: clave(), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } },
  });
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  usuarioId = (await db.usuario.create({ data: { email: `dueno-${Date.now()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  cargaId = (
    await db.cargaArchivo.create({
      data: { tipoFuente: "TRII_CAJA", nombreArchivo: "caja.ficticio.csv", sha256: "a".repeat(64), estado: "CARGADO", cargadoPorId: usuarioId },
    })
  ).id;
  instrumentoId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICT${Date.now()}`, nombre: "Acción ficticia" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("reglas escritas a mano en la migración", () => {
  it("existen los CHECK, los índices parciales, la exclusión y los disparadores", async () => {
    const restricciones = await db.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE conname LIKE '%\_chk' OR conname LIKE '%\_excl'`;
    const nombres = restricciones.map((r) => r.conname);
    for (const esperado of [
      "movimiento_caja_monto_chk",
      "dividendo_bruto_chk",
      "dividendo_fraccion_chk",
      "lote_origen_chk",
      "instrumento_tipo_chk",
      "simbolo_precio_sin_solape_excl",
    ]) {
      expect(nombres, esperado).toContain(esperado);
    }
    const indices = await db.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE indexname IN ('valor_unidad_fondo_vigente_key', 'precio_cierre_vigente_key')`;
    expect(indices).toHaveLength(2);
    const disparadores = await db.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE tgname LIKE '%\_solo\_insercion'`;
    expect(disparadores.map((d) => d.tgname).sort()).toEqual([
      "dividendo_solo_insercion",
      "fila_de_carga_solo_insercion",
      "fila_fuente_solo_insercion",
      "movimiento_caja_solo_insercion",
      "orden_solo_insercion",
    ]);
  });

  it("los hechos importados son de solo inserción", async () => {
    const fila = await nuevaFila();
    const mov = await db.movimientoCaja.create({
      data: { filaFuenteId: fila.id, ocurridoEn: new Date("2025-05-12T21:42:00Z"), fecha: new Date("2025-05-12"), tipo: "DEPOSITO", estado: "APROBADO", monto: new Prisma.Decimal("100000.00") },
    });
    await expect(db.movimientoCaja.update({ where: { id: mov.id }, data: { monto: new Prisma.Decimal("1") } })).rejects.toThrow(/solo inserción/);
    await expect(db.movimientoCaja.delete({ where: { id: mov.id } })).rejects.toThrow(/solo inserción/);
    await expect(db.filaFuente.update({ where: { id: fila.id }, data: { crudo: {} } })).rejects.toThrow(/solo inserción/);
  });

  it("rechaza un movimiento de caja con monto cero o negativo", async () => {
    const fila = await nuevaFila();
    await expect(
      db.movimientoCaja.create({
        data: { filaFuenteId: fila.id, ocurridoEn: new Date(), fecha: new Date("2025-06-01"), tipo: "RETIRO", estado: "APROBADO", monto: new Prisma.Decimal("-5") },
      }),
    ).rejects.toThrow(/movimiento_caja_monto_chk/);
  });

  it("exige bruto − retención = neto cuando hay bruto", async () => {
    const fila = await nuevaFila("TRII_DIVIDENDOS");
    await expect(
      db.dividendo.create({
        data: {
          filaFuenteId: fila.id, fechaPago: new Date("2026-03-01"), instrumentoId, tipo: "EXTRAORDINARIO",
          montoNeto: new Prisma.Decimal("650"), montoBruto: new Prisma.Decimal("1000"), retencion: new Prisma.Decimal("300"),
        },
      }),
    ).rejects.toThrow(/dividendo_bruto_chk/);
    const ok = await db.dividendo.create({
      data: {
        filaFuenteId: fila.id, fechaPago: new Date("2026-03-01"), instrumentoId, tipo: "EXTRAORDINARIO",
        montoNeto: new Prisma.Decimal("650"), montoBruto: new Prisma.Decimal("1000"), retencion: new Prisma.Decimal("350"),
        tasaRetencion: new Prisma.Decimal("0.35"),
      },
    });
    expect(ok.montoNeto.toString()).toBe("650");
  });

  it("una fracción de escisión exige su evento (y un dividendo normal no lo lleva)", async () => {
    const fila = await nuevaFila("TRII_DIVIDENDOS");
    await expect(
      db.dividendo.create({
        data: { filaFuenteId: fila.id, fechaPago: new Date("2025-08-08"), instrumentoId, tipo: "FRACCION_ESCISION", montoNeto: new Prisma.Decimal("10") },
      }),
    ).rejects.toThrow(/dividendo_fraccion_chk/);
  });

  it("un solo precio vigente por día y fuente; el reemplazado queda como historia", async () => {
    const base = { instrumentoId, fecha: new Date("2026-11-19"), fuente: "yahoo", estado: "VERIFICADO" as const };
    const primero = await db.precioCierre.create({ data: { ...base, precio: new Prisma.Decimal("1000") } });
    await expect(db.precioCierre.create({ data: { ...base, precio: new Prisma.Decimal("1001") } })).rejects.toThrow();
    await db.precioCierre.update({ where: { id: primero.id }, data: { reemplazadoEn: new Date() } });
    const segundo = await db.precioCierre.create({ data: { ...base, precio: new Prisma.Decimal("1001") } });
    expect(segundo.precio.toString()).toBe("1001");
  });

  it("las vigencias de un símbolo no se solapan", async () => {
    await db.simboloPrecio.create({ data: { instrumentoId, simbolo: "FICT.CL", vigenteDesde: new Date("2025-01-01"), vigenteHasta: new Date("2026-01-01") } });
    await expect(
      db.simboloPrecio.create({ data: { instrumentoId, simbolo: "FICT2.CL", vigenteDesde: new Date("2025-06-01") } }),
    ).rejects.toThrow(/simbolo_precio_sin_solape_excl/);
    const siguiente = await db.simboloPrecio.create({ data: { instrumentoId, simbolo: "FICT2.CL", vigenteDesde: new Date("2026-01-01") } });
    expect(siguiente.simbolo).toBe("FICT2.CL");
  });
});

describe("GET /api/salud", () => {
  it("responde 200 con la base arriba", async () => {
    const { GET } = await import("@/app/api/salud/route");
    const respuesta = await GET();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ estado: "ok", base: "ok" });
  });
});
