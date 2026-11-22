/**
 * E8: la puerta nube con el modelo y el esfuerzo de la configuración de la IA (no de las constantes), de forma ADITIVA:
 * sin ajustes, todo sigue como antes (opus y esfuerzo bajo). Precios de la skill claude-api (caché de la skill), POR
 * VERIFICAR contra la página de precios antes de encender: en micro-USD POR MILLÓN de tokens (haiku no cabe en enteros
 * por token), con la división redondeada hacia arriba (el tope solo puede quedar más estricto). Haiku tiene dos tramos:
 * hasta 100K tokens de entrada, USD 0,10 y 0,50; por encima, USD 0,50 y 2,50.
 * Con el cliente del SDK inyectado (un doble): sin red ni llave real. Valores inventados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CODIGOS_APAGADO_NUBE, LlaveNube, TECHO_TOPE_MICRO_USD, VARIABLE_LLAVE_NUBE, VARIABLE_TOPE_NUBE, configNubeDesde, type ConfigNube } from "@/ia/nube/config";
import { crearGeneradorNube } from "@/ia/nube/generador-nube";
import { AJUSTES_NUBE_POR_OMISION, ESFUERZOS_NUBE, MAX_TOKENS_NUBE, MODELOS_NUBE, armarCuerpoNube, type AjustesNube } from "@/ia/nube/peticion";
import { DETALLES_NUBE, leerRespuesta } from "@/ia/nube/respuesta";
import { TARIFAS_NUBE, costoMaximoMicroUsd, costoMicroUsd, costoTokensMicroUsd, esGastoDelMes, modeloDeDigest, type GastoDelMes } from "@/ia/nube/tope";
import { crearClienteDoble } from "./apoyo/cliente-doble";
import { GASTO_FICTICIO, LLAVE_FICTICIA, MES_FICTICIO, mensajeFicticio, pedidoFicticio } from "./apoyo/datos.ficticio";
import { fetchProhibido } from "./apoyo/fetch-falso";

const LLAVE = LlaveNube.desdeTexto(LLAVE_FICTICIA) as LlaveNube;
const SONNET: AjustesNube = { modelo: "claude-sonnet-5-5", esfuerzo: "medium" };
const HAIKU: AjustesNube = { modelo: "claude-haiku-5-5", esfuerzo: "low" };
const viva = (): AbortSignal => new AbortController().signal;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchProhibido());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listas cerradas de la nube", () => {
  it("los tres modelos (opus por omisión) y los dos esfuerzos, congelados", () => {
    expect([...MODELOS_NUBE]).toEqual(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect([...ESFUERZOS_NUBE]).toEqual(["low", "medium"]);
    expect(AJUSTES_NUBE_POR_OMISION).toEqual({ modelo: "claude-opus-5-5", esfuerzo: "low" });
    for (const l of [MODELOS_NUBE, ESFUERZOS_NUBE, AJUSTES_NUBE_POR_OMISION]) expect(Object.isFrozen(l)).toBe(true);
  });

  it("las tarifas en micro-USD por millón de tokens, una por modelo", () => {
    expect(TARIFAS_NUBE).toEqual({
      "claude-opus-5-5": { base: { entradaPorMillon: 4_000_000n, salidaPorMillon: 20_000_000n } },
      "claude-sonnet-5-5": { base: { entradaPorMillon: 2_000_000n, salidaPorMillon: 10_000_000n } },
      "claude-haiku-5-5": {
        base: { entradaPorMillon: 100_000n, salidaPorMillon: 500_000n },
        largo: { desdeTokensEntrada: 100_001, precio: { entradaPorMillon: 500_000n, salidaPorMillon: 2_500_000n } },
      },
    });
    expect(Object.keys(TARIFAS_NUBE).sort()).toEqual([...MODELOS_NUBE].sort());
    expect(Object.isFrozen(TARIFAS_NUBE)).toBe(true);
  });
});

describe("costoTokensMicroUsd · por modelo y tramo, redondeado hacia arriba", () => {
  it.each([
    ["claude-opus-5-5", 37911, 4613, 243_904n],
    ["claude-sonnet-5-5", 37911, 4613, 121_952n],
    // (37911 × 0,1 + 4613 × 0,5) = 6097,6 → 6098
    ["claude-haiku-5-5", 37911, 4613, 6098n],
    // 100.000 de entrada todavía es el tramo base: 10.000,5 → 10.001
    ["claude-haiku-5-5", 100_000, 1, 10_001n],
    // 100.001 ya es el tramo largo: 50.000,5 + 2,5 = 50.003
    ["claude-haiku-5-5", 100_001, 1, 50_003n],
    ["claude-haiku-5-5", 1, 0, 1n],
    ["claude-haiku-5-5", 0, 0, 0n],
  ] as const)("%s con %d de entrada y %d de salida = %s", (modelo, entrada, salida, esperado) => {
    expect(costoTokensMicroUsd(modelo, entrada, salida)).toBe(esperado);
  });

  it("opus por tokens es lo mismo que el costo de siempre (regresión)", () => {
    expect(costoTokensMicroUsd("claude-opus-5-5", GASTO_FICTICIO.tokensEntrada, GASTO_FICTICIO.tokensSalida)).toBe(costoMicroUsd(GASTO_FICTICIO));
  });
});

describe("costoMaximoMicroUsd con el modelo elegido", () => {
  it("sin modelo, opus como siempre; sonnet y haiku con su precio", () => {
    expect(costoMaximoMicroUsd("abc", 8192)).toBe(180_236n);
    expect(costoMaximoMicroUsd("abc", 8192, "claude-opus-5-5")).toBe(180_236n);
    expect(costoMaximoMicroUsd("abc", 8192, "claude-sonnet-5-5")).toBe((3n + 4096n) * 2n + 8192n * 10n);
    // (4099 × 0,1 + 8192 × 0,5) = 4505,9 → 4506
    expect(costoMaximoMicroUsd("abc", 8192, "claude-haiku-5-5")).toBe(4506n);
  });

  it("haiku con un cuerpo que pasa de 100K tokens (por bytes) se cota al tramo largo", () => {
    const cuerpo = "x".repeat(100_000);
    // (100.000 + 4.096) × 0,5 + 8.192 × 2,5 = 52.048 + 20.480
    expect(costoMaximoMicroUsd(cuerpo, 8192, "claude-haiku-5-5")).toBe(72_528n);
  });
});

describe("el gasto del mes ya valorado (microUsd, opcional)", () => {
  it("si viene, manda; si no, los tokens se valoran al precio más alto (opus), como antes", () => {
    expect(costoMicroUsd({ ...GASTO_FICTICIO, microUsd: 1237n })).toBe(1237n);
    expect(costoMicroUsd(GASTO_FICTICIO)).toBe(243_904n);
  });

  it("esGastoDelMes acepta microUsd en BigInt no negativo y rechaza lo demás", () => {
    expect(esGastoDelMes({ ...GASTO_FICTICIO, microUsd: 0n })).toBe(true);
    expect(esGastoDelMes({ ...GASTO_FICTICIO, microUsd: 1237n })).toBe(true);
    expect(esGastoDelMes({ ...GASTO_FICTICIO, microUsd: -1n })).toBe(false);
    expect(esGastoDelMes({ ...GASTO_FICTICIO, microUsd: 1237 })).toBe(false);
    expect(esGastoDelMes({ ...GASTO_FICTICIO, microUsd: "1237" })).toBe(false);
  });

  it("modeloDeDigest: el id exacto que devuelve la API es su modelo; otro, ninguno (se valora como opus)", () => {
    expect(modeloDeDigest("claude-haiku-5-5")).toBe("claude-haiku-5-5");
    expect(modeloDeDigest("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
    expect(modeloDeDigest("claude-haiku-5-5-ficticio")).toBeNull();
    expect(modeloDeDigest(null)).toBeNull();
  });
});

describe("armarCuerpoNube con ajustes", () => {
  it("sonnet con esfuerzo medio: el modelo y el esfuerzo elegidos, sin `speed` (el modo rápido es solo de opus)", () => {
    const r = armarCuerpoNube(pedidoFicticio().pedido, SONNET);
    if (!r.ok) throw new Error(r.detalle);
    expect(r.cuerpo.model).toBe("claude-sonnet-5-5");
    expect(r.cuerpo.output_config?.effort).toBe("medium");
    expect(r.cuerpo).not.toHaveProperty("speed");
    expect(r.cuerpo.service_tier).toBe("standard_only");
    expect(r.cuerpo.thinking).toEqual({ type: "adaptive" });
    expect(r.cuerpo.max_tokens).toBe(MAX_TOKENS_NUBE);
  });

  it("opus con esfuerzo medio conserva la velocidad estándar explícita", () => {
    const r = armarCuerpoNube(pedidoFicticio().pedido, { modelo: "claude-opus-5-5", esfuerzo: "medium" });
    if (!r.ok) throw new Error(r.detalle);
    expect(r.cuerpo).toMatchObject({ model: "claude-opus-5-5", speed: "standard", output_config: { effort: "medium" } });
  });

  it("sin ajustes, el mismo cuerpo que con los de omisión (regresión)", () => {
    const { pedido } = pedidoFicticio();
    expect(armarCuerpoNube(pedido)).toEqual(armarCuerpoNube(pedido, AJUSTES_NUBE_POR_OMISION));
  });

  it.each([
    ["un modelo que no es de la lista", { modelo: "claude-opus-5", esfuerzo: "low" }],
    ["un esfuerzo que no es de la lista", { modelo: "claude-opus-5-5", esfuerzo: "high" }],
    ["un campo de más", { modelo: "claude-opus-5-5", esfuerzo: "low", fallbacks: "default" }],
    ["nulo", null],
  ])("%s: no sale (AJUSTES_INVALIDOS), sin lanzar", (_n, ajustes) => {
    expect(armarCuerpoNube(pedidoFicticio().pedido, ajustes as unknown as AjustesNube)).toEqual({ ok: false, detalle: "AJUSTES_INVALIDOS" });
  });
});

describe("leerRespuesta con el modelo configurado", () => {
  it("el modelo es el pedido y el digest el que devolvió la API", () => {
    const r = leerRespuesta(mensajeFicticio({ model: "claude-haiku-5-5" }), 41, "claude-haiku-5-5");
    expect(r).toMatchObject({ ok: true, modelo: "claude-haiku-5-5", modeloDigest: "claude-haiku-5-5" });
  });

  it("AJUSTES_INVALIDOS está en la lista cerrada de detalles y de apagado", () => {
    expect(CODIGOS_APAGADO_NUBE).toContain("AJUSTES_INVALIDOS");
    expect(DETALLES_NUBE).toContain("AJUSTES_INVALIDOS");
  });
});

describe("configNubeDesde · la llave del entorno; el tope, el modelo y el esfuerzo de la configuración de la IA", () => {
  const entorno = { [VARIABLE_LLAVE_NUBE]: LLAVE_FICTICIA, [VARIABLE_TOPE_NUBE]: "0.37" };

  it("lista con el tope de la configuración (la variable del tope no cuenta) y sus ajustes", () => {
    const c = configNubeDesde(entorno, { topeMicroUsd: 4_613_000n, ...SONNET });
    expect(c).toMatchObject({ lista: true, topeMicroUsd: 4_613_000n, modelo: "claude-sonnet-5-5", esfuerzo: "medium" });
    expect(JSON.stringify(c, (_k, v: unknown) => (typeof v === "bigint" ? String(v) : v))).not.toContain(LLAVE_FICTICIA);
  });

  it.each([
    ["sin llave", {}, { topeMicroUsd: 4_613_000n, ...SONNET }, "SIN_LLAVE"],
    ["una llave con espacios", { [VARIABLE_LLAVE_NUBE]: "con espacio" }, { topeMicroUsd: 4_613_000n, ...SONNET }, "LLAVE_INVALIDA"],
    ["sin tope", entorno, { topeMicroUsd: null, ...SONNET }, "SIN_TOPE"],
    ["un tope cero", entorno, { topeMicroUsd: 0n, ...SONNET }, "TOPE_INVALIDO"],
    ["un tope sobre el techo", entorno, { topeMicroUsd: TECHO_TOPE_MICRO_USD + 1n, ...SONNET }, "TOPE_FUERA_DE_RANGO"],
    ["un modelo que no es de la lista", entorno, { topeMicroUsd: 4_613_000n, modelo: "claude-opus-5", esfuerzo: "low" }, "AJUSTES_INVALIDOS"],
  ])("%s → apagada · %s", (_n, env, ajustes, detalle) => {
    expect(configNubeDesde(env as Record<string, string>, ajustes as never)).toEqual({ lista: false, detalle });
  });
});

describe("crearGeneradorNube con el modelo de la configuración", () => {
  const configCon = (ajustes: AjustesNube, topeMicroUsd: bigint): ConfigNube => ({ lista: true, llave: LLAVE, topeMicroUsd, ...ajustes });
  const gasto = (microUsd?: bigint): GastoDelMes => (microUsd === undefined ? GASTO_FICTICIO : { ...GASTO_FICTICIO, microUsd });
  const maximoDe = (ajustes: AjustesNube): bigint => {
    const r = armarCuerpoNube(pedidoFicticio().pedido, ajustes);
    if (!r.ok) throw new Error(r.detalle);
    return costoMaximoMicroUsd(r.json, MAX_TOKENS_NUBE, ajustes.modelo);
  };

  function montar(config: ConfigNube, valor: GastoDelMes) {
    const doble = crearClienteDoble(() => Promise.resolve(mensajeFicticio({ model: (config as { modelo?: string }).modelo ?? "claude-opus-5-5" })));
    const generador = crearGeneradorNube(config, { gastoDelMes: () => Promise.resolve(valor), crearCliente: doble.crearCliente });
    return { generador, doble };
  }

  it("sonnet: llama con sonnet y devuelve sonnet; el tope cuenta el máximo de sonnet («justo» cabe)", async () => {
    const tope = 1237n + maximoDe(SONNET);
    const { generador, doble } = montar(configCon(SONNET, tope), gasto(1237n));
    const r = await generador.generar(pedidoFicticio().pedido, viva());
    expect(r).toMatchObject({ ok: true, puerta: "nube", modelo: "claude-sonnet-5-5" });
    expect(doble.llamadas()[0]?.cuerpo).toMatchObject({ model: "claude-sonnet-5-5", output_config: { effort: "medium" } });
  });

  it("sonnet: un micro-USD menos y no se llama (TOPE_MENSUAL)", async () => {
    const tope = 1237n + maximoDe(SONNET) - 1n;
    const { generador, doble } = montar(configCon(SONNET, tope), gasto(1237n));
    expect(await generador.generar(pedidoFicticio().pedido, viva())).toEqual({ ok: false, puerta: "nube", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" });
    expect(doble.llamadas()).toHaveLength(0);
  });

  it("haiku sin el gasto valorado: los tokens del mes cuentan a precio de opus (conservador)", async () => {
    const tope = costoMicroUsd(GASTO_FICTICIO) + maximoDe(HAIKU);
    const justo = montar(configCon(HAIKU, tope), gasto());
    expect(await justo.generador.generar(pedidoFicticio().pedido, viva())).toMatchObject({ ok: true, modelo: "claude-haiku-5-5" });
    const corto = montar(configCon(HAIKU, tope - 1n), gasto());
    expect(await corto.generador.generar(pedidoFicticio().pedido, viva())).toMatchObject({ ok: false, motivo: "TOPE_MENSUAL" });
  });

  it.each([
    ["un modelo que no es de la lista", { modelo: "claude-opus-5", esfuerzo: "low" }],
    ["un esfuerzo que no es de la lista", { modelo: "claude-haiku-5-5", esfuerzo: "max" }],
  ])("%s: PUERTA_APAGADA · AJUSTES_INVALIDOS, sin gasto ni cliente", async (_n, ajustes) => {
    const leer = vi.fn(() => Promise.resolve(GASTO_FICTICIO));
    const doble = crearClienteDoble(() => Promise.resolve(mensajeFicticio()));
    const g = crearGeneradorNube({ lista: true, llave: LLAVE, topeMicroUsd: 4_613_000n, ...ajustes } as unknown as ConfigNube, { gastoDelMes: leer, crearCliente: doble.crearCliente });
    expect(await g.generar(pedidoFicticio().pedido, viva())).toEqual({ ok: false, puerta: "nube", motivo: "PUERTA_APAGADA", detalle: "AJUSTES_INVALIDOS" });
    expect(leer).not.toHaveBeenCalled();
    expect(doble.construcciones()).toHaveLength(0);
  });

  it("el mes del gasto se respeta (regresión de la forma)", () => {
    expect(GASTO_FICTICIO.mes).toBe(MES_FICTICIO);
  });
});
