// Buscador fijo del servicio de precios (condiciones del CEO de PI, D-018): solo 2 hosts fijos —Yahoo
// query1.finance.yahoo.com y la SFC www.datos.gov.co—, solo https al puerto 443, con redirect "error" (una
// redirección es un error, nunca se sigue) y la conexión solo a IPv4 públicas que validó el lookup propio.
// Sin red real: los pedidos van a un servidor HTTP local (la petición se reescribe hacia él después de que el
// buscador armó sus opciones) o el lookup rechaza antes de conectar. Datos inventados.
import { EventEmitter } from "node:events";
import { createServer, request as pedirHttp, type ClientRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import type { AddressInfo } from "node:net";
import type { RequestOptions } from "node:https";
import { afterEach, describe, expect, it } from "vitest";
import { pedirJsonAcotado } from "../../../src/lib/http-acotado";
import { obtenerCierres } from "../../../src/precios/yahoo";
import { obtenerValores } from "../../../src/fondo/sfc";
import { HOSTS_PERMITIDOS, buscadorQueRechaza, crearBuscadorFijo, type Solicitar } from "../../../src/servicio-precios/buscador";
import { crearLookupSeguro } from "../../../src/servicio-precios/direcciones";

const ip = (...o: number[]): string => o.join(".");
const LOCAL = ip(127, 0, 0, 1);
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/FICTA.CL?interval=1d&period1=1799280017&period2=1799366417";
const SFC = "https://www.datos.gov.co/resource/qhpu-8ixx.json?codigo_negocio=94613";
const INIT = { headers: { "User-Agent": "Mozilla/5.0" }, signal: new AbortController().signal, redirect: "error" as const };
const LIMITES = { prefijo: "YAHOO", headers: { "User-Agent": "Mozilla/5.0" }, bytesMaximos: 4613, tiempoMaximoMs: 3_000 };

/** Un solicitar que no abre nada: registra las opciones y nunca responde. */
function espia(): { solicitar: Solicitar; vistas: RequestOptions[] } {
  const vistas: RequestOptions[] = [];
  const solicitar: Solicitar = (opciones) => {
    vistas.push(opciones);
    throw new Error("espía: no conecta");
  };
  return { solicitar, vistas };
}

let servidor: Server | null = null;
let pedidosAlServidor = 0;
let conexionesCerradas = 0;
afterEach(async () => {
  if (servidor) await new Promise((ok) => servidor!.close(ok));
  servidor = null;
  pedidosAlServidor = 0;
  conexionesCerradas = 0;
});

/** Servidor HTTP local y un solicitar que reescribe hacia él la petición ya armada por el buscador. */
async function local(atender: (pedido: IncomingMessage, respuesta: ServerResponse) => void): Promise<{ solicitar: Solicitar; vistas: RequestOptions[] }> {
  servidor = createServer((pedido, respuesta) => {
    pedidosAlServidor += 1;
    atender(pedido, respuesta);
  });
  servidor.on("connection", (s) => s.on("close", () => (conexionesCerradas += 1)));
  await new Promise<void>((ok) => servidor!.listen(0, LOCAL, ok));
  const puerto = (servidor.address() as AddressInfo).port;
  const vistas: RequestOptions[] = [];
  const solicitar: Solicitar = (opciones, alResponder) => {
    vistas.push(opciones);
    return pedirHttp({ ...opciones, protocol: "http:", hostname: LOCAL, port: puerto, lookup: undefined, agent: false }, alResponder);
  };
  return { solicitar, vistas };
}

const json = (cuerpo: unknown, extra: Record<string, string> = {}) => (_: IncomingMessage, r: ServerResponse) => {
  r.writeHead(200, { "content-type": "application/json", ...extra });
  r.end(JSON.stringify(cuerpo));
};

describe("los 2 hosts fijos", () => {
  it("son exactamente Yahoo (query1 y query2) y la SFC (www.datos.gov.co)", () => {
    expect(HOSTS_PERMITIDOS).toEqual(["query1.finance.yahoo.com", "query2.finance.yahoo.com", "www.datos.gov.co"]);
  });

  for (const [caso, url] of [
    ["otro host", "https://ejemplo.invalid/v8/finance/chart/FICTA.CL"],
    ["un sufijo engañoso", "https://query1.finance.yahoo.com.ejemplo.invalid/v8/finance/chart/FICTA.CL"],
    ["otro host de Yahoo (query3)", "https://query3.finance.yahoo.com/v8/finance/chart/FICTA.CL"],
    ["la SFC sin www", "https://datos.gov.co/resource/qhpu-8ixx.json"],
    ["http sin TLS", "http://query1.finance.yahoo.com/v8/finance/chart/FICTA.CL"],
    ["un puerto explícito", "https://query1.finance.yahoo.com:8443/v8/finance/chart/FICTA.CL"],
    ["credenciales en la URL", "https://ficticio:clave@query1.finance.yahoo.com/v8/finance/chart/FICTA.CL"],
    ["una IP en lugar del nombre", `https://${ip(11, 37, 91, 47)}/v8/finance/chart/FICTA.CL`],
    ["la IP del host vista desde el contenedor", `https://${ip(172, 17, 0, 1)}/`],
    ["texto que no es URL", "query1.finance.yahoo.com/v8/finance/chart/FICTA.CL"],
  ] as const) {
    it(`${caso}: rechazo ANTES de conectar, sin repetir la ruta ni la consulta`, async () => {
      const { solicitar, vistas } = espia();
      const buscar = crearBuscadorFijo({ solicitar });
      const error = await buscar(url, INIT).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toBe("PRECIOS_DESTINO_NO_PERMITIDO");
      expect(vistas).toEqual([]);
    });
  }

  it("un destino que no es texto ni URL (p. ej. un Request) se rechaza antes de conectar", async () => {
    const { solicitar, vistas } = espia();
    const error = await crearBuscadorFijo({ solicitar })({ url: YAHOO } as unknown as string, INIT).then(() => null, (e: unknown) => e);
    expect((error as Error).message).toBe("PRECIOS_DESTINO_NO_PERMITIDO");
    expect(vistas).toEqual([]);
  });

  it("acepta los 2 hosts (también como URL) y arma la petición: https, 443, GET, SNI del nombre, lookup propio y sin agente compartido", async () => {
    for (const url of [YAHOO, SFC, new URL(SFC)]) {
      const { solicitar, vistas } = espia();
      await crearBuscadorFijo({ solicitar })(url as string, INIT).catch(() => undefined);
      const u = new URL(String(url));
      expect(vistas).toHaveLength(1);
      expect(vistas[0]).toMatchObject({ protocol: "https:", hostname: u.hostname, port: 443, method: "GET", path: `${u.pathname}${u.search}`, servername: u.hostname, agent: false, signal: INIT.signal });
      expect(typeof vistas[0]?.lookup).toBe("function");
    }
  });
});

describe('redirect: "error"', () => {
  for (const redirect of ["follow", "manual", undefined]) {
    it(`init.redirect = ${String(redirect)}: rechazo antes de conectar`, async () => {
      const { solicitar, vistas } = espia();
      const error = await crearBuscadorFijo({ solicitar })(YAHOO, { ...INIT, redirect } as unknown as typeof INIT).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toBe("PRECIOS_REDIRECCION_NO_ERROR");
      expect(vistas).toEqual([]);
    });
  }

  for (const estado of [301, 302, 303, 307, 308]) {
    it(`una respuesta ${estado} es un error: no se sigue (un solo pedido al servidor) y el pedido acotado da YAHOO_RED`, async () => {
      const { solicitar } = await local((_, r) => {
        r.writeHead(estado, { location: "https://ejemplo.invalid/otra" });
        r.end();
      });
      const buscar = crearBuscadorFijo({ solicitar });
      const error = await buscar(YAHOO, INIT).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toBe("PRECIOS_REDIRECCION_RECHAZADA");
      expect(await pedirJsonAcotado(buscar, YAHOO, LIMITES)).toEqual({ ok: false, codigo: "YAHOO_RED" });
      expect(pedidosAlServidor).toBe(2);
    });
  }
});

describe("cabeceras", () => {
  it("pide identity (sin compresión), conserva las del pedido y pone accept */* si no viene; nadie le cambia la codificación", async () => {
    let vistas: Record<string, string | string[] | undefined> = {};
    const { solicitar } = await local((p, r) => {
      vistas = p.headers;
      json({ ok: 1 })(p, r);
    });
    const buscar = crearBuscadorFijo({ solicitar });
    await pedirJsonAcotado(buscar, YAHOO, { ...LIMITES, headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip" } });
    expect(vistas["accept-encoding"]).toBe("identity");
    expect(vistas["user-agent"]).toBe("Mozilla/5.0");
    expect(vistas.accept).toBe("*/*");
    await pedirJsonAcotado(buscar, SFC, { ...LIMITES, prefijo: "SFC", headers: { Accept: "application/json" } });
    expect(vistas.accept).toBe("application/json");
  });

  it("un pedido sin cabeceras propias lleva igual accept */* y accept-encoding identity", async () => {
    let vistas: Record<string, string | string[] | undefined> = {};
    const { solicitar } = await local((p, r) => {
      vistas = p.headers;
      json({ ok: 1 })(p, r);
    });
    const r = await crearBuscadorFijo({ solicitar })(YAHOO, { signal: INIT.signal, redirect: "error" } as unknown as typeof INIT);
    await r.body?.cancel();
    expect(vistas.accept).toBe("*/*");
    expect(vistas["accept-encoding"]).toBe("identity");
  });

  it("una respuesta comprimida se rechaza (se pidió identity)", async () => {
    const { solicitar } = await local(json({ ok: 1 }, { "content-encoding": "gzip" }));
    const buscar = crearBuscadorFijo({ solicitar });
    expect((await buscar(YAHOO, INIT).then(() => null, (e: unknown) => e) as Error).message).toBe("PRECIOS_CODIFICACION");
    expect(await pedirJsonAcotado(buscar, YAHOO, LIMITES)).toEqual({ ok: false, codigo: "YAHOO_RED" });
  });

  it("content-encoding: identity explícito sí sirve", async () => {
    const { solicitar } = await local(json({ ok: 1 }, { "content-encoding": "identity" }));
    expect(await pedirJsonAcotado(crearBuscadorFijo({ solicitar }), YAHOO, LIMITES)).toEqual({ ok: true, datos: { ok: 1 } });
  });
});

describe("la respuesta, por el pedido acotado (src/lib/http-acotado.ts)", () => {
  it("200 con cuerpo en trozos: devuelve el JSON; los encabezados se leen sin importar mayúsculas", async () => {
    const { solicitar } = await local((_, r) => {
      r.writeHead(200, { "content-type": "application/json", "x-ficticia": ["a", "b"] });
      r.write('{"valor":');
      setTimeout(() => r.end("37911.47}"), 17);
    });
    const buscar = crearBuscadorFijo({ solicitar });
    const respuesta = await buscar(YAHOO, INIT);
    expect(respuesta.ok).toBe(true);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("application/json");
    expect(respuesta.headers.get("x-ficticia")).toBe("a, b");
    expect(respuesta.headers.get("no-existe")).toBeNull();
    await respuesta.body?.cancel();
    expect(await pedirJsonAcotado(buscar, YAHOO, LIMITES)).toEqual({ ok: true, datos: { valor: 37911.47 } });
  });

  it("404 → YAHOO_HTTP_404 (ok falso, con su estado)", async () => {
    const { solicitar } = await local((_, r) => {
      r.writeHead(404);
      r.end("no");
    });
    expect(await pedirJsonAcotado(crearBuscadorFijo({ solicitar }), YAHOO, LIMITES)).toEqual({ ok: false, codigo: "YAHOO_HTTP_404" });
  });

  it("un cuerpo sobre el tope → YAHOO_FORMATO y la conexión se cierra", async () => {
    const { solicitar } = await local((_, r) => {
      r.writeHead(200, { "content-type": "application/json" });
      const trozo = "x".repeat(1237);
      for (let i = 0; i < 17; i += 1) r.write(trozo);
      r.end();
    });
    expect(await pedirJsonAcotado(crearBuscadorFijo({ solicitar }), YAHOO, LIMITES)).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
    await expect.poll(() => conexionesCerradas).toBe(1);
  });

  it("un servidor que no responde: vence el plazo → YAHOO_RED y el pedido se aborta (la conexión se cierra)", async () => {
    const { solicitar } = await local(() => undefined);
    expect(await pedirJsonAcotado(crearBuscadorFijo({ solicitar }), YAHOO, { ...LIMITES, tiempoMaximoMs: 137 })).toEqual({ ok: false, codigo: "YAHOO_RED" });
    await expect.poll(() => conexionesCerradas).toBe(1);
  });

  it("un cuerpo cortado a mitad (el servidor cae) → YAHOO_RED", async () => {
    const { solicitar } = await local((_, r) => {
      r.writeHead(200, { "content-type": "application/json", "content-length": "4613" });
      r.write('{"valor":');
      setTimeout(() => r.socket?.destroy(), 17);
    });
    expect(await pedirJsonAcotado(crearBuscadorFijo({ solicitar }), YAHOO, LIMITES)).toEqual({ ok: false, codigo: "YAHOO_RED" });
  });

  it("dos errores seguidos de la respuesta (abort y reset del socket) no tumban el proceso: el cuerpo falla una vez", async () => {
    const respuesta = Object.assign(new PassThrough(), { statusCode: 200, headers: {} }) as unknown as IncomingMessage & PassThrough;
    const solicitar: Solicitar = (_, alResponder) => {
      const pedido = Object.assign(new EventEmitter(), { end: () => setImmediate(() => alResponder(respuesta)) });
      return pedido as unknown as ClientRequest;
    };
    const r = await crearBuscadorFijo({ solicitar })(YAHOO, INIT);
    const lector = r.body!.getReader();
    respuesta.write("{");
    expect((await lector.read()).done).toBe(false);
    const leyendo = lector.read();
    respuesta.emit("error", Object.assign(new Error("aborted"), { code: "ECONNRESET" }));
    expect(() => respuesta.emit("error", new Error("segundo error del socket"))).not.toThrow();
    await expect(leyendo).rejects.toMatchObject({ code: "ECONNRESET" });
  });

  it("un error de la petición (conexión rechazada) → rechazo con su causa → YAHOO_RED", async () => {
    const solicitar: Solicitar = (opciones, alResponder) => pedirHttp({ ...opciones, protocol: "http:", hostname: LOCAL, port: 1, lookup: undefined, agent: false }, alResponder);
    const buscar = crearBuscadorFijo({ solicitar });
    const error = await buscar(YAHOO, INIT).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe("PRECIOS_RED");
    expect(((error as Error).cause as NodeJS.ErrnoException).code).toBe("ECONNREFUSED");
    expect(await pedirJsonAcotado(buscar, YAHOO, LIMITES)).toEqual({ ok: false, codigo: "YAHOO_RED" });
  });

  it("de punta a punta con Yahoo: obtenerCierres lee los cierres (inventados) por el buscador fijo", async () => {
    const t = Date.UTC(2027, 0, 7) / 1000 + 14 * 3600;
    const { solicitar, vistas } = await local(json({ chart: { result: [{ meta: { currency: "COP" }, timestamp: [t], indicators: { quote: [{ close: [4613.37], volume: [1237] }] } }], error: null } }));
    const r = await obtenerCierres("FICTA.CL", new Date("2027-01-07T00:00:00Z"), new Date("2027-01-07T00:00:00Z"), crearBuscadorFijo({ solicitar }));
    expect(r).toEqual({ ok: true, cierres: [{ fecha: new Date("2027-01-07T00:00:00Z"), precio: "4613.37", volumen: 1237 }] });
    expect(vistas[0]?.hostname).toBe("query1.finance.yahoo.com");
  });

  it("de punta a punta con la SFC: obtenerValores lee el valor de unidad (inventado) por el buscador fijo", async () => {
    const fila = { fecha_corte: "2027-01-07T00:00:00.000", codigo_negocio: "94613", tipo_participacion: "7", valor_unidad_operaciones: "13711.4613", valor_fondo_cierre_dia_t: "37911.47" };
    const { solicitar, vistas } = await local(json([fila]));
    const r = await obtenerValores({ codigo: "94613", participacion: "7", desde: new Date("2027-01-07T00:00:00Z"), hasta: new Date("2027-01-07T00:00:00Z") }, crearBuscadorFijo({ solicitar }));
    expect(r).toMatchObject({ ok: true, descartados: 0, valores: [{ valorUnidad: "13711.4613" }] });
    expect(vistas[0]?.hostname).toBe("www.datos.gov.co");
  });
});

describe("nunca a la IP del host: el lookup propio rechaza antes de conectar", () => {
  it("con el https real: si el nombre resuelve a una dirección no pública, falla con su causa y no hay conexión", async () => {
    for (const mala of [LOCAL, ip(172, 17, 0, 1), ip(169, 254, 169, 254)]) {
      const lookup = crearLookupSeguro(async () => [{ address: mala, family: 4 }]);
      const error = await crearBuscadorFijo({ lookup })(YAHOO, INIT).then(() => null, (e: unknown) => e);
      expect(error, mala).toBeInstanceOf(TypeError);
      expect(((error as Error).cause as NodeJS.ErrnoException).code, mala).toBe("PRECIOS_DIRECCION_NO_PUBLICA");
    }
  });
});

describe("buscadorQueRechaza (el proceso del bucle no sale a la red)", () => {
  it("rechaza todo, también los 2 hosts fijos", async () => {
    for (const url of [YAHOO, SFC]) {
      const error = await buscadorQueRechaza()(url, INIT).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toBe("PRECIOS_SIN_RED_EN_EL_BUCLE");
    }
  });

  it("los dos buscadores tienen nombre (la prueba del bundle ve cuál quedó instalado como fetch)", () => {
    expect(crearBuscadorFijo().name).toBe("buscarFijo");
    expect(buscadorQueRechaza().name).toBe("buscarRechazado");
  });
});
