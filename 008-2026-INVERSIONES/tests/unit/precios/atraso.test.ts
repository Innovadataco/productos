// Días hábiles de atraso de un cierre (frente fuente-retraso), según el calendario de la BVC; si el calendario no cubre un
// año, se cuentan los días de semana sin festivos como cota superior y el resultado es aproximado. Fechas inventadas de 2027:
// el 22-mar es festivo y se siembra aquí; el 17-mar-2027 es miércoles. Las horas son de Colombia (UTC−5).
import { describe, expect, it } from "vitest";
import { atrasoParaAviso, CALENDARIO_DE_RESPALDO, camposDeAtraso, diasHabilesDeAtraso, MAX_HABILES } from "@/precios/atraso";
import type { CalendarioBvc } from "@/precios/negociacion";

const CAL: CalendarioBvc = { noHabiles: new Set(["2027-03-22"]), aniosCubiertos: new Set([2027]) };
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** El instante de las `hhmm` de Colombia de un día. */
const bogota = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00-05:00`);
const MIERCOLES = dia("2027-03-17");

describe("diasHabilesDeAtraso", () => {
  it("el mismo día o uno posterior al hoy: 0", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-17", "20:00"), CAL)?.dias).toBe(0);
    expect(diasHabilesDeAtraso(dia("2027-03-19"), bogota("2027-03-17", "10:00"), CAL)?.dias).toBe(0);
  });

  it("hoy solo cuenta cuando su rueda ya cerró (17:00 de Colombia)", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "10:00"), CAL)?.dias).toBe(0);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "16:59"), CAL)?.dias).toBe(0);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "17:00"), CAL)?.dias).toBe(1);
  });

  it("no cuenta fines de semana ni festivos del calendario", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-22", "10:00"), CAL)?.dias).toBe(2); // jue y vie; sáb, dom y festivo no
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "10:00"), CAL)?.dias).toBe(2); // el lunes festivo no suma
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), CAL)?.dias).toBe(3);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "10:00"), { ...CAL, noHabiles: new Set() })?.dias).toBe(3);
  });

  it("un cierre de hace más del tope no devuelve null: un aviso aproximado con el tope", () => {
    expect(diasHabilesDeAtraso(dia("2010-01-04"), bogota("2027-03-17", "10:00"), CAL)).toEqual({ dias: MAX_HABILES, aproximado: true, aniosSinFestivos: [], respaldo: false, tope: true });
    expect(atrasoParaAviso(dia("2010-01-04"), bogota("2027-03-17", "10:00"), CAL)?.tope).toBe(true);
  });

  it("si la LECTURA del calendario falló (respaldo), lo marca; un calendario que solo no cubre el año, no", () => {
    const sinCubrir: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set() };
    const respaldo = diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), CALENDARIO_DE_RESPALDO);
    expect(respaldo).toEqual({ dias: 4, aproximado: true, aniosSinFestivos: [], respaldo: true, tope: false });
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), sinCubrir)).toEqual({ dias: 4, aproximado: true, aniosSinFestivos: [2027], respaldo: false, tope: false });
  });

  it("con todo el tramo cubierto, el resultado es exacto", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), CAL)).toEqual({ dias: 3, aproximado: false, aniosSinFestivos: [], respaldo: false, tope: false });
  });

  it("un año que el calendario no cubre: cuenta los días de semana sin festivos (cota superior) y lo marca aproximado", () => {
    // 31-dic-2026 (jue, sin calendario), 1-ene (vie), 4-ene (lun) de 2027; el 5-ene a las 10:00 aún no cerró.
    expect(diasHabilesDeAtraso(dia("2026-12-30"), bogota("2027-01-05", "10:00"), CAL)).toEqual({ dias: 3, aproximado: true, aniosSinFestivos: [2026], respaldo: false, tope: false });
  });

  it("sin ningún año cubierto (calendario vacío) cuenta todo como hábil entre semana, aunque haya festivos; no baja del exacto", () => {
    const vacio: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set() };
    const exacto = diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), CAL)!;
    const aprox = diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), vacio)!;
    expect(aprox).toEqual({ dias: 4, aproximado: true, aniosSinFestivos: [2027], respaldo: false, tope: false });
    expect(aprox.dias).toBeGreaterThanOrEqual(exacto.dias);
  });

  it("varios años sin calendario: los dice todos, sin repetir y en orden", () => {
    const solo2027: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set([2027]) };
    expect(diasHabilesDeAtraso(dia("2026-12-23"), bogota("2028-01-04", "18:00"), solo2027)?.aniosSinFestivos).toEqual([2026, 2028]);
  });

  it("hoy cuenta solo después de la hora definitiva también sin calendario", () => {
    const vacio: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set() };
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "16:59"), vacio)?.dias).toBe(0);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "17:00"), vacio)?.dias).toBe(1);
  });

  it("no depende de la zona del proceso: usa el día de Colombia (23:30 allí ya es el día siguiente en UTC)", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "23:30"), CAL)?.dias).toBe(1);
  });
});

describe("atrasoParaAviso", () => {
  it("avisa solo con más de un día hábil", () => {
    expect(atrasoParaAviso(MIERCOLES, bogota("2027-03-18", "18:00"), CAL)).toBeNull();
    expect(atrasoParaAviso(MIERCOLES, bogota("2027-03-19", "18:00"), CAL)?.dias).toBe(2);
    expect(atrasoParaAviso(MIERCOLES, bogota("2027-03-23", "18:00"), CAL)?.dias).toBe(3);
  });

  it("un año sin calendario también avisa, aproximado; con menos de dos días, nada", () => {
    expect(atrasoParaAviso(dia("2026-12-30"), bogota("2027-01-05", "10:00"), CAL)).toEqual({ dias: 3, aproximado: true, aniosSinFestivos: [2026], respaldo: false, tope: false });
    expect(atrasoParaAviso(dia("2026-12-30"), bogota("2027-01-01", "10:00"), CAL)).toBeNull();
  });
});

describe("camposDeAtraso (lo que viaja a la pantalla)", () => {
  it("exacto: solo el número; aproximado: el número y los años sin festivos; sin aviso: null", () => {
    expect(camposDeAtraso({ dias: 3, aproximado: false, aniosSinFestivos: [], respaldo: false, tope: false })).toEqual({ habilesAtras: 3 });
    expect(camposDeAtraso({ dias: 3, aproximado: true, aniosSinFestivos: [2027], respaldo: false, tope: false })).toEqual({ habilesAtras: 3, aniosSinFestivos: [2027] });
    expect(camposDeAtraso(null)).toEqual({ habilesAtras: null });
    expect(camposDeAtraso({ dias: 4, aproximado: true, aniosSinFestivos: [], respaldo: true, tope: false })).toEqual({ habilesAtras: 4, calendarioNoLeido: true });
    expect(camposDeAtraso({ dias: MAX_HABILES, aproximado: true, aniosSinFestivos: [], respaldo: false, tope: true })).toEqual({ habilesAtras: MAX_HABILES, masDelTope: true });
  });
});
