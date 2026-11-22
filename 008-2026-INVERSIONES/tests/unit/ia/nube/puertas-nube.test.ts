/**
 * La puerta nube de punta a punta, con el SDK REAL y un `fetch` falso, detrás de `generarConPuertas` (la guarda de la
 * vista ciega es la única entrada al generador). Lo que sale por el cable es solo la vista ciega y el prompt; lo que
 * vuelve, sin la llave ni el mensaje del proveedor. Sin red: el fetch global está prohibido.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { LlaveNube, TECHO_TOPE_MICRO_USD, VARIABLE_TOPE_NUBE, leerConfigNube, type ConfigNube } from "@/ia/nube/config";
import { crearGeneradorNube } from "@/ia/nube/generador-nube";
import { MODELO_NUBE } from "@/ia/nube/peticion";
import { MODOS_PUERTAS, generarConPuertas, ordenDePuertas, type ModoPuertas } from "@/ia/puertas";
import { hayDigitosFueraDeIds } from "../apoyo/detectores";
import { FUENTE_FICTICIA } from "../apoyo/hechos.ficticio";
import { PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import {
  GASTO_FICTICIO, LLAVE_FICTICIA, MENSAJE_DEL_PROVEEDOR, OTRA_LLAVE_FICTICIA, SALIDA_FICTICIA, cuerpoErrorFicticio, mensajeFicticio, pedidoFicticio,
} from "./apoyo/datos.ficticio";
import { crearFetchFalso, fetchProhibido, type ConductaFetch } from "./apoyo/fetch-falso";

const LLAVE = LlaveNube.desdeTexto(LLAVE_FICTICIA) as LlaveNube;
const config = (topeMicroUsd = TECHO_TOPE_MICRO_USD): ConfigNube => ({ lista: true, llave: LLAVE, topeMicroUsd });

function montar(guion: ConductaFetch | ((indice: number) => ConductaFetch), configuracion: ConfigNube = config()) {
  const falso = crearFetchFalso(guion);
  const generador = crearGeneradorNube(configuracion, { gastoDelMes: () => Promise.resolve(GASTO_FICTICIO), fetch: falso.fetch });
  return { falso, generador };
}

async function correr(guion: ConductaFetch | ((indice: number) => ConductaFetch), modo: ModoPuertas = "nube", configuracion: ConfigNube = config(), limiteMs?: number) {
  const { paquete, pedido } = pedidoFicticio("DIARIO", limiteMs);
  const m = montar(guion, configuracion);
  const resultado = await generarConPuertas([m.generador], modo, pedido, paquete);
  return { ...m, resultado, paquete, pedido };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchProhibido());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("éxito por la puerta nube", () => {
  it("modo nube: EXITO con la salida, el modelo, el digest y los tokens", async () => {
    const { resultado, falso } = await correr({ tipo: "JSON", cuerpo: mensajeFicticio() });
    expect(resultado).toMatchObject({
      estado: "EXITO",
      exito: { ok: true, puerta: "nube", salidaCruda: SALIDA_FICTICIA, modelo: MODELO_NUBE, modeloDigest: "claude-opus-5-5", tokensEntrada: 5561, tokensSalida: 379 },
      fallosPrevios: [],
    });
    expect(falso.llamadas()).toHaveLength(1);
  });

  it("modo local-luego-nube: si la local falla, responde la nube", async () => {
    const { paquete, pedido } = pedidoFicticio();
    const local = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE", detalle: "SIN_CONEXION" } });
    const { generador } = montar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    const resultado = await generarConPuertas([local, generador], "local-luego-nube", pedido, paquete);
    expect(resultado).toMatchObject({ estado: "EXITO", exito: { puerta: "nube" }, fallosPrevios: [{ puerta: "local", motivo: "MODELO_NO_DISPONIBLE" }] });
  });
});

describe("una respuesta cobrada pero inservible (decisión fijada en la revisión)", () => {
  it("un rechazo del modelo es EXITO con la salida vacía y sus tokens: el validador lo rechaza y el registro lo cuenta", async () => {
    const { resultado } = await correr({ tipo: "JSON", cuerpo: mensajeFicticio({ stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null } }) });
    expect(resultado).toMatchObject({ estado: "EXITO", exito: { puerta: "nube", salidaCruda: "", tokensEntrada: 5561, tokensSalida: 379 } });
  });

  it("por eso la nube va siempre ÚLTIMA: un EXITO vacío nunca le quita el turno a otra puerta", () => {
    for (const modo of MODOS_PUERTAS) {
      const orden = ordenDePuertas(modo);
      if (orden.includes("nube")) expect(orden.at(-1)).toBe("nube");
    }
  });
});

describe("lo que sale por el cable", () => {
  it.each(TIPOS_RESUMEN)("%s: el contenido es solo la vista ciega; system es el prompt; nada del paquete completo", async (tipo) => {
    const { paquete, pedido } = pedidoFicticio(tipo);
    const { falso, generador } = montar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    await generarConPuertas([generador], "nube", pedido, paquete);
    const cuerpo = JSON.parse(falso.llamadas()[0]?.cuerpo ?? "{}") as { readonly system: string; readonly messages: readonly { readonly content: string }[] };
    const contenido = cuerpo.messages[0]?.content ?? "";
    expect(cuerpo.system).toBe(PROMPT_FICTICIO.texto);
    expect(hayDigitosFueraDeIds(contenido)).toBe(false);
    const texto = falso.llamadas()[0]?.cuerpo ?? "";
    for (const dato of [paquete.hash, paquete.hoy, FUENTE_FICTICIA, "FICTICIA", ...paquete.avisos, ...paquete.hechos.filter((h) => h.presentacion.length > 3).map((h) => h.presentacion)]) {
      expect(texto).not.toContain(dato);
    }
  });
});

describe("sin llamar por el cable", () => {
  it("tope encima: FALLO · TOPE_MENSUAL, cero llamadas", async () => {
    const { resultado, falso } = await correr({ tipo: "JSON", cuerpo: mensajeFicticio() }, "nube", config(1n));
    expect(resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "nube", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" }] });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("sin la llave propia (aunque el entorno tenga ANTHROPIC_API_KEY): PUERTA_APAGADA, cero llamadas", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", OTRA_LLAVE_FICTICIA);
    const configuracion = leerConfigNube({ ...process.env, [VARIABLE_TOPE_NUBE]: "4.37" });
    const { resultado, falso } = await correr({ tipo: "JSON", cuerpo: mensajeFicticio() }, "nube", configuracion);
    expect(resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "nube", motivo: "PUERTA_APAGADA", detalle: "SIN_LLAVE" }] });
    expect(falso.llamadas()).toHaveLength(0);
  });
});

describe("el límite y los errores, por el orquestador", () => {
  it("el límite del orquestador corta un fetch colgado; el fetch vio la señal abortada y la siguiente pasa", async () => {
    const { paquete, pedido } = pedidoFicticio("DIARIO", 37);
    const { falso, generador } = montar((indice) => (indice === 0 ? { tipo: "COLGAR" } : { tipo: "JSON", cuerpo: mensajeFicticio() }));
    const primera = await generarConPuertas([generador], "nube", pedido, paquete);
    expect(primera).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "nube", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_ORQUESTADOR" }] });
    await new Promise((resolver) => setTimeout(resolver, 5));
    expect(falso.llamadas()[0]?.senal?.aborted).toBe(true);
    const otra = pedidoFicticio();
    expect(await generarConPuertas([generador], "nube", otra.pedido, otra.paquete)).toMatchObject({ estado: "EXITO" });
  });

  it.each([
    ["429 del límite de gasto de la cuenta", { tipo: "JSON", estado: 429, cuerpo: cuerpoErrorFicticio("rate_limit_error", "enforced_spend_limit_reached") }, "TOPE_MENSUAL", "LIMITE_DE_GASTO_DEL_PROVEEDOR"],
    ["529 con x-should-retry", { tipo: "JSON", estado: 529, cuerpo: cuerpoErrorFicticio("overloaded_error"), cabeceras: { "x-should-retry": "true" } }, "MODELO_NO_DISPONIBLE", "SOBRECARGA"],
    ["401", { tipo: "JSON", estado: 401, cuerpo: cuerpoErrorFicticio("authentication_error") }, "ERROR_PROVEEDOR", "NO_AUTORIZADO"],
    ["conexión rechazada", { tipo: "RECHAZAR" }, "MODELO_NO_DISPONIBLE", "SIN_CONEXION"],
    ["respuesta demasiado grande", { tipo: "BYTES", n: 1_048_577 }, "ERROR_PROVEEDOR", "RESPUESTA_DEMASIADO_GRANDE"],
    ["el cuerpo se corta a la mitad (sin aborto)", { tipo: "CORTAR_CUERPO" }, "MODELO_NO_DISPONIBLE", "SIN_CONEXION"],
  ] as const)("%s → %s · %s, una sola llamada, sin la llave ni el mensaje del proveedor", async (_caso, conducta, motivo, detalle) => {
    const { resultado, falso } = await correr(conducta as ConductaFetch);
    expect(resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "nube", motivo, detalle }] });
    expect(falso.llamadas()).toHaveLength(1);
    const json = JSON.stringify(resultado);
    expect(json).not.toContain(LLAVE_FICTICIA);
    expect(json).not.toContain(MENSAJE_DEL_PROVEEDOR);
  });
});
