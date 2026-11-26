/**
 * El paquete `hechos-v2` (solo SIMULACION): hechos con `rango` e `importancia`. DIARIO, REGLAS y ESCENARIOS siguen en
 * `hechos-v1` con EL MISMO hash de antes (las huellas de abajo se fijaron antes del cambio).
 */
import { describe, expect, it } from "vitest";
import { VERSION_HECHOS, VERSION_HECHOS_V2 } from "@/ia/contrato";
import { ErrorPaquete, construirPaquete, leerPaquete } from "@/ia/paquete";
import { ENTRADAS_FICTICIAS, entradaSimulacion } from "../apoyo/hechos.ficticio";

/** Los hashes de los tres paquetes inventados de hoy, ANTES de agregar SIMULACION y `hechos-v2`. */
const HASH_DE_HOY = {
  DIARIO: "da6795ec41a644474632402e333c6296822c111f06ea36ae7ece4027b28e5868",
  REGLAS: "53bca91659e97c73ec5099cbcc99b92151cc72f6bfe8379ab25753080e891c6c",
  ESCENARIOS: "9e52aabda4f5287cedca2c57aa77f25dc0fcc7496ea2177d5a487585868a3315",
} as const;

const codigoDe = (f: () => unknown): string | null => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof ErrorPaquete ? e.codigo : "OTRO";
  }
};

type Entrada = ReturnType<typeof entradaSimulacion>;
const conHecho = (indice: number, cambios: Record<string, unknown>): Entrada => {
  const base = entradaSimulacion();
  return { ...base, hechos: base.hechos.map((h, i) => (i === indice ? { ...h, ...cambios } : h)) } as unknown as Entrada;
};
const sinCampo = (indice: number, campo: string): Entrada => {
  const base = entradaSimulacion();
  return { ...base, hechos: base.hechos.map((h, i) => { if (i !== indice) return h; const { [campo]: _quitado, ...resto } = h as unknown as Record<string, unknown>; return resto; }) } as unknown as Entrada;
};

describe("hechos-v2 solo en SIMULACION", () => {
  it.each(["DIARIO", "REGLAS", "ESCENARIOS"] as const)("%s sigue en hechos-v1 con el mismo hash de antes", (tipo) => {
    const paquete = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
    expect(paquete.version).toBe(VERSION_HECHOS);
    expect(paquete.hash).toBe(HASH_DE_HOY[tipo]);
    for (const hecho of paquete.hechos) expect(Object.keys(hecho)).not.toContain("rango");
  });

  it("SIMULACION es hechos-v2, con rango e importancia en cada punto, y se guarda y se lee igual", () => {
    expect(VERSION_HECHOS_V2).toBe("hechos-v2");
    const paquete = construirPaquete(entradaSimulacion());
    expect(paquete.version).toBe("hechos-v2");
    expect(paquete.hechos[1]).toMatchObject({ clave: "PESO_ESPECIE", rango: "MUY_ELEVADO", importancia: "ALTA", unidad: "PORCENTAJE", presentacion: "42,5 %" });
    expect(Object.keys(paquete.hechos[0] as object)).not.toContain("rango");
    expect(leerPaquete(JSON.parse(JSON.stringify(paquete)))).toEqual(paquete);
  });

  it("las unidades nuevas se presentan como el análisis de /operar", () => {
    const paquete = construirPaquete(entradaSimulacion());
    expect(paquete.hechos[2]?.presentacion).toBe("0,318");
    expect(paquete.hechos[3]?.presentacion).toBe("2,84 veces");
  });

  it("el hash cambia con el rango y con la importancia", () => {
    const a = construirPaquete(entradaSimulacion());
    expect(construirPaquete(conHecho(1, { rango: "ELEVADO", importancia: "MEDIA" })).hash).not.toBe(a.hash);
  });

  it("un rango fuera de la lista de su clave, o de otra clave, es RANGO_INVALIDO", () => {
    expect(codigoDe(() => construirPaquete(conHecho(1, { rango: "TOCADA", importancia: "ALTA" })))).toBe("RANGO_INVALIDO");
    expect(codigoDe(() => construirPaquete(conHecho(1, { rango: "INVENTADO", importancia: "ALTA" })))).toBe("RANGO_INVALIDO");
    expect(codigoDe(() => construirPaquete(conHecho(1, { rango: "MUY_ELEVADO ", importancia: "ALTA" })))).toBe("RANGO_INVALIDO");
    expect(codigoDe(() => construirPaquete(conHecho(1, { rango: 7, importancia: "ALTA" })))).toBe("RANGO_INVALIDO");
  });

  it("un punto sin rango o sin importancia, o con otra importancia que la de TRAMOS, se rechaza", () => {
    expect(codigoDe(() => construirPaquete(sinCampo(1, "rango")))).toBe("CAMPO_FALTANTE");
    expect(codigoDe(() => construirPaquete(sinCampo(1, "importancia")))).toBe("CAMPO_FALTANTE");
    expect(codigoDe(() => construirPaquete(conHecho(1, { importancia: "BAJA" })))).toBe("IMPORTANCIA_INVALIDA");
    expect(codigoDe(() => construirPaquete(conHecho(1, { importancia: "URGENTE" })))).toBe("IMPORTANCIA_INVALIDA");
  });

  it("el nombre de la especie, y todo hecho de los tres de hoy, no llevan rango ni importancia", () => {
    expect(codigoDe(() => construirPaquete(conHecho(0, { rango: "ELEVADO", importancia: "MEDIA" })))).toBe("RANGO_INVALIDO");
    const diario = ENTRADAS_FICTICIAS.DIARIO();
    const con = { ...diario, hechos: diario.hechos.map((h, i) => (i === 1 ? { ...h, rango: "ELEVADO", importancia: "MEDIA" } : h)) } as unknown as typeof diario;
    expect(codigoDe(() => construirPaquete(con))).toBe("RANGO_INVALIDO");
  });

  it("la versión guardada tiene que ser la del tipo: v1 en SIMULACION y v2 en DIARIO son VERSION_DISTINTA", () => {
    const simulacion = JSON.parse(JSON.stringify(construirPaquete(entradaSimulacion()))) as Record<string, unknown>;
    expect(codigoDe(() => leerPaquete({ ...simulacion, version: "hechos-v1" }))).toBe("VERSION_DISTINTA");
    const diario = JSON.parse(JSON.stringify(construirPaquete(ENTRADAS_FICTICIAS.DIARIO()))) as Record<string, unknown>;
    expect(codigoDe(() => leerPaquete({ ...diario, version: "hechos-v2" }))).toBe("VERSION_DISTINTA");
    expect(leerPaquete(diario).hash).toBe(HASH_DE_HOY.DIARIO);
  });

  it("un campo desconocido en un hecho de SIMULACION sigue siendo CAMPO_DESCONOCIDO, y «lado», «cambio» o «antes» no entran", () => {
    for (const campo of ["lado", "cambio", "antes", "otro"]) {
      const codigo = codigoDe(() => construirPaquete(conHecho(1, { [campo]: "x" })));
      expect(["CAMPO_DESCONOCIDO", "CLAVE_PROHIBIDA"], campo).toContain(codigo);
    }
  });
});
