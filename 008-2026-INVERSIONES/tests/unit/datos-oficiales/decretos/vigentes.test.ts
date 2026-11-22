// Los decretos que cuentan (fase C, C5c: src/datos-oficiales/decretos/vigentes.ts): el único filtro de los decretos
// vigentes y no anulados, que usan el lector de la pantalla, el del motor de proyecciones y el plan; y la lectura de sus
// fechas para el plan, con el rango que exige la ventana del cruce. Lo que lee contra la base lo prueba
// tests/integracion/plan-dividendos-fecha-ex.test.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { enVentanaDePago, VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS } from "@/datos-oficiales/decretos/ventana";
import { sumarDias } from "@/plan/fechas";

const candado = vi.hoisted(() => ({ cargado: false }));
vi.mock("server-only", () => {
  candado.cargado = true;
  return {};
});

const SRC = path.join(__dirname, "..", "..", "..", "..", "src");
const VIGENTES = path.join(SRC, "datos-oficiales", "decretos", "vigentes.ts");
const IMPORTACION = /^(?:import|export)\s+(?!type\b)(?:[^"';()=]*?from\s+)?["']([^"']+)["']/gm;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** `reemplazadoEn: null` y `anulada: false` como claves hermanas (sin llaves entre las dos), en cualquier orden: el filtro. */
const FILTRO_LITERAL = /\breemplazadoEn\s*:\s*null\b[^{}]*\banulada\s*:\s*false\b|\banulada\s*:\s*false\b[^{}]*\breemplazadoEn\s*:\s*null\b/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = path.join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

describe("decretos que cuentan · frontera", () => {
  it("carga server-only como primera importación y nunca nombra la fila cruda", async () => {
    const fuente = readFileSync(VIGENTES, "utf8");
    expect([...fuente.matchAll(IMPORTACION)].map((m) => m[1])[0]).toBe("server-only");
    expect(fuente).not.toMatch(/\bfilaFuente\b|\bcrudo\b/);
    expect(fuente).toMatch(/select:/);
    await import("@/datos-oficiales/decretos/vigentes");
    expect(candado.cargado).toBe(true);
  });

  it("el filtro es uno: vigentes (sin reemplazo) y no anulados", async () => {
    const { DECRETOS_QUE_CUENTAN } = await import("@/datos-oficiales/decretos/vigentes");
    expect(DECRETOS_QUE_CUENTAN).toEqual({ reemplazadoEn: null, anulada: false });
    expect(Object.isFrozen(DECRETOS_QUE_CUENTAN)).toBe(true);
  });

  it("candado: el filtro literal solo vive en vigentes.ts, y los lectores de decretos lo importan de ahí", () => {
    const conFiltro = archivos(SRC).filter((a) => FILTRO_LITERAL.test(readFileSync(a, "utf8"))).map((a) => path.relative(SRC, a));
    expect(conFiltro).toEqual([path.join("datos-oficiales", "decretos", "vigentes.ts")]);
    for (const lector of [path.join(SRC, "datos-oficiales", "decretos", "leer.ts"), path.join(SRC, "proyecciones", "leer.ts")]) {
      const texto = readFileSync(lector, "utf8");
      expect(texto, lector).toMatch(/\bDECRETOS_QUE_CUENTAN\b[^;]*from\s+["'][./]*(datos-oficiales\/decretos\/)?vigentes["']/);
    }
  });

  it("el detector del filtro ve las dos condiciones juntas, en cualquier orden, y no un `anulada: false` suelto", () => {
    expect(FILTRO_LITERAL.test("where: { reemplazadoEn: null, anulada : false, fechaPago: { gte: desde } }")).toBe(true);
    expect(FILTRO_LITERAL.test("where: { anulada: false, instrumentoId: id, reemplazadoEn:null }")).toBe(true);
    expect(FILTRO_LITERAL.test("data: { anulada: false, nota: null }")).toBe(false);
    expect(FILTRO_LITERAL.test("where: { reemplazadoEn: null, fechaPago: { gte: desde } }, data: { anulada: false }")).toBe(false);
  });
});

describe("decretos que cuentan · el rango de las fechas de pago", () => {
  it("de `desde` − VENTANA_PAGO_DESPUES_DIAS a `hasta` + VENTANA_PAGO_ANTES_DIAS", async () => {
    const { rangoDeDecretos } = await import("@/datos-oficiales/decretos/vigentes");
    expect(rangoDeDecretos({ desde: dia("2027-03-11"), hasta: dia("2027-06-09") })).toEqual({
      desde: sumarDias(dia("2027-03-11"), -VENTANA_PAGO_DESPUES_DIAS),
      hasta: sumarDias(dia("2027-06-09"), VENTANA_PAGO_ANTES_DIAS),
    });
  });

  it("contiene todo decreto cuya ventana alcanza un pago del rango, y los bordes son justos", async () => {
    const { rangoDeDecretos } = await import("@/datos-oficiales/decretos/vigentes");
    const pagos = { desde: dia("2027-03-11"), hasta: dia("2027-03-25") };
    const decretos = rangoDeDecretos(pagos);
    for (let p = sumarDias(decretos.desde, -20); p <= sumarDias(decretos.hasta, 20); p = sumarDias(p, 1)) {
      let alcanza = false;
      for (let t = pagos.desde; t <= pagos.hasta; t = sumarDias(t, 1)) alcanza ||= enVentanaDePago(p, t);
      expect(alcanza, p.toISOString()).toBe(p >= decretos.desde && p <= decretos.hasta);
    }
  });
});

describe("decretos que cuentan · lectura de las fechas", () => {
  it("una consulta con el filtro, un rango por especie y solo las fechas", async () => {
    const { leerFechasDeDecretos } = await import("@/datos-oficiales/decretos/vigentes");
    const llamadas: unknown[] = [];
    const fila = { instrumentoId: "ins-a", fechaEx: dia("2027-03-16"), fechaPago: dia("2027-03-23") };
    const db = { dividendoDecretado: { findMany: async (args: unknown) => { llamadas.push(args); return [fila]; } } } as unknown as PrismaClient;
    const rangos = new Map([["ins-a", { desde: dia("2027-03-01"), hasta: dia("2027-05-30") }], ["ins-b", { desde: dia("2027-04-02"), hasta: dia("2027-04-30") }]]);
    expect(await leerFechasDeDecretos(db, rangos)).toEqual([fila]);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toEqual({
      where: {
        OR: [
          { instrumentoId: "ins-a", fechaPago: { gte: dia("2027-02-19"), lte: dia("2027-06-02") } },
          { instrumentoId: "ins-b", fechaPago: { gte: dia("2027-03-23"), lte: dia("2027-05-03") } },
        ],
        reemplazadoEn: null,
        anulada: false,
      },
      select: { instrumentoId: true, fechaEx: true, fechaPago: true },
      orderBy: [{ instrumentoId: "asc" }, { fechaPago: "asc" }, { fechaEx: "asc" }, { id: "asc" }],
    });
  });
});
