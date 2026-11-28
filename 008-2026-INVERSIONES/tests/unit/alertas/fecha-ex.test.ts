import { describe, expect, it } from "vitest";
import { evaluarFechasEx, type DecretoParaAlerta } from "@/alertas/evaluar/fecha-ex";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const f = (s: string) => new Date(`${s}T00:00:00Z`);
// 2027-03-01 es lunes.
const decreto = (id: string, ex: string, o: Partial<DecretoParaAlerta> = {}): DecretoParaAlerta => ({
  id, instrumentoId: "FICTICIA-A", fechaEx: f(ex), fechaPago: f("2027-04-15"), vigente: true, anulada: false, ...o,
});
const movs = new Map([["FICTICIA-A", [{ fecha: f("2027-01-10"), cantidad: 10n }]]]);
const evaluar = (decretos: DecretoParaAlerta[], o: { hoy?: string; noHabiles?: string[]; movimientos?: typeof movs; u?: typeof UMBRALES_OMISION } = {}) =>
  evaluarFechasEx({ dia: o.hoy ?? "2027-03-01", hoy: f(o.hoy ?? "2027-03-01"), decretos, movimientos: o.movimientos ?? movs, noHabiles: new Set(o.noHabiles ?? []) }, o.u ?? UMBRALES_OMISION);

describe("evaluarFechasEx", () => {
  it("un ex que cae hoy salta", () => {
    expect(evaluar([decreto("d1", "2027-03-01")])).toMatchObject([{ tipo: "FECHA_EX", instrumentoId: "FICTICIA-A", reglaId: "d1", datos: { fechaEx: f("2027-03-01") } }]);
  });
  it("salta dentro de 3 días hábiles y no a los 4", () => {
    expect(evaluar([decreto("d1", "2027-03-04")])).toHaveLength(1); // jueves: martes, miércoles, jueves
    expect(evaluar([decreto("d1", "2027-03-05")])).toHaveLength(0);
  });
  it("los fines de semana y festivos no cuentan como hábiles", () => {
    expect(evaluar([decreto("d1", "2027-03-08")], { hoy: "2027-03-04" })).toHaveLength(1); // jueves → lunes: viernes y lunes = 2 hábiles
    expect(evaluar([decreto("d1", "2027-03-09")], { hoy: "2027-03-04", noHabiles: ["2027-03-08"] })).toHaveLength(1); // viernes y martes = 2 hábiles
    expect(evaluar([decreto("d1", "2027-03-10")], { hoy: "2027-03-04" })).toHaveLength(0); // viernes, lunes, martes y miércoles = 4
  });
  it("un ex en fin de semana o festivo cuenta: los hábiles hasta él se cuentan, y el de hoy salta", () => {
    expect(evaluar([decreto("d1", "2027-03-06")], { hoy: "2027-03-04" })).toHaveLength(1); // sábado: solo el viernes cuenta
    expect(evaluar([decreto("d1", "2027-03-07")], { hoy: "2027-03-05" })).toHaveLength(1); // domingo
    expect(evaluar([decreto("d1", "2027-03-08")], { hoy: "2027-03-08", noHabiles: ["2027-03-08"] })).toHaveLength(1); // festivo, es hoy
    expect(evaluar([decreto("d1", "2027-03-08")], { hoy: "2027-03-03", noHabiles: ["2027-03-08"] })).toHaveLength(1); // mié → festivo: jue y vie
    expect(evaluar([decreto("d1", "2027-03-14")], { hoy: "2027-03-04" })).toHaveLength(0); // domingo lejano: vie, lun, mar, mié, jue
  });
  it("un ex ya pasado no salta", () => {
    expect(evaluar([decreto("d1", "2027-02-26")])).toHaveLength(0);
  });
  it("un decreto anulado o reemplazado no salta", () => {
    expect(evaluar([decreto("d1", "2027-03-01", { anulada: true }), decreto("d2", "2027-03-01", { vigente: false })])).toHaveLength(0);
  });
  it("solo con tenencia de la especie antes de la ex", () => {
    expect(evaluar([decreto("d1", "2027-03-01")], { movimientos: new Map() })).toHaveLength(0);
    expect(evaluar([decreto("d1", "2027-03-01")], { movimientos: new Map([["FICTICIA-A", [{ fecha: f("2027-03-01"), cantidad: 10n }]]]) })).toHaveLength(0); // la compra del día de la ex no cobra
    expect(evaluar([decreto("d1", "2027-03-01")], { movimientos: new Map([["FICTICIA-A", [{ fecha: f("2027-02-28"), cantidad: 10n }]]]) })).toHaveLength(1);
  });
  it("una alerta por decreto, con una clave que no cambia de un día a otro", () => {
    const r = evaluar([decreto("d2", "2027-03-02"), decreto("d1", "2027-03-02", { instrumentoId: "FICTICIA-A" })]);
    expect(r).toHaveLength(2);
    expect(new Set(r.map((a) => a.clave)).size).toBe(2);
    const otroDia = evaluar([decreto("d1", "2027-03-02")], { hoy: "2027-03-02" });
    expect(otroDia[0]!.clave).toBe(r.find((a) => a.reglaId === "d1")!.clave);
  });
  it("respeta los días del umbral y el interruptor", () => {
    expect(evaluar([decreto("d1", "2027-03-05")], { u: { ...UMBRALES_OMISION, alertaExDiasHabiles: 4 } })).toHaveLength(1);
    expect(evaluar([decreto("d1", "2027-03-01")], { u: { ...UMBRALES_OMISION, alertaExActiva: false } })).toHaveLength(0);
  });
  it("lleva las fechas del decreto para el texto", () => {
    const [a] = evaluar([decreto("d1", "2027-03-01")]);
    expect(a!.datos.fechaPago).toEqual(f("2027-04-15"));
  });
});
