// INV-SPEC-16: el detalle de un fallo expone solo nombre y código, nunca el mensaje (puede traer valores).
// Además, guardarCierre ante corridas simultáneas y la re-verificación de un cierre igual al vigente,
// con una base falsa (sin PostgreSQL) y un Yahoo falso (sin red). Datos inventados.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { actualizarPrecios, detalleDeError, MAX_INTENTOS_GUARDADO, mismaVerificacion } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";

describe("mismaVerificacion", () => {
  const D = (v: string) => new Prisma.Decimal(v);
  const verificado = { estado: "VERIFICADO" as const, fuenteReferencia: "certificacion:2024-03-12", precioReferencia: D("502"), desviacionPct: D("0") };
  const sinVerificar = { estado: "NO_VERIFICADO" as const, fuenteReferencia: null, precioReferencia: null, desviacionPct: null };

  it("compara los Decimal por valor, no por texto: 0 = 0.000000 y 502 = 502.000000", () => {
    expect(mismaVerificacion(verificado, { ...verificado, precioReferencia: D("502.000000"), desviacionPct: D("0.000000") })).toBe(true);
  });
  it("null solo es igual a null", () => {
    expect(mismaVerificacion(sinVerificar, { ...sinVerificar })).toBe(true);
    expect(mismaVerificacion({ ...verificado, desviacionPct: null }, verificado)).toBe(false);
    expect(mismaVerificacion(verificado, { ...verificado, precioReferencia: null })).toBe(false);
  });
  it("otro precio de referencia o desviación: distinta", () => {
    expect(mismaVerificacion(verificado, { ...verificado, precioReferencia: D("501") })).toBe(false);
    expect(mismaVerificacion(verificado, { ...verificado, desviacionPct: D("0.000001") })).toBe(false);
  });
  it("otro estado u otra fuente de referencia: distinta", () => {
    expect(mismaVerificacion(verificado, { ...verificado, estado: "NO_VERIFICADO" })).toBe(false);
    expect(mismaVerificacion(verificado, { ...verificado, fuenteReferencia: "certificacion:2024-03-13" })).toBe(false);
  });
});

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

interface Verificacion {
  estado: "VERIFICADO" | "NO_VERIFICADO";
  fuenteReferencia: string | null;
  precioReferencia: Prisma.Decimal | null;
  desviacionPct: Prisma.Decimal | null;
}
interface Fila extends Verificacion { id: string; instrumentoId: string; fecha: Date; precio: Prisma.Decimal; fuente: string; reemplazadoEn: Date | null }
/** Posición de una certificación de A&V (ficticia) de la especie: su fecha de corte y su precio de valoración. */
interface Referencia { fechaCorte: Date; precioValoracion: Prisma.Decimal }
interface Ganchos {
  antesDeReemplazar?: (filas: Fila[], intento: number) => void; // otra corrida actúa entre la lectura y el reemplazo
  antesDeCrear?: (filas: Fila[], intento: number) => void; // otra corrida guarda antes que esta, o falla la inserción
}
type Donde = { id?: string; instrumentoId?: string; fecha?: Date; fuente?: string; reemplazadoEn?: null };

/**
 * Base falsa con lo que usa actualizarPrecios. `$transaction` corre la función sobre la misma base, sin
 * deshacer: cada escenario falla antes de que esta corrida escriba, así que no hay nada que deshacer.
 */
function baseFalsa(previas: readonly Fila[], ganchos: Ganchos = {}, referencia: Referencia | null = null) {
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
    // Una fila ficticia de 2024: el año queda cubierto (sin calendario, las barras se omitirían por SIN_CALENDARIO).
    calendarioBvc: { findMany: async () => [{ dia: new Date("2024-01-01T00:00:00Z"), esHabil: false }] },
    simboloPrecio: { findFirst: async () => null },
    certificacionPosicion: {
      findFirst: async ({ where }: { where: { instrumentoId: string; certificacion: { fechaCorte: Date } } }) => {
        llamadas.certificacion += 1;
        const coincide = referencia && where.instrumentoId === ESPECIE && where.certificacion.fechaCorte.getTime() === referencia.fechaCorte.getTime();
        return coincide ? { precioValoracion: referencia.precioValoracion, certificacion: { fechaCorte: referencia.fechaCorte } } : null;
      },
    },
    precioCierre,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db: db as unknown as PrismaClient, filas, llamadas };
}

const SIN_VERIFICAR: Verificacion = { estado: "NO_VERIFICADO", fuenteReferencia: null, precioReferencia: null, desviacionPct: null };
const fila = (id: string, precio: number, reemplazadoEn: Date | null = null, verificacion: Verificacion = SIN_VERIFICAR): Fila => ({
  id, instrumentoId: ESPECIE, fecha: DIA, precio: new Prisma.Decimal(precio), fuente: "yahoo", reemplazadoEn, ...verificacion,
});
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

  it("un cierre igual al vigente y con la misma verificación no se escribe (sí consulta la certificación)", async () => {
    const { db, filas, llamadas } = baseFalsa([fila("v1", 500)]);
    const r = await correr(db, 500);
    expect(llamadas).toMatchObject({ crear: 0, certificacion: 1, reemplazos: 0 });
    expect(vigentes(filas)).toEqual([["v1", "500"]]);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0, fallidas: [] });
  });
});

describe("actualizarPrecios · re-verificación de un cierre igual al vigente (base falsa)", () => {
  const D = (v: string) => new Prisma.Decimal(v);
  const certificada = (precioValoracion: string): Referencia => ({ fechaCorte: DIA, precioValoracion: D(precioValoracion) });
  /** Lo que guardaría la carga con la certificación del día a 502: 2/502 = 0,398406 %, dentro del 1 %. */
  const VERIFICADO_A_502: Verificacion = { estado: "VERIFICADO", fuenteReferencia: "certificacion:2024-03-12", precioReferencia: D("502"), desviacionPct: D("0.398406") };
  const verificacionDe = (f: Fila) => [f.estado, f.fuenteReferencia, f.precioReferencia?.toString() ?? null, f.desviacionPct?.toString() ?? null];

  it("NO_VERIFICADO que ahora cuadra con la certificación del día: se versiona como VERIFICADO y el anterior queda como historia", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500)], {}, certificada("502"));
    const r = await correr(db, 500);
    expect(filas.find((f) => f.id === "v1")!.reemplazadoEn).toBeInstanceOf(Date);
    const vigente = filas.filter((f) => f.reemplazadoEn === null);
    expect(vigente.map((f) => f.precio.toString())).toEqual(["500"]);
    expect(verificacionDe(vigente[0]!)).toEqual(["VERIFICADO", "certificacion:2024-03-12", "502", "0.398406"]);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 1, fallidas: [] });
  });

  it("VERIFICADO cuya certificación ya no está (carga revertida): se versiona como NO_VERIFICADO sin referencia", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500, null, VERIFICADO_A_502)], {}, null);
    const r = await correr(db, 500);
    expect(filas.filter((f) => f.reemplazadoEn === null).map(verificacionDe)).toEqual([["NO_VERIFICADO", null, null, null]]);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 1, fallidas: [] });
  });

  it("VERIFICADO que deja de cuadrar (la certificación del día quedó a más del 1 %): se versiona como NO_VERIFICADO con la referencia nueva", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500, null, VERIFICADO_A_502)], {}, certificada("520"));
    const r = await correr(db, 500);
    // 20/520 = 3,846154 %.
    expect(filas.filter((f) => f.reemplazadoEn === null).map(verificacionDe)).toEqual([["NO_VERIFICADO", "certificacion:2024-03-12", "520", "3.846154"]]);
    expect(r).toMatchObject({ cierresReverificados: 1, fallidas: [] });
  });

  it("mismo estado pero otra referencia (la certificación del día cambió dentro del 1 %): se versiona con la referencia nueva", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500, null, VERIFICADO_A_502)], {}, certificada("501"));
    const r = await correr(db, 500);
    // 1/501 = 0,199601 %.
    expect(filas.filter((f) => f.reemplazadoEn === null).map(verificacionDe)).toEqual([["VERIFICADO", "certificacion:2024-03-12", "501", "0.199601"]]);
    expect(r).toMatchObject({ cierresReverificados: 1, fallidas: [] });
  });

  it("un VERIFICADO que sigue cuadrando con la misma referencia no se escribe", async () => {
    const { db, filas, llamadas } = baseFalsa([fila("v1", 500, null, VERIFICADO_A_502)], {}, certificada("502"));
    const r = await correr(db, 500);
    expect(llamadas).toMatchObject({ crear: 0, reemplazos: 0 });
    expect(vigentes(filas)).toEqual([["v1", "500"]]);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0, fallidas: [] });
  });

  it("certificación con valoración 0: NO_VERIFICADO con la referencia y sin desviación (nunca Infinity)", async () => {
    const { db, filas } = baseFalsa([], {}, certificada("0"));
    const r = await correr(db, 500);
    expect(filas.map(verificacionDe)).toEqual([["NO_VERIFICADO", "certificacion:2024-03-12", "0", null]]);
    expect(r).toMatchObject({ cierresNuevos: 1, fallidas: [] });
  });

  it("certificación con valoración negativa: nunca VERIFICADO", async () => {
    const { db, filas } = baseFalsa([], {}, certificada("-500"));
    await correr(db, 500);
    expect(filas.map(verificacionDe)).toEqual([["NO_VERIFICADO", "certificacion:2024-03-12", "-500", null]]);
  });

  it("desviación de 1000 % (no cabe en Decimal(9,6)): NO_VERIFICADO sin desviación; 999,999999 % sí se guarda", async () => {
    const fuera = baseFalsa([], {}, certificada("100"));
    await correr(fuera.db, 1100);
    expect(fuera.filas.map(verificacionDe)).toEqual([["NO_VERIFICADO", "certificacion:2024-03-12", "100", null]]);
    const borde = baseFalsa([], {}, certificada("100"));
    await correr(borde.db, 1099.999999);
    expect(borde.filas.map(verificacionDe)).toEqual([["NO_VERIFICADO", "certificacion:2024-03-12", "100", "999.999999"]]);
  });

  it("un VERIFICADO cuya certificación queda en 0 se re-verifica a NO_VERIFICADO sin desviación (no queda VERIFICADO)", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500, null, VERIFICADO_A_502)], {}, certificada("0"));
    const r = await correr(db, 500);
    expect(filas.filter((f) => f.reemplazadoEn === null).map(verificacionDe)).toEqual([["NO_VERIFICADO", "certificacion:2024-03-12", "0", null]]);
    expect(r).toMatchObject({ cierresReverificados: 1, fallidas: [] });
  });

  it("si otra corrida ya re-verificó entre la lectura y el reemplazo, se relee: sin cambios, sin error y sin pisar su versión", async () => {
    const { db, filas } = baseFalsa([fila("v1", 500)], {
      antesDeReemplazar: (fs, intento) => {
        if (intento > 1) return;
        fs.find((f) => f.id === "v1")!.reemplazadoEn = OTRA_CORRIDA;
        fs.push(fila("w1", 500, null, VERIFICADO_A_502));
      },
    }, certificada("502"));
    const r = await correr(db, 500);
    expect(filas.find((f) => f.id === "v1")!.reemplazadoEn).toBe(OTRA_CORRIDA);
    expect(vigentes(filas)).toEqual([["w1", "500"]]);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0, fallidas: [] });
  });
});
