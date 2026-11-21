// INV-SPEC-16: el detalle de un fallo expone solo nombre y código, nunca el mensaje (puede traer valores).
// Además, guardarCierre ante corridas simultáneas, con una base falsa (sin PostgreSQL) y un Yahoo falso (sin red).
// Datos inventados.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { actualizarPrecios, detalleDeError, MAX_INTENTOS_GUARDADO } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";

describe("detalleDeError", () => {
  it("incluye el nombre y el código de Prisma, y nunca el mensaje", () => {
    const e = Object.assign(new Error("valor 123456 en la consulta"), { name: "PrismaClientKnownRequestError", code: "P2002" });
    const d = detalleDeError(e);
    expect(d).toBe("PrismaClientKnownRequestError P2002");
    expect(d).not.toContain("123456");
  });
  it("sin código, solo el nombre", () => {
    expect(detalleDeError(new TypeError("secreto"))).toBe("TypeError");
  });
  it("un valor que no es Error no filtra contenido", () => {
    expect(detalleDeError("texto 999")).toBe("error");
    expect(detalleDeError(null)).toBe("error");
  });
});

const SECRETO = "valor 654321 en la consulta";
const errorPrisma = (code: string) => Object.assign(new Error(SECRETO), { name: "PrismaClientKnownRequestError", code });
const DIA = new Date("2024-03-12T00:00:00Z");
const T = Date.UTC(2024, 2, 12, 14, 30) / 1000;
const ESPECIE = "esp-ficticia";
const OTRA_CORRIDA = new Date("2024-03-12T22:00:00Z");
const yahoo = (cierre: number): Buscar => async () =>
  new Response(JSON.stringify({ chart: { result: [{ meta: { currency: "COP" }, timestamp: [T], indicators: { quote: [{ close: [cierre] }] } }] } }));

interface Fila { id: string; instrumentoId: string; fecha: Date; precio: Prisma.Decimal; fuente: string; reemplazadoEn: Date | null }
interface Ganchos {
  antesDeReemplazar?: (filas: Fila[], intento: number) => void; // otra corrida actúa entre la lectura y el reemplazo
  antesDeCrear?: (filas: Fila[], intento: number) => void; // otra corrida guarda antes que esta, o falla la inserción
}
type Donde = { id?: string; instrumentoId?: string; fecha?: Date; fuente?: string; reemplazadoEn?: null };

/**
 * Base falsa con lo que usa actualizarPrecios. `$transaction` corre la función sobre la misma base, sin
 * deshacer: cada escenario falla antes de que esta corrida escriba, así que no hay nada que deshacer.
 */
function baseFalsa(previas: readonly Fila[], ganchos: Ganchos = {}) {
  const filas: Fila[] = previas.map((f) => ({ ...f }));
  const llamadas = { crear: 0, certificacion: 0, reemplazos: 0 };
  const vigenteDe = (w: Donde) => (f: Fila) => f.instrumentoId === w.instrumentoId && f.fecha.getTime() === w.fecha?.getTime() && f.fuente === w.fuente && f.reemplazadoEn === null;
  const reemplazar = (w: Donde, cuando: Date): number => {
    llamadas.reemplazos += 1;
    ganchos.antesDeReemplazar?.(filas, llamadas.reemplazos);
    const blanco = filas.filter((f) => f.id === w.id && (!("reemplazadoEn" in w) || f.reemplazadoEn === null));
    for (const f of blanco) f.reemplazadoEn = cuando;
    return blanco.length;
  };
  const precioCierre = {
    findFirst: async ({ where }: { where: Donde }) => filas.find(vigenteDe(where)) ?? null,
    update: async ({ where, data }: { where: Donde; data: { reemplazadoEn: Date } }) => (reemplazar(where, data.reemplazadoEn), filas.find((f) => f.id === where.id)),
    updateMany: async ({ where, data }: { where: Donde; data: { reemplazadoEn: Date } }) => ({ count: reemplazar(where, data.reemplazadoEn) }),
    create: async ({ data }: { data: Omit<Fila, "id" | "reemplazadoEn"> }) => {
      llamadas.crear += 1;
      ganchos.antesDeCrear?.(filas, llamadas.crear);
      if (filas.some(vigenteDe(data))) throw errorPrisma("P2002");
      const fila = { ...data, precio: new Prisma.Decimal(data.precio), id: `p${filas.length + 1}`, reemplazadoEn: null };
      filas.push(fila);
      return fila;
    },
    count: async () => 0,
  };
  const db = {
    instrumento: { findMany: async () => [{ id: ESPECIE, nemotecnico: "FICT1" }] },
    calendarioBvc: { findMany: async () => [] },
    simboloPrecio: { findFirst: async () => null },
    certificacionPosicion: { findFirst: async () => (llamadas.certificacion++, null) },
    precioCierre,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db: db as unknown as PrismaClient, filas, llamadas };
}

const fila = (id: string, precio: number, reemplazadoEn: Date | null = null): Fila => ({ id, instrumentoId: ESPECIE, fecha: DIA, precio: new Prisma.Decimal(precio), fuente: "yahoo", reemplazadoEn });
const correr = (db: PrismaClient, cierre: number) => actualizarPrecios(db, { desde: DIA, hasta: DIA, buscar: yahoo(cierre), instrumentoIds: [ESPECIE] });
const vigentes = (filas: readonly Fila[]) => filas.filter((f) => f.reemplazadoEn === null).map((f) => [f.id, f.precio.toString()]);

describe("actualizarPrecios · guardado ante corridas simultáneas (base falsa)", () => {
  it("si otra corrida reemplaza el vigente entre la lectura y el reemplazo, se relee: sin error y sin pisar su historia", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500)], {
      antesDeReemplazar: (fs, intento) => {
        if (intento > 1) return;
        fs.find((f) => f.id === "v1")!.reemplazadoEn = OTRA_CORRIDA;
        fs.push(fila("w1", 600));
      },
    });
    const r = await correr(db, 600);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, fallidas: [] });
    expect(filas.find((f) => f.id === "v1")!.reemplazadoEn).toBe(OTRA_CORRIDA);
    expect(vigentes(filas)).toEqual([["w1", "600"]]);
  });

  it("si el vigente deja de serlo sin sucesor entre la lectura y el reemplazo, se relee y el cierre cuenta como nuevo", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500)], {
      antesDeReemplazar: (fs, intento) => {
        if (intento === 1) fs.find((f) => f.id === "v1")!.reemplazadoEn = OTRA_CORRIDA;
      },
    });
    const r = await correr(db, 600);
    expect(r).toMatchObject({ cierresNuevos: 1, cierresRevisados: 0, fallidas: [] });
    expect(filas.find((f) => f.id === "v1")!.reemplazadoEn).toBe(OTRA_CORRIDA);
    expect(vigentes(filas).map(([, precio]) => precio)).toEqual(["600"]);
  });

  it("un P2002 al insertar (otra corrida ya guardó ese cierre) se reintenta releyendo y no es error", async () => {
    const { db, filas, llamadas } = baseFalsa([], {
      antesDeCrear: (fs, intento) => {
        if (intento === 1) fs.push(fila("w1", 500));
      },
    });
    const r = await correr(db, 500);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, fallidas: [] });
    expect(llamadas.crear).toBe(1);
    expect(vigentes(filas)).toEqual([["w1", "500"]]);
  });

  it(`un P2002 que persiste se rinde a los ${MAX_INTENTOS_GUARDADO} intentos con GUARDADO_ERROR, nombre y código, sin el mensaje`, async () => {
    const { db, llamadas } = baseFalsa([], {
      antesDeCrear: () => {
        throw errorPrisma("P2002");
      },
    });
    const r = await correr(db, 500);
    expect(r.fallidas).toEqual([{ instrumentoId: ESPECIE, codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P2002", barrasGuardadas: 0, barrasFallidas: 1 }]);
    expect(llamadas.crear).toBe(MAX_INTENTOS_GUARDADO);
    expect(JSON.stringify(r)).not.toContain("654321");
  });

  it(`si otra corrida reemplaza el vigente en cada intento, se rinde a los ${MAX_INTENTOS_GUARDADO} con GUARDADO_ERROR «ConflictoConcurrente»`, async () => {
    const { db, llamadas } = baseFalsa([fila("v1", 500)], {
      antesDeReemplazar: (fs, intento) => {
        for (const f of fs) if (f.reemplazadoEn === null) f.reemplazadoEn = OTRA_CORRIDA;
        fs.push(fila(`w${intento}`, 700 + intento));
      },
    });
    const r = await correr(db, 600);
    expect(r.fallidas).toEqual([{ instrumentoId: ESPECIE, codigo: "GUARDADO_ERROR", detalle: "ConflictoConcurrente", barrasGuardadas: 0, barrasFallidas: 1 }]);
    expect(llamadas).toMatchObject({ reemplazos: MAX_INTENTOS_GUARDADO, crear: 0 });
  });

  it("un error que no es conflicto no se reintenta", async () => {
    const { db, llamadas } = baseFalsa([], {
      antesDeCrear: () => {
        throw errorPrisma("P2020");
      },
    });
    const r = await correr(db, 500);
    expect(r.fallidas).toEqual([{ instrumentoId: ESPECIE, codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P2020", barrasGuardadas: 0, barrasFallidas: 1 }]);
    expect(llamadas.crear).toBe(1);
  });

  it("un cierre igual al vigente no se toca ni consulta la certificación", async () => {
    const { db, filas, llamadas } = baseFalsa([fila("v1", 500)]);
    const r = await correr(db, 500);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, fallidas: [] });
    expect(llamadas).toMatchObject({ crear: 0, certificacion: 0, reemplazos: 0 });
    expect(vigentes(filas)).toEqual([["v1", "500"]]);
  });
});
