// `importarValoresFondo` (el CSV de valores de unidad de la vía B) contra la base de PRUEBAS: deja lo mismo que
// `actualizarFondo` con una SFC falsa para los mismos valores (mismo camino de escritura: src/fondo/guardar.ts);
// reimportar el mismo CSV no escribe nada; una revisión versiona; un código sin fondo FIC activo no escribe nada
// (FONDO_NO_REGISTRADO) y una clase distinta de la registrada tampoco (CLASE_DISTINTA). El CLI como proceso imprime
// solo conteos e ids. Códigos de negocio, clases y cifras inventados.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarFondo } from "@/fondo/actualizar";
import { escribirCsvValoresFondo, leerCsvValoresFondo, type FondoAEscribir, type LecturaCsvFondo } from "@/fondo/csv-valores";
import { importarValoresFondo } from "@/fondo/importar";
import { registrarFondo } from "@/fondo/registrar";
import { FUENTE_SFC, type BuscarSfc, type ValorDia } from "@/fondo/sfc";
import { fechaEnBogota } from "@/precios/horario";
import { comprobar, correr, entornoMinimo } from "../ayudas/cli";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-6);
let n = 0;
const nuevoCodigo = () => `7${corrida}${String((n += 1)).padStart(2, "0")}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2024-03-15");
const AHORA = new Date("2024-03-15T15:00:00Z");
const DIAS = ["2024-03-10", "2024-03-11", "2024-03-12"] as const;
const valores = (unidades: readonly string[], fondo: string | null = "500000000"): ValorDia[] => unidades.map((u, i) => ({ fecha: dia(DIAS[i]!), valorUnidad: u, valorFondo: fondo }));

/** El CSV como lo escribe el exportador y lo lee el importador (todo o nada). */
function csv(fondos: readonly FondoAEscribir[]): Extract<LecturaCsvFondo, { ok: true }> {
  const w = escribirCsvValoresFondo(fondos, HOY);
  if (!w.ok) throw new Error(w.codigo);
  const r = leerCsvValoresFondo(new TextEncoder().encode(w.texto), HOY);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

/** Registra un fondo ficticio como en producción (`registrar-fondo`): con su clase, o sin ella. */
async function fondo(participacion: string | null = "907"): Promise<{ id: string; codigo: string }> {
  const codigo = nuevoCodigo();
  const r = await registrarFondo(db, { codigo, participacion, nombre: "Fondo ficticio de la vía B" }, HOY);
  return { id: r.instrumentoId, codigo };
}

const vigentes = async (fondoId: string) =>
  (await db.valorUnidadFondo.findMany({ where: { fondoId, reemplazadoEn: null }, orderBy: { fechaValor: "asc" } })).map((v) => [
    v.fechaValor.toISOString().slice(0, 10), v.valorUnidad.toString(), v.valorFondo?.toString() ?? null, v.fuente,
  ]);

/** SFC falsa (sin red) con las mismas filas que el CSV, para comparar con actualizarFondo. */
const sfcCon = (codigo: string, vs: readonly ValorDia[]): BuscarSfc => async () =>
  new Response(JSON.stringify(vs.map((v) => ({
    fecha_corte: `${v.fecha.toISOString().slice(0, 10)}T00:00:00.000`, codigo_negocio: codigo, tipo_participacion: "907", valor_unidad_operaciones: v.valorUnidad, valor_fondo_cierre_dia_t: v.valorFondo,
  }))));

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("importarValoresFondo · el mismo camino que actualizar-fondo", () => {
  it("deja los mismos vigentes y los mismos conteos que actualizarFondo con los mismos valores", async () => {
    const [a, b] = [await fondo(), await fondo()];
    const vs = valores(["10000", "10000.5", "10001.12345678"]);
    const porCsv = await importarValoresFondo(db, csv([{ codigoFic: a.codigo, participacion: "907", valores: vs }]), { ahora: AHORA });
    const porSfc = await actualizarFondo(db, { desde: dia(DIAS[0]), hasta: dia(DIAS[2]), buscar: sfcCon(b.codigo, vs), instrumentoIds: [b.id] });
    expect(porCsv).toMatchObject({ filas: 3, fondosCsv: 1, sinFondo: [] });
    expect(porCsv.guardado).toMatchObject({ fondos: 1, valoresNuevos: 3, valoresRevisados: 0, fallidos: [] });
    expect(porSfc).toMatchObject({ fondos: 1, valoresNuevos: 3, valoresRevisados: 0, fallidos: [] });
    expect(await vigentes(a.id)).toEqual(await vigentes(b.id));
    expect((await vigentes(a.id)).every((v) => v[3] === FUENTE_SFC)).toBe(true);
    expect(porCsv.guardado.ultimos).toEqual([{ instrumentoId: a.id, ultimaFecha: dia(DIAS[2]), atrasado: false }]);
  });

  it("reimportar el mismo CSV no escribe nada; sin el valor del fondo, tampoco cambia el vigente", async () => {
    const a = await fondo();
    const datos = csv([{ codigoFic: a.codigo, participacion: "907", valores: valores(["20000", "20001", "20002"]) }]);
    await importarValoresFondo(db, datos, { ahora: AHORA });
    const filas = await db.valorUnidadFondo.count({ where: { fondoId: a.id } });
    const otra = await importarValoresFondo(db, datos, { ahora: AHORA });
    expect(otra.guardado).toMatchObject({ valoresNuevos: 0, valoresRevisados: 0, fallidos: [] });
    const sinFondo = await importarValoresFondo(db, csv([{ codigoFic: a.codigo, participacion: "907", valores: valores(["20000", "20001", "20002"], null) }]), { ahora: AHORA });
    expect(sinFondo.guardado).toMatchObject({ valoresNuevos: 0, valoresRevisados: 0 });
    expect(await db.valorUnidadFondo.count({ where: { fondoId: a.id } })).toBe(filas);
  });

  it("un valor revisado versiona: el anterior queda como historia (reemplazadoEn) y entra el nuevo", async () => {
    const a = await fondo();
    await importarValoresFondo(db, csv([{ codigoFic: a.codigo, participacion: "907", valores: valores(["31847.2093"]) }]), { ahora: AHORA });
    const r = await importarValoresFondo(db, csv([{ codigoFic: a.codigo, participacion: "907", valores: valores(["31847.2961"]) }]), { ahora: AHORA });
    expect(r.guardado).toMatchObject({ valoresNuevos: 0, valoresRevisados: 1 });
    const todas = await db.valorUnidadFondo.findMany({ where: { fondoId: a.id }, orderBy: { traidoEn: "asc" } });
    expect(todas.map((v) => [v.valorUnidad.toString(), v.reemplazadoEn === null])).toEqual([["31847.2093", false], ["31847.2961", true]]);
  });
});

describe("importarValoresFondo · el atraso se mide contra hoy (code-reviewer MEDIO)", () => {
  it("un CSV viejo (último valor de hace más de 7 días) avisa ATRASADO, como actualizar-fondo; uno al día, no", async () => {
    const a = await fondo();
    const viejo = [{ fecha: dia("2024-02-29"), valorUnidad: "50000", valorFondo: null }, { fecha: dia("2024-03-01"), valorUnidad: "50001", valorFondo: null }];
    const r = await importarValoresFondo(db, csv([{ codigoFic: a.codigo, participacion: "907", valores: viejo }]), { ahora: AHORA });
    expect(r.guardado.ultimos).toEqual([{ instrumentoId: a.id, ultimaFecha: dia("2024-03-01"), atrasado: true }]);
    const alDia = await importarValoresFondo(db, csv([{ codigoFic: a.codigo, participacion: "907", valores: valores(["50002", "50003", "50004"]) }]), { ahora: AHORA });
    expect(alDia.guardado.ultimos).toEqual([{ instrumentoId: a.id, ultimaFecha: dia(DIAS[2]), atrasado: false }]);
  });
});

describe("importarValoresFondo · lo que no se escribe", () => {
  it("un código sin fondo FIC activo (sin registrar o inactivo) no escribe nada y se informa por su primera línea; los demás sí", async () => {
    const a = await fondo();
    const inactivo = await fondo();
    await db.instrumento.update({ where: { id: inactivo.id }, data: { activo: false } });
    const sinRegistrar = nuevoCodigo();
    const r = await importarValoresFondo(db, csv([
      { codigoFic: sinRegistrar, participacion: "907", valores: valores(["1", "2"]) },
      { codigoFic: a.codigo, participacion: "907", valores: valores(["40000"]) },
      { codigoFic: inactivo.codigo, participacion: "907", valores: valores(["5"]) },
    ]), { ahora: AHORA });
    expect(r.sinFondo).toEqual([{ linea: 2, codigo: "FONDO_NO_REGISTRADO" }, { linea: 5, codigo: "FONDO_NO_REGISTRADO" }]);
    expect(r.guardado).toMatchObject({ fondos: 1, valoresNuevos: 1, fallidos: [] });
    expect(await db.instrumento.count({ where: { codigoFic: sinRegistrar } })).toBe(0);
    expect(await db.valorUnidadFondo.count({ where: { fondoId: inactivo.id } })).toBe(0);
  });

  it("una clase distinta de la registrada (u otra sin clase registrada) es CLASE_DISTINTA y no escribe nada de ese fondo", async () => {
    const [conClase, sinClase, bien] = [await fondo("907"), await fondo(null), await fondo("907")];
    const r = await importarValoresFondo(db, csv([
      { codigoFic: conClase.codigo, participacion: "908", valores: valores(["1"]) },
      { codigoFic: sinClase.codigo, participacion: "907", valores: valores(["1"]) },
      { codigoFic: bien.codigo, participacion: "907", valores: valores(["1"]) },
    ]), { ahora: AHORA });
    expect(r.guardado.fallidos.map((f) => [f.instrumentoId, f.codigo])).toEqual([[conClase.id, "CLASE_DISTINTA"], [sinClase.id, "CLASE_DISTINTA"]]);
    expect(r.guardado.valoresNuevos).toBe(1);
    expect(await db.valorUnidadFondo.count({ where: { fondoId: { in: [conClase.id, sinClase.id] } } })).toBe(0);
    const sinFiltro = await importarValoresFondo(db, csv([{ codigoFic: conClase.codigo, participacion: null, valores: valores(["1"]) }]), { ahora: AHORA });
    expect(sinFiltro.guardado.fallidos.map((f) => f.codigo)).toEqual(["CLASE_DISTINTA"]);
  });
});

describe("CLI importar-valores-fondo.ts como proceso", { timeout: 120_000 }, () => {
  it("importa con 0 y repite con 0 sin escribir: imprime conteos e ids, nunca el código, la clase ni los valores", async () => {
    const a = await fondo();
    const carpeta = mkdtempSync(join(tmpdir(), "inv008-fondo-cli-"));
    try {
      const ruta = join(carpeta, "valores.ficticio.csv");
      // Fechas recientes (hoy − 3 y hoy − 2): el CLI mide el atraso contra hoy y un CSV viejo saldría con 3.
      const hoyReal = fechaEnBogota(new Date());
      const recientes = [3, 2].map((d, i) => ({ fecha: new Date(hoyReal.getTime() - d * 86_400_000), valorUnidad: ["43210.5", "43211"][i]!, valorFondo: null }));
      const w = escribirCsvValoresFondo([{ codigoFic: a.codigo, participacion: "907", valores: recientes }], hoyReal);
      writeFileSync(ruta, w.ok ? w.texto : "");
      const env = entornoMinimo({ DATABASE_URL: process.env.DATABASE_URL ?? "" });
      const nunca = [a.codigo, "43210.5", "43211", carpeta];
      const primero = correr("importar-valores-fondo.ts", ["--archivo", ruta], env);
      comprobar(primero, 0, "📄 CSV de valores del fondo · filas: 2 · fondos: 1", nunca);
      expect(primero.texto).toContain("valores nuevos: 2 · revisados: 0");
      expect(primero.texto).toContain(`fondo ${a.id} · último dato: ${recientes[1]!.fecha.toISOString().slice(0, 10)}`);
      comprobar(correr("importar-valores-fondo.ts", ["--archivo", ruta], env), 0, "valores nuevos: 0 · revisados: 0", nunca);
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});
