// De informe a vista de /operar (frente operar-informe): fechas «AAAA-MM-DD» y cifras en texto exacto; el peso y su
// porcentaje con dos decimales, como el tablero. Datos inventados (FICTICIA-*).
import { describe, expect, it } from "vitest";
import { aVistaOperar } from "@/app/operar/serializar";
import { armarInforme } from "@/operar/informe/armar";
import { sumarDias } from "@/plan/fechas";
import { cierre, cierreLeido, D, dia, entradas, especie, HOY, plan, proximo, regla, reglaDe } from "./ficticio";

describe("aVistaOperar", () => {
  it("el estado en texto: cantidad, cierre con su verificación, valor exacto y peso con dos decimales", () => {
    const v = aVistaOperar(armarInforme(entradas({
      especies: [especie({ nemotecnico: "FICTICIA-A", cantidad: 37n, costoVivo: D("158917.31"), cierre: cierre("4597.31", dia("2027-03-16"), true) })],
    }), HOY));
    expect(v.estado.especies).toEqual([{
      id: "FICTICIA-A", nemo: "FICTICIA-A", cantidad: "37", cierre: { precio: "4597.31", fecha: "2027-03-16", verificado: true },
      valor: "170100.47", pesoPct: "100.00", sinVender: "11183.16", sinVenderPct: "7.04", atrasado: false,
    }]);
    expect([v.hoy, v.hasta, v.referencia, v.preciosAtrasados]).toEqual(["2027-03-17", "2027-04-16", "2027-03-16", false]);
    expect([v.estado.valorAcciones, v.estado.sinVender]).toEqual(["170100.47", "11183.16"]);
  });

  it("los estados de las reglas sin cierre pasan tal cual; el nivel, la cantidad y el plazo, en texto", () => {
    const v = aVistaOperar(armarInforme(entradas({
      plan: plan([
        reglaDe("FICTICIA-A", { id: "r-1", condicion: "CIERRE_BAJO", nivel: D("4751.39"), cantidad: 13n, plazoHasta: sumarDias(HOY, 3) }),
        regla({ id: "r-2", condicion: "MONTO_ORDEN_BAJO", nivel: D("1237911.47") }),
        reglaDe("FICTICIA-A", { id: "r-3", condicion: "CIERRE_SOBRE", nivel: null }),
      ]),
    }), HOY));
    expect(v.reglas.resto.map((r) => [r.id, r.estado, r.nivel, r.cantidad, r.plazo])).toEqual([
      ["r-1", { tipo: "SIN_CIERRE_AL_DIA", ultimo: null }, "4751.39", "13", "2027-03-20"],
      ["r-3", { tipo: "SIN_NIVEL" }, null, null, null],
      ["r-2", { tipo: "POR_ORDEN" }, "1237911.47", null, null],
    ]);
    expect(v.reglas.version).toEqual({ numero: 7, desde: "2027-01-04" });
  });

  it("las fechas: el ex-dividendo con su valor y su tenencia, el plazo con su regla", () => {
    const v = aVistaOperar(armarInforme(entradas({
      plan: plan([reglaDe("FICTICIA-A", { id: "r-1", condicion: "CIERRE_BAJO", nivel: D("4751.39"), accion: "VENDER", cantidad: 13n, plazoHasta: sumarDias(HOY, 3) })]),
      cierres: new Map([["FICTICIA-A", cierreLeido("4613")]]),
      proximos: [proximo({ id: "x-1", fechaEx: sumarDias(HOY, 1), fechaPago: sumarDias(HOY, 8), tenencia: -13n })],
    }), HOY));
    expect(v.fechas).toEqual([
      { tipo: "EX_DIVIDENDO", fecha: "2027-03-18", id: "x-1", especie: "FICTICIA-D", tipoDividendo: "ORDINARIO", cuota: 1, valorPorAccion: "37.91", fechaPago: "2027-03-25", tenencia: "-13" },
      { tipo: "PLAZO", fecha: "2027-03-20", id: "r-1", especie: "FICTICIA-A", accion: "VENDER", cantidad: "13", condicion: "CIERRE_BAJO", nivel: "4751.39" },
    ]);
  });
});
