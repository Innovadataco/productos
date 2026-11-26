/**
 * El cableado (E8): la configuración vigente decide el modo, el límite por pedido, el modelo local DE CADA TAREA, la
 * temperatura de la local y el modelo, el esfuerzo y el tope de la nube; no las constantes. Sin configuración, o con la
 * tarea inactiva, no se llama a nadie (APAGADO). Con generadores falsos y, al final, con los clientes reales de las dos
 * puertas sobre un `fetch` y un SDK falsos: lo elegido llega al cable. Sin red. Datos inventados.
 */
import { describe, expect, it, vi } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { configLocalDe, configNubeDe, corridaDe, generarSegunConfig, generadoresDeConfig } from "@/ia/config/cableado";
import type { ConfigIaVigente } from "@/ia/config/leer";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { VARIABLE_LLAVE_NUBE } from "@/ia/nube/config";
import { construirPaquete } from "@/ia/paquete";
import { entradaDiario, entradaReglas } from "../apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import { crearClienteDoble } from "../nube/apoyo/cliente-doble";
import { mensajeFicticio } from "../nube/apoyo/datos.ficticio";
import { crearOllamaFalso, generacionFicticia, json, tagsCon, vigilarFalsos } from "../local/apoyo/ollama-falso";
import { DESTINO_FICTICIO, DIGEST_GEMMA, DIGEST_QWEN, VIGENTE_FICTICIA } from "./apoyo/config.ficticio";

// La lista ficticia de PI como la del módulo (sin importar el apoyo, que importa este mismo módulo: se colgaría).
vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { readFileSync } = await import("node:fs");
  const lista = real.leerModelosPermitidos(readFileSync(new URL("../../../fixtures/ia/modelos-ia-local-permitidos.ficticio.json", import.meta.url), "utf8"));
  const modelos = lista.estado === "LISTA" ? lista.modelos : [];
  return { ...real, modeloAprobado: (n: unknown) => modelos.find((m) => m.nombre === n) ?? null };
});

vigilarFalsos();

const con = (cambios: Partial<ConfigIaVigente>): ConfigIaVigente => ({ ...VIGENTE_FICTICIA, ...cambios });
const entrada = (paquete: PaqueteHechos = construirPaquete(entradaDiario())) => ({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO });
const LLAVE = { [VARIABLE_LLAVE_NUBE]: "llave-ficticia-nube-4613-37911-alfa" };

describe("corridaDe · qué dice la configuración para una tarea", () => {
  it("una tarea activa: el modo, el límite en ms y su modelo local", () => {
    expect(corridaDe(VIGENTE_FICTICIA, "DIARIO")).toEqual({ estado: "LISTA", tarea: "DIARIO", modo: "local-luego-nube", limiteMs: 45_000, modeloLocal: "qwen2.5:14b" });
    expect(corridaDe(VIGENTE_FICTICIA, "REGLAS")).toMatchObject({ estado: "LISTA", modeloLocal: "gemma2:27b" });
  });

  it("sin configuración, con el modo apagado o con la tarea inactiva: APAGADO con su motivo", () => {
    expect(corridaDe(null, "DIARIO")).toEqual({ estado: "APAGADO", motivo: "SIN_CONFIGURACION" });
    expect(corridaDe(con({ modo: "apagado" }), "DIARIO")).toEqual({ estado: "APAGADO", motivo: "MODO_APAGADO" });
    expect(corridaDe(VIGENTE_FICTICIA, "ESCENARIOS")).toEqual({ estado: "APAGADO", motivo: "TAREA_INACTIVA" });
  });
});

describe("configLocalDe y configNubeDe", () => {
  it("la local: el destino guardado, el modelo de la tarea y la temperatura", () => {
    expect(configLocalDe(con({ temperaturaCentesimas: 37 }), "REGLAS")).toEqual({ destino: DESTINO_FICTICIO, modelo: "gemma2:27b", temperaturaCentesimas: 37 });
    expect(configLocalDe(con({ ollamaHost: null, ollamaPuerto: null }), "DIARIO")).toBeNull();
    expect(configLocalDe(VIGENTE_FICTICIA, "ESCENARIOS")).toBeNull();
  });

  it("la nube: la llave del entorno; el tope, el modelo y el esfuerzo de la configuración", () => {
    expect(configNubeDe(VIGENTE_FICTICIA, LLAVE)).toMatchObject({ lista: true, topeMicroUsd: 4_610_000n, modelo: "claude-sonnet-5-5", esfuerzo: "medium" });
    expect(configNubeDe(con({ topeMicroUsd: null }), LLAVE)).toEqual({ lista: false, detalle: "SIN_TOPE" });
    expect(configNubeDe(VIGENTE_FICTICIA, {})).toEqual({ lista: false, detalle: "SIN_LLAVE" });
    expect(configNubeDe(null, LLAVE)).toEqual({ lista: false, detalle: "SIN_TOPE" });
  });
});

describe("generarSegunConfig · con generadores falsos", () => {
  it("una tarea activa: arma el pedido con el límite de la configuración y corre las puertas del modo", async () => {
    const local = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: '{"frases":[]}' } });
    const nube = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "RESPONDER", salidaCruda: '{"frases":[]}' } });
    const r = await generarSegunConfig(VIGENTE_FICTICIA, [local, nube], entrada());
    expect(r).toMatchObject({ estado: "EXITO", exito: { puerta: "local" } });
    expect(local.llamadas()[0]?.limiteMs).toBe(45_000);
    expect(nube.llamadas()).toHaveLength(0);
  });

  it("la tarea del paquete inactiva, o sin configuración: APAGADO, sin llamar a nadie", async () => {
    const local = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: "{}" } });
    const tareas = { ...VIGENTE_FICTICIA.tareas, DIARIO: { activo: false, modeloLocal: "qwen2.5:14b" } };
    expect(await generarSegunConfig(con({ tareas }), [local], entrada())).toEqual({ estado: "APAGADO", ok: false });
    expect(await generarSegunConfig(null, [local], entrada())).toEqual({ estado: "APAGADO", ok: false });
    expect(local.llamadas()).toHaveLength(0);
  });
});

describe("generadoresDeConfig · los clientes reales de las dos puertas, con la red y el SDK falsos", () => {
  it("DIARIO va a la local con qwen2.5:14b y su digest de la lista; REGLAS, con gemma2:27b; la nube, con sonnet y esfuerzo medio", async () => {
    const ollama = crearOllamaFalso((llamada) => {
      const cuerpo = llamada.body === undefined ? null : (JSON.parse(llamada.body) as { model: string });
      if (cuerpo === null) return json(tagsCon([{ nombre: "qwen2.5:14b", digest: DIGEST_QWEN }, { nombre: "gemma2:27b", digest: DIGEST_GEMMA }]));
      return json(generacionFicticia({ model: cuerpo.model }));
    });
    const doble = crearClienteDoble(() => Promise.resolve(mensajeFicticio({ model: "claude-sonnet-5-5" })));
    const deps = { fetchLocal: ollama.fetch, gastoDelMes: () => Promise.resolve({ mes: "2027-03", tokensEntrada: 0, tokensSalida: 0, microUsd: 0n }), crearCliente: doble.crearCliente };

    const diario = generadoresDeConfig(VIGENTE_FICTICIA, "DIARIO", LLAVE, deps);
    const r1 = await generarSegunConfig(VIGENTE_FICTICIA, diario, entrada());
    expect(r1).toMatchObject({ estado: "EXITO", exito: { puerta: "local", modelo: "qwen2.5:14b", modeloDigest: DIGEST_QWEN } });

    const reglas = generadoresDeConfig(VIGENTE_FICTICIA, "REGLAS", LLAVE, deps);
    const r2 = await generarSegunConfig(VIGENTE_FICTICIA, reglas, entrada(construirPaquete(entradaReglas())));
    expect(r2).toMatchObject({ estado: "EXITO", exito: { puerta: "local", modelo: "gemma2:27b", modeloDigest: DIGEST_GEMMA } });

    const soloNube = con({ modo: "nube" });
    const r3 = await generarSegunConfig(soloNube, generadoresDeConfig(soloNube, "DIARIO", LLAVE, deps), entrada());
    expect(r3).toMatchObject({ estado: "EXITO", exito: { puerta: "nube", modelo: "claude-sonnet-5-5" } });
    expect(doble.llamadas()[0]?.cuerpo).toMatchObject({ model: "claude-sonnet-5-5", output_config: { effort: "medium" } });
  });

  it("sin destino o sin modelo para la tarea, no hay generador local (la puerta queda PUERTA_APAGADA)", () => {
    const deps = { fetchLocal: crearOllamaFalso(() => json({})).fetch, gastoDelMes: () => Promise.resolve({ mes: "2027-03", tokensEntrada: 0, tokensSalida: 0 }) };
    expect(generadoresDeConfig(con({ ollamaHost: null, ollamaPuerto: null }), "DIARIO", {}, deps).map((g) => g.puerta)).toEqual(["nube"]);
    expect(generadoresDeConfig(VIGENTE_FICTICIA, "ESCENARIOS", {}, deps).map((g) => g.puerta)).toEqual(["nube"]);
  });

  it("un modelo que ya no está en la lista no tumba nada: sin generador local", () => {
    const tareas = { ...VIGENTE_FICTICIA.tareas, DIARIO: { activo: true, modeloLocal: "qwen2.5:32b" } };
    const deps = { fetchLocal: crearOllamaFalso(() => json({})).fetch, gastoDelMes: () => Promise.resolve({ mes: "2027-03", tokensEntrada: 0, tokensSalida: 0 }) };
    expect(generadoresDeConfig(con({ tareas }), "DIARIO", {}, deps).map((g) => g.puerta)).toEqual(["nube"]);
  });
});
