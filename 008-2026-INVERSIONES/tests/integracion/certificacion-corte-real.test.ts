// Corte real de la certificación de A&V contra la base de PRUEBAS (frente certificacion-corte-real).
// Señal 2: el PDF trae su CreationDate con hora; si se generó el mismo día del corte pedido antes del cierre
// definitivo (17:00 COT, la hora de los precios), no es al cierre de ese día: RECHAZADO (la carga RECHAZADO guarda el
// código), ningún hecho, y sugiere el día con cierre definitivo a esa hora. Con un corte posterior al día de creación,
// FECHA_CORTE_POSTERIOR_AL_PDF con la misma sugerencia. Si el mismo PDF ya está cargado, lo dice (yaCargadaEn).
// Datos inventados: agosto de 2027 (calendario sembrado; festivo 2027-08-16) con `hoy` inyectado, cifras raras.
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importarCertificacion, type ArchivoCertificacion } from "@/importacion/av/importar";
import { cargarYConciliar } from "@/importacion/av/salida";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const email = `dueno-corte-real-${corrida.toLowerCase()}@ejemplo.invalid`;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
let duenoId = "";
let n = 0;

/** Dos especies con cifras raras (cantidad × precio = valor), un fondo propio y la CreationDate dada (hora COT). */
function caso(creado: string, hhmmss: string) {
  n += 1;
  const nemos = ["A", "B"].map((l) => `R${corrida}${n}${l}`);
  const nit = `99617${String(n).padStart(3, "0")}-4`;
  const codigoFic = `3719${n}${corrida.replace(/\D/g, "3").slice(0, 3)}`;
  const espec: EspecCertificacion = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit }],
    rentaVariable: [
      { nemo: nemos[0]!, cantidad: "41", precio: "COP 2.371,00", valor: "COP 97.211,00" },
      { nemo: nemos[1]!, cantidad: "127", precio: "COP 63,17", valor: "COP 8.022,59" },
    ],
    creadoEn: `D:${creado.replace(/-/g, "")}${hhmmss.replace(/:/g, "")}-05'00'`,
  };
  return { nemos, nit, codigoFic, espec };
}

type Caso = ReturnType<typeof caso>;
const archivo = (c: Caso, corte: string, hoy = "2027-08-20"): ArchivoCertificacion => ({
  contenido: generarCertificacionPdf(c.espec), usuarioId: duenoId, fechaCorte: dia(corte), fondoCodigo: c.codigoFic, hoy: dia(hoy),
});
const registrarFondo = (c: Caso) => db.instrumento.create({ data: { tipo: "FIC", codigoFic: c.codigoFic, nombre: "Fondo ficticio" } });
const sha = (c: Caso) => createHash("sha256").update(generarCertificacionPdf(c.espec)).digest("hex");
const errores = (codigo: string) => ({ total: 1, errores: [{ pagina: 0, fila: 0, columna: null, codigo }] });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("señal 2 · el PDF se generó antes del cierre definitivo del día pedido", () => {
  it("generado el 2027-08-04 a las 14:35 con ese corte: RECHAZADO, nada guardado, sugiere 2027-08-03; con esa fecha carga", async () => {
    const c = caso("2027-08-04", "14:35:17");
    await registrarFondo(c);
    const r = await importarCertificacion(db, archivo(c, "2027-08-04"));
    expect(r.estado).toBe("RECHAZADO");
    expect(r.errores.map((e) => e.codigo)).toEqual(["FECHA_CORTE_ANTES_DEL_CIERRE"]);
    expect(r.pistaCorte).toEqual({ tipo: "PDF", generadoEn: new Date("2027-08-04T19:35:17Z"), sugerido: { ok: true, dia: "2027-08-03" } });
    expect(r.yaCargadaEn).toBeNull();
    const cargas = await db.cargaArchivo.findMany({ where: { sha256: sha(c) }, select: { fechaCorte: true, estado: true, errores: true } });
    expect(cargas).toEqual([{ fechaCorte: dia("2027-08-04"), estado: "RECHAZADO", errores: errores("FECHA_CORTE_ANTES_DEL_CIERRE") }]);
    expect(await db.certificacion.count({ where: { fechaCorte: { in: [dia("2027-08-04"), dia("2027-08-03")] } } })).toBe(0);
    expect(await db.instrumento.count({ where: { nemotecnico: { in: c.nemos } } }), "no crea especies").toBe(0);

    const texto = (await cargarYConciliar(db, archivo(c, "2027-08-04"))).lineas.join("\n");
    expect(texto).toContain("--fecha-corte 2027-08-03");
    for (const dato of [...c.nemos, c.nit, c.codigoFic, "97.211", "8.022,59", "2.371", email]) expect(texto, dato).not.toContain(dato);

    const otra = await importarCertificacion(db, archivo(c, "2027-08-03"));
    expect([otra.estado, otra.errores]).toEqual(["CARGADO", []]);
  });

  it("generado el 2027-08-10 a las 14:35 con el corte del 2027-08-11: POSTERIOR_AL_PDF y sugiere 2027-08-09", async () => {
    const c = caso("2027-08-10", "14:35:41");
    await registrarFondo(c);
    const r = await importarCertificacion(db, archivo(c, "2027-08-11"));
    expect(r.errores.map((e) => e.codigo)).toEqual(["FECHA_CORTE_POSTERIOR_AL_PDF"]);
    expect(r.pistaCorte).toMatchObject({ tipo: "PDF", sugerido: { ok: true, dia: "2027-08-09" } });
  });

  it("generado el 2027-08-12 a las 17:03 (ya definitivo) con ese corte: CARGADO", async () => {
    const c = caso("2027-08-12", "17:03:29");
    await registrarFondo(c);
    const r = await importarCertificacion(db, archivo(c, "2027-08-12"));
    expect([r.estado, r.errores]).toEqual(["CARGADO", []]);
  });

  it("si el mismo PDF ya está cargado (de antes de este control) con ese corte: lo dice en yaCargadaEn", async () => {
    const c = caso("2027-08-19", "15:47:02");
    // Una carga CARGADO del mismo archivo, como la que dejó el defecto (aquí sin certificación: basta la carga).
    await db.cargaArchivo.create({
      data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "certificacion-av-2027-08-19.pdf", sha256: sha(c), fechaCorte: dia("2027-08-19"), estado: "CARGADO", cargadoPorId: duenoId },
    });
    const r = await importarCertificacion(db, archivo(c, "2027-08-19"));
    expect(r.errores.map((e) => e.codigo)).toEqual(["FECHA_CORTE_ANTES_DEL_CIERRE"]);
    expect(r.yaCargadaEn).toBe("2027-08-19");
    const texto = (await cargarYConciliar(db, archivo(c, "2027-08-19"))).lineas.join("\n");
    expect(texto).toContain("--fecha-corte 2027-08-19 --nueva-fecha-corte 2027-08-18");
  });
});

// Señal 1: los cierres ya guardados del corte y del día hábil anterior. Las especies se registran ANTES (como si ya
// tuvieran órdenes) para sembrar sus cierres; el PDF se generó al día siguiente del corte (la señal 2 no aplica).
describe("señal 1 · los precios de valoración son los cierres del día hábil anterior", () => {
  const sembrar = async (c: Caso, cierres: Readonly<Record<string, readonly (string | null)[]>>) => {
    const ids = await Promise.all(c.nemos.map(async (nemo) => (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo, nombre: nemo } })).id));
    for (const [fecha, precios] of Object.entries(cierres)) {
      const filas = ids.flatMap((instrumentoId, i) => (precios[i] ? [{ instrumentoId, fecha: dia(fecha), precio: precios[i]!, fuente: "yahoo", estado: "NO_VERIFICADO" as const }] : []));
      await db.precioCierre.createMany({ data: filas });
    }
    return ids;
  };
  const conUna = (c: Caso): Caso => ({ ...c, nemos: [c.nemos[0]!], espec: { ...c.espec, rentaVariable: [c.espec.rentaVariable[0]!] } });

  it("jueves 2027-08-26 valorado al miércoles: CORTE_NO_COINCIDE, sin certificación ni filas, sugiere 2027-08-25; con esa fecha carga", async () => {
    const c = caso("2027-08-27", "10:15:07");
    await registrarFondo(c);
    await sembrar(c, { "2027-08-25": ["2371", "63.17"], "2027-08-26": ["2371", "65.83"] });
    const r = await importarCertificacion(db, archivo(c, "2027-08-26", "2027-08-30"));
    expect(r.estado).toBe("RECHAZADO");
    expect(r.errores.map((e) => e.codigo)).toEqual(["CORTE_NO_COINCIDE"]);
    expect(r.pistaCorte).toEqual({ tipo: "PRECIOS", sugerido: "2027-08-25", especies: 2, distintas: 1 });
    const cargas = await db.cargaArchivo.findMany({ where: { sha256: sha(c) }, select: { id: true, fechaCorte: true, estado: true, errores: true } });
    expect(cargas.map(({ id: _id, ...resto }) => resto)).toEqual([{ fechaCorte: dia("2027-08-26"), estado: "RECHAZADO", errores: errores("CORTE_NO_COINCIDE") }]);
    expect(await db.filaFuente.count({ where: { primeraCargaId: { in: cargas.map((x) => x.id) } } })).toBe(0);
    expect(await db.certificacion.count({ where: { fechaCorte: dia("2027-08-26") } })).toBe(0);

    const texto = (await cargarYConciliar(db, archivo(c, "2027-08-26", "2027-08-30"))).lineas.join("\n");
    expect(texto).toContain("cuadran (±1 %) con los cierres del 2027-08-25, el día hábil anterior al corte, en las 2 especies");
    expect(texto).toContain("--fecha-corte 2027-08-25");
    for (const dato of [...c.nemos, "2371", "63.17", "65.83", email]) expect(texto, dato).not.toContain(dato);

    const otra = await importarCertificacion(db, archivo(c, "2027-08-25", "2027-08-30"));
    expect([otra.estado, otra.errores]).toEqual(["CARGADO", []]);
  });

  it("si a una especie le falta el cierre del día anterior: no se puede saber y carga", async () => {
    const c = caso("2027-09-10", "10:15:23");
    await registrarFondo(c);
    await sembrar(c, { "2027-09-08": ["2371", null], "2027-09-09": ["2389.17", "65.83"] });
    const r = await importarCertificacion(db, archivo(c, "2027-09-09", "2027-09-13"));
    expect([r.estado, r.errores]).toEqual(["CARGADO", []]);
  });

  it("si una especie todavía no existe (no tiene cierres): carga y la crea", async () => {
    const c = caso("2027-09-24", "10:15:31");
    await registrarFondo(c);
    const [id] = await Promise.all([db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: c.nemos[0]!, nombre: c.nemos[0]! } })]);
    await db.precioCierre.createMany({ data: [{ instrumentoId: id.id, fecha: dia("2027-09-22"), precio: "2371", fuente: "yahoo", estado: "NO_VERIFICADO" }, { instrumentoId: id.id, fecha: dia("2027-09-23"), precio: "2411.9", fuente: "yahoo", estado: "NO_VERIFICADO" }] });
    const r = await importarCertificacion(db, archivo(c, "2027-09-23", "2027-09-27"));
    expect([r.estado, r.errores, r.instrumentosCreados]).toEqual(["CARGADO", [], 1]);
  });

  it("si los precios son los del corte (y no los del día anterior): carga", async () => {
    const c = caso("2027-10-01", "10:15:43");
    await registrarFondo(c);
    await sembrar(c, { "2027-09-29": ["2311.7", "61.03"], "2027-09-30": ["2371", "63.17"] });
    const r = await importarCertificacion(db, archivo(c, "2027-09-30", "2027-10-04"));
    expect([r.estado, r.errores]).toEqual(["CARGADO", []]);
  });

  it("con una sola especie no concluye: carga", async () => {
    const c = conUna(caso("2027-10-08", "10:15:59"));
    await registrarFondo(c);
    await sembrar(c, { "2027-10-06": ["2371"], "2027-10-07": ["2449.3"] });
    const r = await importarCertificacion(db, { ...archivo(c, "2027-10-07", "2027-10-11"), contenido: generarCertificacionPdf({ ...c.espec, rentaVariable: [c.espec.rentaVariable[0]!] }) });
    expect([r.estado, r.errores]).toEqual(["CARGADO", []]);
  });

  it("reimportar la misma certificación ya cargada (repetida) no se bloquea aunque después lleguen los cierres", async () => {
    const c = caso("2027-10-15", "10:16:11");
    await registrarFondo(c);
    const ids = await Promise.all(c.nemos.map(async (nemo) => (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo, nombre: nemo } })).id));
    const primera = await importarCertificacion(db, archivo(c, "2027-10-14", "2027-10-18"));
    expect([primera.estado, primera.errores]).toEqual(["CARGADO", []]);
    await db.precioCierre.createMany({
      data: [["2027-10-13", "2371", "63.17"], ["2027-10-14", "2371", "65.83"]].flatMap(([fecha, a, b]) => [
        { instrumentoId: ids[0]!, fecha: dia(fecha!), precio: a!, fuente: "yahoo", estado: "NO_VERIFICADO" as const },
        { instrumentoId: ids[1]!, fecha: dia(fecha!), precio: b!, fuente: "yahoo", estado: "NO_VERIFICADO" as const },
      ]),
    });
    const otra = await importarCertificacion(db, archivo(c, "2027-10-14", "2027-10-18"));
    expect([otra.estado, otra.repetida, otra.errores]).toEqual(["CARGADO", true, []]);
  });
});
