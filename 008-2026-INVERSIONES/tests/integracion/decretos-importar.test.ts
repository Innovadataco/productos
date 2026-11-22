// importar-decretos (fase C, C4a: src/datos-oficiales/decretos/importar.ts y su camino único, guardar.ts) contra la base
// de PRUEBAS: el ensayo no escribe nada; ESPECIE_NO_REGISTRADA no crea instrumentos; aplicar deja la carga, la fila cruda
// CIFRADA y su visto, y la v1; reimportar no escribe nada; un cambio es la v2 vigente, que retira a la v1 en el mismo
// instante; anular es una versión nueva `anulada` con su nota (P10); una cadena rota sembrada a mano (v2 sin v1, 1 y 3,
// retiro sin sucesor) rechaza sin escribir; si la inserción de la versión siguiente falla después del retiro, la
// transacción se deshace (la v1 sigue vigente); dos cargas a la vez del mismo cambio dejan una sola v2; con la tabla
// bloqueada (una migración), la carga no espera más que su lock_timeout; un P2002 en la fila cruda no se disfraza de
// concurrencia; una especie que es el nemotécnico de una acción y el símbolo de Trii de otra es ambigua; el nombre del
// archivo del dueño no se guarda.
// Datos inventados: especies FICT*, números raros, anuncios anteriores a 2022.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { descifrarCrudo } from "@/cifrado/campos";
import { esSobre } from "@/cifrado/sobre";
import { ENCABEZADO_DECRETOS } from "@/datos-oficiales/decretos/csv";
import { COLUMNAS } from "@/datos-oficiales/decretos/filas";
import { claveNaturalDecreto } from "@/datos-oficiales/decretos/guardar";
import { importarDecretos, type ResultadoDecretos } from "@/datos-oficiales/decretos/importar";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-6);
const email = `dueno-decretos-${corrida}@ejemplo.invalid`;
const familia = `familia-decretos-${corrida}@ejemplo.invalid`;
const nemo = (letra: string) => `FICT${letra}${corrida}`;
const ids: Record<string, string> = {};
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Fila = Record<(typeof COLUMNAS)[number], string>;
const fila = (especie: string, c: Partial<Fila> = {}): Fila => ({
  especie, tipo: "ORDINARIO", fecha_anuncio: "2021-03-17", cuota: "1", valor_por_accion: "1873.204517", moneda: "COP", forma: "DINERO",
  fecha_ex: "2021-04-14", fecha_pago: "2021-04-21", referencia: "https://www.superfinanciera.gov.co/ficticio/decreto?id=4613", anulada: "", nota: "", ...c,
});
const csv = (filas: readonly Fila[]) =>
  new TextEncoder().encode(`${ENCABEZADO_DECRETOS.join(",")}\n${filas.map((f) => COLUMNAS.map((k) => f[k]).join(",")).join("\n")}\n`);
const importar = (filas: readonly Fila[], aplicar: boolean, correo = email): Promise<ResultadoDecretos> =>
  importarDecretos(db, { contenido: csv(filas), email: correo, aplicar });

/** Conteos de todo lo que una carga de decretos puede escribir: si no cambian, no se escribió nada. */
async function huella() {
  const [cargas, filas, vistas, decretos, retirados, instrumentos] = await Promise.all([
    db.cargaArchivo.count(), db.filaFuente.count(), db.filaDeCarga.count(), db.dividendoDecretado.count(),
    db.dividendoDecretado.count({ where: { reemplazadoEn: { not: null } } }), db.instrumento.count(),
  ]);
  return { cargas, filas, vistas, decretos, retirados, instrumentos };
}

const versiones = (instrumentoId: string, cuota = 1) =>
  db.dividendoDecretado.findMany({ where: { instrumentoId, cuota }, orderBy: { version: "asc" }, include: { filaFuente: true } });
const codigos = (r: ResultadoDecretos) => (r.estado === "RECHAZADO" ? r.hallazgos.map((h) => `${h.linea}:${h.codigo}`) : []);

/** Siembra a mano (como lo haría un segundo camino) una versión de un decreto, con su fila cruda. */
async function sembrar(instrumentoId: string, cuota: number, version: number, retirada: boolean): Promise<void> {
  const carga = await db.cargaArchivo.create({ data: { tipoFuente: "REGISTRO_DECRETOS", nombreArchivo: "sembrado.ficticio.csv", sha256: "f".repeat(64), estado: "CARGADO", cargadoPorId: ids["dueno"]! } });
  const d = { tipo: "ORDINARIO" as const, fechaAnuncio: dia("2021-03-17"), cuota };
  const ff = await db.filaFuente.create({ data: { tipoFuente: "REGISTRO_DECRETOS", claveNatural: claveNaturalDecreto(instrumentoId, d, version), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 2, crudo: {} } });
  const { id } = await db.dividendoDecretado.create({
    data: {
      filaFuenteId: ff.id, instrumentoId, ...d, valorPorAccion: new Prisma.Decimal("4.61"), fechaEx: dia("2021-04-14"), fechaPago: dia("2021-04-21"),
      referenciaOficial: "sfc:FICT-4613", version,
    },
  });
  if (retirada) await db.dividendoDecretado.update({ where: { id }, data: { reemplazadoEn: new Date() } });
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  ids["dueno"] = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
  await db.usuario.create({ data: { email: familia, rol: "FAMILIA" } });
  for (const letra of ["A", "C", "R", "S", "U", "V", "X", "Y"]) ids[letra] = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo(letra), nombre: `Ficticia ${letra}` } })).id;
  ids["B"] = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo("B"), simboloTrii: nemo("T"), nombre: "Ficticia B" } })).id;
  // P es el nemotécnico de una acción y el símbolo de Trii de otra (Q): un decreto de «P» es ambiguo.
  ids["P"] = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo("P"), nombre: "Ficticia P" } })).id;
  ids["Q"] = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo("Q"), simboloTrii: nemo("P"), nombre: "Ficticia Q" } })).id;
  ids["L"] = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo("L"), nombre: "Ficticia L" } })).id;
  // Un fondo con nemotécnico (no debería existir así, pero no es una acción): un decreto no se le registra.
  await db.instrumento.create({ data: { tipo: "FIC", nemotecnico: nemo("F"), codigoFic: `9${corrida}1`, nombre: "Fondo ficticio" } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("importar-decretos · ensayo y rechazos (no escriben nada)", () => {
  it("el ensayo valida, planifica y cuenta sin escribir nada; esta base (de pruebas) admitiría --aplicar", async () => {
    const antes = await huella();
    const r = await importar([fila(nemo("A")), fila(nemo("A"), { cuota: "2", fecha_ex: "2021-09-08", fecha_pago: "2021-09-15" })], false);
    expect(r).toEqual({ modo: "ENSAYO", estado: "LISTO", conteos: { filas: 2, nuevos: 2, versiones: 0, anulaciones: 0, sinCambios: 0 }, cargaId: null, aplicarPermitido: true });
    expect(await huella()).toEqual(antes);
  });

  it("ESPECIE_NO_REGISTRADA por línea (también un fondo): no crea instrumentos ni escribe nada, ni en ensayo ni al aplicar", async () => {
    const antes = await huella();
    for (const aplicar of [false, true]) {
      const r = await importar([fila(nemo("A")), fila(nemo("Z")), fila(nemo("F"))], aplicar);
      expect(codigos(r)).toEqual(["3:ESPECIE_NO_REGISTRADA", "4:ESPECIE_NO_REGISTRADA"]);
    }
    expect(await huella()).toEqual(antes);
    expect(await db.instrumento.count({ where: { nemotecnico: nemo("Z") } })).toBe(0);
  });

  it("el nemotécnico y el símbolo de Trii de una misma acción son la misma especie: DECRETO_REPETIDO", async () => {
    const r = await importar([fila(nemo("B")), fila(nemo("T"), { valor_por_accion: "41.3729" })], true);
    expect(codigos(r)).toEqual(["3:DECRETO_REPETIDO"]);
    expect(await db.dividendoDecretado.count({ where: { instrumentoId: ids["B"] } })).toBe(0);
  });

  it("una especie que es el nemotécnico de una acción y el símbolo de Trii de otra: ESPECIE_AMBIGUA, sin escribir nada", async () => {
    const antes = await huella();
    const r = await importar([fila(nemo("A")), fila(nemo("P"))], true);
    expect(r).toMatchObject({ estado: "RECHAZADO", hallazgos: [{ linea: 3, columna: "especie", codigo: "ESPECIE_AMBIGUA" }] });
    expect(await huella()).toEqual(antes);
    // El nemotécnico de Q no es ambiguo: sí resuelve.
    expect(await importar([fila(nemo("Q"))], false)).toMatchObject({ estado: "LISTO" });
  });

  it("solo el dueño activo: la familia o un correo que no existe salen con USUARIO_NO_AUTORIZADO", async () => {
    for (const correo of [familia, `nadie-${corrida}@ejemplo.invalid`]) expect(codigos(await importar([fila(nemo("A"))], true, correo))).toEqual(["0:USUARIO_NO_AUTORIZADO"]);
  });

  it("anular sin decreto registrado: ANULACION_SIN_DECRETO", async () => {
    const antes = await huella();
    expect(codigos(await importar([fila(nemo("C"), { anulada: "SI", nota: "no existía" })], true))).toEqual(["2:ANULACION_SIN_DECRETO"]);
    expect(await huella()).toEqual(antes);
  });
});

describe("importar-decretos · aplicar", () => {
  it("la v1: carga CARGADO, fila cruda CIFRADA (se abre con su llave y es la fila tal cual), su visto y el decreto", async () => {
    const filas = [fila(nemo("A"), { nota: "primera cuota" }), fila(nemo("A"), { cuota: "2", valor_por_accion: "0.000317", fecha_ex: "2021-09-08", fecha_pago: "2027-09-15", referencia: "sfc:FICT-4613" })];
    const r = await importar(filas, true);
    expect(r).toMatchObject({ modo: "APLICAR", estado: "APLICADO", conteos: { filas: 2, nuevos: 2, versiones: 0, anulaciones: 0, sinCambios: 0 } });
    if (r.estado !== "APLICADO") return;
    const carga = await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId! } });
    expect(carga).toMatchObject({ tipoFuente: "REGISTRO_DECRETOS", estado: "CARGADO", filasTotal: 2, filasNuevas: 2, filasRepetidas: 0, cargadoPorId: ids["dueno"], nombreArchivo: "decretos.csv" });
    const [v1] = await versiones(ids["A"]!);
    expect(v1).toMatchObject({ version: 1, reemplazadoEn: null, anulada: false, tipo: "ORDINARIO", cuota: 1, moneda: "COP", nota: "primera cuota", fechaAnuncio: dia("2021-03-17"), fechaEx: dia("2021-04-14"), fechaPago: dia("2021-04-21") });
    expect(v1!.valorPorAccion.toString()).toBe("1873.204517");
    expect(v1!.registradoEn).toBeInstanceOf(Date);
    const ff = v1!.filaFuente;
    expect(ff).toMatchObject({ tipoFuente: "REGISTRO_DECRETOS", ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 2, claveNatural: claveNaturalDecreto(ids["A"]!, { tipo: "ORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 1 }, 1) });
    expect(esSobre(ff.crudo)).toBe(true);
    expect(JSON.stringify(ff.crudo)).not.toContain(nemo("A"));
    expect(descifrarCrudo(ff.crudo, ff)).toEqual(filas[0]);
    expect(await db.filaDeCarga.findMany({ where: { cargaId: carga.id }, orderBy: { filaNo: "asc" }, select: { filaNo: true } })).toEqual([{ filaNo: 2 }, { filaNo: 3 }]);
    const [cuota2] = await versiones(ids["A"]!, 2);
    expect(cuota2!.valorPorAccion.toString()).toBe("0.000317");
  });

  it("reimportar el mismo CSV (en ensayo o al aplicar) no escribe nada: SIN_CAMBIOS", async () => {
    const filas = [fila(nemo("A"), { nota: "primera cuota" }), fila(nemo("A"), { cuota: "2", valor_por_accion: "0.000317", fecha_ex: "2021-09-08", fecha_pago: "2027-09-15", referencia: "sfc:FICT-4613" })];
    const antes = await huella();
    expect(await importar(filas, false)).toMatchObject({ estado: "SIN_CAMBIOS", conteos: { sinCambios: 2 } });
    expect(await importar(filas, true)).toMatchObject({ estado: "SIN_CAMBIOS", cargaId: null, conteos: { filas: 2, sinCambios: 2 } });
    expect(await huella()).toEqual(antes);
  });

  it("un cambio es la v2 vigente, que retira a la v1 en el mismo instante; la fila sin cambio deja su visto hacia la vigente", async () => {
    const filas = [fila(nemo("A"), { valor_por_accion: "1873.204519", nota: "primera cuota" }), fila(nemo("A"), { cuota: "2", valor_por_accion: "0.000317", fecha_ex: "2021-09-08", fecha_pago: "2027-09-15", referencia: "sfc:FICT-4613" })];
    const r = await importar(filas, true);
    expect(r).toMatchObject({ estado: "APLICADO", conteos: { filas: 2, nuevos: 0, versiones: 1, anulaciones: 0, sinCambios: 1 } });
    if (r.estado !== "APLICADO") return;
    const [v1, v2] = await versiones(ids["A"]!);
    expect(v2).toMatchObject({ version: 2, reemplazadoEn: null, anulada: false });
    expect(v2!.valorPorAccion.toString()).toBe("1873.204519");
    expect(v1!.reemplazadoEn).not.toBeNull();
    expect(v1!.reemplazadoEn!.getTime()).toBe(v2!.registradoEn.getTime());
    expect(await db.cargaArchivo.findUniqueOrThrow({ where: { id: r.cargaId! } })).toMatchObject({ filasTotal: 2, filasNuevas: 1, filasRepetidas: 1 });
    const [cuota2] = await versiones(ids["A"]!, 2);
    expect(await db.filaDeCarga.findUniqueOrThrow({ where: { cargaId_filaNo: { cargaId: r.cargaId!, filaNo: 3 } } })).toMatchObject({ filaFuenteId: cuota2!.filaFuenteId });
    expect(descifrarCrudo(v2!.filaFuente.crudo, v2!.filaFuente)).toEqual(filas[0]);
  });

  it("anular (P10) es la v3 `anulada` con su nota; repetir la anulación no escribe; volver al contenido de la v1 es la v4", async () => {
    const anular = fila(nemo("A"), { valor_por_accion: "1873.204519", nota: "registrado con la cuota equivocada", anulada: "SI" });
    expect(await importar([anular], true)).toMatchObject({ estado: "APLICADO", conteos: { anulaciones: 1 } });
    const antes = await huella();
    expect(await importar([anular], true)).toMatchObject({ estado: "SIN_CAMBIOS" });
    expect(await huella()).toEqual(antes);
    const comoV1 = fila(nemo("A"), { nota: "primera cuota" });
    expect(await importar([comoV1], true)).toMatchObject({ estado: "APLICADO", conteos: { versiones: 1 } });
    const todas = await versiones(ids["A"]!);
    expect(todas.map((v) => [v.version, v.anulada, v.reemplazadoEn === null])).toEqual([[1, false, false], [2, false, false], [3, true, false], [4, false, true]]);
    expect(todas[2]!.nota).toBe("registrado con la cuota equivocada");
    expect(new Set(todas.map((v) => v.filaFuenteId)).size).toBe(4);
  });
});

describe("importar-decretos · la cadena de versiones y la atomicidad", () => {
  it("CADENA_ROTA sembrada a mano (v2 sin v1, 1 y 3, retiro sin sucesor): rechaza sin escribir nada", async () => {
    await sembrar(ids["R"]!, 1, 2, false);
    await sembrar(ids["R"]!, 2, 1, true);
    await sembrar(ids["R"]!, 2, 3, false);
    await sembrar(ids["R"]!, 3, 1, true);
    const antes = await huella();
    for (const aplicar of [false, true]) {
      const r = await importar([fila(nemo("R")), fila(nemo("R"), { cuota: "2" }), fila(nemo("R"), { cuota: "3" })], aplicar);
      expect(codigos(r)).toEqual(["2:CADENA_ROTA", "3:CADENA_ROTA", "4:CADENA_ROTA"]);
    }
    expect(await huella()).toEqual(antes);
  });

  it("si la inserción de la versión siguiente falla después del retiro, se deshace todo: la v1 sigue vigente", async () => {
    expect(await importar([fila(nemo("U"))], true)).toMatchObject({ estado: "APLICADO" });
    const funcion = `"prueba_falla_decreto_${corrida}"`;
    const disparador = `"zz_prueba_falla_decreto_${corrida}"`;
    await db.$executeRawUnsafe(`CREATE FUNCTION ${funcion}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falla de prueba'; END $$`);
    try {
      await db.$executeRawUnsafe(
        `CREATE TRIGGER ${disparador} BEFORE INSERT ON "dividendo_decretado" FOR EACH ROW WHEN (NEW."instrumentoId" = '${ids["U"]}' AND NEW."version" >= 2) EXECUTE FUNCTION ${funcion}()`,
      );
      const antes = await huella();
      await expect(importar([fila(nemo("U"), { valor_por_accion: "41.3729" })], true)).rejects.toThrow();
      expect(await huella()).toEqual(antes);
      const [v1, ...otras] = await versiones(ids["U"]!);
      expect(otras).toEqual([]);
      expect(v1).toMatchObject({ version: 1, reemplazadoEn: null });
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${disparador} ON "dividendo_decretado"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${funcion}()`);
    }
  });

  it("dos cargas a la vez del mismo cambio: el candado las ordena; una escribe la v2 y la otra sale sin cambios", async () => {
    expect(await importar([fila(nemo("V"))], true)).toMatchObject({ estado: "APLICADO" });
    const cambio = [fila(nemo("V"), { valor_por_accion: "41.3729" })];
    const estados = (await Promise.all([importar(cambio, true), importar(cambio, true)])).map((r) => r.estado).sort();
    expect(estados).toEqual(["APLICADO", "SIN_CAMBIOS"]);
    expect((await versiones(ids["V"]!)).map((v) => [v.version, v.reemplazadoEn === null])).toEqual([[1, false], [2, true]]);
  });

  it("una fila cruda huérfana con la clave de la versión siguiente (P2002 en fila_fuente, defecto propio): sube, sin escribir nada", async () => {
    expect(await importar([fila(nemo("X"))], true)).toMatchObject({ estado: "APLICADO" });
    const carga = await db.cargaArchivo.create({ data: { tipoFuente: "REGISTRO_DECRETOS", nombreArchivo: "huerfana.ficticio.csv", sha256: "a".repeat(64), estado: "CARGADO", cargadoPorId: ids["dueno"]! } });
    await db.filaFuente.create({ data: { tipoFuente: "REGISTRO_DECRETOS", claveNatural: claveNaturalDecreto(ids["X"]!, { tipo: "ORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 1 }, 2), ocurrencia: 1, primeraCargaId: carga.id, primeraFilaNo: 2, crudo: {} } });
    const antes = await huella();
    await expect(importar([fila(nemo("X"), { valor_por_accion: "41.3729" })], true)).rejects.toMatchObject({ code: "P2002" });
    expect(await huella()).toEqual(antes);
    expect((await versiones(ids["X"]!)).map((v) => [v.version, v.reemplazadoEn === null])).toEqual([[1, true]]);
  });

  it("con dividendo_decretado bloqueada (como en una migración), la carga no espera más que su lock_timeout y no escribe", { timeout: 45_000 }, async () => {
    expect(await importar([fila(nemo("L"))], true)).toMatchObject({ estado: "APLICADO" });
    const antes = await huella();
    let bloqueada = false;
    const bloqueo = db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`LOCK TABLE "dividendo_decretado" IN ACCESS EXCLUSIVE MODE`);
      bloqueada = true;
      await new Promise((r) => setTimeout(r, 15_000));
    }, { timeout: 30_000, maxWait: 5_000 });
    while (!bloqueada) await new Promise((r) => setTimeout(r, 50));
    const inicio = Date.now();
    const intento = await importar([fila(nemo("L"), { valor_por_accion: "41.3729" })], true).then(() => "escribió", () => "falló");
    const espera = Date.now() - inicio;
    await bloqueo;
    expect(intento).toBe("falló");
    expect(espera).toBeLessThan(14_000);
    expect(await huella()).toEqual(antes);
  });

  it("un archivo con nuevos, cambios y anulaciones de varias especies queda en una sola carga, con sus conteos", async () => {
    expect(await importar([fila(nemo("Y")), fila(nemo("Y"), { cuota: "2" })], true)).toMatchObject({ estado: "APLICADO" });
    const r = await importar([
      fila(nemo("Y"), { valor_por_accion: "3.47" }), fila(nemo("Y"), { cuota: "2", anulada: "SI", nota: "anulada en la prueba" }),
      fila(nemo("Y"), { cuota: "3" }), fila(nemo("S"), { tipo: "EXTRAORDINARIO" }),
    ], true);
    expect(r).toMatchObject({ estado: "APLICADO", conteos: { filas: 4, nuevos: 2, versiones: 1, anulaciones: 1, sinCambios: 0 } });
    if (r.estado !== "APLICADO") return;
    expect(await db.filaFuente.count({ where: { primeraCargaId: r.cargaId! } })).toBe(4);
    expect(await db.dividendoDecretado.count({ where: { filaFuente: { primeraCargaId: r.cargaId! } } })).toBe(4);
  });
});
