/**
 * El generador de la puerta local (Ollama del Mac), con un `fetch` falso y la lista de modelos FICTICIA (`vi.mock`):
 * el camino feliz por `generarConPuertas`, lo que se manda, el respaldo de `thinking`, el modelo y su digest, la
 * configuración, la barrera y un pedido a la vez. Nada de red real.
 */
import { describe, expect, it, vi } from "vitest";
import { MAX_SALIDA_CRUDA } from "@/ia/generador";
import { generarConPuertas } from "@/ia/puertas";
import { jsonCanonico } from "@/ia/hash";
import { ErrorLocal, type CodigoErrorLocal } from "@/ia/local/errores";
import { crearGeneradorLocal, type ConfigLocal, type DependenciasLocal } from "@/ia/local/generador";
import type { BuscarLocal } from "@/ia/local/http";
import { ESQUEMA_FICTICIO, PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import { crearOllamaFalso, diferido, generacionFicticia, guionFeliz, json, tagsCon, tagsDelFicticio, vigilarFalsos, type Guion } from "./apoyo/ollama-falso";
import { CONFIG_FICTICIA, DIGEST_LOCAL_FICTICIO, MODELO_LOCAL_FICTICIO, MODELO_PENDIENTE_FICTICIO, ORIGEN_FICTICIO, OTRO_DIGEST_FICTICIO, SALIDA_FICTICIA, URL_GENERAR, URL_TAGS, ip, pedidoFicticio } from "./apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { modeloAprobadoFicticio } = await import("./apoyo/red.ficticio");
  return { ...real, modeloAprobado: modeloAprobadoFicticio };
});

vigilarFalsos();

/** Un reloj inyectado que devuelve, en orden, los instantes dados (y repite el último). */
function reloj(...instantes: number[]): () => number {
  let i = 0;
  return () => instantes[Math.min(i++, instantes.length - 1)] as number;
}

function generador(guion: Guion, ahora: () => number = reloj(1237.25, 4850.5)) {
  const falso = crearOllamaFalso(guion);
  return { falso, local: crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, ahora }) };
}

const vivo = (): AbortSignal => new AbortController().signal;

function codigoDe(accion: () => unknown): CodigoErrorLocal {
  try {
    accion();
  } catch (e) {
    if (e instanceof ErrorLocal) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
}

describe("crearGeneradorLocal · la forma", () => {
  it("es la puerta local, congelada, con generar y la sonda", () => {
    const { local } = generador(guionFeliz());
    expect(local.puerta).toBe("local");
    expect(typeof local.generar).toBe("function");
    expect(typeof local.sondaLocal).toBe("function");
    expect(Object.isFrozen(local)).toBe(true);
  });

  it("el fetch global sirve como dependencia (lo revisa el typecheck; no se llama)", () => {
    const buscar: BuscarLocal = fetch;
    expect(typeof buscar).toBe("function");
  });
});

describe("generar · camino feliz", () => {
  it("consulta tags y después genera: dos llamadas, en ese orden, solo a las rutas permitidas", async () => {
    const { local, falso } = generador(guionFeliz());
    const { pedido } = pedidoFicticio();
    await local.generar(pedido, vivo());
    expect(falso.llamadas().map((l) => [l.method, l.url])).toEqual([["GET", URL_TAGS], ["POST", URL_GENERAR]]);
  });

  it("manda el modelo, el prompt como system, la vista ciega como prompt, el esquema, sin flujo, temperatura 0, semilla 42 y keep_alive corto", async () => {
    const { local, falso } = generador(guionFeliz());
    const { pedido } = pedidoFicticio();
    await local.generar(pedido, vivo());
    const cuerpo = JSON.parse(falso.llamadas()[1]?.body as string) as unknown;
    expect(cuerpo).toEqual({
      model: MODELO_LOCAL_FICTICIO,
      system: PROMPT_FICTICIO.texto,
      prompt: jsonCanonico(pedido.vista),
      format: ESQUEMA_FICTICIO,
      stream: false,
      options: { temperature: 0, seed: 42 },
      keep_alive: "30s",
    });
  });

  it("devuelve la salida, el modelo, el digest aprobado, la latencia del reloj y los tokens", async () => {
    const { local } = generador(guionFeliz());
    const { pedido } = pedidoFicticio();
    expect(await local.generar(pedido, vivo())).toEqual({
      ok: true,
      puerta: "local",
      salidaCruda: SALIDA_FICTICIA,
      modelo: MODELO_LOCAL_FICTICIO,
      modeloDigest: DIGEST_LOCAL_FICTICIO,
      latenciaMs: 4850.5 - 1237.25,
      tokensEntrada: 613,
      tokensSalida: 271,
    });
  });

  it("por generarConPuertas, en modo local, da EXITO con el resultado normalizado", async () => {
    const { local } = generador(guionFeliz());
    const { pedido, paquete } = pedidoFicticio();
    const resultado = await generarConPuertas([local], "local", pedido, paquete);
    expect(resultado).toEqual({
      estado: "EXITO",
      ok: true,
      exito: { ok: true, puerta: "local", salidaCruda: SALIDA_FICTICIA, modelo: MODELO_LOCAL_FICTICIO, modeloDigest: DIGEST_LOCAL_FICTICIO, latenciaMs: 3613, tokensEntrada: 613, tokensSalida: 271 },
      fallosPrevios: [],
    });
  });

  it("por generarConPuertas, un fallo local pasa tal cual (motivo y detalle válidos)", async () => {
    const { local } = generador(() => json(tagsDelFicticio(OTRO_DIGEST_FICTICIO)));
    const { pedido, paquete } = pedidoFicticio();
    expect(await generarConPuertas([local], "local", pedido, paquete)).toEqual({
      estado: "FALLO",
      ok: false,
      fallos: [{ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" }],
    });
  });

  it("sin reloj inyectado usa el monótono del sistema: latencia finita y no negativa", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const resultado = await local.generar(pedidoFicticio().pedido, vivo());
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(Number.isFinite(resultado.latenciaMs)).toBe(true);
      expect(resultado.latenciaMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("un reloj que retrocede no da latencia negativa", async () => {
    const { local } = generador(guionFeliz(), reloj(4850.5, 1237.25));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ ok: true, latenciaMs: 0 });
  });

  it("los tokens raros quedan en null sin hacer fallar", async () => {
    const { local } = generador(guionFeliz(generacionFicticia({ prompt_eval_count: -1, eval_count: "271" })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ ok: true, tokensEntrada: null, tokensSalida: null });
  });
});

describe("generar · respaldo de thinking (como PI)", () => {
  it.each([["vacía", ""], ["con solo espacios", "  \n "]])("con `response` %s, la salida es `thinking`", async (_n, response) => {
    const { local } = generador(guionFeliz(generacionFicticia({ response, thinking: SALIDA_FICTICIA })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ ok: true, salidaCruda: SALIDA_FICTICIA });
  });

  it("sin nada en `response` ni en `thinking` → ERROR_PROVEEDOR RESPUESTA_VACIA", async () => {
    const { local } = generador(guionFeliz(generacionFicticia({ response: "", thinking: "" })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "RESPUESTA_VACIA" });
  });
});

describe("generar · modelo aprobado y su digest", () => {
  it("el digest de tags no coincide → MODELO_NO_DISPONIBLE DIGEST_NO_COINCIDE, sin generar", async () => {
    const { local, falso } = generador(() => json(tagsDelFicticio(OTRO_DIGEST_FICTICIO)));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" });
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS]);
  });

  it("el modelo no está en tags → MODELO_NO_DISPONIBLE MODELO_NO_ENCONTRADO, sin generar", async () => {
    const { local, falso } = generador(() => json(tagsCon([{ nombre: "otro-ficticio:1b", digest: DIGEST_LOCAL_FICTICIO }])));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ motivo: "MODELO_NO_DISPONIBLE", detalle: "MODELO_NO_ENCONTRADO" });
    expect(falso.llamadas()).toHaveLength(1);
  });

  it("el digest con prefijo sha256: vale y se devuelve el digest aprobado, sin prefijo", async () => {
    const { local } = generador((_l, i) => json(i === 0 ? tagsDelFicticio(`sha256:${DIGEST_LOCAL_FICTICIO}`) : generacionFicticia()));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ ok: true, modeloDigest: DIGEST_LOCAL_FICTICIO });
  });

  it("un modelo aprobado con el digest pendiente → MODELO_NO_DISPONIBLE DIGEST_POR_VERIFICAR, sin red", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo: MODELO_PENDIENTE_FICTICIO }, { fetch: falso.fetch });
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_POR_VERIFICAR" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("la respuesta de generate trae otro modelo → ERROR_PROVEEDOR MODELO_DISTINTO", async () => {
    const { local } = generador(guionFeliz(generacionFicticia({ model: "otro-ficticio:1b" })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ motivo: "ERROR_PROVEEDOR", detalle: "MODELO_DISTINTO" });
  });
});

describe("generar · lo que el modelo devuelve", () => {
  it("cortada por largo (done_reason «length») → ERROR_PROVEEDOR SALIDA_CORTADA", async () => {
    const { local } = generador(guionFeliz(generacionFicticia({ done_reason: "length" })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ motivo: "ERROR_PROVEEDOR", detalle: "SALIDA_CORTADA" });
  });

  it("una salida de más de MAX_SALIDA_CRUDA → ERROR_PROVEEDOR SALIDA_DEMASIADO_LARGA", async () => {
    const { local } = generador(guionFeliz(generacionFicticia({ response: "z".repeat(MAX_SALIDA_CRUDA + 1) })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ motivo: "ERROR_PROVEEDOR", detalle: "SALIDA_DEMASIADO_LARGA" });
  });

  it("una salida de exactamente MAX_SALIDA_CRUDA pasa", async () => {
    const larga = "z".repeat(MAX_SALIDA_CRUDA);
    const { local } = generador(guionFeliz(generacionFicticia({ response: larga })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ ok: true, salidaCruda: larga });
  });

  it("done distinto de true → ERROR_PROVEEDOR GENERACION_INCOMPLETA", async () => {
    const { local } = generador(guionFeliz(generacionFicticia({ done: false })));
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ motivo: "ERROR_PROVEEDOR", detalle: "GENERACION_INCOMPLETA" });
  });
});

describe("generar · antes de la red", () => {
  it("una señal ya abortada → TIEMPO_AGOTADO SENAL_ABORTADA, sin red", async () => {
    const { local, falso } = generador(guionFeliz());
    const control = new AbortController();
    control.abort();
    expect(await local.generar(pedidoFicticio().pedido, control.signal)).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("un pedido que no es ciego se rechaza sin red (segunda barrera)", async () => {
    const { local, falso } = generador(guionFeliz());
    const { pedido } = pedidoFicticio();
    const vista = { ...pedido.vista, hechos: pedido.vista.hechos.map((h, i) => (i === 0 ? { ...h, etiqueta: "Valor 4613" } : h)) };
    expect(await local.generar({ ...pedido, vista } as typeof pedido, vivo())).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "PEDIDO_NO_CIEGO" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("un pedido mal formado se rechaza sin red", async () => {
    const { local, falso } = generador(guionFeliz());
    const { pedido } = pedidoFicticio();
    expect(await local.generar({ ...pedido, limiteMs: -7 }, vivo())).toMatchObject({ motivo: "ERROR_PROVEEDOR", detalle: "PEDIDO_INVALIDO" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("nunca rechaza: un reloj que lanza da ERROR_PROVEEDOR EXCEPCION_INTERNA y libera el turno", async () => {
    let lanzar = true;
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal(CONFIG_FICTICIA, {
      fetch: falso.fetch,
      ahora: () => {
        if (lanzar) throw new Error("reloj roto FICTICIA-ALFA");
        return 7.5;
      },
    });
    const { pedido } = pedidoFicticio();
    expect(await local.generar(pedido, vivo())).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "EXCEPCION_INTERNA" });
    lanzar = false;
    expect(await local.generar(pedido, vivo())).toMatchObject({ ok: true });
  });
});

describe("generar · un pedido a la vez", () => {
  it("el segundo no consulta tags hasta que el primero termina de generar", async () => {
    const generando = diferido<Response>();
    const { local, falso } = generador((_l, i) => (i === 1 ? { tipo: "PROMESA", promesa: generando.promesa } : json(i % 2 === 0 ? tagsDelFicticio() : generacionFicticia())));
    const { pedido } = pedidoFicticio();
    const primero = local.generar(pedido, vivo());
    const segundo = local.generar(pedido, vivo());
    await new Promise((r) => setTimeout(r, 7));
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS, URL_GENERAR]);
    generando.resolver(new Response(JSON.stringify(generacionFicticia())));
    expect(await primero).toMatchObject({ ok: true });
    expect(await segundo).toMatchObject({ ok: true });
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS, URL_GENERAR, URL_TAGS, URL_GENERAR]);
  });

  it("el turno se libera aunque el primero falle (estado 500) o el fetch lance", async () => {
    const { local, falso } = generador((_l, i) => {
      if (i === 0) return json({ error: "FICTICIA" }, 500);
      if (i === 1) return { tipo: "LANZAR", error: new Error("síncrono") };
      return json(i % 2 === 0 ? tagsDelFicticio() : generacionFicticia());
    });
    const { pedido } = pedidoFicticio();
    const resultados = await Promise.all([local.generar(pedido, vivo()), local.generar(pedido, vivo()), local.generar(pedido, vivo())]);
    expect(resultados.map((r) => (r.ok ? "OK" : r.detalle))).toEqual(["HTTP_ERROR_SERVIDOR", "FALLO_DE_RED", "OK"]);
    expect(falso.llamadas()).toHaveLength(4);
  });

  it("dos generadores (dos instancias) no comparten turno: el semáforo es de cada instancia", async () => {
    const generando = diferido<Response>();
    const a = crearOllamaFalso((_l, i) => (i === 1 ? { tipo: "PROMESA", promesa: generando.promesa } : json(tagsDelFicticio())));
    const b = crearOllamaFalso(guionFeliz());
    const localA = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: a.fetch });
    const localB = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: b.fetch });
    const { pedido } = pedidoFicticio();
    const primero = localA.generar(pedido, vivo());
    expect(await localB.generar(pedido, vivo())).toMatchObject({ ok: true });
    generando.resolver(new Response(JSON.stringify(generacionFicticia())));
    expect(await primero).toMatchObject({ ok: true });
  });
});

describe("crearGeneradorLocal · configuración (cierra en fallo al crear, sin repetir valores)", () => {
  const falso = (): DependenciasLocal => ({ fetch: crearOllamaFalso(guionFeliz()).fetch });

  it.each([
    ["sin destino", { modelo: MODELO_LOCAL_FICTICIO }, "DESTINO_AUSENTE"],
    ["destino vacío", { destino: "", modelo: MODELO_LOCAL_FICTICIO }, "DESTINO_AUSENTE"],
    ["un nombre DNS", { destino: "http://mac-ficticio.test:47213", modelo: MODELO_LOCAL_FICTICIO }, "DESTINO_INVALIDO"],
    ["una IP privada", { destino: `http://${ip(192, 168, 41, 157)}:47213`, modelo: MODELO_LOCAL_FICTICIO }, "DESTINO_FUERA_DE_RANGO"],
    ["un modelo no aprobado", { destino: ORIGEN_FICTICIO, modelo: "otro-ficticio:1b" }, "MODELO_NO_APROBADO"],
    ["un modelo de 32B", { destino: ORIGEN_FICTICIO, modelo: "ornith:32b" }, "MODELO_NO_APROBADO"],
    ["sin modelo", { destino: ORIGEN_FICTICIO }, "MODELO_NO_APROBADO"],
    ["un campo de más", { ...CONFIG_FICTICIA, digest: DIGEST_LOCAL_FICTICIO }, "CONFIGURACION_INVALIDA"],
    ["null", null, "CONFIGURACION_INVALIDA"],
    ["un Proxy", new Proxy({ ...CONFIG_FICTICIA }, {}), "CONFIGURACION_INVALIDA"],
  ])("config %s → %s", (_n, config, codigo) => {
    expect(codigoDe(() => crearGeneradorLocal(config as ConfigLocal, falso()))).toBe(codigo);
  });

  it.each([
    ["sin fetch", {}],
    ["fetch que no es función", { fetch: "fetch" }],
    ["ahora que no es función", { fetch: crearOllamaFalso(guionFeliz()).fetch, ahora: 7 }],
    ["un campo de más", { fetch: crearOllamaFalso(guionFeliz()).fetch, modelos: [] }],
    ["null", null],
  ])("dependencias %s → CONFIGURACION_INVALIDA", (_n, dependencias) => {
    expect(codigoDe(() => crearGeneradorLocal(CONFIG_FICTICIA, dependencias as DependenciasLocal))).toBe("CONFIGURACION_INVALIDA");
  });

  it("el mensaje no repite el destino ni el modelo", () => {
    try {
      crearGeneradorLocal({ destino: `http://${ip(10, 41, 7, 23)}:47213`, modelo: MODELO_LOCAL_FICTICIO }, falso());
    } catch (e) {
      expect((e as Error).message).not.toMatch(/[0-9]|ficticio/);
      return;
    }
    throw new Error("no lanzó");
  });
});
