// actualizarFondo con una base falsa (sin PostgreSQL) y una SFC falsa (sin red): guardado por lotes,
// reintento ante carreras y aislamiento de fallos. Datos inventados.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { actualizarFondo, MAX_INTENTOS, TAMANO_LOTE } from "@/fondo/actualizar";
import type { BuscarSfc } from "@/fondo/sfc";

const MS_DIA = 86_400_000;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const desde = dia("2024-03-10");
const hasta = dia("2024-03-12");
const FONDOS = [{ id: "fondo-a", codigoFic: "999001" }, { id: "fondo-b", codigoFic: "999002" }];
const SECRETO = "valor 123456 en la consulta";
const errorPrisma = () => Object.assign(new Error(SECRETO), { name: "PrismaClientKnownRequestError", code: "P2002" });

/** SFC falsa: `dias` días seguidos desde `inicio`, valor 10000 + i. */
const sfc = (inicio = desde, dias = 3): BuscarSfc => async (url) => {
  const codigo = new URL(url).searchParams.get("codigo_negocio");
  const filas = Array.from({ length: dias }, (_, i) => ({
    fecha_corte: `${iso(new Date(inicio.getTime() + i * MS_DIA))}T00:00:00.000`, codigo_negocio: codigo, tipo_participacion: "901", valor_unidad_operaciones: String(10000 + i),
  }));
  return new Response(JSON.stringify(filas));
};

interface Fila { id: string; fondoId: string; fechaValor: Date; valorUnidad: Prisma.Decimal; valorFondo: Prisma.Decimal | null; reemplazadoEn: Date | null }
interface Fallas {
  crear?: (fondoId: string, fechas: readonly string[], intento: number) => boolean;
  crearGanaOtra?: boolean; // antes del P2002, otra corrida guardó esos mismos valores
  reemplazar?: (intento: number) => number | null; // conteo forzado de updateMany (simula otra corrida)
  clase?: (instrumentoId: string) => boolean;
  ultimos?: boolean;
}

function baseFalsa(falla: Fallas, previas: readonly Fila[] = []) {
  const filas: Fila[] = [...previas];
  const llamadas = { findMany: 0, createMany: 0, updateMany: 0 };
  const intentosCrear = new Map<string, number>();
  let intentosReemplazo = 0;
  const vigente = (f: Fila) => f.reemplazadoEn === null;
  const db = {
    instrumento: { findMany: async ({ where }: { where: { id?: { in: string[] } } }) => FONDOS.filter((f) => !where.id || where.id.in.includes(f.id)) },
    simboloPrecio: {
      findFirst: async ({ where }: { where: { instrumentoId: string } }) => {
        if (falla.clase?.(where.instrumentoId)) throw errorPrisma();
        return null;
      },
    },
    valorUnidadFondo: {
      findMany: async ({ where }: { where: { fondoId: string; fechaValor: { in: Date[] } } }) => {
        llamadas.findMany += 1;
        const fechas = new Set(where.fechaValor.in.map((d) => d.getTime()));
        return filas.filter((f) => vigente(f) && f.fondoId === where.fondoId && fechas.has(f.fechaValor.getTime()));
      },
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        llamadas.updateMany += 1;
        intentosReemplazo += 1;
        const forzado = falla.reemplazar?.(intentosReemplazo);
        if (forzado !== undefined && forzado !== null) {
          // Otra corrida ganó: reemplazó esos vigentes por el mismo valor que esta trae.
          for (const f of filas.filter((x) => where.id.in.includes(x.id))) {
            f.reemplazadoEn = new Date();
            filas.push({ ...f, id: `${f.id}-otra`, valorUnidad: new Prisma.Decimal("20000"), reemplazadoEn: null });
          }
          return { count: forzado };
        }
        const objetivo = filas.filter((f) => where.id.in.includes(f.id) && vigente(f));
        for (const f of objetivo) f.reemplazadoEn = new Date();
        return { count: objetivo.length };
      },
      createMany: async ({ data }: { data: { fondoId: string; fechaValor: Date; valorUnidad: Prisma.Decimal; valorFondo: Prisma.Decimal | null }[] }) => {
        llamadas.createMany += 1;
        const fondoId = data[0]!.fondoId;
        const intento = (intentosCrear.get(fondoId) ?? 0) + 1;
        intentosCrear.set(fondoId, intento);
        if (falla.crear?.(fondoId, data.map((d) => iso(d.fechaValor)), intento)) {
          if (falla.crearGanaOtra) data.forEach((d, i) => filas.push({ ...d, id: `otra-${filas.length + i}`, reemplazadoEn: null }));
          throw errorPrisma();
        }
        data.forEach((d, i) => filas.push({ ...d, id: `${fondoId}-${filas.length + i}`, reemplazadoEn: null }));
        return { count: data.length };
      },
      groupBy: async ({ where }: { where: { fondoId: { in: string[] } } }) => {
        if (falla.ultimos) throw errorPrisma();
        return where.fondoId.in.flatMap((fondoId) => {
          const propias = filas.filter((f) => f.fondoId === fondoId && vigente(f)).map((f) => f.fechaValor.getTime());
          return propias.length ? [{ fondoId, _max: { fechaValor: new Date(Math.max(...propias)) } }] : [];
        });
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return { db: db as unknown as PrismaClient, filas, llamadas };
}

describe("actualizarFondo · guardado por lotes", () => {
  it("una serie larga se guarda con una lectura y una escritura por lote, no por día", async () => {
    const { db, llamadas } = baseFalsa({});
    const inicio = dia("2023-01-01");
    const r = await actualizarFondo(db, { desde: inicio, hasta: dia("2024-12-31"), buscar: sfc(inicio, TAMANO_LOTE + 1), instrumentoIds: ["fondo-a"] });
    expect(r).toMatchObject({ valoresNuevos: TAMANO_LOTE + 1, fallidos: [] });
    expect(llamadas).toEqual({ findMany: 2, createMany: 2, updateMany: 0 }); // 2 lotes
  });

  it("un lote que falla al guardarse no aborta los demás lotes ni los demás fondos", async () => {
    const inicio = dia("2023-01-01");
    const { db } = baseFalsa({ crear: (fondoId, fechas) => fondoId === "fondo-a" && fechas.includes("2023-01-05") });
    const r = await actualizarFondo(db, { desde: inicio, hasta: dia("2024-12-31"), buscar: sfc(inicio, TAMANO_LOTE + 1) });
    expect(r.valoresNuevos).toBe(1 + TAMANO_LOTE + 1);
    expect(r.fallidos).toEqual([
      { instrumentoId: "fondo-a", codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P2002", guardados: 1, conError: TAMANO_LOTE, descartados: 0 },
    ]);
  });

  it("un P2002 al insertar (otra corrida ya lo guardó) se reintenta releyendo, y no es error", async () => {
    const { db, filas } = baseFalsa({ crear: (fondoId, _f, intento) => fondoId === "fondo-a" && intento === 1, crearGanaOtra: true });
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfc() });
    expect(r).toMatchObject({ valoresNuevos: 3, valoresRevisados: 0, fallidos: [] }); // solo los de fondo-b
    expect(filas.filter((f) => f.fondoId === "fondo-a" && f.reemplazadoEn === null)).toHaveLength(3);
  });

  it("si otra corrida ya reemplazó el vigente, se relee y el dato igual cuenta como sin cambios", async () => {
    const previa: Fila = { id: "v1", fondoId: "fondo-a", fechaValor: desde, valorUnidad: new Prisma.Decimal("9999"), valorFondo: null, reemplazadoEn: null };
    const { db } = baseFalsa({ reemplazar: (intento) => (intento === 1 ? 0 : null) }, [previa]);
    const buscar: BuscarSfc = async () => new Response(JSON.stringify([{ fecha_corte: "2024-03-10T00:00:00.000", codigo_negocio: "999001", tipo_participacion: "901", valor_unidad_operaciones: "20000" }]));
    const r = await actualizarFondo(db, { desde, hasta, buscar, instrumentoIds: ["fondo-a"] });
    expect(r).toMatchObject({ valoresNuevos: 0, valoresRevisados: 0, fallidos: [] });
  });

  it(`un conflicto que persiste tras ${MAX_INTENTOS} intentos es GUARDADO_ERROR, sin el mensaje`, async () => {
    const { db } = baseFalsa({ crear: (fondoId) => fondoId === "fondo-a" });
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfc() });
    expect(r.fallidos).toEqual([{ instrumentoId: "fondo-a", codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P2002", guardados: 0, conError: 3, descartados: 0 }]);
    expect(JSON.stringify(r)).not.toContain("123456");
  });
});

describe("actualizarFondo · aislamiento y últimos datos", () => {
  it("si falla la lectura de la clase de un fondo, los demás siguen", async () => {
    const { db } = baseFalsa({ clase: (id) => id === "fondo-a" });
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfc() });
    expect(r.valoresNuevos).toBe(3);
    expect(r.fallidos).toEqual([{ instrumentoId: "fondo-a", codigo: "BASE_ERROR", detalle: "PrismaClientKnownRequestError P2002", guardados: 0, conError: 0, descartados: 0 }]);
  });

  it("los últimos datos salen de una sola consulta agrupada, sin atraso con el dato al día", async () => {
    const { db } = baseFalsa({});
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfc() });
    expect(r.ultimos).toEqual([
      { instrumentoId: "fondo-a", ultimaFecha: hasta, atrasado: false },
      { instrumentoId: "fondo-b", ultimaFecha: hasta, atrasado: false },
    ]);
  });

  it("si falla la lectura de los últimos datos, se informa en cada fondo sin otro fallo", async () => {
    const { db } = baseFalsa({ ultimos: true, clase: (id) => id === "fondo-b" });
    const r = await actualizarFondo(db, { desde, hasta, buscar: sfc() });
    expect(r.ultimos).toEqual([]);
    expect(r.fallidos.map((f) => [f.instrumentoId, f.codigo])).toEqual([["fondo-b", "BASE_ERROR"], ["fondo-a", "BASE_ERROR"]]);
    expect(JSON.stringify(r)).not.toContain("123456");
  });
});
