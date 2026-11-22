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
// Prefijo por corrida: las filas no se pueden borrar (solo inserción), así que las claves no deben repetirse.
const corrida = Date.now().toString(16);

const clave = () => {
  n += 1;
  return `${corrida}-${n}`.padStart(64, "0");
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
      "orden_montos_chk",
      "orden_aprobada_precio_chk",
      "lote_cantidad_chk",
      "asignacion_venta_cantidad_chk",
      "dividendo_neto_chk",
      "ajuste_caja_fraccion_chk",
      "movimiento_fondo_unidades_chk",
      "movimiento_fondo_monto_chk",
      "movimiento_fondo_aporte_enlace_chk",
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
      SELECT indexname FROM pg_indexes WHERE indexname IN ('valor_unidad_fondo_vigente_key', 'precio_cierre_vigente_key', 'movimiento_fondo_constitucion_key')`;
    expect(indices).toHaveLength(3);
    const disparadores = await db.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE tgname LIKE '%\_solo\_insercion'`;
    expect(disparadores.map((d) => d.tgname).sort()).toEqual([
      "ajuste_caja_solo_insercion",
      "certificacion_posicion_solo_insercion",
      "certificacion_solo_insercion",
      "conciliacion_solo_insercion",
      "control_conciliacion_solo_insercion",
      "decision_solo_insercion",
      "dividendo_solo_insercion",
      "enlace_decision_orden_solo_insercion",
      "fila_de_carga_solo_insercion",
      "fila_fuente_solo_insercion",
      "intento_ingreso_solo_insercion",
      "movimiento_caja_solo_insercion",
      "movimiento_fondo_solo_insercion",
      "orden_solo_insercion",
      "plan_version_solo_insercion",
      "regla_plan_solo_insercion",
      "rendimiento_fondo_solo_insercion",
      "resumen_ia_solo_insercion",
    ]);
  });

  it("los hechos importados son de solo inserción", async () => {
    const fila = await nuevaFila();
    const mov = await db.movimientoCaja.create({
      data: { filaFuenteId: fila.id, ocurridoEn: new Date("2024-03-14T20:27:00Z"), fecha: new Date("2024-03-14"), tipo: "DEPOSITO", estado: "APROBADO", monto: new Prisma.Decimal("100000.00") },
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

  // Desde la fase C (C1, migración *_datos_oficiales) las columnas viejas son obsoletas y van nulas: lo que cumple
  // bruto − retención = neto ya no entra (lo frena dividendo_viejas_nulas_chk, que se evalúa después por su nombre).
  it("exige bruto − retención = neto cuando hay bruto, y desde C1 ningún dividendo lleva bruto", async () => {
    const fila = await nuevaFila("TRII_DIVIDENDOS");
    await expect(
      db.dividendo.create({
        data: {
          filaFuenteId: fila.id, fechaPago: new Date("2026-03-01"), instrumentoId, tipo: "EXTRAORDINARIO",
          montoNeto: new Prisma.Decimal("650"), montoBruto: new Prisma.Decimal("1000"), retencion: new Prisma.Decimal("300"),
        },
      }),
    ).rejects.toThrow(/dividendo_bruto_chk/);
    await expect(
      db.dividendo.create({
        data: {
          filaFuenteId: fila.id, fechaPago: new Date("2026-03-01"), instrumentoId, tipo: "EXTRAORDINARIO",
          montoNeto: new Prisma.Decimal("650"), montoBruto: new Prisma.Decimal("1000"), retencion: new Prisma.Decimal("350"),
          tasaRetencion: new Prisma.Decimal("0.35"),
        },
      }),
    ).rejects.toThrow(/dividendo_viejas_nulas_chk/);
    const ok = await db.dividendo.create({
      data: { filaFuenteId: fila.id, fechaPago: new Date("2026-03-01"), instrumentoId, tipo: "EXTRAORDINARIO", montoNeto: new Prisma.Decimal("650") },
    });
    expect(ok.montoNeto.toString()).toBe("650");
  });

  it("una fracción de escisión exige su evento (y un dividendo normal no lo lleva)", async () => {
    const fila = await nuevaFila("TRII_DIVIDENDOS");
    await expect(
      db.dividendo.create({
        data: { filaFuenteId: fila.id, fechaPago: new Date("2024-03-08"), instrumentoId, tipo: "FRACCION_ESCISION", montoNeto: new Prisma.Decimal("10") },
      }),
    ).rejects.toThrow(/dividendo_fraccion_chk/);
  });

  it("un solo precio vigente por día y fuente; el reemplazado queda como historia", async () => {
    const base = { instrumentoId, fecha: new Date("2024-11-19"), fuente: "yahoo", estado: "VERIFICADO" as const };
    const primero = await db.precioCierre.create({ data: { ...base, precio: new Prisma.Decimal("1000") } });
    await expect(db.precioCierre.create({ data: { ...base, precio: new Prisma.Decimal("1001") } })).rejects.toThrow(
      /Unique constraint failed|precio_cierre_vigente_key/,
    );
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

describe("reglas de coherencia con casos legítimos y prohibidos", () => {
  async function nuevaOrden(estado: "APROBADO" | "CANCELADO", precio: string, lado: "COMPRA" | "VENTA" = "COMPRA") {
    const fila = await nuevaFila("TRII_ORDENES");
    const cero = new Prisma.Decimal("0");
    return db.orden.create({
      data: {
        filaFuenteId: fila.id, ejecutadaEn: new Date(), fechaOperacion: new Date("2024-04-15"), fechaLiquidacion: new Date("2024-04-17"),
        instrumentoId, lado, estado, cantidadCompletada: estado === "APROBADO" ? 10n : 0n,
        precioUnitario: new Prisma.Decimal(precio), totalInvertido: estado === "APROBADO" ? new Prisma.Decimal("1000") : cero,
        comision: cero, totalEstimado: estado === "APROBADO" ? new Prisma.Decimal("1000") : cero,
      },
    });
  }

  it("una orden cancelada puede venir sin precio; una aprobada no", async () => {
    await expect(nuevaOrden("CANCELADO", "0")).resolves.toBeTruthy();
    await expect(nuevaOrden("APROBADO", "0")).rejects.toThrow(/orden_aprobada_precio_chk/);
  });

  it("un lote de compra lleva orden; uno de escisión lleva evento y lote madre", async () => {
    const compra = await nuevaOrden("APROBADO", "100");
    const base = { instrumentoId, fechaCompra: new Date("2024-04-15"), fechaLiquidacion: new Date("2024-04-17"), cantidad: 10n, costoUnitario: new Prisma.Decimal("100"), costoTotal: new Prisma.Decimal("1000") };
    const madre = await db.lote.create({ data: { ...base, origen: "COMPRA", ordenId: compra.id, fuenteCosto: "AV_PORTAL" } });
    const destino = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICTB${Date.now()}`, nombre: "Destino ficticio" } });
    const evento = await db.eventoCorporativo.create({ data: { tipo: "ESCISION", fecha: new Date("2024-02-12"), origenId: instrumentoId, destinoId: destino.id } });
    // Escisión sin lote madre: prohibido.
    await expect(
      db.lote.create({ data: { ...base, instrumentoId: destino.id, origen: "ESCISION", eventoId: evento.id, fuenteCosto: "AV_PORTAL" } }),
    ).rejects.toThrow(/lote_origen_chk/);
    // Compra sin orden: prohibido.
    await expect(db.lote.create({ data: { ...base, origen: "COMPRA", fuenteCosto: "AV_PORTAL" } })).rejects.toThrow(/lote_origen_chk/);
    // Escisión completa: permitido.
    const hijo = await db.lote.create({
      data: { ...base, instrumentoId: destino.id, origen: "ESCISION", eventoId: evento.id, loteOrigenId: madre.id, fuenteCosto: "AV_PORTAL" },
    });
    expect(hijo.loteOrigenId).toBe(madre.id);
  });

  it("una acción exige nemotécnico y un fondo exige código de la SFC", async () => {
    await expect(db.instrumento.create({ data: { tipo: "ACCION", nombre: "Sin nemotécnico" } })).rejects.toThrow(/instrumento_tipo_chk/);
    await expect(db.instrumento.create({ data: { tipo: "FIC", nombre: "Fondo sin código" } })).rejects.toThrow(/instrumento_tipo_chk/);
  });

  it("un ajuste de caja puede ser negativo, pero la fracción de escisión exige su evento", async () => {
    const base = { fecha: new Date("2024-04-15"), fuente: "MANUAL" as const, motivo: "caso ficticio", creadoPorId: usuarioId };
    await expect(db.ajusteCaja.create({ data: { ...base, monto: new Prisma.Decimal("-500"), categoria: "APORTE_FIC" } })).resolves.toBeTruthy();
    await expect(db.ajusteCaja.create({ data: { ...base, monto: new Prisma.Decimal("50"), categoria: "FRACCION_ESCISION" } })).rejects.toThrow(
      /ajuste_caja_fraccion_chk/,
    );
  });

  it("la reversión de una carga es la única salida de la regla de solo inserción", async () => {
    const fila = await nuevaFila();
    await expect(db.filaFuente.delete({ where: { id: fila.id } })).rejects.toThrow(/solo inserción/);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
      await tx.filaFuente.delete({ where: { id: fila.id } });
    });
    expect(await db.filaFuente.findUnique({ where: { id: fila.id } })).toBeNull();
    // Fuera de esa transacción, la regla vuelve a morder.
    const otra = await nuevaFila();
    await expect(db.filaFuente.delete({ where: { id: otra.id } })).rejects.toThrow(/solo inserción/);
  });
});

describe("GET /api/salud", () => {
  it("responde 200 con la base arriba, y solo estado y versión (es pública)", async () => {
    const { GET } = await import("@/app/api/salud/route");
    const respuesta = await GET();
    expect(respuesta.status).toBe(200);
    expect(Object.keys(await respuesta.json()).sort()).toEqual(["estado", "version"]);
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});
