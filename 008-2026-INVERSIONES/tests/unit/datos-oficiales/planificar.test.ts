// `planificar` (puro): qué filas del CSV de una serie entran nuevas, cuáles revisan a los vigentes que se solapan (que se
// retiran) y cuáles quedan igual. «Sin cambios» = mismos desde, hasta y valor (la fuente no entra: si entrara, cada
// anexo del DANE reescribiría toda la historia). `finDeLote` alarga un lote hasta cubrir lo que un vigente retirado toca
// después del corte: el retiro y su reemplazo van en la misma transacción. Cifras inventadas; fechas de 2027.
import { describe, expect, it } from "vitest";
import { finDeLote, planificar, type VigenteSerie } from "@/datos-oficiales/series/planificar";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fila = (desde: string, hasta: string, valor: string) => ({ desde: dia(desde), hasta: dia(hasta), valor });
const vigente = (id: string, desde: string, hasta: string, valor: string): VigenteSerie => ({ id, desde: dia(desde), hasta: dia(hasta), valor });

describe("planificar", () => {
  it("sin vigentes, todo entra nuevo y nada se retira", () => {
    const filas = [fila("2027-03-05", "2027-03-07", "4613.27"), fila("2027-03-08", "2027-03-08", "4613.29")];
    expect(planificar(filas, [])).toEqual({ nuevas: filas, revisadas: [], sinCambios: 0, aRetirar: [], diasDescubiertos: 0, extremoRetirado: null });
  });

  it("igual vigencia e igual valor (también con otra escala en la base): sin cambios", () => {
    const p = planificar([fila("2027-03-08", "2027-03-08", "9.5"), fila("2027-03-09", "2027-03-09", "9.37")], [
      vigente("a", "2027-03-08", "2027-03-08", "9.50000000"), vigente("b", "2027-03-09", "2027-03-09", "9.37"),
    ]);
    expect(p).toEqual({ nuevas: [], revisadas: [], sinCambios: 2, aRetirar: [], diasDescubiertos: 0, extremoRetirado: null });
  });

  it("igual vigencia y otro valor: revisión que retira al vigente", () => {
    const f = fila("2027-03-08", "2027-03-08", "9.41");
    expect(planificar([f], [vigente("a", "2027-03-08", "2027-03-08", "9.37")])).toEqual({
      nuevas: [], revisadas: [f], sinCambios: 0, aRetirar: ["a"], diasDescubiertos: 0, extremoRetirado: dia("2027-03-08"),
    });
  });

  it("vigencia acortada (la TRM del 05 al 07 pasa a ser solo del 05): revisión y 2 días sin vigente", () => {
    const f = fila("2027-03-05", "2027-03-05", "4613.27");
    expect(planificar([f], [vigente("a", "2027-03-05", "2027-03-07", "4613.27")])).toEqual({
      nuevas: [], revisadas: [f], sinCambios: 0, aRetirar: ["a"], diasDescubiertos: 2, extremoRetirado: dia("2027-03-07"),
    });
  });

  it("vigencia alargada: revisión sin días descubiertos", () => {
    const p = planificar([fila("2027-03-05", "2027-03-07", "4613.27")], [vigente("a", "2027-03-05", "2027-03-05", "4613.27")]);
    expect([p.revisadas.length, p.aRetirar, p.diasDescubiertos]).toEqual([1, ["a"], 0]);
  });

  it("un vigente que se solapa con varias filas se retira una sola vez y las filas cubren sus días", () => {
    const filas = [fila("2027-03-05", "2027-03-05", "4613.27"), fila("2027-03-06", "2027-03-07", "4613.27")];
    const p = planificar(filas, [vigente("a", "2027-03-05", "2027-03-07", "4613.27")]);
    expect(p).toEqual({ nuevas: [], revisadas: filas, sinCambios: 0, aRetirar: ["a"], diasDescubiertos: 0, extremoRetirado: dia("2027-03-07") });
  });

  it("una fila que se solapa con varios vigentes los retira a todos (sin importar el orden en que llegan)", () => {
    const f = fila("2027-03-05", "2027-03-07", "4613.27");
    const p = planificar([f], [vigente("c", "2027-03-07", "2027-03-07", "4613.27"), vigente("a", "2027-03-05", "2027-03-05", "4613.27"), vigente("b", "2027-03-06", "2027-03-06", "4613.27")]);
    expect(p).toEqual({ nuevas: [], revisadas: [f], sinCambios: 0, aRetirar: ["a", "b", "c"], diasDescubiertos: 0, extremoRetirado: dia("2027-03-07") });
  });

  it("un vigente en un hueco del CSV queda intacto", () => {
    const filas = [fila("2027-03-08", "2027-03-08", "9.37"), fila("2027-03-12", "2027-03-12", "9.41")];
    const p = planificar(filas, [vigente("hueco", "2027-03-10", "2027-03-10", "9.39"), vigente("antes", "2027-03-01", "2027-03-01", "9.31")]);
    expect(p).toEqual({ nuevas: filas, revisadas: [], sinCambios: 0, aRetirar: [], diasDescubiertos: 0, extremoRetirado: null });
  });

  it("todo junto: nuevas, sin cambios y revisadas, con el extremo más tardío de lo retirado", () => {
    const filas = [
      fila("2027-03-01", "2027-03-01", "9.31"), fila("2027-03-02", "2027-03-02", "9.33"), fila("2027-03-03", "2027-03-03", "9.37"), fila("2027-03-04", "2027-03-04", "9.41"),
    ];
    const p = planificar(filas, [vigente("v2", "2027-03-02", "2027-03-02", "9.33"), vigente("v3", "2027-03-03", "2027-03-03", "9.39"), vigente("v4", "2027-03-04", "2027-03-05", "9.41")]);
    expect(p).toEqual({ nuevas: [filas[0]], revisadas: [filas[2], filas[3]], sinCambios: 1, aRetirar: ["v3", "v4"], diasDescubiertos: 1, extremoRetirado: dia("2027-03-05") });
  });

  it("no cambia lo que recibe", () => {
    const filas = Object.freeze([Object.freeze(fila("2027-03-05", "2027-03-05", "4613.27"))]);
    const vigentes = Object.freeze([Object.freeze(vigente("b", "2027-03-06", "2027-03-06", "4613.29")), Object.freeze(vigente("a", "2027-03-05", "2027-03-05", "4613.21"))]);
    expect(() => planificar(filas, vigentes)).not.toThrow();
    expect(vigentes.map((v) => v.id)).toEqual(["b", "a"]);
  });
});

describe("finDeLote", () => {
  const filas = [fila("2027-03-05", "2027-03-05", "1.7"), fila("2027-03-06", "2027-03-07", "1.7"), fila("2027-03-08", "2027-03-08", "1.7"), fila("2027-03-09", "2027-03-09", "1.7")];

  it("sin nada retirado, o si lo retirado termina antes de la fila siguiente, el corte no se mueve", () => {
    expect(finDeLote(filas, 1, null)).toBe(1);
    expect(finDeLote(filas, 1, dia("2027-03-05"))).toBe(1);
  });

  it("si lo retirado alcanza filas después del corte, el lote las incluye (hasta la primera que empieza después)", () => {
    expect(finDeLote(filas, 1, dia("2027-03-06"))).toBe(2);
    expect(finDeLote(filas, 1, dia("2027-03-08"))).toBe(3);
    expect(finDeLote(filas, 1, dia("2027-03-31"))).toBe(4);
  });

  it("en el final de la serie no hay nada que alargar", () => {
    expect(finDeLote(filas, 4, dia("2027-03-31"))).toBe(4);
  });
});
