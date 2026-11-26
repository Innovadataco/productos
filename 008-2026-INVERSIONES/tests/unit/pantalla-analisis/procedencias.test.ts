// La procedencia de los cierres de /analisis cuenta los días hábiles de atraso con el mismo patrón que el tablero
// (frente fuente-retraso): el cierre más viejo que compone el valor avisa «dato de hace N días hábiles»; sin calendario
// que cubra el tramo, el aviso es aproximado. Datos inventados de 2027 (miércoles 17-mar; festivo el 22-mar).
import { describe, expect, it } from "vitest";
import { procedenciasDeCierres } from "@/app/analisis/procedencias";
import { componer } from "@/app/_comun/fecha-dato/componer";
import { avisoAtraso } from "@/app/_comun/fecha-dato/textos";
import { leerCalendario } from "@/precios/negociacion";
import { D, dia, especie, resumenDe } from "../tablero/ficticio";

const cierre = (iso: string, traidoEn: string, fuente = "yahoo") => ({ precio: D("100"), fecha: dia(iso), verificado: false, traidoEn: new Date(traidoEn), fuente });
const TABLERO = resumenDe([
  especie({ nemotecnico: "FICTA", cantidad: 10n, costoVivo: D(1000), cierre: cierre("2027-03-17", "2027-03-17T23:04:00Z") }),
  especie({ nemotecnico: "FICTB", cantidad: 10n, costoVivo: D(1000), cierre: cierre("2027-03-12", "2027-03-12T22:41:00Z", "bvc-ficticia") }),
  especie({ nemotecnico: "FICTC", cantidad: 10n, costoVivo: D(1000) }),
]).tablero;
const CAL = leerCalendario([{ dia: dia("2027-03-22"), esHabil: false }, { dia: dia("2027-04-01"), esHabil: true }]);
const bogota = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00-05:00`);
const MARTES = bogota("2027-03-23", "10:00");

describe("procedenciasDeCierres", () => {
  it("una por cada especie con cierre, con su día, su hora de Colombia, su fuente y los días hábiles de atraso", () => {
    const ps = procedenciasDeCierres(TABLERO, { ahora: MARTES, calendario: CAL });
    expect(ps).toHaveLength(2);
    const a = ps.find((p) => p.dia === "2027-03-17")!;
    expect(a).toMatchObject({ traidoEn: "2027-03-17 18:04", fuente: "yahoo", habilesAtras: 2 }); // jue 18 y vie 19; el lunes 22 fue festivo y hoy (10:00) aún no cerró
    expect(a).not.toHaveProperty("aniosSinFestivos");
  });

  it("al día: sin número que avisar (null)", () => {
    const ps = procedenciasDeCierres(TABLERO, { ahora: bogota("2027-03-18", "10:00"), calendario: CAL });
    expect(ps.find((p) => p.dia === "2027-03-17")?.habilesAtras).toBeNull();
  });

  it("sin calendario que cubra el año: aproximado, con el año y sin apagar el aviso", () => {
    const sin = leerCalendario([{ dia: dia("2026-01-01"), esHabil: false }]);
    const ps = procedenciasDeCierres(TABLERO, { ahora: MARTES, calendario: sin });
    const a = ps.find((p) => p.dia === "2027-03-17")!;
    expect(a.aniosSinFestivos).toEqual([2027]);
    expect(avisoAtraso(a)).toMatch(/^dato de hace unos \d+ días hábiles \(sin festivos de 2027 en el calendario\)$/);
  });

  it("compuesta por el cierre más viejo: el aviso es el de ese cierre", () => {
    const c = componer(procedenciasDeCierres(TABLERO, { ahora: MARTES, calendario: CAL }));
    expect(c?.masVieja.dia).toBe("2027-03-12");
    expect(avisoAtraso(c!.masVieja)).toMatch(/^dato de hace \d+ días hábiles$/);
  });
});
