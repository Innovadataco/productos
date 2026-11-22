/**
 * Grupos de hechos de los armadores: se ordenan por prioridad (los empates, en el orden de llegada), entran enteros
 * hasta el tope de noventa y nueve hechos (los que no caben se cuentan), se numeran de H01 en adelante, el sujeto se
 * resuelve a un id anterior del mismo grupo, la presentación sale de `presentar` y lo obligatorio arrastra al nombre de
 * su especie (a través del ancla de la regla, que no se vuelve obligatoria).
 */
import { describe, expect, it } from "vitest";
import type { ClaveReglas } from "@/ia/catalogo";
import { MAX_HECHOS } from "@/ia/contrato";
import { ErrorArmado } from "@/ia/hechos/errores";
import { numerarGrupos, type BorradorHecho, type Grupo } from "@/ia/hechos/grupos";
import { construirPaquete } from "@/ia/paquete";
import { ALFA, BETA, HOY } from "./apoyo.ficticio";

type B = BorradorHecho<ClaveReglas>;
const base = { fuente: "fuente-ficticia", fecha: HOY, calidad: "VERIFICADO", direccion: "NO_APLICA", cercania: "NO_APLICA", frescura: "HOY", obligatorio: false } as const;
const nombre = (valor: string, extra: Partial<B> = {}): B => ({ ...base, ref: "especie", clave: "ESPECIE_NOMBRE", valor, ...extra });
const ancla = (ref: string, extra: Partial<B> = {}): B => ({ ...base, ref, clave: "REGLA_DEL_PLAN", sujeto: "especie", valor: "2027-02-03", ...extra });
const nivel = (sujeto: string, valor: string, extra: Partial<B> = {}): B => ({ ...base, clave: "REGLA_NIVEL", sujeto, valor, ...extra });
const grupo = (prioridad: number, hechos: readonly B[]): Grupo<ClaveReglas> => ({ prioridad, hechos });

const codigoDe = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorArmado) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
};

describe("numerarGrupos", () => {
  it("numera de H01 en adelante, resuelve el sujeto al id anterior de su grupo y presenta con presentar", () => {
    const { hechos, recortados } = numerarGrupos("REGLAS", [
      grupo(2, [nombre(BETA), ancla("r1"), nivel("r1", "2491.73")]),
      grupo(1, [nombre(ALFA), ancla("r1"), nivel("r1", "4591.37"), ancla("r2"), nivel("r2", "4497.11")]),
    ]);
    expect(recortados).toBe(0);
    expect(hechos.map((h) => [h.id, h.clave, h.sujeto ?? null, h.valor])).toEqual([
      ["H01", "ESPECIE_NOMBRE", null, ALFA],
      ["H02", "REGLA_DEL_PLAN", "H01", "2027-02-03"],
      ["H03", "REGLA_NIVEL", "H02", "4591.37"],
      ["H04", "REGLA_DEL_PLAN", "H01", "2027-02-03"],
      ["H05", "REGLA_NIVEL", "H04", "4497.11"],
      ["H06", "ESPECIE_NOMBRE", null, BETA],
      ["H07", "REGLA_DEL_PLAN", "H06", "2027-02-03"],
      ["H08", "REGLA_NIVEL", "H07", "2491.73"],
    ]);
    expect(hechos.map((h) => h.presentacion)).toEqual([ALFA, "3-feb-2027", "$ 4.591", "3-feb-2027", "$ 4.497", BETA, "3-feb-2027", "$ 2.492"]);
    expect(construirPaquete({ tipo: "REGLAS", hoy: HOY, versionesCalculo: {}, avisos: [], hechos }).hechos).toHaveLength(8);
  });

  it("los empates de prioridad quedan en el orden de llegada", () => {
    const { hechos } = numerarGrupos("REGLAS", [grupo(3, [nombre(BETA)]), grupo(3, [nombre(ALFA)])]);
    expect(hechos.map((h) => h.valor)).toEqual([BETA, ALFA]);
  });

  it("los grupos entran enteros hasta el tope: el que no cabe se salta y se cuenta, y uno menor después sí entra", () => {
    const grande = grupo(1, [nombre("FICTICIA-GRANDE"), ...Array.from({ length: 4 }, (_, i) => ancla(`r${i}`))]);
    const medio = grupo(2, [nombre("FICTICIA-MEDIO"), ancla("r"), nivel("r", "4613.27")]);
    const chico = grupo(3, [nombre("FICTICIA-CHICO")]);
    const { hechos, recortados } = numerarGrupos("REGLAS", [grande, medio, chico], 7);
    expect(recortados).toBe(1);
    expect(hechos.map((h) => h.valor).filter((v) => v.startsWith("FICTICIA"))).toEqual(["FICTICIA-GRANDE", "FICTICIA-CHICO"]);
    expect(hechos).toHaveLength(6);
  });

  it("por omisión el tope es el del contrato (noventa y nueve)", () => {
    const especies = Array.from({ length: 50 }, (_, i) => grupo(1, [nombre(`FICTICIA-${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`), ancla("r")]));
    const { hechos, recortados } = numerarGrupos("REGLAS", especies);
    expect(hechos).toHaveLength(MAX_HECHOS - 1);
    expect(recortados).toBe(1);
  });

  it("lo obligatorio arrastra al nombre de su especie, a través del ancla, sin volver obligatoria el ancla", () => {
    const { hechos } = numerarGrupos("REGLAS", [
      grupo(1, [nombre(ALFA), ancla("r1"), nivel("r1", "4591.37", { obligatorio: true })]),
      grupo(1, [nombre(BETA), ancla("r1"), nivel("r1", "2491.73")]),
    ]);
    expect(hechos.map((h) => [h.valor, h.obligatorio])).toEqual([
      [ALFA, true], ["2027-02-03", false], ["4591.37", true], [BETA, false], ["2027-02-03", false], ["2491.73", false],
    ]);
  });

  it.each<readonly [string, readonly B[]]>([
    ["un sujeto que no existe", [nombre(ALFA), nivel("r9", "4591.37")]],
    ["un sujeto que viene después", [nivel("r1", "4591.37"), nombre(ALFA), ancla("r1")]],
    ["una referencia repetida en el grupo", [nombre(ALFA), ancla("r1"), ancla("r1")]],
  ])("REFERENCIA_INVALIDA: %s", (_caso, hechos) => {
    expect(codigoDe(() => numerarGrupos("REGLAS", [grupo(1, hechos)]))).toBe("REFERENCIA_INVALIDA");
  });

  it("el sujeto de otro grupo no se ve: cada grupo resuelve sus propias referencias", () => {
    expect(codigoDe(() => numerarGrupos("REGLAS", [grupo(1, [nombre(ALFA), ancla("r1")]), grupo(2, [nivel("r1", "4591.37")])]))).toBe("REFERENCIA_INVALIDA");
  });

  it("una clave fuera del catálogo del tipo o un valor sin la forma de su unidad cierran en fallo", () => {
    expect(codigoDe(() => numerarGrupos("REGLAS", [grupo(1, [{ ...base, clave: "VALOR_ACCIONES" as ClaveReglas, valor: "4613.27" }])]))).toBe("CLAVE_FUERA_DE_CATALOGO");
    expect(codigoDe(() => numerarGrupos("REGLAS", [grupo(1, [nombre(ALFA), ancla("r1"), nivel("r1", "4.591,37")])]))).toBe("VALOR_INVALIDO");
  });

  it("sin grupos no hay hechos (el paquete, después, da SIN_HECHOS)", () => {
    expect(numerarGrupos("REGLAS", [])).toEqual({ hechos: [], recortados: 0 });
  });

  it("no toca los grupos que recibe", () => {
    const grupos = [grupo(1, [nombre(ALFA), ancla("r1"), nivel("r1", "4591.37", { obligatorio: true })])];
    const antes = JSON.stringify(grupos);
    numerarGrupos("REGLAS", grupos);
    expect(JSON.stringify(grupos)).toBe(antes);
  });
});
