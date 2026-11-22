// La conciliación detecta el corte real contra la base de PRUEBAS (frente certificacion-corte-real): si los precios de
// valoración de TODAS las especies cuadran (±1 %) con los cierres del día hábil anterior al corte (calendario_bvc) y
// alguna no cuadra con los del corte, el total dice fecha_corte_dudosa con la fecha sugerida, aunque otra especie
// tenga el mismo cierre los dos días (el caso del defecto). La lectura de la pantalla la ve al día.
// La certificación se importa ANTES de sembrar los cierres (si no, la importación la rechazaría por el corte real).
// Datos inventados: septiembre de 2027 (jueves y su miércoles), cifras raras. Sin órdenes, caja ni lotes.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { leerConciliacion } from "@/conciliacion/leer";
import { importarCertificacion } from "@/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
let duenoId = "";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-conc-corte-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("conciliación con la certificación al cierre del día hábil anterior", () => {
  it("jueves 2027-09-02 valorado al miércoles: fecha_corte_dudosa con fechaSugerida 2027-09-01; el resumen la trae y la lectura está al día", async () => {
    const nemos = ["A", "B"].map((l) => `K${corrida}${l}`);
    const espec: EspecCertificacion = {
      ...CERTIFICACION_FICTICIA,
      fondos: [],
      rentaVariable: [
        { nemo: nemos[0]!, cantidad: "41", precio: "COP 2.371,00", valor: "COP 97.211,00" },
        { nemo: nemos[1]!, cantidad: "127", precio: "COP 63,17", valor: "COP 8.022,59" },
      ],
      creadoEn: "D:20270903101731-05'00'",
    };
    const corte = dia("2027-09-02");
    const r = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: corte, hoy: dia("2027-09-06") });
    expect(r.errores).toEqual([]);
    const ids = await Promise.all(nemos.map(async (n) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: n } })).id));
    const cierres = (fecha: string, precios: readonly string[]) =>
      db.precioCierre.createMany({ data: ids.map((instrumentoId, i) => ({ instrumentoId, fecha: dia(fecha), precio: new Prisma.Decimal(precios[i]!), fuente: "yahoo", estado: "NO_VERIFICADO" })) });
    // Miércoles: los dos son los precios de valoración. Jueves: el primero repite su cierre, el segundo sube.
    await cierres("2027-09-01", ["2371", "63.17"]);
    await cierres("2027-09-02", ["2371", "65.83"]);

    const resumen = await conciliarCertificacion(db, { fechaCorte: corte });
    expect(resumen).toMatchObject({ resultado: "NO_CUADRA", versionCalculo: "conciliacion-v2", corteSugerido: "2027-09-01" });
    expect(resumen.motivos).toContain("fecha_corte_dudosa");
    const total = await db.controlConciliacion.findFirstOrThrow({ where: { conciliacionId: resumen.conciliacionId, tipo: "VALOR", instrumentoId: null }, select: { codigoMotivo: true, detalle: true } });
    expect(total).toEqual({ codigoMotivo: "fecha_corte_dudosa", detalle: { alcance: "total_acciones", fechaSugerida: "2027-09-01" } });

    const lectura = await leerConciliacion(db, corte);
    expect(lectura?.frescura).toBe("AL_DIA");
  });
});
