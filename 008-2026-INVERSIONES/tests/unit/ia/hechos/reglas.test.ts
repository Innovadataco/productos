/**
 * Armador REGLAS: de las reglas del plan vigente (con `estadoDelNivel`, como la pantalla del plan: solo con el cierre al
 * día) y de los próximos ex-dividendos (`proximos()`). Varias reglas por especie: cada una con su ancla REGLA_DEL_PLAN,
 * que cita a la especie; los hechos de la regla citan al ancla. Puro: `hoy` entra como parámetro.
 */
import { describe, expect, it } from "vitest";
import type { Hecho } from "@/ia/contrato";
import { armarReglas, type EntradaArmadoReglas } from "@/ia/hechos";
import { ErrorArmado } from "@/ia/hechos/errores";
import { presentar } from "@/ia/presentar";
import { vistaCiega } from "@/ia/vista-ciega";
import { ALFA, BETA, D, DELTA, HOY, dia, entradaReglasFicticia, reglasLeidas } from "./apoyo.ficticio";

type Fila = readonly [string, string, string | null, string, string, string, string, string, boolean];
/** [id, clave, valor, sujeto, fecha, calidad, dirección, cercanía, frescura, obligatorio] */
const filas = (hechos: readonly Hecho[]) =>
  hechos.map((h) => [h.id, h.clave, h.valor, h.sujeto ?? null, h.fecha, h.calidad, h.direccion, h.cercania, h.frescura, h.obligatorio] as const);
const sinId = (f: readonly unknown[]): Fila => f.slice(1) as unknown as Fila;

/** Lo vigente (el plan, los decretos, el nombre) va con el día de hoy y frescura HOY: fecha y frescura nunca se contradicen. */
describe("armarReglas · el paquete del plan", () => {
  it("arma cada especie con su cierre, una ancla por regla con sus hechos y su próximo dividendo; las de portafolio al final", () => {
    const paquete = armarReglas(entradaReglasFicticia());
    expect(paquete.tipo).toBe("REGLAS");
    expect(paquete.versionesCalculo).toEqual({ hechos: "armadores-v1" });
    expect(paquete.avisos).toEqual(["PROXIMO_SIN_NOMBRE", "DIVIDENDOS_PROXIMOS_OMITIDOS"]);
    expect(filas(paquete.hechos)).toEqual([
      ["H01", "ESPECIE_NOMBRE", ALFA, null, HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H02", "CIERRE_ESPECIE", "4613.27", "H01", "2027-03-16", "VERIFICADO", "NO_APLICA", "NO_APLICA", "RECIENTE", false],
      ["H03", "FECHA_CIERRE_ESPECIE", "2027-03-16", "H01", "2027-03-16", "VERIFICADO", "NO_APLICA", "NO_APLICA", "RECIENTE", false],
      ["H04", "REGLA_DEL_PLAN", "2027-02-03", "H01", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H05", "REGLA_NIVEL", "4591.37", "H04", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H06", "REGLA_TOCADA", "2027-03-16", "H04", "2027-03-16", "CALCULADO", "SUBE", "NO_APLICA", "RECIENTE", true],
      ["H07", "REGLA_DEL_PLAN", "2027-02-03", "H01", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H08", "REGLA_NIVEL", "4497.11", "H07", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H09", "REGLA_DISTANCIA", "-2.52", "H07", "2027-03-16", "CALCULADO", "BAJA", "CERCA", "RECIENTE", true],
      ["H10", "REGLA_PLAZO", "2027-09-23", "H07", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H11", "REGLA_DIAS_AL_PLAZO", "190", "H07", HOY, "CALCULADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H12", "REGLA_DEL_PLAN", "2027-02-03", "H01", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H13", "REGLA_NIVEL", "4791.53", "H12", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H14", "REGLA_DISTANCIA", "3.86", "H12", "2027-03-16", "CALCULADO", "SUBE", "LEJOS", "RECIENTE", false],
      ["H15", "REGLA_PLAZO", "2027-01-29", "H12", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H16", "PROXIMO_EX_DIVIDENDO", "2027-04-07", "H01", HOY, "NO_VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H17", "DIAS_A_EX_DIVIDENDO", "21", "H01", HOY, "CALCULADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H18", "DIVIDENDO_POR_ACCION", "41.37", "H01", HOY, "NO_VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H19", "DIVIDENDO_FECHA_PAGO", "2027-04-21", "H01", HOY, "NO_VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H20", "DIVIDENDO_BRUTO_ESTIMADO", "30578.79", "H01", HOY, "ESTIMADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H21", "ESPECIE_NOMBRE", BETA, null, HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H22", "CIERRE_ESPECIE", "2713.9", "H21", "2027-03-15", "ATRASADO", "NO_APLICA", "NO_APLICA", "ATRASADO", false],
      ["H23", "FECHA_CIERRE_ESPECIE", "2027-03-15", "H21", "2027-03-15", "ATRASADO", "NO_APLICA", "NO_APLICA", "ATRASADO", false],
      ["H24", "REGLA_DEL_PLAN", "2027-02-03", "H21", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H25", "REGLA_NIVEL", "2491.73", "H24", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H26", "REGLA_SIN_CIERRE_AL_DIA", "2027-03-15", "H24", "2027-03-15", "ATRASADO", "NO_APLICA", "NO_APLICA", "ATRASADO", true],
      ["H27", "ESPECIE_NOMBRE", DELTA, null, HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H28", "PROXIMO_EX_DIVIDENDO", "2027-05-12", "H27", HOY, "NO_VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H29", "DIAS_A_EX_DIVIDENDO", "56", "H27", HOY, "CALCULADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H30", "DIVIDENDO_POR_ACCION", "97.31", "H27", HOY, "NO_VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H31", "DIVIDENDO_FECHA_PAGO", "2027-05-26", "H27", HOY, "NO_VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H32", "REGLA_DEL_PLAN", "2027-02-03", null, HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H33", "REGLA_PLAZO", "2027-06-30", "H32", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["H34", "REGLA_DIAS_AL_PLAZO", "105", "H32", HOY, "CALCULADO", "NO_APLICA", "NO_APLICA", "HOY", false],
    ]);
  });

  it("cada presentación es la de presentar, y la vista ciega pasa la guarda", () => {
    const paquete = armarReglas(entradaReglasFicticia());
    for (const h of paquete.hechos) expect(h.presentacion, h.id).toBe(presentar(h.valor, h.unidad));
    expect(() => vistaCiega(paquete)).not.toThrow();
  });

  it("la misma entrada da el mismo hash", () => {
    expect(armarReglas(entradaReglasFicticia()).hash).toBe(armarReglas(entradaReglasFicticia()).hash);
  });
});

describe("armarReglas · cada estado del nivel", () => {
  const unaRegla = (condicion: string, nivel: string | null, plazo: string | null = null) => {
    const [base] = reglasLeidas();
    return { ...base!, condicion, nivel: nivel === null ? null : D(nivel), plazoHasta: plazo === null ? null : dia(plazo) };
  };
  const armarCon = (reglas: readonly unknown[], cambio: Partial<EntradaArmadoReglas> = {}) =>
    armarReglas({ ...entradaReglasFicticia(), reglas: reglas as EntradaArmadoReglas["reglas"], proximos: [], ...cambio });
  const sinEspecie = (hechos: readonly Hecho[]) => hechos.filter((h) => !["ESPECIE_NOMBRE", "CIERRE_ESPECIE", "FECHA_CIERRE_ESPECIE"].includes(h.clave)).map((h) => sinId(filas([h])[0]!));

  it("tocada por debajo: REGLA_TOCADA que baja, obligatoria", () => {
    expect(sinEspecie(armarCon([unaRegla("CIERRE_BAJO", "4719.31")]).hechos)).toEqual([
      ["REGLA_DEL_PLAN", "2027-02-03", "H01", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["REGLA_NIVEL", "4719.31", "H04", HOY, "VERIFICADO", "NO_APLICA", "NO_APLICA", "HOY", false],
      ["REGLA_TOCADA", "2027-03-16", "H04", "2027-03-16", "CALCULADO", "BAJA", "NO_APLICA", "RECIENTE", true],
    ]);
  });

  it("el cierre justo en el nivel: REGLA_EN_EL_NIVEL, obligatoria", () => {
    const hechos = armarCon([unaRegla("CIERRE_SOBRE", "4613.27")]).hechos;
    expect(hechos.find((h) => h.clave === "REGLA_EN_EL_NIVEL")).toMatchObject({ valor: "2027-03-16", obligatorio: true, sujeto: "H04" });
  });

  it("una condición sin nivel de precio (monto por orden, libre o ninguna) no lleva nivel; sin plazo, la regla no entra", () => {
    expect(armarCon([unaRegla("MONTO_ORDEN_BAJO", "613.29", "2027-06-30")]).hechos.map((h) => h.clave)).toEqual([
      "ESPECIE_NOMBRE", "CIERRE_ESPECIE", "FECHA_CIERRE_ESPECIE", "REGLA_DEL_PLAN", "REGLA_PLAZO", "REGLA_DIAS_AL_PLAZO",
    ]);
    expect(() => armarCon([unaRegla("LIBRE", null), unaRegla("NINGUNA", null)])).toThrow(/SIN_HECHOS/);
  });

  it("una regla de portafolio con condición de precio no lleva nivel: sin especie no hay precio que comparar", () => {
    const portafolio = { ...unaRegla("CIERRE_BAJO", "4497.11", "2027-06-30"), instrumentoId: null, nemotecnico: null };
    expect(armarCon([portafolio]).hechos.map((h) => h.clave)).toEqual(["REGLA_DEL_PLAN", "REGLA_PLAZO", "REGLA_DIAS_AL_PLAZO"]);
  });

  it("una regla de portafolio sin plazo no tiene nada que decir: no entra", () => {
    const portafolio = { ...unaRegla("MONTO_ORDEN_BAJO", "613.29"), instrumentoId: null, nemotecnico: null };
    expect(armarCon([unaRegla("CIERRE_BAJO", "4497.11"), portafolio]).hechos.filter((h) => h.clave === "REGLA_DEL_PLAN")).toHaveLength(1);
  });

  it("un plazo vencido va como fecha, sin días negativos", () => {
    const claves = armarCon([unaRegla("NINGUNA", null, "2027-01-29")]).hechos.map((h) => h.clave);
    expect(claves).toContain("REGLA_PLAZO");
    expect(claves).not.toContain("REGLA_DIAS_AL_PLAZO");
  });

  it("una especie sin cierre: la regla va con su nivel y sin distancia (no se inventa un cierre)", () => {
    const hechos = armarCon([unaRegla("CIERRE_BAJO", "4497.11")], { cierres: new Map() }).hechos;
    expect(hechos.map((h) => h.clave)).toEqual(["ESPECIE_NOMBRE", "REGLA_DEL_PLAN", "REGLA_NIVEL"]);
  });

  it("una regla con especie pero sin nombre no entra, y el aviso lo dice", () => {
    const paquete = armarCon([unaRegla("CIERRE_BAJO", "4497.11"), { ...unaRegla("CIERRE_BAJO", "4497.11"), nemotecnico: null }]);
    expect(paquete.avisos).toEqual(["REGLA_SIN_NOMBRE"]);
    expect(paquete.hechos.filter((h) => h.clave === "REGLA_DEL_PLAN")).toHaveLength(1);
  });

  it("con muchas reglas, entran primero las especies tocadas o cerca, y el aviso dice que se recortó", () => {
    const lejanas = Array.from({ length: 31 }, (_, i) => ({ ...unaRegla("CIERRE_SOBRE", `${4900 + i}.37`), instrumentoId: "inst-ficticio-alfa-q", nemotecnico: ALFA }));
    const cerca = { ...unaRegla("CIERRE_SOBRE", "4701.13"), instrumentoId: "inst-ficticio-beta-q", nemotecnico: BETA };
    const cierres = new Map([
      ["inst-ficticio-alfa-q", { fecha: dia("2027-03-16"), precio: D("4613.27"), estado: "VERIFICADO" as const }],
      ["inst-ficticio-beta-q", { fecha: dia("2027-03-16"), precio: D("4613.27"), estado: "VERIFICADO" as const }],
    ]);
    const paquete = armarCon([...lejanas, cerca], { cierres });
    expect(paquete.avisos).toEqual(["HECHOS_RECORTADOS"]);
    expect(paquete.hechos[0]).toMatchObject({ clave: "ESPECIE_NOMBRE", valor: BETA });
    expect(paquete.hechos.length).toBeLessThanOrEqual(99);
  });

  it.each<readonly [string, Partial<EntradaArmadoReglas>, string]>([
    ["un hoy que no es un día", { hoy: "2027-13-01" }, "HOY_INVALIDO"],
    ["una versión del plan que todavía no rige", { vigenteDesde: dia("2027-03-18") }, "VERSION_NO_VIGENTE"],
    ["una fecha que no es medianoche UTC", { vigenteDesde: new Date("2027-02-03T05:00:00.000Z") }, "FECHA_INVALIDA"],
  ])("cierra en fallo con %s", (_caso, cambio, codigo) => {
    try {
      armarCon([unaRegla("CIERRE_BAJO", "4497.11")], cambio);
      throw new Error("no lanzó");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorArmado);
      expect((e as ErrorArmado).codigo).toBe(codigo);
    }
  });
});
