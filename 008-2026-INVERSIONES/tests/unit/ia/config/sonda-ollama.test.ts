/**
 * «Identificar modelos» y «Probar» (E8) detrás de la interfaz `SondaOllama`: SOLO con el destino GUARDADO en la
 * configuración vigente, nunca con uno que venga del pedido (I-24 de PI, un SSRF). Un Ollama inalcanzable da un estado
 * estructurado («inalcanzable»), nunca una excepción. En producción, y por omisión, la sonda es la PENDIENTE: la app de
 * 008 no tiene salida a la tailnet y la llamada la hará el servicio de IA (E6). La directa solo en desarrollo y con la
 * variable explícita. Cada modelo identificado queda marcado: en la lista de PI y con su digest (seleccionable) o no.
 */
import { describe, expect, it, vi } from "vitest";
import type { ConfigIaVigente } from "@/ia/config/leer";
import {
  LIMITE_IDENTIFICAR_MS, SONDA_PENDIENTE, VARIABLE_SONDA_OLLAMA, identificarGuardado, probarGuardado, sondaDelEntorno, sondaDirecta, type SondaOllama,
} from "@/ia/config/sonda-ollama";
import { conexionRechazada, crearOllamaFalso, generacionFicticia, json, tagsCon, vigilarFalsos } from "../local/apoyo/ollama-falso";
import { URL_GENERAR, URL_TAGS } from "../local/apoyo/red.ficticio";
import { DESTINO_FICTICIO, DIGEST_AYA, DIGEST_GEMMA, DIGEST_QWEN, LISTA_FICTICIA, SIN_LISTA, VIGENTE_FICTICIA } from "./apoyo/config.ficticio";

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
const TAGS = tagsCon([
  { nombre: "qwen2.5:14b", digest: DIGEST_QWEN },
  { nombre: "gemma2:27b", digest: "9".repeat(64) },
  { nombre: "llama3.1:8b", digest: "4613".repeat(16) },
  { nombre: "aya-expanse:32b", digest: DIGEST_AYA },
]);

/** Una sonda espía: anota con qué destino y modelo la llamaron. */
function espia(): SondaOllama & { readonly destinos: string[] } {
  const destinos: string[] = [];
  return {
    tipo: "DIRECTA",
    destinos,
    identificar: (destino) => { destinos.push(destino); return Promise.resolve({ ok: true, modelos: [] }); },
    probar: (destino) => { destinos.push(destino); return Promise.resolve({ ok: true, latenciaMs: 41, smoke: "OK" }); },
  };
}

describe("identificarGuardado · con el destino guardado y la lista de PI", () => {
  it("marca cada modelo: en la lista y con su digest (seleccionable), con otro digest, o fuera de la lista", async () => {
    const ollama = crearOllamaFalso(() => json(TAGS));
    const r = await identificarGuardado(VIGENTE_FICTICIA, sondaDirecta(ollama.fetch), LISTA_FICTICIA);
    expect(r).toEqual({
      estado: "OK",
      modelos: [
        { nombre: "qwen2.5:14b", tamanoBytes: 5613472913, digest: DIGEST_QWEN, enLista: true, digestCoincide: true, seleccionable: true, nota: "Recomendado para 008 (nota ficticia)" },
        { nombre: "gemma2:27b", tamanoBytes: 5613472913, digest: "9".repeat(64), enLista: true, digestCoincide: false, seleccionable: false, nota: null },
        { nombre: "llama3.1:8b", tamanoBytes: 5613472913, digest: "4613".repeat(16), enLista: false, digestCoincide: null, seleccionable: false, nota: null },
        { nombre: "aya-expanse:32b", tamanoBytes: 5613472913, digest: DIGEST_AYA, enLista: true, digestCoincide: true, seleccionable: true, nota: "Nota ficticia del 32B" },
      ],
    });
    expect(ollama.llamadas().map((l) => l.url)).toEqual([URL_TAGS]);
  });

  it("usa SOLO el destino guardado (control positivo con una sonda espía)", async () => {
    const s = espia();
    await identificarGuardado(VIGENTE_FICTICIA, s, LISTA_FICTICIA);
    await probarGuardado(VIGENTE_FICTICIA, s);
    expect(new Set(s.destinos)).toEqual(new Set([DESTINO_FICTICIO]));
  });

  it("sin configuración o sin destino guardado: SIN_DESTINO, sin llamar a la sonda", async () => {
    const s = espia();
    expect(await identificarGuardado(null, s, LISTA_FICTICIA)).toEqual({ estado: "SIN_DESTINO" });
    expect(await identificarGuardado(con({ ollamaHost: null, ollamaPuerto: null }), s, LISTA_FICTICIA)).toEqual({ estado: "SIN_DESTINO" });
    expect(s.destinos).toEqual([]);
  });

  it("sin lista de PI: los modelos se ven, pero ninguno es seleccionable", async () => {
    const ollama = crearOllamaFalso(() => json(TAGS));
    const r = await identificarGuardado(VIGENTE_FICTICIA, sondaDirecta(ollama.fetch), SIN_LISTA);
    expect(r.estado === "OK" && r.modelos.every((m) => !m.enLista && !m.seleccionable)).toBe(true);
  });

  it("Ollama inalcanzable: INALCANZABLE estructurado, sin lanzar ni repetir el destino", async () => {
    const ollama = crearOllamaFalso(() => ({ tipo: "RECHAZAR", error: conexionRechazada() }));
    const r = await identificarGuardado(VIGENTE_FICTICIA, sondaDirecta(ollama.fetch), LISTA_FICTICIA);
    expect(r).toEqual({ estado: "INALCANZABLE", detalle: "CONEXION_RECHAZADA" });
    expect(JSON.stringify(r)).not.toContain(DESTINO_FICTICIO);
  });

  it("una respuesta rara del servidor: ERROR con su código", async () => {
    const ollama = crearOllamaFalso(() => json({ no: "models" }));
    expect(await identificarGuardado(VIGENTE_FICTICIA, sondaDirecta(ollama.fetch), LISTA_FICTICIA)).toEqual({ estado: "ERROR", detalle: "CUERPO_INVALIDO" });
  });

  it("la sonda pendiente (producción): PENDIENTE, sin red", async () => {
    expect(await identificarGuardado(VIGENTE_FICTICIA, SONDA_PENDIENTE, LISTA_FICTICIA)).toEqual({ estado: "PENDIENTE" });
  });

  it("el límite de identificar es corto y fijo", () => {
    expect(LIMITE_IDENTIFICAR_MS).toBeLessThanOrEqual(15_000);
  });
});

describe("probarGuardado · ping y smoke de cada modelo de las tareas activas", () => {
  it("prueba cada modelo distinto de las tareas activas, uno a la vez, con su latencia", async () => {
    const ollama = crearOllamaFalso((llamada) => {
      if (llamada.url === URL_TAGS) return json(tagsCon([{ nombre: "qwen2.5:14b", digest: DIGEST_QWEN }, { nombre: "gemma2:27b", digest: DIGEST_GEMMA }]));
      return json(generacionFicticia({ model: (JSON.parse(llamada.body ?? "{}") as { model: string }).model, response: "ok" }));
    });
    const r = await probarGuardado(VIGENTE_FICTICIA, sondaDirecta(ollama.fetch));
    expect(r).toMatchObject({ estado: "OK", pruebas: [{ modelo: "qwen2.5:14b", ok: true }, { modelo: "gemma2:27b", ok: true }] });
    expect(r.estado === "OK" && r.pruebas.every((p) => typeof p.latenciaMs === "number")).toBe(true);
    expect(ollama.llamadas().filter((l) => l.url === URL_GENERAR)).toHaveLength(2);
  });

  it("un modelo que falla: FALLO con su etapa y su código (inalcanzable incluido)", async () => {
    const ollama = crearOllamaFalso(() => ({ tipo: "RECHAZAR", error: conexionRechazada() }));
    const r = await probarGuardado(VIGENTE_FICTICIA, sondaDirecta(ollama.fetch));
    expect(r).toMatchObject({ estado: "FALLO", pruebas: [{ modelo: "qwen2.5:14b", ok: false, etapa: "PING", inalcanzable: true, detalle: "CONEXION_RECHAZADA" }, { modelo: "gemma2:27b", ok: false }] });
  });

  it("un modelo guardado que ya no está en la lista: FUERA_DE_LISTA, sin red", async () => {
    const ollama = crearOllamaFalso(() => json({}));
    const tareas = { ...VIGENTE_FICTICIA.tareas, DIARIO: { activo: true, modeloLocal: "qwen2.5:32b" }, REGLAS: { activo: false, modeloLocal: null } };
    expect(await probarGuardado(con({ tareas }), sondaDirecta(ollama.fetch))).toMatchObject({ estado: "FALLO", pruebas: [{ modelo: "qwen2.5:32b", ok: false, detalle: "MODELO_NO_APROBADO" }] });
    expect(ollama.llamadas()).toHaveLength(0);
  });

  it("sin destino: SIN_DESTINO; sin modelos en las tareas activas: SIN_MODELO; pendiente: PENDIENTE", async () => {
    const s = espia();
    expect(await probarGuardado(con({ ollamaHost: null, ollamaPuerto: null }), s)).toEqual({ estado: "SIN_DESTINO" });
    const sinModelo = { DIARIO: { activo: true, modeloLocal: null }, REGLAS: { activo: false, modeloLocal: null }, ESCENARIOS: { activo: false, modeloLocal: null } };
    expect(await probarGuardado(con({ tareas: sinModelo }), s)).toEqual({ estado: "SIN_MODELO" });
    expect(await probarGuardado(VIGENTE_FICTICIA, SONDA_PENDIENTE)).toEqual({ estado: "PENDIENTE" });
    expect(s.destinos).toEqual([]);
  });
});

describe("sondaDelEntorno", () => {
  it("por omisión y en producción, la pendiente (aunque pidan la directa)", () => {
    expect(VARIABLE_SONDA_OLLAMA).toBe("INV_IA_SONDA_OLLAMA");
    expect(sondaDelEntorno({}).tipo).toBe("PENDIENTE");
    expect(sondaDelEntorno({ NODE_ENV: "production", [VARIABLE_SONDA_OLLAMA]: "directa" }).tipo).toBe("PENDIENTE");
    expect(sondaDelEntorno({ NODE_ENV: "development", [VARIABLE_SONDA_OLLAMA]: "otra" }).tipo).toBe("PENDIENTE");
  });

  it("la directa solo fuera de producción y con la variable exacta (para probar hoy en el Mac)", () => {
    expect(sondaDelEntorno({ NODE_ENV: "development", [VARIABLE_SONDA_OLLAMA]: "directa" }).tipo).toBe("DIRECTA");
  });
});
