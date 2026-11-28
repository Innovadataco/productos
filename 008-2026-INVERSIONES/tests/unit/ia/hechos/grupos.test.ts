/**
 * Grupos de hechos de los armadores: se ordenan por prioridad (los empates, en el orden de llegada), entran enteros
 * hasta el tope de noventa y nueve hechos (los que no caben se cuentan), se numeran de H01 en adelante, el sujeto (el
 * propio borrador al que se refiere, no un texto) se resuelve al id de un hecho anterior del mismo grupo, la
 * presentación sale de `presentar` y lo obligatorio arrastra al nombre de su especie (a través del ancla de la regla,
 * que no se vuelve obligatoria).
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
const nombre = (valor: string): BorradorHecho<"ESPECIE_NOMBRE"> => ({ ...base, clave: "ESPECIE_NOMBRE", valor });
const ancla = (especie: BorradorHecho<"ESPECIE_NOMBRE"> | undefined): BorradorHecho<"REGLA_DEL_PLAN"> =>
  ({ ...base, clave: "REGLA_DEL_PLAN", valor: "2027-02-03", ...(especie === undefined ? {} : { sujeto: especie }) });
const nivel = (regla: BorradorHecho<"REGLA_DEL_PLAN">, valor: string, obligatorio = false): BorradorHecho<"REGLA_NIVEL"> =>
  ({ ...base, clave: "REGLA_NIVEL", sujeto: regla, valor, obligatorio });
const grupo = (prioridad: number, hechos: readonly B[]): Grupo<ClaveReglas> => ({ prioridad, hechos });

/** Una especie con sus reglas: [nombre, ancla, nivel, ancla, nivel…]. */
function especieConReglas(valor: string, niveles: readonly string[], obligatorio = false): readonly B[] {
  const especie = nombre(valor);
  return [especie, ...niveles.flatMap((n) => {
    const regla = ancla(especie);
    return [regla, nivel(regla, n, obligatorio)];
  })];
}

const errorDe = (f: () => unknown): ErrorArmado => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorArmado) return e;
    throw e;
  }
  throw new Error("no lanzó");
};

describe("numerarGrupos", () => {
  it("numera de H01 en adelante, resuelve el sujeto (el borrador) al id anterior de su grupo y presenta con presentar", () => {
    const { hechos, recortados } = numerarGrupos("REGLAS", [
      grupo(2, especieConReglas(BETA, ["2491.73"])),
      grupo(1, especieConReglas(ALFA, ["4591.37", "4497.11"])),
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

  it("un ancla sin especie (regla de portafolio) no lleva sujeto", () => {
    const regla = ancla(undefined);
    const { hechos } = numerarGrupos("REGLAS", [grupo(1, [regla, nivel(regla, "613.29")])]);
    expect(hechos.map((h) => h.sujeto ?? null)).toEqual([null, "H01"]);
  });

  it("los empates de prioridad quedan en el orden de llegada", () => {
    const { hechos } = numerarGrupos("REGLAS", [grupo(3, [nombre(BETA)]), grupo(3, [nombre(ALFA)])]);
    expect(hechos.map((h) => h.valor)).toEqual([BETA, ALFA]);
  });

  it("los grupos entran enteros hasta el tope: el que no cabe se salta y se cuenta, y uno menor después sí entra", () => {
    const grande = grupo(1, [nombre("FICTICIA-GRANDE"), ...Array.from({ length: 4 }, () => ancla(undefined))]);
    const medio = grupo(2, especieConReglas("FICTICIA-MEDIO", ["4613.27"]));
    const chico = grupo(3, [nombre("FICTICIA-CHICO")]);
    const { hechos, recortados } = numerarGrupos("REGLAS", [grande, medio, chico], 7);
    expect(recortados).toBe(1);
    expect(hechos.map((h) => h.valor).filter((v) => v.startsWith("FICTICIA"))).toEqual(["FICTICIA-GRANDE", "FICTICIA-CHICO"]);
    expect(hechos).toHaveLength(6);
  });

  it("por omisión el tope es el del contrato (noventa y nueve), y un tope mayor no lo pasa", () => {
    const especies = Array.from({ length: 50 }, (_, i) => grupo(1, [nombre(`FICTICIA-${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`), ancla(undefined)]));
    expect(numerarGrupos("REGLAS", especies)).toMatchObject({ recortados: 1 });
    expect(numerarGrupos("REGLAS", especies).hechos).toHaveLength(MAX_HECHOS - 1);
    expect(numerarGrupos("REGLAS", especies, 137).hechos).toHaveLength(MAX_HECHOS - 1);
  });

  it("lo obligatorio arrastra al nombre de su especie, a través del ancla, sin volver obligatoria el ancla", () => {
    const { hechos } = numerarGrupos("REGLAS", [grupo(1, especieConReglas(ALFA, ["4591.37"], true)), grupo(1, especieConReglas(BETA, ["2491.73"]))]);
    expect(hechos.map((h) => [h.valor, h.obligatorio])).toEqual([
      [ALFA, true], ["2027-02-03", false], ["4591.37", true], [BETA, false], ["2027-02-03", false], ["2491.73", false],
    ]);
  });

  it.each<readonly [string, () => readonly Grupo<ClaveReglas>[]]>([
    ["un sujeto que viene después", () => {
      const especie = nombre(ALFA);
      const regla = ancla(especie);
      return [grupo(1, [nivel(regla, "4591.37"), especie, regla])];
    }],
    ["un sujeto que no está en el grupo", () => [grupo(1, [nombre(ALFA), nivel(ancla(nombre(ALFA)), "4591.37")])]],
    ["un sujeto de otro grupo", () => {
      const especie = nombre(ALFA);
      const regla = ancla(especie);
      return [grupo(1, [especie, regla]), grupo(2, [nivel(regla, "4591.37")])];
    }],
    ["el mismo borrador dos veces en el grupo", () => {
      const especie = nombre(ALFA);
      return [grupo(1, [especie, especie])];
    }],
  ])("REFERENCIA_INVALIDA: %s, con la clave del hecho", (_caso, armar) => {
    const error = errorDe(() => numerarGrupos("REGLAS", armar()));
    expect(error.codigo).toBe("REFERENCIA_INVALIDA");
    expect(error.clave).not.toBeNull();
  });

  it("una clave fuera del catálogo del tipo o un valor sin la forma de su unidad cierran en fallo, con la clave", () => {
    const fuera = errorDe(() => numerarGrupos("REGLAS", [grupo(1, [{ ...base, clave: "VALOR_ACCIONES" as ClaveReglas, valor: "4613.27" }])]));
    expect([fuera.codigo, fuera.clave]).toEqual(["CLAVE_FUERA_DE_CATALOGO", "VALOR_ACCIONES"]);
    const especie = nombre(ALFA);
    const regla = ancla(especie);
    const invalido = errorDe(() => numerarGrupos("REGLAS", [grupo(1, [especie, regla, nivel(regla, "4.591,37")])]));
    expect([invalido.codigo, invalido.clave]).toEqual(["VALOR_INVALIDO", "REGLA_NIVEL"]);
    expect(invalido.message).not.toMatch(/\p{N}/u);
  });

  it("sin grupos no hay hechos (el paquete, después, da SIN_HECHOS)", () => {
    expect(numerarGrupos("REGLAS", [])).toEqual({ hechos: [], recortados: 0, obligatoriosRecortados: 0 });
  });

  it("no toca los grupos que recibe", () => {
    const grupos = [grupo(1, especieConReglas(ALFA, ["4591.37"], true))];
    const antes = JSON.stringify(grupos);
    numerarGrupos("REGLAS", grupos);
    expect(JSON.stringify(grupos)).toBe(antes);
  });
});
