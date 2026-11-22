// Rendimientos del fondo (frente fondo-rendimientos, T3) contra la base de PRUEBAS, por src/fondo/rendimientos/registrar.ts:
// - el ensayo valida contra la base y no escribe; aplicar escribe en UNA transacción la carga, cada fila cruda cifrada,
//   el hecho de cada fila y, solo para cada RENDIMIENTO, su ajuste de caja RENDIMIENTO_FIC (+valor, la misma fecha);
// - idempotente: el mismo CSV no escribe nada; uno con filas viejas y una nueva solo agrega la nueva;
// - una fila ya registrada con otro valor, un dueño que no lo es, un fondo que no es un FIC activo, sin constitución o
//   una fila anterior a ella: rechazado, sin escribir NADA (tampoco las demás filas);
// - dos cargas a la vez del mismo CSV: una aplica y la otra no encuentra nada nuevo.
// Las filas no se pueden borrar (solo inserción): cada caso usa su propio fondo, y scripts/integracion.mjs resetea la
// base de pruebas en cada corrida. Cifras y fechas inventadas (2027).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { descifrarCrudo } from "@/cifrado/campos";
import { esSobre } from "@/cifrado/sobre";
import { MOTIVO_RENDIMIENTO, NOMBRE_ARCHIVO, TIPO_FUENTE } from "@/fondo/rendimientos/guardar";
import { registrarRendimientos, type ResultadoRendimientos } from "@/fondo/rendimientos/registrar";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-5);
let n = 0;
const dec = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AHORA = new Date("2027-11-19T15:00:00Z");
const CONSTITUCION = dia("2027-01-14");

let email = "";
let duenoId = "";

const bytes = (...filas: string[]) => new TextEncoder().encode(["fecha,tipo,valor", ...filas].join("\n"));
const CSV = [
  "2027-02-17,RENDIMIENTO,48213.3719",
  "2027-02-17,RETENCION,1748.6233",
  "2027-03-17,RENDIMIENTO,47931.0457",
  "2027-03-17,RETENCION,1738.3811",
];

const nuevoCodigo = () => `9${corrida}${String((n += 1)).padStart(2, "0")}`;

async function nuevoFondo(o: { activo?: boolean; constituido?: boolean } = {}): Promise<{ id: string; codigo: string }> {
  const codigo = nuevoCodigo();
  const { id } = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: codigo, nombre: "Fondo ficticio de rendimientos", activo: o.activo ?? true }, select: { id: true } });
  if (o.constituido ?? true) {
    const ajuste = await db.ajusteCaja.create({
      data: { fecha: CONSTITUCION, monto: dec("-3713946.2817"), categoria: "APORTE_FIC", fuente: "EXTRACTO", motivo: "aporte ficticio", creadoPorId: duenoId },
    });
    await db.movimientoFondo.create({
      data: { fondoId: id, fecha: CONSTITUCION, unidades: dec("1237.48215"), monto: dec("3713946.2817"), tipo: "CONSTITUCION", fuente: "EXTRACTO", ajusteCajaId: ajuste.id },
    });
  }
  return { id, codigo };
}

const registrar = (codigoFic: string, filas: readonly string[], aplicar: boolean, correo = email) =>
  registrarRendimientos(db, { contenido: bytes(...filas), email: correo, codigoFic, aplicar }, { ahora: AHORA });

const escritoDe = async (fondoId: string) => ({
  hechos: await db.rendimientoFondo.count({ where: { fondoId } }),
  ajustes: await db.ajusteCaja.count({ where: { rendimientoFondo: { fondoId } } }),
});

function codigos(r: ResultadoRendimientos): string[] {
  if (r.estado !== "RECHAZADO") throw new Error(`se esperaba un rechazo y llegó ${r.estado}`);
  return r.hallazgos.map((h) => `${h.linea}:${h.codigo}`);
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  email = `dueno-rendimientos-${corrida}@ejemplo.invalid`;
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registrarRendimientos · ensayo y aplicar", () => {
  it("el ensayo cuenta lo que registraría y no escribe nada (ni la carga)", async () => {
    const f = await nuevoFondo();
    const cargasAntes = await db.cargaArchivo.count({ where: { tipoFuente: TIPO_FUENTE } });
    expect(await registrar(f.codigo, CSV, false)).toEqual({
      modo: "ENSAYO", estado: "LISTO", fondoId: f.id, conteos: { filas: 4, rendimientos: 2, retenciones: 2, sinCambios: 0 }, cargaId: null,
    });
    expect(await escritoDe(f.id)).toEqual({ hechos: 0, ajustes: 0 });
    expect(await db.cargaArchivo.count({ where: { tipoFuente: TIPO_FUENTE } })).toBe(cargasAntes);
  });

  it("aplicar escribe la carga, las filas crudas cifradas, los hechos y un ajuste RENDIMIENTO_FIC por rendimiento (la retención no mueve la caja)", async () => {
    const f = await nuevoFondo();
    const r = await registrar(f.codigo, CSV, true);
    expect(r).toMatchObject({ modo: "APLICAR", estado: "APLICADO", fondoId: f.id, conteos: { filas: 4, rendimientos: 2, retenciones: 2, sinCambios: 0 } });
    if (r.estado !== "APLICADO") return;
    const carga = await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId! } });
    expect([carga.tipoFuente, carga.nombreArchivo, carga.estado, carga.cargadoPorId, carga.filasTotal, carga.filasNuevas, carga.filasRepetidas]).toEqual([
      TIPO_FUENTE, NOMBRE_ARCHIVO, "CARGADO", duenoId, 4, 4, 0,
    ]);
    expect(carga.sha256).toMatch(/^[0-9a-f]{64}$/);

    const hechos = await db.rendimientoFondo.findMany({ where: { fondoId: f.id }, include: { ajusteCaja: true, filaFuente: true }, orderBy: [{ fecha: "asc" }, { tipo: "asc" }] });
    expect(hechos.map((h) => [h.fecha.toISOString().slice(0, 10), h.tipo, h.valor.toString(), h.ajusteCaja?.monto.toString() ?? null])).toEqual([
      ["2027-02-17", "RENDIMIENTO", "48213.3719", "48213.3719"],
      ["2027-02-17", "RETENCION", "1748.6233", null],
      ["2027-03-17", "RENDIMIENTO", "47931.0457", "47931.0457"],
      ["2027-03-17", "RETENCION", "1738.3811", null],
    ]);
    for (const h of hechos.filter((x) => x.ajusteCaja !== null)) {
      const a = h.ajusteCaja!;
      expect([a.fecha.getTime(), a.categoria, a.fuente, a.motivo, a.referenciaEvidencia, a.creadoPorId, a.eventoId]).toEqual([
        h.fecha.getTime(), "RENDIMIENTO_FIC", "EXTRACTO", MOTIVO_RENDIMIENTO, null, duenoId, null,
      ]);
    }
    for (const h of hechos) {
      const ff = h.filaFuente;
      expect([ff.tipoFuente, ff.primeraCargaId, ff.ocurrencia]).toEqual([TIPO_FUENTE, carga.id, 1]);
      expect(esSobre(ff.crudo)).toBe(true);
      const claro = descifrarCrudo(ff.crudo, ff);
      expect(claro).toEqual({ fecha: h.fecha.toISOString().slice(0, 10), tipo: h.tipo, valor: h.valor.toString() });
    }
    expect(await db.filaDeCarga.count({ where: { cargaId: carga.id } })).toBe(4);
  });

  it("repetir el mismo CSV (con o sin aplicar) no escribe nada, ni una carga nueva", async () => {
    const f = await nuevoFondo();
    await registrar(f.codigo, CSV, true);
    const cargas = await db.cargaArchivo.count({ where: { tipoFuente: TIPO_FUENTE } });
    for (const aplicar of [true, false]) {
      expect(await registrar(f.codigo, [...CSV].reverse(), aplicar)).toEqual({
        modo: aplicar ? "APLICAR" : "ENSAYO", estado: "SIN_CAMBIOS", fondoId: f.id, conteos: { filas: 4, rendimientos: 0, retenciones: 0, sinCambios: 4 }, cargaId: null,
      });
    }
    expect(await escritoDe(f.id)).toEqual({ hechos: 4, ajustes: 2 });
    expect(await db.cargaArchivo.count({ where: { tipoFuente: TIPO_FUENTE } })).toBe(cargas);
  });

  it("un CSV con las filas de antes y una nueva solo agrega la nueva, y la carga deja registro de las repetidas", async () => {
    const f = await nuevoFondo();
    await registrar(f.codigo, CSV, true);
    const r = await registrar(f.codigo, [...CSV, "2027-04-19,RENDIMIENTO,48107.2263"], true);
    expect(r).toMatchObject({ estado: "APLICADO", conteos: { filas: 5, rendimientos: 1, retenciones: 0, sinCambios: 4 } });
    if (r.estado !== "APLICADO") return;
    expect(await escritoDe(f.id)).toEqual({ hechos: 5, ajustes: 3 });
    const carga = await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId! } });
    expect([carga.filasTotal, carga.filasNuevas, carga.filasRepetidas]).toEqual([5, 1, 4]);
    expect(await db.filaDeCarga.count({ where: { cargaId: carga.id } })).toBe(5);
  });

  it("los mismos días en dos fondos distintos no chocan", async () => {
    const a = await nuevoFondo();
    const b = await nuevoFondo();
    expect((await registrar(a.codigo, CSV, true)).estado).toBe("APLICADO");
    expect((await registrar(b.codigo, CSV, true)).estado).toBe("APLICADO");
    expect(await escritoDe(b.id)).toEqual({ hechos: 4, ajustes: 2 });
  });

  it("dos cargas a la vez del mismo CSV: una aplica y la otra no encuentra nada nuevo", async () => {
    const f = await nuevoFondo();
    const rs = await Promise.all([registrar(f.codigo, CSV, true), registrar(f.codigo, CSV, true)]);
    expect(rs.map((r) => r.estado).sort()).toEqual(["APLICADO", "SIN_CAMBIOS"]);
    expect(await escritoDe(f.id)).toEqual({ hechos: 4, ajustes: 2 });
  });
});

describe("registrarRendimientos · rechazos (no escribe nada)", () => {
  it("una fila ya registrada con otro valor: VALOR_DISTINTO en su línea, y tampoco entra la fila nueva del mismo archivo", async () => {
    const f = await nuevoFondo();
    await registrar(f.codigo, CSV, true);
    for (const aplicar of [false, true]) {
      const r = await registrar(f.codigo, ["2027-02-17,RETENCION,1748.6234", "2027-04-19,RENDIMIENTO,48107.2263"], aplicar);
      expect(codigos(r)).toEqual(["2:VALOR_DISTINTO"]);
    }
    expect(await escritoDe(f.id)).toEqual({ hechos: 4, ajustes: 2 });
  });

  it("una fila anterior a la constitución del fondo: FECHA_ANTES_DE_LA_CONSTITUCION", async () => {
    const f = await nuevoFondo();
    for (const aplicar of [false, true]) {
      expect(codigos(await registrar(f.codigo, ["2027-01-13,RENDIMIENTO,48213.3719", ...CSV], aplicar))).toEqual(["2:FECHA_ANTES_DE_LA_CONSTITUCION"]);
    }
    expect(await escritoDe(f.id)).toEqual({ hechos: 0, ajustes: 0 });
  });

  it("un fondo sin constitución, inactivo, que no está registrado o que no es un FIC", async () => {
    const sinConstitucion = await nuevoFondo({ constituido: false });
    const inactivo = await nuevoFondo({ activo: false });
    const codigoDeAccion = nuevoCodigo();
    await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICTRF${corrida}`, codigoFic: codigoDeAccion, nombre: "Acción ficticia" } });
    for (const aplicar of [false, true]) {
      expect(codigos(await registrar(sinConstitucion.codigo, CSV, aplicar))).toEqual(["0:FONDO_SIN_CONSTITUCION"]);
      expect(codigos(await registrar(inactivo.codigo, CSV, aplicar))).toEqual(["0:FONDO_INACTIVO"]);
      expect(codigos(await registrar(nuevoCodigo(), CSV, aplicar))).toEqual(["0:FONDO_NO_REGISTRADO"]);
      expect(codigos(await registrar(codigoDeAccion, CSV, aplicar))).toEqual(["0:FONDO_NO_REGISTRADO"]);
    }
    expect(await escritoDe(sinConstitucion.id)).toEqual({ hechos: 0, ajustes: 0 });
  });

  it("un correo que no es de un dueño activo: USUARIO_NO_AUTORIZADO", async () => {
    const f = await nuevoFondo();
    const familia = `familia-rendimientos-${corrida}@ejemplo.invalid`;
    await db.usuario.create({ data: { email: familia, rol: "FAMILIA" } });
    for (const correo of [familia, `nadie-rendimientos-${corrida}@ejemplo.invalid`]) {
      expect(codigos(await registrar(f.codigo, CSV, true, correo))).toEqual(["0:USUARIO_NO_AUTORIZADO"]);
    }
    expect(await escritoDe(f.id)).toEqual({ hechos: 0, ajustes: 0 });
  });

  it("un CSV con hallazgos no toca la base", async () => {
    const f = await nuevoFondo();
    expect(codigos(await registrar(f.codigo, ["2027-02-17,RENDIMIENTO,48213.3719", "2027-02-17,RENDIMIENTO,48213.3719"], true))).toEqual(["3:FILA_REPETIDA"]);
    expect(await escritoDe(f.id)).toEqual({ hechos: 0, ajustes: 0 });
  });
});
