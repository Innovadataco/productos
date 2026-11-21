// Pedido HTTP acotado común (Yahoo y SFC): sin redirecciones, plazo total, tope de bytes, UTF-8 estricto y JSON.
// Sin red: `buscar` siempre es un doble. Datos inventados.
import { afterEach, describe, expect, it, vi } from "vitest";
import { pedirJsonAcotado, type BuscarHttp, type InitHttp, type LimitesPedido, type ResultadoPedido } from "@/lib/http-acotado";

const TOPE = 64;
const PLAZO_MS = 10_000;
const LIMITES: LimitesPedido = { prefijo: "PRUEBA", headers: { Accept: "application/json" }, bytesMaximos: TOPE, tiempoMaximoMs: PLAZO_MS };
const URL_PRUEBA = "https://ejemplo.invalid/datos.json";
const enc = new TextEncoder();
const pedir = (buscar: BuscarHttp) => pedirJsonAcotado(buscar, URL_PRUEBA, LIMITES);
const responder = (cuerpo: BodyInit | null, init?: ResponseInit): BuscarHttp => async () => new Response(cuerpo, init);

/** Flujo de bytes: entrega las partes y luego cierra, falla o queda abierto para siempre. */
const flujo = (partes: readonly Uint8Array[], final: "cierra" | "falla" | "abierto" = "cierra") =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of partes) c.enqueue(p);
      if (final === "falla") c.error(new TypeError("corte"));
      if (final === "cierra") c.close();
    },
  });

/** Observa una promesa sin esperarla: sirve para ver si ya terminó al mover el reloj falso. */
function vigilar(p: Promise<ResultadoPedido>): { listo: boolean; valor?: ResultadoPedido } {
  const v: { listo: boolean; valor?: ResultadoPedido } = { listo: false };
  void p.then((x) => {
    v.listo = true;
    v.valor = x;
  });
  return v;
}

describe("pedirJsonAcotado · pedido y cuerpo", () => {
  it("pide sin seguir redirecciones, con los encabezados dados y una señal de aborto, y devuelve el JSON", async () => {
    let pedida = "";
    let init: InitHttp | undefined;
    const r = await pedir(async (url, i) => {
      pedida = url;
      init = i;
      return new Response(JSON.stringify({ a: 1 }));
    });
    expect(r).toEqual({ ok: true, datos: { a: 1 } });
    expect(pedida).toBe(URL_PRUEBA);
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("una respuesta HTTP no exitosa da <PREFIJO>_HTTP_<estado>, sin leer el cuerpo", async () => {
    expect(await pedir(responder(flujo([], "falla"), { status: 429 }))).toEqual({ ok: false, codigo: "PRUEBA_HTTP_429" });
    expect(await pedir(responder("{}", { status: 503 }))).toEqual({ ok: false, codigo: "PRUEBA_HTTP_503" });
  });

  it("si buscar lanza (red, redirección rechazada), da <PREFIJO>_RED sin lanzar", async () => {
    expect(await pedir(async () => { throw new TypeError("redirect"); })).toEqual({ ok: false, codigo: "PRUEBA_RED" });
  });

  it("un content-length declarado sobre el tope se rechaza como <PREFIJO>_FORMATO", async () => {
    expect(await pedir(responder("[]", { headers: { "content-length": String(TOPE + 1) } }))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
  });

  it("un flujo sin fin se corta al pasar el tope, se cancela y da <PREFIJO>_FORMATO", async () => {
    let cancelado = false;
    const sinFin = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(16).fill(0x20));
      },
      cancel() {
        cancelado = true;
      },
    });
    expect(await pedir(responder(sinFin))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
    expect(cancelado).toBe(true);
  });

  it("un cuerpo justo en el tope se acepta; un byte más, no", async () => {
    const justo = enc.encode(`[${" ".repeat(TOPE - 2)}]`);
    expect(justo.byteLength).toBe(TOPE);
    expect(await pedir(responder(flujo([justo])))).toEqual({ ok: true, datos: [] });
    const pasado = enc.encode(`[${" ".repeat(TOPE - 1)}]`);
    expect(await pedir(responder(flujo([pasado])))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
  });

  it.each([
    ["sin cuerpo", null],
    // Dentro de un texto JSON: un decodificador no estricto lo volvería «["�"]», que sí es JSON válido.
    ["UTF-8 inválido", flujo([new Uint8Array([0x5b, 0x22, 0xff, 0x22, 0x5d])])],
    ["JSON inválido", "no es json"],
  ])("%s da <PREFIJO>_FORMATO", async (_caso, cuerpo) => {
    expect(await pedir(responder(cuerpo))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
  });

  it("un corte a mitad del cuerpo da <PREFIJO>_RED", async () => {
    expect(await pedir(responder(flujo([enc.encode("[")], "falla")))).toEqual({ ok: false, codigo: "PRUEBA_RED" });
  });
});

describe("pedirJsonAcotado · plazo total (reloj falso)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const conRelojFalso = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  it("con un buscar que respeta la señal: sigue pendiente 1 ms antes del plazo, y al plazo se aborta y da <PREFIJO>_RED", async () => {
    conRelojFalso();
    let senal: AbortSignal | undefined;
    const buscar: BuscarHttp = (_url, init) =>
      new Promise((_resolver, rechazar) => {
        senal = init.signal;
        init.signal.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
      });
    const v = vigilar(pedir(buscar));
    await vi.advanceTimersByTimeAsync(PLAZO_MS - 1);
    expect(v.listo).toBe(false);
    expect(senal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(senal?.aborted).toBe(true);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "PRUEBA_RED" } });
  });

  it("con un buscar que ignora la señal y nunca resuelve, da <PREFIJO>_RED al plazo (no se cuelga)", async () => {
    conRelojFalso();
    const v = vigilar(pedir(() => new Promise(() => undefined)));
    await vi.advanceTimersByTimeAsync(PLAZO_MS - 1);
    expect(v.listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "PRUEBA_RED" } });
  });

  it("con un cuerpo que nunca termina, da <PREFIJO>_RED al plazo y cancela el lector", async () => {
    conRelojFalso();
    let cancelado = false;
    const abierto = new ReadableStream<Uint8Array>({
      cancel() {
        cancelado = true;
      },
    });
    const v = vigilar(pedir(responder(abierto)));
    await vi.advanceTimersByTimeAsync(PLAZO_MS);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "PRUEBA_RED" } });
    expect(cancelado).toBe(true);
  });

  it("si buscar responde después del plazo, su cuerpo se cancela sin leerlo", async () => {
    conRelojFalso();
    let cancelado = false;
    const abierto = new ReadableStream<Uint8Array>({
      cancel() {
        cancelado = true;
      },
    });
    const tardio: BuscarHttp = () =>
      new Promise((resolver) => {
        setTimeout(() => resolver(new Response(abierto)), PLAZO_MS + 1);
      });
    const v = vigilar(pedir(tardio));
    await vi.advanceTimersByTimeAsync(PLAZO_MS);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "PRUEBA_RED" } });
    await vi.advanceTimersByTimeAsync(1);
    await new Promise((resolver) => setImmediate(resolver));
    expect(cancelado).toBe(true);
  });

  it("tras un pedido exitoso no queda ningún reloj vivo", async () => {
    conRelojFalso();
    expect(await pedir(responder("[]"))).toEqual({ ok: true, datos: [] });
    expect(vi.getTimerCount()).toBe(0);
  });
});
