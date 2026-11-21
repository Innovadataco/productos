// Fecha de corte no hábil de la certificación de A&V contra la base de PRUEBAS, con el calendario_bvc sembrado
// por las migraciones (seguimiento «corte no hábil»):
// (a) PDF generado en fin de semana o festivo, (b) fecha de corte no hábil: se rechaza como hasta hoy (la carga
//     RECHAZADO guarda lo mismo), se dice el último día hábil anterior y cómo correrlo; nada se ajusta solo.
// (c) La conciliación compara el cierre del día EXACTO del corte guardado (siempre hábil), nunca el anterior; si A&V
//     valoró a otro día, todos los precios difieren y lo dice (fecha_corte_dudosa).
// Datos inventados: fechas de 2027 (festivos del calendario sembrado) y de 2021 (año sin sembrar), cifras raras.
// No escribe órdenes, caja, dividendos, ajustes, eventos ni lotes (la guarda de 2022 de conciliacion.test.ts).
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { importarCertificacion, type ArchivoCertificacion } from "@/importacion/av/importar";
import { cargarYConciliar } from "@/importacion/av/salida";
import { POR_CLI_MS, comprobar, correr, entornoMinimo } from "../ayudas/cli";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const email = `dueno-corte-${corrida.toLowerCase()}@ejemplo.invalid`;
const DIA = 86_400_000;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
let duenoId = "";
let carpeta = "";
let n = 0;

/** Dos especies con cifras raras (cantidad × precio = valor) y un fondo propio por caso. */
function espec(generado: string): { espec: EspecCertificacion; nemos: string[]; nit: string; codigoFic: string } {
  n += 1;
  const nemos = ["A", "B"].map((l) => `Q${corrida}${n}${l}`);
  const nit = `99413707${n}-3`;
  return {
    nemos, nit, codigoFic: `4613${n}${corrida.replace(/\D/g, "7").slice(0, 3)}`,
    espec: {
      ...CERTIFICACION_FICTICIA,
      fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit }],
      rentaVariable: [
        { nemo: nemos[0]!, cantidad: "37", precio: "COP 1.237,00", valor: "COP 45.769,00" },
        { nemo: nemos[1]!, cantidad: "113", precio: "COP 46,13", valor: "COP 5.212,69" },
      ],
      creadoEn: `D:${generado.replace(/-/g, "")}101500-05'00'`,
    },
  };
}

type Caso = ReturnType<typeof espec>;
const archivo = (c: Caso, fechaCorte: string, hoy: string): ArchivoCertificacion => ({
  contenido: generarCertificacionPdf(c.espec), usuarioId: duenoId, fechaCorte: dia(fechaCorte), fondoCodigo: c.codigoFic, hoy: dia(hoy),
});
const registrarFondo = (c: Caso) => db.instrumento.create({ data: { tipo: "FIC", codigoFic: c.codigoFic, nombre: "Fondo ficticio" } });
const sha = (c: Caso) => createHash("sha256").update(generarCertificacionPdf(c.espec)).digest("hex");
const ERRORES_NO_HABIL = { total: 1, errores: [{ pagina: 0, fila: 0, columna: null, codigo: "FECHA_CORTE_NO_HABIL" }] };

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  carpeta = mkdtempSync(join(tmpdir(), "inv-corte-no-habil-"));
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("certificación con fecha de corte no hábil (calendario_bvc sembrado)", () => {
  it("(a)(b) PDF del lunes festivo 2027-10-18 con ese corte: RECHAZADO igual que antes, dice 2027-10-15 y cómo correrlo; con 2027-10-15 carga", async () => {
    const c = espec("2027-10-18");
    await registrarFondo(c);
    const r = await cargarYConciliar(db, archivo(c, "2027-10-18", "2027-10-19"));
    const texto = r.lineas.join("\n");
    expect(r.codigo).toBe(1);
    expect(texto).toContain("FECHA_CORTE_NO_HABIL");
    expect(texto).toContain("Según calendario_bvc, el último día hábil anterior es 2027-10-15.");
    expect(texto).toContain("--fecha-corte 2027-10-15");
    for (const dato of [...c.nemos, c.nit, c.codigoFic, "45.769", "5.212,69", "1.237", email]) expect(texto, dato).not.toContain(dato);
    // Lo guardado no cambia: la misma carga RECHAZADO con el mismo código, y nada con la fecha sugerida.
    const cargas = await db.cargaArchivo.findMany({ where: { sha256: sha(c) }, select: { fechaCorte: true, estado: true, filasTotal: true, errores: true } });
    expect(cargas).toEqual([{ fechaCorte: dia("2027-10-18"), estado: "RECHAZADO", filasTotal: 4, errores: ERRORES_NO_HABIL }]);
    expect(await db.certificacion.count({ where: { fechaCorte: { in: [dia("2027-10-18"), dia("2027-10-15")] } } })).toBe(0);

    const otra = await cargarYConciliar(db, archivo(c, "2027-10-15", "2027-10-19"));
    expect(otra.codigo, otra.lineas.join("\n")).toBe(0);
    expect(otra.lineas.join("\n")).toContain("✅ CARGADO · 4 filas");
    expect(otra.lineas.join("\n")).toContain("Conciliación al 2027-10-15");
  });

  it("(a) si el día que toca es de un año sin calendario sembrado (2021): lo dice y no sugiere fecha", async () => {
    expect(await db.calendarioBvc.count({ where: { dia: { gte: dia("2021-01-01"), lt: dia("2022-01-01") } } }), "2021 no debe estar sembrado").toBe(0);
    const c = espec("2021-06-12");
    const r = await cargarYConciliar(db, archivo(c, "2021-06-12", "2021-06-14"));
    expect(r.codigo).toBe(1);
    expect(r.lineas.join("\n")).toContain("calendario_bvc no cubre 2021: no se puede indicar el último día hábil anterior");
    expect(r.lineas.join("\n")).not.toContain("--fecha-corte 2021");
  });

  it("(c) PDF del sábado 2027-09-18 cargado al viernes: sin cierre del viernes no usa el del jueves; si A&V valoró al jueves, fecha_corte_dudosa", async () => {
    const c = espec("2027-09-18");
    await registrarFondo(c);
    const cargada = await importarCertificacion(db, archivo(c, "2027-09-17", "2027-09-20"));
    expect(cargada.errores).toEqual([]);
    const ids = await Promise.all(c.nemos.map(async (nemo) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: nemo } })).id));
    const cierres = (fecha: string, precios: readonly string[]) =>
      db.precioCierre.createMany({ data: ids.map((instrumentoId, i) => ({ instrumentoId, fecha: dia(fecha), precio: new Prisma.Decimal(precios[i]!), fuente: "yahoo", estado: "VERIFICADO" })) });
    const total = async () => {
      const { conciliacionId } = await conciliarCertificacion(db, { fechaCorte: dia("2027-09-17") });
      return (await db.controlConciliacion.findFirstOrThrow({ where: { conciliacionId, tipo: "VALOR", instrumentoId: null }, select: { codigoMotivo: true } })).codigoMotivo;
    };
    // A&V valoró al jueves: los cierres del jueves son sus precios de valoración.
    await cierres("2027-09-16", ["1237", "46.13"]);
    expect(await total()).toBe("sin_precio_al_corte");
    await cierres("2027-09-17", ["1261.37", "47.29"]);
    expect(await total()).toBe("fecha_corte_dudosa");
  });
});

describe("importar-certificacion como proceso con una fecha de corte no hábil", { timeout: 2 * POR_CLI_MS }, () => {
  // Reloj real: 2027 es futuro, pero la fecha no hábil se mira antes que la futura (fecha-corte.ts).
  it("PDF del sábado santo 2027-03-27 con ese corte: 1, dice 2027-03-24 y el comando; sin correo, especies, cifras ni ruta", () => {
    const c = espec("2027-03-27");
    const ruta = join(carpeta, "cert.ficticio.pdf");
    writeFileSync(ruta, generarCertificacionPdf(c.espec));
    const claves = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;
    const s = correr("importar-certificacion.ts", ["--email", email, "--fecha-corte", "2027-03-27", ruta], entornoMinimo({ DATABASE_URL: URL_BASE, ...claves }));
    const nunca = [email, ...c.nemos, c.nit, "000000001", "45.769", "5.212,69", "1.237", "Titular", carpeta, URL_BASE, "postgresql://"];
    comprobar(s, 1, "Según calendario_bvc, el último día hábil anterior es 2027-03-24.", nunca);
    expect(s.texto).toContain("FECHA_CORTE_NO_HABIL");
    expect(s.texto).toContain("--fecha-corte 2027-03-24 [--fondo <codigoFic>] <certificacion.pdf>");
  });
});
