// Resumen del resultado de las decisiones por horizonte: conteos por veredicto, lo que no se calculó, el total en pesos
// sin las de escisión, las medidas por decisión y las violaciones del contrato. Puro.
import { describe, expect, it } from "vitest";
import { resumirDecisiones } from "@/analisis/decisiones";
import { D, decision, horizonte } from "./fixtures/portafolio.ficticio";

const lista = [
  decision("FICTICIA-DEC-A", horizonte(30, { pesos: "5246.37", objetivos: ["2021-02-11", "2021-02-19"] }), horizonte(90, { estado: "PENDIENTE", veredicto: null, pesos: null })),
  decision("FICTICIA-DEC-B", horizonte(30, { veredicto: "NO_FUNCIONO", pesos: "-1237.41", incluyeDividendos: false, verificado: false }), horizonte(90, { veredicto: "NO_FUNCIONO", pesos: "-4613.27", objetivos: ["2021-04-29"] })),
  decision("FICTICIA-DEC-C", horizonte(30, { veredicto: "NEUTRO", pesos: "0" }), horizonte(90, { estado: "SIN_PRECIO", veredicto: null, pesos: null })),
  decision("FICTICIA-DEC-D", horizonte(30, { veredicto: null, pesos: "-3791.17", escision: true }), horizonte(90, { estado: "SIN_ORDEN", veredicto: null, pesos: null })),
];

describe("resumen de decisiones", () => {
  const r = resumirDecisiones(lista);

  it("a 30 días: un FUNCIONO, un NO_FUNCIONO, un NEUTRO y uno sin veredicto por escisión, que no suma", () => {
    expect(r.d30).toEqual({
      horizonteDias: 30, decisiones: 4, veredictos: { FUNCIONO: 1, NO_FUNCIONO: 1, NEUTRO: 1 }, sinVeredicto: 1, pendientes: 0, sinPrecio: 0, sinOrden: 0,
      totalPesos: D("4008.96"), sinDividendosEnTotal: 1, noVerificadasEnTotal: 1,
    });
  });

  it("a 90 días: el total es solo del horizonte (nunca entre horizontes)", () => {
    expect(r.d90).toEqual({
      horizonteDias: 90, decisiones: 4, veredictos: { FUNCIONO: 0, NO_FUNCIONO: 1, NEUTRO: 0 }, sinVeredicto: 0, pendientes: 1, sinPrecio: 1, sinOrden: 1,
      totalPesos: D("-4613.27"), sinDividendosEnTotal: 0, noVerificadasEnTotal: 0,
    });
  });

  it("las medidas con veredicto, por decisión y horizonte, con el día en que se conocieron", () => {
    expect(r.medidas).toEqual([
      { decisionId: "FICTICIA-DEC-A", horizonteDias: 30, veredicto: "FUNCIONO", resultadoPesos: D("5246.37"), conocidoEl: "2021-02-19" },
      { decisionId: "FICTICIA-DEC-B", horizonteDias: 30, veredicto: "NO_FUNCIONO", resultadoPesos: D("-1237.41"), conocidoEl: "2021-03-17" },
      { decisionId: "FICTICIA-DEC-B", horizonteDias: 90, veredicto: "NO_FUNCIONO", resultadoPesos: D("-4613.27"), conocidoEl: "2021-04-29" },
      { decisionId: "FICTICIA-DEC-C", horizonteDias: 30, veredicto: "NEUTRO", resultadoPesos: D("0"), conocidoEl: "2021-03-17" },
    ]);
  });

  it("los conteos de cada horizonte suman todas las decisiones", () => {
    for (const h of [r.d30, r.d90]) {
      const suma = h.veredictos.FUNCIONO + h.veredictos.NO_FUNCIONO + h.veredictos.NEUTRO + h.sinVeredicto + h.pendientes + h.sinPrecio + h.sinOrden;
      expect(suma).toBe(h.decisiones);
    }
  });

  it("el orden de entrada no cambia el resumen", () => {
    expect(resumirDecisiones([...lista].reverse())).toEqual(r);
  });

  it("sin decisiones: ceros y total 0", () => {
    const vacio = resumirDecisiones([]);
    expect(vacio.d30.totalPesos.eq(0)).toBe(true);
    expect(vacio.d90.veredictos).toEqual({ FUNCIONO: 0, NO_FUNCIONO: 0, NEUTRO: 0 });
    expect(vacio.medidas).toEqual([]);
  });
});

describe("violaciones del contrato de resultado.ts", () => {
  const ok = horizonte(90, { estado: "PENDIENTE", veredicto: null, pesos: null });

  it("un veredicto sin resultado en pesos", () => {
    expect(() => resumirDecisiones([decision("FICTICIA-DEC-A", horizonte(30, { pesos: null }), ok)])).toThrow(RangeError);
  });

  it("un calculado sin tramos", () => {
    expect(() => resumirDecisiones([decision("FICTICIA-DEC-A", horizonte(30, { objetivos: [] }), ok)])).toThrow(RangeError);
  });

  it("un horizonte en el lugar del otro", () => {
    expect(() => resumirDecisiones([decision("FICTICIA-DEC-A", horizonte(90), ok)])).toThrow(RangeError);
    expect(() => resumirDecisiones([decision("FICTICIA-DEC-A", horizonte(30), horizonte(30))])).toThrow(RangeError);
  });

  it("una decisión repetida", () => {
    const d = decision("FICTICIA-DEC-A", horizonte(30), ok);
    expect(() => resumirDecisiones([d, d])).toThrow(RangeError);
  });
});
