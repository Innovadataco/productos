// Los textos de /operar (frente operar-informe): «Su regla … dice …» con la acción y la cantidad tal como están en el
// plan, el estado frente al nivel (sin «Hoy» si la carga de precios se detuvo), los plazos, las fechas y el aviso fijo.
// Datos inventados (FICTICIA-*).
import { describe, expect, it } from "vitest";
import {
  AVISO_DECISION, distancia, fraseRegla, textoEstadoRegla, textoFecha, textoPlazoRegla, textoPrecios, textoPreciosAtrasados, textoTenencia, textoVersion,
} from "@/app/operar/textos";
import type { FechaVista, ReglaOperarVista } from "@/app/operar/tipos";

const regla = (o: Partial<ReglaOperarVista>): ReglaOperarVista => ({
  id: "r", especie: "FICTICIA-A", condicion: "CIERRE_BAJO", nivel: "4613.17", accion: "VENDER", cantidad: "37", plazo: null, plazoVencido: false,
  detalle: "Detalle ficticio", estado: { tipo: "POSTURA" }, grupo: "RESTO", ...o,
});
const C = { precio: "4597.31", fecha: "2027-03-16" };

describe("el aviso fijo y los precios", () => {
  it("dice que la decisión es del dueño y que 008 no recomienda", () => {
    expect(AVISO_DECISION).toBe("Información calculada por 008 con su plan. La decisión es suya. 008 no recomienda comprar ni vender.");
  });

  it("los precios: el último cierre disponible y su fecha, o que no hay; y cuándo se detuvo la carga", () => {
    expect(textoPrecios("2027-03-16")).toBe("Precios: último cierre disponible (16-mar-2027).");
    expect(textoPrecios(null)).toBe("Precios: todavía no hay cierres de las especies del portafolio.");
    expect(textoPreciosAtrasados("2027-03-16")).toBe("Los precios no se han actualizado desde el 16-mar-2027.");
  });

  it("la versión del plan que rige, o que no rige ninguna", () => {
    expect(textoVersion({ numero: 7, desde: "2027-01-04" })).toBe("Plan vigente: versión 7, desde el 4-ene-2027.");
    expect(textoVersion(null)).toBe("Hoy no rige ninguna versión del plan.");
  });
});

describe("«Su regla … dice …»: acción, cantidad, condición y nivel del plan", () => {
  it.each([
    [{}, "Su regla de FICTICIA-A dice: vender 37 acciones si el cierre queda por debajo de $ 4.613,17."],
    [{ condicion: "CIERRE_SOBRE", accion: "COMPRAR", cantidad: null, nivel: "1259.17", especie: "FICTICIA-B" }, "Su regla de FICTICIA-B dice: comprar si el cierre queda por encima de $ 1.259,17."],
    [{ cantidad: "1", accion: "COMPRAR" }, "Su regla de FICTICIA-A dice: comprar 1 acción si el cierre queda por debajo de $ 4.613,17."],
    [{ condicion: "NINGUNA", accion: "NO_ACTUAR", cantidad: "4613", nivel: null }, "Su regla de FICTICIA-A dice: no actuar (4.613 acciones), sin condición."],
    [{ condicion: "NINGUNA", accion: "VENDER", cantidad: "13", nivel: null }, "Su regla de FICTICIA-A dice: vender 13 acciones, sin condición."],
    [{ condicion: "MONTO_ORDEN_BAJO", accion: "NO_ACTUAR", cantidad: null, nivel: "1237911.47", especie: null }, "Su regla de portafolio dice: no actuar si el monto por orden es menor a $ 1.237.911,47."],
    [{ condicion: "LIBRE", accion: "NO_ACTUAR", cantidad: null, nivel: null, especie: null, detalle: "Orden límite siempre (ficticia)" }, "Su regla de portafolio dice: «Orden límite siempre (ficticia)»."],
  ] as const)("%o", (o, esperado) => {
    expect(fraseRegla(regla(o))).toBe(esperado);
  });
});

describe("el estado de la regla hoy", () => {
  it("tocada: «Hoy se cumple», con el cierre y el lado; con la carga detenida, «con el último cierre disponible»", () => {
    expect(textoEstadoRegla({ tipo: "TOCADA", lado: "BAJO", cierre: C }, false)).toEqual({ principal: "Hoy se cumple: el cierre del 16-mar-2027 fue de $ 4.597,31, por debajo del nivel.", aviso: false });
    expect(textoEstadoRegla({ tipo: "TOCADA", lado: "SOBRE", cierre: C }, true)).toEqual({ principal: "Se cumple con el último cierre disponible, del 16-mar-2027: $ 4.597,31, por encima del nivel.", aviso: false });
  });

  it("en el nivel, a distancia y sin cierre al día (este con aviso); nunca «se cumple» si no está tocada", () => {
    expect(textoEstadoRegla({ tipo: "EN_EL_NIVEL", cierre: C }, false).principal).toBe("El cierre del 16-mar-2027 quedó en el nivel: $ 4.597,31.");
    expect(textoEstadoRegla({ tipo: "A_DISTANCIA", distanciaPct: "1.79", cierre: C }, false).principal).toBe("El cierre del 16-mar-2027 fue de $ 4.597,31: está a +1,79 % del nivel.");
    expect(textoEstadoRegla({ tipo: "SIN_CIERRE_AL_DIA", ultimo: { precio: "899.11", fecha: "2027-03-12" } }, false)).toEqual({ principal: "Sin cierre al día: el último cierre es del 12-mar-2027 ($ 899,11).", aviso: true });
    expect(textoEstadoRegla({ tipo: "SIN_CIERRE_AL_DIA", ultimo: null }, true)).toEqual({ principal: "Sin cierre al día: no hay un cierre de esta especie.", aviso: true });
    for (const e of [{ tipo: "EN_EL_NIVEL", cierre: C }, { tipo: "A_DISTANCIA", distanciaPct: "1.79", cierre: C }, { tipo: "SIN_CIERRE_AL_DIA", ultimo: C }] as const) {
      expect(textoEstadoRegla(e, false).principal.toLowerCase()).not.toContain("se cumple");
    }
  });

  it("por orden, postura y sin nivel", () => {
    expect(textoEstadoRegla({ tipo: "POR_ORDEN" }, false)).toEqual({ principal: "008 no la mide con los cierres: aplica al monto de cada orden.", aviso: false });
    expect(textoEstadoRegla({ tipo: "POSTURA" }, false)).toEqual({ principal: "Es una postura del plan: no depende de un nivel de precio.", aviso: false });
    expect(textoEstadoRegla({ tipo: "SIN_NIVEL" }, false)).toEqual({ principal: "El plan no trae un nivel para medirla.", aviso: true });
  });

  it("la distancia lleva signo y dos decimales", () => {
    expect(distancia("1.79")).toBe("+1,79 %");
    expect(distancia("-2.99")).toBe("−2,99 %");
    expect(distancia("9.09")).toBe("+9,09 %");
    expect(distancia("3")).toBe("+3,00 %");
  });

  it("el plazo: sin plazo, hasta el día o vencido", () => {
    expect(textoPlazoRegla(null, false)).toBe("Plazo: sin plazo.");
    expect(textoPlazoRegla("2027-04-02", false)).toBe("Plazo: hasta el 2-abr-2027.");
    expect(textoPlazoRegla("2027-03-01", true)).toBe("Plazo: venció el 1-mar-2027.");
  });
});

describe("las fechas de los próximos días", () => {
  const ex = (o: Partial<Extract<FechaVista, { tipo: "EX_DIVIDENDO" }>> = {}): FechaVista => ({
    tipo: "EX_DIVIDENDO", fecha: "2027-03-24", id: "x", especie: "FICTICIA-D", tipoDividendo: "ORDINARIO", cuota: 2, valorPorAccion: "37.91", fechaPago: "2027-03-31", tenencia: "0", ...o,
  });

  it("un ex-dividendo: especie, tipo, cuota, valor por acción, pago y las acciones de hoy", () => {
    expect(textoFecha(ex())).toEqual({ cuando: "24-mar-2027", que: "Ex-dividendo de FICTICIA-D", detalle: "ordinario, cuota 2: $ 37,91 por acción; pago el 31-mar-2027; sin acciones hoy." });
    expect(textoFecha(ex({ tipoDividendo: "EXTRAORDINARIO", especie: null, tenencia: "37" })).detalle).toContain("extraordinario, cuota 2");
    expect(textoFecha(ex({ especie: null })).que).toBe("Ex-dividendo de una especie sin nemotécnico");
  });

  it("un plazo: el último día de su regla, con la acción y la condición del plan", () => {
    const plazo: FechaVista = { tipo: "PLAZO", fecha: "2027-04-02", id: "r-b", especie: "FICTICIA-B", accion: "VENDER", cantidad: "13", condicion: "CIERRE_SOBRE", nivel: "1259.17" };
    expect(textoFecha(plazo)).toEqual({ cuando: "2-abr-2027", que: "Último día del plazo de su regla de FICTICIA-B", detalle: "vender 13 acciones si el cierre queda por encima de $ 1.259,17." });
    expect(textoFecha({ ...plazo, especie: null, condicion: "LIBRE", accion: "NO_ACTUAR", cantidad: null, nivel: null }).que).toBe("Último día del plazo de su regla de portafolio");
  });

  it("las acciones de hoy: con, sin o por verificar", () => {
    expect(textoTenencia("37")).toBe("con 37 acciones hoy");
    expect(textoTenencia("1")).toBe("con 1 acción hoy");
    expect(textoTenencia("0")).toBe("sin acciones hoy");
    expect(textoTenencia("-13")).toBe("acciones de hoy por verificar: faltan compras cargadas");
  });
});
