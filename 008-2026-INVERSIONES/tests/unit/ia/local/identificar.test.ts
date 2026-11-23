/**
 * E8: «Identificar modelos» por la puerta local: GET /api/tags en el destino GUARDADO, con el cliente de E4a (tope de
 * bytes y de tiempo, sin redirecciones, solo esa ruta), y la lista de lo instalado: nombre, tamaño y digest. Nunca
 * lanza: un Ollama inalcanzable vuelve como fallo con su código, sin datos. Y lo aditivo del generador: la temperatura
 * de la configuración (0 a 1, en centésimas; la semilla queda fija) y un turno compartido entre instancias (un pedido a
 * la vez al Mac aunque cada tarea tenga su modelo). Red e IP inventadas (la IP se arma al correr).
 */
import { describe, expect, it, vi } from "vitest";
import { ErrorLocal } from "@/ia/local/errores";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { BYTES_MAXIMOS_TAGS } from "@/ia/local/http";
import { MAX_MODELOS_INSTALADOS, identificarModelos } from "@/ia/local/identificar";
import { cuerpoGenerar } from "@/ia/local/ollama";
import { crearSemaforo } from "@/ia/local/semaforo";
import { conexionRechazada, crearOllamaFalso, diferido, generacionFicticia, guionFeliz, json, respuestaCruda, tagsCon, tagsDelFicticio, vigilarFalsos } from "./apoyo/ollama-falso";

import { CONFIG_FICTICIA, DIGEST_LOCAL_FICTICIO, MODELO_LOCAL_FICTICIO, ORIGEN_FICTICIO, URL_GENERAR, URL_TAGS, ip, pedidoFicticio } from "./apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { modeloAprobadoFicticio } = await import("./apoyo/red.ficticio");
  return { ...real, modeloAprobado: modeloAprobadoFicticio };
});

vigilarFalsos();

const OPCIONES = Object.freeze({ limiteMs: 4613 });
const vivo = (): AbortSignal => new AbortController().signal;

describe("identificarModelos · lo instalado en el Ollama del destino", () => {
  it("pide solo GET /api/tags y devuelve nombre, tamaño y digest (sin el prefijo sha256:)", async () => {
    const falso = crearOllamaFalso(() => json({
      models: [
        { name: "qwen2.5:14b", model: "qwen2.5:14b", size: 9_037_911_473, digest: `sha256:${"4613a27c".repeat(8)}` },
        { name: "gemma2:27b", model: "gemma2:27b", size: 15_461_237_377, digest: "37911f47".repeat(8) },
      ],
    }));
    const r = await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES);
    expect(r).toEqual({
      ok: true,
      modelos: [
        { nombre: "qwen2.5:14b", tamanoBytes: 9_037_911_473, digest: "4613a27c".repeat(8) },
        { nombre: "gemma2:27b", tamanoBytes: 15_461_237_377, digest: "37911f47".repeat(8) },
      ],
    });
    expect(falso.llamadas().map((l) => [l.url, l.method])).toEqual([[URL_TAGS, "GET"]]);
    expect(falso.llamadas()[0]?.redirect).toBe("manual");
  });

  it("descarta lo que no tiene forma (nombre raro, tamaño o digest inválidos quedan nulos) y no lanza", async () => {
    const falso = crearOllamaFalso(() => json({
      models: [
        { name: "con espacio:1b", size: 1237 },
        { name: 4613 },
        "no es un objeto",
        { name: "ficticio:3b", size: -1, digest: "corto" },
        { model: "solo-model:7b", size: 1237.5 },
      ],
    }));
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES)).toEqual({
      ok: true,
      modelos: [
        { nombre: "ficticio:3b", tamanoBytes: null, digest: null },
        { nombre: "solo-model:7b", tamanoBytes: null, digest: null },
      ],
    });
  });

  it("con más de MAX_MODELOS_INSTALADOS entradas, CUERPO_INVALIDO (no se recorta en silencio)", async () => {
    const muchos = Array.from({ length: MAX_MODELOS_INSTALADOS + 1 }, (_, i) => ({ name: `ficticio${i}:1b` }));
    const falso = crearOllamaFalso(() => json({ models: muchos }));
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES)).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "CUERPO_INVALIDO" });
  });

  it("Ollama inalcanzable (conexión rechazada): MODELO_NO_DISPONIBLE · CONEXION_RECHAZADA, sin lanzar", async () => {
    const falso = crearOllamaFalso(() => ({ tipo: "RECHAZAR", error: conexionRechazada() }));
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES)).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" });
  });

  it("una redirección es un error, nunca se sigue", async () => {
    const falso = crearOllamaFalso(() => ({ tipo: "CRUDA", respuesta: respuestaCruda(302) }));
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES)).toMatchObject({ ok: false, motivo: "ERROR_PROVEEDOR", detalle: "HTTP_REDIRECCION" });
    expect(falso.llamadas()).toHaveLength(1);
  });

  it("el tope de tiempo cierra en fallo (TIEMPO_AGOTADO), aunque el servidor no conteste", async () => {
    const falso = crearOllamaFalso(() => ({ tipo: "COLGAR" }));
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, { limiteMs: 5 })).toMatchObject({ ok: false, motivo: "TIEMPO_AGOTADO" });
  });

  it("el tope de bytes del cuerpo es el de tags", async () => {
    expect(BYTES_MAXIMOS_TAGS).toBeGreaterThan(0);
    const falso = crearOllamaFalso(() => ({ tipo: "CRUDA", respuesta: respuestaCruda(200, { contentLength: String(BYTES_MAXIMOS_TAGS + 1) }) }));
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES)).toMatchObject({ ok: false, detalle: "CUERPO_DEMASIADO_GRANDE" });
  });

  it.each([
    ["un nombre DNS", "http://ollama.ficticio:47213", "DESTINO_INVALIDO"],
    ["https", `https://${ip(100, 73, 41, 157)}:47213`, "DESTINO_INVALIDO"],
    ["una IP privada", `http://${ip(10, 46, 13, 7)}:47213`, "DESTINO_FUERA_DE_RANGO"],
    ["una ruta", `${ORIGEN_FICTICIO}/api/pull`, "DESTINO_INVALIDO"],
  ])("un destino con %s no se pide: lanza ErrorLocal (defecto del código, nunca llega del pedido)", async (_n, destino, codigo) => {
    const falso = crearOllamaFalso(guionFeliz());
    await expect(identificarModelos(destino, { fetch: falso.fetch }, OPCIONES)).rejects.toThrow(new ErrorLocal(codigo as "DESTINO_INVALIDO"));
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("opciones inválidas lanzan ErrorLocal (LIMITE_INVALIDO)", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    await expect(identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, { limiteMs: 0 })).rejects.toThrow(new ErrorLocal("LIMITE_INVALIDO"));
  });

  it("una señal ya abortada: TIEMPO_AGOTADO · SENAL_ABORTADA, sin red", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    expect(await identificarModelos(ORIGEN_FICTICIO, { fetch: falso.fetch }, OPCIONES, AbortSignal.abort())).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(falso.llamadas()).toHaveLength(0);
  });
});

describe("la temperatura de la configuración (aditiva: sin ella, 0)", () => {
  it("cuerpoGenerar sin temperatura es el de siempre; con 37 centésimas, 0.37 y la misma semilla", () => {
    const { pedido } = pedidoFicticio();
    expect(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido)).toBe(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido, 0));
    const cuerpo = JSON.parse(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido, 37)) as { options: unknown };
    expect(cuerpo.options).toEqual({ num_ctx: 8192, seed: 42, temperature: 0.37 });
    expect(JSON.parse(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido, 100)).options).toEqual({ num_ctx: 8192, seed: 42, temperature: 1 });
    expect(JSON.parse(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido, 5)).options).toEqual({ num_ctx: 8192, seed: 42, temperature: 0.05 });
  });

  it("el prompt que contiene el marcador no cambia la temperatura (el marcador solo vive en el valor de options)", () => {
    const { pedido } = pedidoFicticio();
    const cuerpo = JSON.parse(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido, 20)) as { options: unknown; system: string };
    expect(cuerpo.options).toEqual({ num_ctx: 8192, seed: 42, temperature: 0.2 });
    expect(cuerpo.system).toBe(pedido.prompt.texto);
  });

  it.each([-1, 101, 37.5, Number.NaN, "37"])("una temperatura de %s es un defecto: CONFIGURACION_INVALIDA al crear", (temperatura) => {
    const falso = crearOllamaFalso(guionFeliz());
    expect(() => crearGeneradorLocal({ ...CONFIG_FICTICIA, temperaturaCentesimas: temperatura as number }, { fetch: falso.fetch })).toThrow(new ErrorLocal("CONFIGURACION_INVALIDA"));
  });

  it("el generador manda la temperatura configurada", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal({ ...CONFIG_FICTICIA, temperaturaCentesimas: 37 }, { fetch: falso.fetch });
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ ok: true });
    const generar = falso.llamadas().find((l) => l.url === URL_GENERAR);
    expect((JSON.parse(String(generar?.body)) as { options: unknown }).options).toEqual({ num_ctx: 8192, seed: 42, temperature: 0.37 });
  });
});

describe("un turno compartido entre instancias (aditivo)", () => {
  it("dos generadores con el mismo semáforo no piden a la vez al Mac", async () => {
    const semaforo = crearSemaforo();
    const primero = diferido<Response>();
    const falso = crearOllamaFalso((llamada, indice) => {
      if (indice === 0) return { tipo: "PROMESA", promesa: primero.promesa };
      return json(llamada.url === URL_TAGS ? tagsDelFicticio() : generacionFicticia());
    });
    const a = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, semaforo });
    const b = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, semaforo });
    const ra = a.generar(pedidoFicticio().pedido, vivo());
    const rb = b.generar(pedidoFicticio().pedido, vivo());
    await new Promise((r) => setTimeout(r, 5));
    // El segundo espera el turno: solo salió el tags del primero.
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS]);
    primero.resolver(new Response(JSON.stringify(tagsCon([{ nombre: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }])), { status: 200 }));
    expect(await ra).toMatchObject({ ok: true });
    expect(await rb).toMatchObject({ ok: true });
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS, URL_GENERAR, URL_TAGS, URL_GENERAR]);
  });

  it("un semáforo que no lo es: CONFIGURACION_INVALIDA", () => {
    const falso = crearOllamaFalso(guionFeliz());
    expect(() => crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, semaforo: { tomar: 4613 } as never })).toThrow(new ErrorLocal("CONFIGURACION_INVALIDA"));
  });
});
