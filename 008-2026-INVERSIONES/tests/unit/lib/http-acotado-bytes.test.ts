// Pedido HTTP acotado de BYTES (xml y xlsx de las fuentes oficiales): las mismas garantías que pedirJsonAcotado
// (sin redirecciones, plazo total, tope de bytes por trozos) más la lista de content-type aceptados. No decodifica.
// Sin red: `buscar` siempre es un doble. Datos inventados.
import { afterEach, describe, expect, it, vi } from "vitest";
import { pedirBytesAcotado, type BuscarHttp, type InitHttp, type LimitesPedidoBytes, type ResultadoBytes } from "@/lib/http-acotado";

const TOPE = 64;
const PLAZO_MS = 10_000;
const LIMITES: LimitesPedidoBytes = {
  prefijo: "PRUEBA",
  headers: { Accept: "application/xml" },
  bytesMaximos: TOPE,
  tiempoMaximoMs: PLAZO_MS,
  tiposAceptados: ["application/xml", "application/vnd.sdmx.genericdata+xml"],
};
const URL_PRUEBA = "https://ejemplo.invalid/datos.xml";
const XML = { "content-type": "application/xml" };
const pedir = (buscar: BuscarHttp) => pedirBytesAcotado(buscar, URL_PRUEBA, LIMITES);
const responder = (cuerpo: BodyInit | null, init: ResponseInit = { headers: XML }): BuscarHttp => async () => new Response(cuerpo, init);

/** Flujo de bytes: entrega las partes y luego cierra, falla o queda abierto para siempre. */
const flujo = (partes: readonly Uint8Array[], final: "cierra" | "falla" | "abierto" = "cierra") =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of partes) c.enqueue(p);
      if (final === "falla") c.error(new TypeError("corte"));
      if (final === "cierra") c.close();
    },
  });

/** Flujo espía: cuenta cuántas veces se le pidió un trozo y si se canceló. */
function espia(): { flujo: ReadableStream<Uint8Array>; pedidos: () => number; cancelado: () => boolean } {
  let pedidos = 0;
  let cancelado = false;
  const f = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        pedidos += 1;
        c.enqueue(new Uint8Array(4).fill(0x3c));
      },
      cancel() {
        cancelado = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { flujo: f, pedidos: () => pedidos, cancelado: () => cancelado };
}

function vigilar(p: Promise<ResultadoBytes>): { listo: boolean; valor?: ResultadoBytes } {
  const v: { listo: boolean; valor?: ResultadoBytes } = { listo: false };
  void p.then((x) => {
    v.listo = true;
    v.valor = x;
  });
  return v;
}

describe("pedirBytesAcotado · pedido y cuerpo", () => {
  it("pide sin seguir redirecciones, con los encabezados dados y una señal, y devuelve los bytes tal cual (sin decodificar)", async () => {
    let pedida = "";
    let init: InitHttp | undefined;
    const binario = Uint8Array.of(0x00, 0xff, 0xc3, 0x28, 0x3c);
    const r = await pedir(async (url, i) => {
      pedida = url;
      init = i;
      return new Response(binario, { headers: XML });
    });
    expect(r).toEqual({ ok: true, bytes: binario });
    expect(pedida).toBe(URL_PRUEBA);
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({ Accept: "application/xml" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("los trozos se unen en orden en un Uint8Array propio (no un Buffer del pool, byteOffset 0)", async () => {
    const r = await pedir(responder(flujo([Uint8Array.of(1, 2), Uint8Array.of(3), Uint8Array.of(4, 5, 6)])));
    if (!r.ok) throw new Error(r.codigo);
    expect([...r.bytes]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Buffer.isBuffer(r.bytes)).toBe(false);
    expect(r.bytes.byteOffset).toBe(0);
    expect(r.bytes.buffer.byteLength).toBe(6);
  });

  it.each([
    ["exacto", "application/xml"],
    ["en mayúsculas", "APPLICATION/XML"],
    ["con espacios", "  application/xml  "],
    ["con charset utf-8", "application/xml; charset=utf-8"],
    ["con charset entre comillas", 'application/xml;charset="UTF-8"'],
    ["el segundo de la lista, con otro parámetro", "application/vnd.sdmx.genericdata+xml; version=2.1"],
  ])("content-type aceptado (%s)", async (_caso, tipo) => {
    expect(await pedir(responder(flujo([Uint8Array.of(0x3c)]), { headers: { "content-type": tipo } }))).toEqual({ ok: true, bytes: Uint8Array.of(0x3c) });
  });

  it.each([
    ["ausente", undefined],
    ["vacío", ""],
    ["HTML (la página de error de un portal)", "text/html"],
    ["HTML con charset", "text/html; charset=utf-8"],
    ["prefijo engañoso", "application/xmlx"],
    ["otro tipo que empieza igual", "application/xml-dtd"],
    ["una lista de tipos", "application/xml, text/html"],
    ["charset distinto de UTF-8", "application/xml; charset=ISO-8859-1"],
    ["charset vacío", "application/xml; charset="],
  ])("content-type rechazado (%s): <PREFIJO>_TIPO, sin leer el cuerpo y cancelándolo", async (_caso, tipo) => {
    const e = espia();
    const headers: Record<string, string> = tipo === undefined ? {} : { "content-type": tipo };
    expect(await pedir(responder(e.flujo, { headers }))).toEqual({ ok: false, codigo: "PRUEBA_TIPO" });
    expect(e.pedidos()).toBe(0);
    expect(e.cancelado()).toBe(true);
  });

  it("una respuesta HTTP no exitosa da <PREFIJO>_HTTP_<estado> aunque el tipo tampoco sirva", async () => {
    expect(await pedir(responder("<html/>", { status: 406, headers: { "content-type": "text/html" } }))).toEqual({ ok: false, codigo: "PRUEBA_HTTP_406" });
    expect(await pedir(responder(flujo([], "falla"), { status: 503, headers: XML }))).toEqual({ ok: false, codigo: "PRUEBA_HTTP_503" });
  });

  it("con un estado HTTP de error o un content-length sobre el tope, el cuerpo se cancela sin leerlo", async () => {
    const error = espia();
    expect(await pedir(responder(error.flujo, { status: 503, headers: XML }))).toEqual({ ok: false, codigo: "PRUEBA_HTTP_503" });
    expect([error.pedidos(), error.cancelado()]).toEqual([0, true]);
    const largo = espia();
    expect(await pedir(responder(largo.flujo, { headers: { ...XML, "content-length": String(TOPE + 1) } }))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
    expect([largo.pedidos(), largo.cancelado()]).toEqual([0, true]);
  });

  it("si buscar lanza (red, redirección rechazada), da <PREFIJO>_RED sin lanzar", async () => {
    expect(await pedir(async () => { throw new TypeError("redirect"); })).toEqual({ ok: false, codigo: "PRUEBA_RED" });
  });

  it("un content-length declarado sobre el tope se rechaza como <PREFIJO>_FORMATO sin leer el cuerpo; justo en el tope, no", async () => {
    const e = espia();
    expect(await pedir(responder(e.flujo, { headers: { ...XML, "content-length": String(TOPE + 1) } }))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
    expect(e.pedidos()).toBe(0);
    const justo = new Uint8Array(TOPE).fill(0x20);
    expect(await pedir(responder(flujo([justo]), { headers: { ...XML, "content-length": String(TOPE) } }))).toEqual({ ok: true, bytes: justo });
  });

  it("un cuerpo justo en el tope se acepta; un byte más (en un trozo o repartido) da <PREFIJO>_FORMATO", async () => {
    const justo = new Uint8Array(TOPE).fill(0x41);
    expect(await pedir(responder(flujo([justo])))).toEqual({ ok: true, bytes: justo });
    expect(await pedir(responder(flujo([new Uint8Array(TOPE + 1)])))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
    expect(await pedir(responder(flujo([new Uint8Array(TOPE - 3), new Uint8Array(4)])))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
  });

  it("un flujo sin fin se corta al pasar el tope, se cancela y da <PREFIJO>_FORMATO", async () => {
    const e = espia();
    expect(await pedir(responder(e.flujo))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
    expect(e.cancelado()).toBe(true);
    expect(e.pedidos()).toBeLessThanOrEqual(TOPE / 4 + 2);
  });

  it.each([
    ["sin cuerpo", null],
    ["cuerpo vacío", flujo([])],
  ])("%s da <PREFIJO>_FORMATO", async (_caso, cuerpo) => {
    expect(await pedir(responder(cuerpo))).toEqual({ ok: false, codigo: "PRUEBA_FORMATO" });
  });

  it("un corte a mitad del cuerpo da <PREFIJO>_RED", async () => {
    expect(await pedir(responder(flujo([Uint8Array.of(0x3c)], "falla")))).toEqual({ ok: false, codigo: "PRUEBA_RED" });
  });
});

describe("pedirBytesAcotado · plazo total (reloj falso)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const conRelojFalso = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  it("con un buscar que respeta la señal: pendiente 1 ms antes del plazo; al plazo se aborta y da <PREFIJO>_RED", async () => {
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
        setTimeout(() => resolver(new Response(abierto, { headers: XML })), PLAZO_MS + 1);
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
    expect(await pedir(responder(flujo([Uint8Array.of(0x3c)])))).toEqual({ ok: true, bytes: Uint8Array.of(0x3c) });
    expect(vi.getTimerCount()).toBe(0);
  });
});
