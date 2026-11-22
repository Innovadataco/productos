// El armador del informe para operar (frente operar-informe): puro, con el tablero, las reglas del plan vigente, sus
// cierres y los próximos ex-dividendos. Informa lo que dice el plan; nunca un juicio. Datos inventados (FICTICIA-*).
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { armarInforme, DIAS_FECHAS, UMBRAL_CERCANA_PCT } from "@/operar/informe/armar";
import type { ReglaInforme } from "@/operar/informe/tipos";
import { sumarDias } from "@/plan/fechas";
import { calendario, cierre, cierreLeido, congelar, D, dia, entradas, especie, HOY, plan, proximo, REFERENCIA, regla, reglaDe } from "./ficticio";

const ids = (rs: readonly ReglaInforme[]) => rs.map((r) => r.id);

/** El informe con una sola regla de FICTICIA-A y su cierre (o sin él). */
function conRegla(r: Parameters<typeof reglaDe>[1], c: ReturnType<typeof cierreLeido> | null = cierreLeido("4613")) {
  const cierres = new Map(c ? [["FICTICIA-A", c]] : []);
  return armarInforme(entradas({ plan: plan([reglaDe("FICTICIA-A", r)]), cierres }), HOY);
}
const unica = (i: ReturnType<typeof conRegla>): ReglaInforme => {
  const todas = [...i.reglas.seCumplen, ...i.reglas.cercanas, ...i.reglas.resto];
  expect(todas).toHaveLength(1);
  return todas[0]!;
};

describe("armarInforme · lo general", () => {
  it("rechaza un hoy que no es una fecha de negocio (medianoche UTC)", () => {
    expect(() => armarInforme(entradas(), new Date("2027-03-17T05:00:00Z"))).toThrow(RangeError);
    expect(() => armarInforme(entradas(), new Date(Number.NaN))).toThrow(RangeError);
  });

  it("lleva hoy, la ventana de las fechas y la referencia del tablero", () => {
    const i = armarInforme(entradas(), HOY);
    expect(DIAS_FECHAS).toBe(30);
    expect(i.hoy).toEqual(HOY);
    expect(i.hasta).toEqual(sumarDias(HOY, 30));
    expect(i.referencia).toEqual(REFERENCIA);
  });

  it("precios atrasados: la referencia es anterior a la rueda anterior a hoy", () => {
    expect(armarInforme(entradas(), HOY).preciosAtrasados).toBe(false);
    // El martes 23 (el lunes 22 es festivo): la rueda anterior es el viernes 19 y la referencia, del martes 16.
    expect(armarInforme(entradas({ calendario: calendario(["2027-03-22"]) }), dia("2027-03-23")).preciosAtrasados).toBe(true);
    expect(armarInforme(entradas({ especies: [especie({ nemotecnico: "FICTICIA-A", cantidad: 37n, costoVivo: D("4613") })] }), HOY).preciosAtrasados).toBe(false);
    // Sin el año en el calendario no se afirma que se detuvo.
    const sinAnio = { noHabiles: new Set<string>(), aniosCubiertos: new Set([2026]) };
    expect(armarInforme(entradas({ calendario: sinAnio }), dia("2027-03-23")).preciosAtrasados).toBe(false);
  });

  it("no cambia las entradas (congeladas en profundidad)", () => {
    const e = congelar(entradas({
      plan: plan([reglaDe("FICTICIA-B", { id: "r-2", condicion: "CIERRE_SOBRE", nivel: D("1259.17") }), reglaDe("FICTICIA-A", { id: "r-1", condicion: "CIERRE_BAJO", nivel: D("4613") })]),
      cierres: new Map([["FICTICIA-A", cierreLeido("4597.31")], ["FICTICIA-B", cierreLeido("1237")]]),
      proximos: [proximo({ id: "x-2", fechaEx: sumarDias(HOY, 9) }), proximo({ id: "x-1", fechaEx: sumarDias(HOY, 2) })],
    }));
    const antes = JSON.stringify(e, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    const i = armarInforme(e, HOY);
    expect(ids(i.reglas.seCumplen)).toEqual(["r-1"]);
    expect(JSON.stringify(e, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).toBe(antes);
  });
});

describe("estado del portafolio", () => {
  const especies = [
    especie({ nemotecnico: "FICTICIA-A", cantidad: 37n, costoVivo: D("158917.31"), cierre: cierre("4597.31") }),
    especie({ nemotecnico: "FICTICIA-B", cantidad: 113n, costoVivo: D("131711.39"), cierre: cierre("1237", dia("2027-03-11")) }),
    especie({ nemotecnico: "FICTICIA-C", cantidad: 19n, costoVivo: D("17431.07") }),
    especie({ nemotecnico: "FICTICIA-Z", cantidad: 0n, realizada: D("4613.17"), cierre: cierre("917.43") }),
  ];

  it("una fila por especie viva, en el orden del tablero, con Decimal y bigint", () => {
    const { estado } = armarInforme(entradas({ especies, incompletas: ["FICTICIA-I"] }), HOY);
    expect(estado.especies.map((e) => e.nemotecnico)).toEqual(["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"]);
    const [a, b, c] = estado.especies;
    expect(a!.cantidad).toBe(37n);
    expect(a!.valor).toBeInstanceOf(Prisma.Decimal);
    expect(a!.valor!.toString()).toBe("170100.47");
    expect(a!.sinVender!.toString()).toBe("11183.16");
    expect(a!.sinVenderPct!.toFixed(2)).toBe("7.04");
    expect(a!.cierre).toEqual({ precio: D("4597.31"), fecha: REFERENCIA, verificado: false });
    expect(a!.cierreAtrasado).toBe(false);
    expect(b!.cierreAtrasado).toBe(true);
    expect(c!.cierre).toBeNull();
    expect([c!.valor, c!.pesoPct, c!.sinVender, c!.sinVenderPct]).toEqual([null, null, null, null]);
    expect(a!.pesoPct!.add(b!.pesoPct!).toFixed(6)).toBe("100.000000");
  });

  it("los totales, las cuentas de sin precio y atrasadas, y las incompletas son los del tablero", () => {
    const { estado } = armarInforme(entradas({ especies, incompletas: ["FICTICIA-I"] }), HOY);
    expect(estado.valorAcciones.toString()).toBe("309881.47");
    expect(estado.sinVender.toString()).toBe("19252.77");
    expect(estado.especiesSinPrecio).toBe(1);
    expect(estado.especiesAtrasadas).toBe(1);
    expect(estado.incompletas).toEqual(["FICTICIA-I"]);
  });
});

describe("sus reglas hoy", () => {
  it("tocada por debajo y por encima: se cumple, con el lado y el cierre usado", () => {
    const bajo = unica(conRegla({ id: "r", condicion: "CIERRE_BAJO", nivel: D("4613.17") }));
    expect(bajo.grupo).toBe("SE_CUMPLE");
    expect(bajo.estado).toEqual({ tipo: "TOCADA", lado: "BAJO", cierre: { precio: D("4613"), fecha: REFERENCIA } });
    const sobre = unica(conRegla({ id: "r", condicion: "CIERRE_SOBRE", nivel: D("4597.31") }));
    expect(sobre.estado).toMatchObject({ tipo: "TOCADA", lado: "SOBRE" });
    expect(sobre.grupo).toBe("SE_CUMPLE");
  });

  it("el cierre igual al nivel queda en el grupo de las que se cumplen, como EN_EL_NIVEL", () => {
    const r = unica(conRegla({ id: "r", condicion: "CIERRE_BAJO", nivel: D("4613") }));
    expect(r.estado).toEqual({ tipo: "EN_EL_NIVEL", cierre: { precio: D("4613"), fecha: REFERENCIA } });
    expect(r.grupo).toBe("SE_CUMPLE");
  });

  it.each([
    ["CIERRE_SOBRE", "4751.39", "3", "RESTO"],
    ["CIERRE_SOBRE", "4750.92", "2.99", "CERCANA"],
    ["CIERRE_SOBRE", "4751.21", "3", "RESTO"],
    ["CIERRE_BAJO", "4474.61", "-3", "RESTO"],
    ["CIERRE_BAJO", "4475.08", "-2.99", "CERCANA"],
  ] as const)("%s a %s con cierre 4613: distancia %s % → %s (umbral estricto, con 2 decimales)", (condicion, nivel, distancia, grupo) => {
    const r = unica(conRegla({ id: "r", condicion, nivel: D(nivel) }));
    expect(r.estado).toMatchObject({ tipo: "A_DISTANCIA" });
    expect(r.estado.tipo === "A_DISTANCIA" && r.estado.distanciaPct.toString()).toBe(distancia);
    expect(r.grupo).toBe(grupo);
  });

  it("el umbral de las cercanas es 3 %", () => {
    expect(UMBRAL_CERCANA_PCT.toString()).toBe("3");
  });

  it("con el cierre atrasado dice «sin cierre al día», aunque el precio toque el nivel; al día, sí se cumple", () => {
    const atrasada = unica(conRegla({ id: "r", condicion: "CIERRE_BAJO", nivel: D("4751.39") }, cierreLeido("4613", dia("2027-03-12"))));
    expect(atrasada.estado).toEqual({ tipo: "SIN_CIERRE_AL_DIA", ultimo: { precio: D("4613"), fecha: dia("2027-03-12") } });
    expect(atrasada.grupo).toBe("RESTO");
    const alDia = unica(conRegla({ id: "r", condicion: "CIERRE_BAJO", nivel: D("4751.39") }, cierreLeido("4613", REFERENCIA)));
    expect(alDia.grupo).toBe("SE_CUMPLE");
  });

  it("sin cierre de la especie, o sin referencia del tablero: «sin cierre al día»", () => {
    const sinCierre = unica(conRegla({ id: "r", condicion: "CIERRE_BAJO", nivel: D("4751.39") }, null));
    expect(sinCierre.estado).toEqual({ tipo: "SIN_CIERRE_AL_DIA", ultimo: null });
    const sinReferencia = armarInforme(entradas({
      especies: [especie({ nemotecnico: "FICTICIA-A", cantidad: 37n, costoVivo: D("4613") })],
      plan: plan([reglaDe("FICTICIA-A", { id: "r", condicion: "CIERRE_BAJO", nivel: D("4751.39") })]),
      cierres: new Map([["FICTICIA-A", cierreLeido("4613")]]),
    }), HOY);
    expect(sinReferencia.reglas.resto[0]!.estado).toEqual({ tipo: "SIN_CIERRE_AL_DIA", ultimo: { precio: D("4613"), fecha: REFERENCIA } });
  });

  it("una especie de regla que no está en el tablero se mide con su cierre (la fuente de /plan)", () => {
    const i = armarInforme(entradas({
      plan: plan([reglaDe("FICTICIA-Z", { id: "r", condicion: "CIERRE_SOBRE", nivel: D("901.37") })]),
      cierres: new Map([["FICTICIA-Z", cierreLeido("917.43")]]),
    }), HOY);
    expect(i.reglas.seCumplen.map((r) => [r.id, r.especie])).toEqual([["r", "FICTICIA-Z"]]);
    expect(i.estado.especies.map((e) => e.nemotecnico)).not.toContain("FICTICIA-Z");
  });

  it("posturas, monto por orden, una regla de cierre sin especie y una sin nivel van al resto, sin medir", () => {
    const i = armarInforme(entradas({
      plan: plan([
        reglaDe("FICTICIA-A", { id: "r-1", condicion: "NINGUNA", accion: "VENDER", cantidad: 13n }),
        regla({ id: "r-2", condicion: "LIBRE", detalle: "Orden límite siempre (ficticia)" }),
        regla({ id: "r-3", condicion: "MONTO_ORDEN_BAJO", nivel: D("1237911.47") }),
        regla({ id: "r-4", condicion: "CIERRE_BAJO", nivel: D("4751.39") }),
        reglaDe("FICTICIA-A", { id: "r-5", condicion: "CIERRE_SOBRE", nivel: null }),
      ]),
      cierres: new Map([["FICTICIA-A", cierreLeido("4613")]]),
    }), HOY);
    expect(i.reglas.seCumplen).toEqual([]);
    expect(i.reglas.cercanas).toEqual([]);
    const estado = Object.fromEntries(i.reglas.resto.map((r) => [r.id, r.estado]));
    expect(estado).toEqual({
      "r-1": { tipo: "POSTURA" },
      "r-2": { tipo: "POSTURA" },
      "r-3": { tipo: "POR_ORDEN" },
      "r-4": { tipo: "SIN_CIERRE_AL_DIA", ultimo: null },
      "r-5": { tipo: "SIN_NIVEL" },
    });
  });

  it("acción, cantidad, condición, nivel, plazo y detalle pasan tal cual; el plazo de ayer está vencido y el de hoy no", () => {
    const i = armarInforme(entradas({
      plan: plan([
        reglaDe("FICTICIA-A", { id: "r-1", condicion: "CIERRE_BAJO", nivel: D("4613.17"), accion: "COMPRAR", cantidad: 37n, plazoHasta: sumarDias(HOY, -1), detalle: "Detalle ficticio uno" }),
        reglaDe("FICTICIA-B", { id: "r-2", condicion: "NINGUNA", accion: "NO_ACTUAR", plazoHasta: HOY }),
      ]),
      cierres: new Map([["FICTICIA-A", cierreLeido("4597.31")]]),
    }), HOY);
    const [a] = i.reglas.seCumplen;
    expect(a).toMatchObject({ id: "r-1", instrumentoId: "FICTICIA-A", especie: "FICTICIA-A", condicion: "CIERRE_BAJO", accion: "COMPRAR", cantidad: 37n, plazoHasta: sumarDias(HOY, -1), plazoVencido: true, detalle: "Detalle ficticio uno" });
    expect(a!.nivel!.toString()).toBe("4613.17");
    expect(i.reglas.resto[0]).toMatchObject({ id: "r-2", plazoVencido: false, cantidad: null });
  });

  it("dentro de cada grupo: especie de la A a la Z, las de portafolio al final, y después el id; dos de la misma especie, cada una por su lado", () => {
    const i = armarInforme(entradas({
      plan: plan([
        regla({ id: "r-a", condicion: "LIBRE" }),
        reglaDe("FICTICIA-B", { id: "r-c", condicion: "NINGUNA" }),
        reglaDe("FICTICIA-A", { id: "r-e", condicion: "NINGUNA" }),
        reglaDe("FICTICIA-A", { id: "r-b", condicion: "CIERRE_BAJO", nivel: D("4613.17") }),
        reglaDe("FICTICIA-A", { id: "r-d", condicion: "NINGUNA" }),
      ]),
      cierres: new Map([["FICTICIA-A", cierreLeido("4597.31")]]),
    }), HOY);
    expect(ids(i.reglas.seCumplen)).toEqual(["r-b"]);
    expect(ids(i.reglas.resto)).toEqual(["r-d", "r-e", "r-c", "r-a"]);
  });

  it("sin plan vigente: sin versión y sin reglas", () => {
    const i = armarInforme(entradas({ plan: null }), HOY);
    expect(i.reglas).toEqual({ version: null, seCumplen: [], cercanas: [], resto: [] });
  });

  it("con plan: su número y desde cuándo rige", () => {
    expect(armarInforme(entradas({ plan: plan([], 11) }), HOY).reglas.version).toEqual({ numero: 11, vigenteDesde: dia("2027-01-04") });
  });
});

describe("fechas que importan", () => {
  it("ex-dividendos de hoy a hoy + 30, con los datos del decreto y la tenencia tal cual", () => {
    const i = armarInforme(entradas({
      proximos: [
        proximo({ id: "x-ayer", fechaEx: sumarDias(HOY, -1) }),
        proximo({ id: "x-hoy", fechaEx: HOY, tenencia: 37n }),
        proximo({ id: "x-30", fechaEx: sumarDias(HOY, 30), tenencia: -13n, nemotecnico: null }),
        proximo({ id: "x-31", fechaEx: sumarDias(HOY, 31) }),
      ],
    }), HOY);
    expect(i.fechas.map((f) => f.id)).toEqual(["x-hoy", "x-30"]);
    expect(i.fechas[0]).toEqual({
      tipo: "EX_DIVIDENDO", fecha: HOY, id: "x-hoy", especie: "FICTICIA-D", tipoDividendo: "ORDINARIO", cuota: 1, valorPorAccion: D("37.91"), fechaPago: HOY, tenencia: 37n,
    });
    expect(i.fechas[1]).toMatchObject({ especie: null, tenencia: -13n });
  });

  it("plazos de las reglas de hoy a hoy + 30", () => {
    const plazo = (id: string, dias: number) => reglaDe("FICTICIA-A", { id, condicion: "CIERRE_BAJO", nivel: D("4613.17"), accion: "VENDER", cantidad: 13n, plazoHasta: sumarDias(HOY, dias) });
    const i = armarInforme(entradas({ plan: plan([plazo("p-ayer", -1), plazo("p-hoy", 0), plazo("p-30", 30), plazo("p-31", 31), regla({ id: "p-sin", condicion: "LIBRE" })]) }), HOY);
    expect(i.fechas.map((f) => f.id)).toEqual(["p-hoy", "p-30"]);
    expect(i.fechas[0]).toEqual({ tipo: "PLAZO", fecha: HOY, id: "p-hoy", especie: "FICTICIA-A", accion: "VENDER", cantidad: 13n, condicion: "CIERRE_BAJO", nivel: D("4613.17") });
  });

  it("ordenadas por fecha, especie (portafolio al final), primero el ex-dividendo y después el plazo, y el id", () => {
    const d5 = sumarDias(HOY, 5);
    const i = armarInforme(entradas({
      plan: plan([
        regla({ id: "p-port", condicion: "LIBRE", plazoHasta: d5 }),
        reglaDe("FICTICIA-B", { id: "p-b", condicion: "NINGUNA", plazoHasta: d5 }),
        reglaDe("FICTICIA-A", { id: "p-a", condicion: "NINGUNA", plazoHasta: HOY }),
      ]),
      proximos: [
        proximo({ id: "x-b2", fechaEx: d5, nemotecnico: "FICTICIA-B" }),
        proximo({ id: "x-b1", fechaEx: d5, nemotecnico: "FICTICIA-B" }),
        proximo({ id: "x-a", fechaEx: d5, nemotecnico: "FICTICIA-A" }),
      ],
    }), HOY);
    expect(i.fechas.map((f) => f.id)).toEqual(["p-a", "x-a", "x-b1", "x-b2", "p-b", "p-port"]);
  });
});
