/**
 * Fecha de corte no hábil de la certificación de A&V (seguimiento «corte no hábil»). Se rechaza como hasta hoy
 * (FECHA_CORTE_NO_HABIL, lo guardado no cambia) y el CLI dice cuál es el último día hábil anterior según
 * calendario_bvc y cómo correrlo de nuevo. Nunca se ajusta sola, nunca reimporta por su cuenta y nunca da por hábil
 * un día de un año sin calendario sembrado. Calendarios y fechas inventados: festivos de 2027 y años anteriores a 2022.
 */
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ArchivoCertificacion, ResultadoImportacionAv } from "@/importacion/av/importar";
import { calendarioDe, leerCalendarioCorte, ultimoHabilAnterior, type CalendarioCorte } from "@/importacion/av/fecha-corte";
import { cargarYConciliar, type Pasos } from "@/importacion/av/salida";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
/** 2027 sembrado entero (trae enero y diciembre); 2026, 2028 y 2021 no. 2027-12-31 se marca no hábil (inventado). */
const FESTIVOS_2027 = ["2027-01-01", "2027-01-11", "2027-03-25", "2027-03-26", "2027-10-18", "2027-12-08", "2027-12-31"];
const CAL = (): CalendarioCorte => calendarioDe(FESTIVOS_2027.map(dia));

describe("ultimoHabilAnterior", () => {
  it("sábado, domingo o lunes festivo → el viernes anterior", () => {
    for (const d of ["2027-10-16", "2027-10-17", "2027-10-18"]) expect(ultimoHabilAnterior(dia(d), CAL()), d).toEqual({ ok: true, dia: "2027-10-15" });
  });

  it("Semana Santa: del sábado o del viernes santo pasa los dos festivos → miércoles", () => {
    expect(ultimoHabilAnterior(dia("2027-03-27"), CAL())).toEqual({ ok: true, dia: "2027-03-24" });
    expect(ultimoHabilAnterior(dia("2027-03-26"), CAL())).toEqual({ ok: true, dia: "2027-03-24" });
  });

  it("cruza al año anterior si está sembrado, con sus festivos", () => {
    expect(ultimoHabilAnterior(dia("2028-01-02"), CAL())).toEqual({ ok: true, dia: "2027-12-30" });
  });

  it("no adivina: si el día entre semana que toca mirar es de un año sin calendario sembrado, devuelve ese año", () => {
    expect(ultimoHabilAnterior(dia("2027-01-01"), CAL())).toEqual({ ok: false, anioSinCalendario: 2026 });
    expect(ultimoHabilAnterior(dia("2021-06-12"), CAL())).toEqual({ ok: false, anioSinCalendario: 2021 });
  });

  it("calendarioDe arma los no hábiles y solo cuenta los años con festivos de enero y de diciembre", () => {
    expect([...CAL().aniosSembrados]).toEqual([2027]);
    expect(CAL().noHabiles.has("2027-10-18")).toBe(true);
  });
});

describe("leerCalendarioCorte", () => {
  it("lee de calendario_bvc solo los días no hábiles, como la importación", async () => {
    let consulta: unknown = null;
    const db = { calendarioBvc: { findMany: async (q: unknown) => ((consulta = q), FESTIVOS_2027.map((d) => ({ dia: dia(d) }))) } } as unknown as Pick<PrismaClient, "calendarioBvc">;
    const cal = await leerCalendarioCorte(db);
    expect(consulta).toEqual({ where: { esHabil: false }, select: { dia: true } });
    expect([[...cal.noHabiles].sort(), [...cal.aniosSembrados]]).toEqual([[...FESTIVOS_2027].sort(), [2027]]);
  });
});

const db = {} as PrismaClient;
/** PDF generado el lunes festivo 2027-10-18 y el dueño da ese mismo día. */
const entrada: ArchivoCertificacion = { contenido: new Uint8Array([37, 80, 68, 70]), usuarioId: "u", fechaCorte: dia("2027-10-18"), fondoCodigo: "4613707", hoy: dia("2027-10-19") };
const rechazo = (codigo: string): ResultadoImportacionAv => ({
  cargaId: "c1", estado: "RECHAZADO", repetida: false, certificacionId: null, filasTotal: 4, filasNuevas: 0, filasRepetidas: 0, instrumentosCreados: 0, fondoVinculado: false,
  errores: [{ pagina: 0, fila: 0, columna: null, codigo }],
});

type LeerCalendario = NonNullable<Pasos["calendario"]>;

/** Pasos falsos que cuentan lo que se llamó: importar, conciliar y leer el calendario (null: sin ese paso). */
function pasos(codigo: string, calendario: LeerCalendario | null = async () => CAL()) {
  const llamadas = { importar: [] as Date[], conciliar: 0, calendario: 0 };
  const base: Pasos = {
    importar: async (_db, a) => (llamadas.importar.push(a.fechaCorte), rechazo(codigo)),
    conciliar: async () => ((llamadas.conciliar += 1), Promise.reject(new Error("no debía conciliar"))),
  };
  const p: Pasos = calendario === null ? base : { ...base, calendario: async (d) => ((llamadas.calendario += 1), calendario(d)) };
  return { p, llamadas };
}

describe("cargarYConciliar con una fecha de corte no hábil", () => {
  it("rechaza (1) y dice el último día hábil anterior según calendario_bvc y el comando para correrlo; no reimporta ni concilia", async () => {
    const { p, llamadas } = pasos("FECHA_CORTE_NO_HABIL");
    const r = await cargarYConciliar(db, entrada, p);
    const texto = r.lineas.join("\n");
    expect(r.codigo).toBe(1);
    expect(texto).toContain("página 0 · fila 0 · FECHA_CORTE_NO_HABIL");
    expect(texto).toContain("La fecha de corte 2027-10-18 no es día hábil de la BVC y no se ajusta sola.");
    expect(texto).toContain("Según calendario_bvc, el último día hábil anterior es 2027-10-15.");
    expect(texto).toContain("Si la certificación de A&V es al cierre de ese día");
    expect(texto).toContain("`npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte 2027-10-15 [--fondo <codigoFic>] <certificacion.pdf>`");
    expect(texto).toContain("con el mismo `--fondo`, si lo dio");
    expect(texto).toContain("La nueva corrida vuelve a validar la fecha");
    expect(llamadas).toEqual({ importar: [dia("2027-10-18")], conciliar: 0, calendario: 1 });
    expect(texto, "el código del fondo no se repite").not.toContain("4613707");
  });

  it("en producción: el mismo PDF por cargar-prod.sh importar-certificacion, con la fecha en la cabecera; nunca npx tsx", async () => {
    const { p } = pasos("FECHA_CORTE_NO_HABIL");
    const texto = (await cargarYConciliar(db, entrada, p, { produccion: true })).lineas.join("\n");
    expect(texto).toContain("`cargar-prod.sh importar-certificacion` con el mismo PDF y, en la cabecera, `--fecha-corte 2027-10-15`");
    expect(texto).not.toContain("npx tsx");
    expect(texto).not.toContain("precios:actualizar");
  });

  it("si el día que toca es de un año sin calendario: lo dice y no da fecha ni comando (no adivina)", async () => {
    const { p } = pasos("FECHA_CORTE_NO_HABIL");
    const texto = (await cargarYConciliar(db, { ...entrada, fechaCorte: dia("2021-06-12") }, p)).lineas.join("\n");
    expect(texto).toContain("La fecha de corte 2021-06-12 no es día hábil de la BVC y no se ajusta sola.");
    expect(texto).toContain("calendario_bvc no cubre 2021: no se puede indicar el último día hábil anterior; hay que sembrar ese año.");
    expect(texto).not.toContain("--fecha-corte 2021");
  });

  it("si no se puede leer calendario_bvc: 1, lo dice con el nombre del error y sin su mensaje", async () => {
    const falla = Object.assign(new Error("detalle interno con cifras 37911"), { name: "ErrorFicticio" });
    const { p } = pasos("FECHA_CORTE_NO_HABIL", async () => Promise.reject(falla));
    const r = await cargarYConciliar(db, entrada, p);
    const texto = r.lineas.join("\n");
    expect(r.codigo).toBe(1);
    expect(texto).toContain("No se pudo leer calendario_bvc para indicar el último día hábil anterior (ErrorFicticio): corra de nuevo con un día hábil de la BVC.");
    expect(texto).not.toContain("37911");
  });

  it("otro motivo de rechazo (también de fecha) no lee el calendario ni sugiere fecha", async () => {
    for (const codigo of ["VALOR_INCOHERENTE", "FECHA_CORTE_POSTERIOR_AL_PDF", "CALENDARIO_BVC_INCOMPLETO"]) {
      const { p, llamadas } = pasos(codigo);
      const texto = (await cargarYConciliar(db, entrada, p)).lineas.join("\n");
      expect([llamadas.calendario, texto.includes("📅"), texto.includes("último día hábil")], codigo).toEqual([0, false, false]);
    }
  });

  it("sin el paso del calendario, lo lee de calendario_bvc con la base que se le pasa", async () => {
    const { p } = pasos("FECHA_CORTE_NO_HABIL", null);
    const conCalendario = { calendarioBvc: { findMany: async () => FESTIVOS_2027.map((d) => ({ dia: dia(d) })) } } as unknown as PrismaClient;
    const texto = (await cargarYConciliar(conCalendario, entrada, p)).lineas.join("\n");
    expect(texto).toContain("el último día hábil anterior es 2027-10-15.");
  });
});
