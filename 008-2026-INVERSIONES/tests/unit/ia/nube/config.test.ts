/**
 * La configuración de la puerta nube: la llave y el tope salen de dos variables propias y de nada más. Sin llave o sin
 * tope, la puerta queda apagada (nunca hay un tope por omisión). La llave nunca se ve: ni en JSON, ni en texto, ni en
 * `inspect`, ni en `console`, ni en las claves del objeto.
 */
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CODIGOS_APAGADO_NUBE, LlaveNube, MAX_LARGO_LLAVE_NUBE, TECHO_TOPE_MICRO_USD, VARIABLE_LLAVE_NUBE, VARIABLE_TOPE_NUBE,
  leerConfigNube, type ConfigNube,
} from "@/ia/nube/config";
import { LLAVE_FICTICIA, OTRA_LLAVE_FICTICIA } from "./apoyo/datos.ficticio";

const entorno = (llave: string | undefined, tope: string | undefined): Record<string, string | undefined> => ({ [VARIABLE_LLAVE_NUBE]: llave, [VARIABLE_TOPE_NUBE]: tope });

function lista(config: ConfigNube): Extract<ConfigNube, { lista: true }> {
  if (!config.lista) throw new Error(`no quedó lista: ${config.detalle}`);
  return config;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("nombres y listas cerradas", () => {
  it("las variables, los códigos de apagado y el techo del tope", () => {
    expect(VARIABLE_LLAVE_NUBE).toBe("INV_IA_NUBE_LLAVE");
    expect(VARIABLE_TOPE_NUBE).toBe("INV_IA_NUBE_TOPE_USD");
    expect([...CODIGOS_APAGADO_NUBE]).toEqual(["SIN_LLAVE", "LLAVE_INVALIDA", "SIN_TOPE", "TOPE_INVALIDO", "TOPE_FUERA_DE_RANGO", "CLIENTE_NO_CONSTRUIDO", "AJUSTES_INVALIDOS"]);
    expect(Object.isFrozen(CODIGOS_APAGADO_NUBE)).toBe(true);
    expect(TECHO_TOPE_MICRO_USD).toBe(50_000_000n);
    expect(MAX_LARGO_LLAVE_NUBE).toBe(256);
  });
});

describe("leerConfigNube · la llave", () => {
  it.each([undefined, ""])("sin llave (%j) queda apagada con SIN_LLAVE, aunque haya tope", (llave) => {
    expect(leerConfigNube(entorno(llave, "4.37"))).toEqual({ lista: false, detalle: "SIN_LLAVE" });
  });

  it.each([
    ["con un espacio", "llave ficticia"],
    ["con un salto de línea al final", `${LLAVE_FICTICIA}\n`],
    ["con un tab", `\t${LLAVE_FICTICIA}`],
    ["con un carácter fuera de ASCII", "llave-ficticia-ñ"],
    ["demasiado larga", "a".repeat(MAX_LARGO_LLAVE_NUBE + 1)],
  ])("una llave %s queda apagada con LLAVE_INVALIDA (no se recorta ni se corrige)", (_caso, llave) => {
    expect(leerConfigNube(entorno(llave, "4.37"))).toEqual({ lista: false, detalle: "LLAVE_INVALIDA" });
  });

  it("una llave del largo máximo se acepta", () => {
    expect(leerConfigNube(entorno("a".repeat(MAX_LARGO_LLAVE_NUBE), "4.37")).lista).toBe(true);
  });

  it("la llave del entorno de Anthropic NO enciende la puerta: solo cuenta la variable propia", () => {
    expect(leerConfigNube({ ANTHROPIC_API_KEY: OTRA_LLAVE_FICTICIA, ANTHROPIC_AUTH_TOKEN: OTRA_LLAVE_FICTICIA, [VARIABLE_TOPE_NUBE]: "4.37" })).toEqual({ lista: false, detalle: "SIN_LLAVE" });
  });

  it("lee exactamente las dos variables propias, y nada más del entorno", () => {
    const leidas: string[] = [];
    const espia = new Proxy(entorno(LLAVE_FICTICIA, "4.37"), {
      get(objetivo, clave, receptor) {
        leidas.push(String(clave));
        return Reflect.get(objetivo, clave, receptor) as unknown;
      },
    });
    leerConfigNube(espia);
    expect([...new Set(leidas)].sort()).toEqual([VARIABLE_LLAVE_NUBE, VARIABLE_TOPE_NUBE].sort());
  });
});

describe("leerConfigNube · el tope (configuración, sin valor por omisión)", () => {
  it.each([undefined, ""])("sin tope (%j) queda apagada con SIN_TOPE", (tope) => {
    expect(leerConfigNube(entorno(LLAVE_FICTICIA, tope))).toEqual({ lista: false, detalle: "SIN_TOPE" });
  });

  it.each([
    ["37.911", 37_911_000n],
    ["4.37", 4_370_000n],
    ["0.000001", 1n],
    ["41", 41_000_000n],
    ["50", TECHO_TOPE_MICRO_USD],
    ["49.999999", TECHO_TOPE_MICRO_USD - 1n],
  ])("acepta «%s» USD como %s micro-USD", (tope, micro) => {
    expect(lista(leerConfigNube(entorno(LLAVE_FICTICIA, tope))).topeMicroUsd).toBe(micro);
  });

  it.each(["41,7", "-4.37", "+4.37", "1e3", " 41", "41 ", "41.", ".5", "0", "0.000000", "0.0000001", "007", "abc", "٤١", "Infinity", "NaN", "0x10"])(
    "rechaza «%s» con TOPE_INVALIDO",
    (tope) => {
      expect(leerConfigNube(entorno(LLAVE_FICTICIA, tope))).toEqual({ lista: false, detalle: "TOPE_INVALIDO" });
    },
  );

  it.each(["50.000001", "53.17", "999999"])("rechaza «%s» por encima del techo con TOPE_FUERA_DE_RANGO", (tope) => {
    expect(leerConfigNube(entorno(LLAVE_FICTICIA, tope))).toEqual({ lista: false, detalle: "TOPE_FUERA_DE_RANGO" });
  });

  it("la configuración lista lleva la llave envuelta y el tope, congelada", () => {
    const config = lista(leerConfigNube(entorno(LLAVE_FICTICIA, "4.37")));
    expect(Object.keys(config).sort()).toEqual(["lista", "llave", "topeMicroUsd"]);
    expect(LlaveNube.es(config.llave)).toBe(true);
    expect(config.llave.revelar()).toBe(LLAVE_FICTICIA);
    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe("LlaveNube · la llave nunca se ve", () => {
  it("ni en JSON, ni en texto, ni en inspect, ni en las claves, ni en un clon estructurado", () => {
    const config = lista(leerConfigNube(entorno(LLAVE_FICTICIA, "4.37")));
    const vistas = [
      JSON.stringify({ ...config, topeMicroUsd: String(config.topeMicroUsd) }),
      JSON.stringify({ envuelta: config.llave }),
      String(config.llave),
      `${config.llave}`,
      inspect(config, { depth: 10, showHidden: true }),
      inspect(config.llave, { depth: 10, showHidden: true }),
      Object.keys(config.llave).join(","),
      Object.getOwnPropertyNames(config.llave).join(","),
      inspect(structuredClone(config), { depth: 10, showHidden: true }),
    ];
    for (const vista of vistas) expect(vista).not.toContain(LLAVE_FICTICIA);
    expect(String(config.llave)).toBe("[LLAVE_OCULTA]");
    expect(JSON.stringify(config.llave)).toBe('"[LLAVE_OCULTA]"');
  });

  it("console.log de la configuración tampoco la muestra", () => {
    const escritos: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...partes: unknown[]) => {
      escritos.push(partes.map((p) => inspect(p, { depth: 10 })).join(" "));
    });
    console.log(lista(leerConfigNube(entorno(LLAVE_FICTICIA, "4.37"))));
    expect(escritos.join("\n")).not.toContain(LLAVE_FICTICIA);
    expect(escritos.join("\n")).toContain("[LLAVE_OCULTA]");
  });

  it("una imitación no es una LlaveNube (la marca es un campo privado)", () => {
    const imitacion = { revelar: () => LLAVE_FICTICIA, toString: () => "[LLAVE_OCULTA]" };
    expect(LlaveNube.es(imitacion)).toBe(false);
    expect(LlaveNube.es(null)).toBe(false);
    expect(LlaveNube.es(LLAVE_FICTICIA)).toBe(false);
    expect(LlaveNube.es(Object.create(LlaveNube.prototype))).toBe(false);
  });

  it("desdeTexto valida igual que la configuración", () => {
    expect(LlaveNube.desdeTexto(LLAVE_FICTICIA)?.revelar()).toBe(LLAVE_FICTICIA);
    expect(LlaveNube.desdeTexto("")).toBeNull();
    expect(LlaveNube.desdeTexto("llave ficticia")).toBeNull();
  });
});
