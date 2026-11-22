// Pedido al SDMX de BanRep (C2c), sin red: `buscar` siempre es un doble. Un solo pedido por pedirBytesAcotado (sin
// redirecciones, con plazo y tope de bytes), sin User-Agent propio ni nada que imite un navegador: nada se evade. Un
// bloqueo (403, 429 o un tipo de contenido que no es XML, como la página del captcha) sale como BANREP_BLOQUEADO.
import { afterEach, describe, expect, it, vi } from "vitest";
import { serieBanrep } from "@/datos-oficiales/fuentes/banrep-series";
import { ACCEPT_BANREP, BYTES_MAXIMOS_BANREP, TIEMPO_MAXIMO_BANREP_MS, TIPOS_SDMX, pedirSdmxBanrep } from "@/datos-oficiales/fuentes/banrep-pedido";
import type { BuscarHttp, InitHttp } from "@/lib/http-acotado";
import { TOPES_XML } from "@/lib/xml-acotado";
import { CAPTCHA_FICTICIO, MENSAJE_TPM, bytesDe } from "./banrep.ficticio";

const TPM = serieBanrep("TPM")!;
const DESDE = new Date(Date.UTC(2019, 4, 7));
const URL_TPM = "https://totoro.banrep.gov.co/nsi-jax-ws/rest/data/ESTAT,DF_CBR_DAILY_HIST,1.0/all/ALL/?startPeriod=2019";
const XML = { "content-type": "application/xml" };
const responder = (cuerpo: BodyInit | null, init: ResponseInit = { headers: XML }): BuscarHttp => async () => new Response(cuerpo, init);
const pedir = (buscar: BuscarHttp) => pedirSdmxBanrep(TPM, DESDE, buscar);

afterEach(() => {
  vi.useRealTimers();
});

describe("pedirSdmxBanrep · el pedido", () => {
  it("una sola llamada, a la URL pública, solo con Accept, sin seguir redirecciones", async () => {
    const llamadas: [string, InitHttp][] = [];
    const xml = bytesDe(MENSAJE_TPM);
    const r = await pedir(async (url, init) => {
      llamadas.push([url, init]);
      return new Response(xml, { headers: XML });
    });
    expect(r).toEqual({ ok: true, bytes: xml });
    expect(llamadas).toHaveLength(1);
    const [url, init] = llamadas[0]!;
    expect(url).toBe(URL_TPM);
    expect(init.headers).toEqual({ Accept: ACCEPT_BANREP });
    expect(Object.keys(init.headers).map((h) => h.toLowerCase())).not.toContain("user-agent");
    expect(init.redirect).toBe("error");
  });

  it("acepta los tipos de XML del SDMX (con charset UTF-8 o con versión) y el tope es el del lector XML", async () => {
    expect(TIPOS_SDMX).toEqual(["application/vnd.sdmx.genericdata+xml", "application/xml", "text/xml"]);
    expect(BYTES_MAXIMOS_BANREP).toBe(TOPES_XML.bytes);
    expect(TIEMPO_MAXIMO_BANREP_MS).toBe(60_000);
    for (const tipo of ["text/xml;charset=UTF-8", "application/vnd.sdmx.genericdata+xml; version=2.1", "application/xml"]) {
      expect((await pedir(responder("<a/>", { headers: { "content-type": tipo } }))).ok, tipo).toBe(true);
    }
  });

  it(`un cuerpo de exactamente ${TOPES_XML.bytes} bytes se lee; uno más, BANREP_FORMATO`, async () => {
    expect(await pedir(responder(new Uint8Array(BYTES_MAXIMOS_BANREP).fill(0x20)))).toMatchObject({ ok: true });
    expect(await pedir(responder(new Uint8Array(BYTES_MAXIMOS_BANREP + 1).fill(0x20)))).toEqual({ ok: false, codigo: "BANREP_FORMATO", detalle: null });
  });

  it("un cuerpo vacío: BANREP_FORMATO", async () => {
    expect(await pedir(responder(""))).toEqual({ ok: false, codigo: "BANREP_FORMATO", detalle: null });
  });
});

describe("pedirSdmxBanrep · fallos", () => {
  it("la página del captcha (text/html con 200) y otro tipo que no es XML: BANREP_BLOQUEADO (TIPO), sin leer el cuerpo", async () => {
    expect(await pedir(responder(CAPTCHA_FICTICIO, { headers: { "content-type": "text/html;charset=utf-8" } }))).toEqual({ ok: false, codigo: "BANREP_BLOQUEADO", detalle: "TIPO" });
    expect(await pedir(responder("{}", { headers: { "content-type": "application/json" } }))).toEqual({ ok: false, codigo: "BANREP_BLOQUEADO", detalle: "TIPO" });
    expect(await pedir(responder("<a/>", { headers: {} }))).toEqual({ ok: false, codigo: "BANREP_BLOQUEADO", detalle: "TIPO" });
  });

  it("403 y 429 son bloqueo, con su estado como detalle", async () => {
    expect(await pedir(responder(CAPTCHA_FICTICIO, { status: 403, headers: { "content-type": "text/html" } }))).toEqual({ ok: false, codigo: "BANREP_BLOQUEADO", detalle: "HTTP_403" });
    expect(await pedir(responder("", { status: 429 }))).toEqual({ ok: false, codigo: "BANREP_BLOQUEADO", detalle: "HTTP_429" });
  });

  it("otro estado queda como HTTP_<n> (el 500 HTML de una caída no se adivina como bloqueo)", async () => {
    expect(await pedir(responder(CAPTCHA_FICTICIO, { status: 500, headers: { "content-type": "text/html" } }))).toEqual({ ok: false, codigo: "BANREP_HTTP_500", detalle: null });
    expect(await pedir(responder("", { status: 404 }))).toEqual({ ok: false, codigo: "BANREP_HTTP_404", detalle: null });
  });

  it("la red falla, redirige (fetch rechaza con redirect: error) o lanza de forma síncrona: BANREP_RED", async () => {
    expect(await pedir(async () => Promise.reject(new TypeError("redirect")))).toEqual({ ok: false, codigo: "BANREP_RED", detalle: null });
    expect(await pedir(() => {
      throw new TypeError("síncrono");
    })).toEqual({ ok: false, codigo: "BANREP_RED", detalle: null });
  });

  it("el plazo vence: BANREP_RED, sin esperar más", async () => {
    vi.useFakeTimers();
    const p = pedir(() => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_BANREP_MS);
    expect(await p).toEqual({ ok: false, codigo: "BANREP_RED", detalle: null });
  });
});
