/**
 * La red vigilada del arnés (E7): el `fetch` que recibe la puerta local pasa por una lista cerrada (GET de tags y POST
 * de generate del destino, con redirect manual y un pedido a la vez). Lo demás se rechaza SIN llamar al fetch de abajo
 * y se cuenta. IP inventada y armada al correr; el error nunca repite el destino.
 */
import { describe, expect, it } from "vitest";
import type { InitLocal } from "@/ia/local/http";
import { ErrorLocal } from "@/ia/local/errores";
import type { RespuestaHttp } from "@/lib/http-acotado";
import { ErrorRedVigilada, vigilarRed } from "@/ia/evaluacion/red";
import { IP_FICTICIA, ORIGEN_FICTICIO, PUERTO_FICTICIO, URL_GENERAR, URL_TAGS, ip } from "../local/apoyo/red.ficticio";

const senal = new AbortController().signal;
const init = (method: "GET" | "POST", extra: Partial<InitLocal> = {}): InitLocal => ({ method, headers: {}, signal: senal, redirect: "manual", ...extra });
const respuesta = (): RespuestaHttp => new Response("{}", { status: 200 });

function abajo() {
  const llamadas: string[] = [];
  let pendientes: (() => void)[] = [];
  const buscar = (url: string, i: InitLocal): Promise<RespuestaHttp> => {
    llamadas.push(`${i.method} ${url}`);
    return new Promise((ok) => {
      pendientes.push(() => ok(respuesta()));
    });
  };
  const soltar = (): void => {
    const p = pendientes;
    pendientes = [];
    for (const f of p) f();
  };
  return { buscar, llamadas, soltar };
}

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return "SIN_ERROR";
  } catch (error) {
    return error instanceof ErrorRedVigilada ? error.codigo : "OTRO_ERROR";
  }
}

describe("vigilarRed", () => {
  it("deja pasar GET de tags y POST de generate del destino, y los cuenta", async () => {
    const a = abajo();
    const red = vigilarRed(a.buscar, ORIGEN_FICTICIO);
    const tags = red.buscar(URL_TAGS, init("GET"));
    a.soltar();
    await tags;
    const gen = red.buscar(URL_GENERAR, init("POST", { body: "{}" }));
    a.soltar();
    await gen;
    expect(a.llamadas).toEqual([`GET ${URL_TAGS}`, `POST ${URL_GENERAR}`]);
    expect(red.conteo()).toEqual({ tags: 1, generar: 1, rechazados: 0 });
  });

  for (const [nombre, url, metodo, extra, codigo] of [
    ["otra ruta de Ollama", `${ORIGEN_FICTICIO}/api/pull`, "POST", {}, "RUTA_NO_PERMITIDA"],
    ["la ruta de borrar", `${ORIGEN_FICTICIO}/api/delete`, "POST", {}, "RUTA_NO_PERMITIDA"],
    ["otro destino", `http://${ip(100, 99, 13, 71)}:${PUERTO_FICTICIO}/api/tags`, "GET", {}, "RUTA_NO_PERMITIDA"],
    ["tags con POST", URL_TAGS, "POST", {}, "METODO_NO_PERMITIDO"],
    ["generate con GET", URL_GENERAR, "GET", {}, "METODO_NO_PERMITIDO"],
    ["un redirect que se sigue", URL_TAGS, "GET", { redirect: "follow" }, "REDIRECT_NO_MANUAL"],
  ] as const) {
    it(`rechaza ${nombre} sin llamar al fetch de abajo`, async () => {
      const a = abajo();
      const red = vigilarRed(a.buscar, ORIGEN_FICTICIO);
      expect(await codigoDe(red.buscar(url, init(metodo, extra as Partial<InitLocal>)))).toBe(codigo);
      expect(a.llamadas).toEqual([]);
      expect(red.conteo()).toEqual({ tags: 0, generar: 0, rechazados: 1 });
    });
  }

  it("un pedido a la vez: el segundo, con el primero en vuelo, se rechaza; al terminar el primero, pasa", async () => {
    const a = abajo();
    const red = vigilarRed(a.buscar, ORIGEN_FICTICIO);
    const primero = red.buscar(URL_TAGS, init("GET"));
    expect(await codigoDe(red.buscar(URL_GENERAR, init("POST", { body: "{}" })))).toBe("PEDIDO_CONCURRENTE");
    a.soltar();
    await primero;
    const segundo = red.buscar(URL_GENERAR, init("POST", { body: "{}" }));
    a.soltar();
    await segundo;
    expect(red.conteo()).toEqual({ tags: 1, generar: 1, rechazados: 1 });
  });

  it("un rechazo del fetch de abajo libera el turno", async () => {
    let veces = 0;
    const red = vigilarRed(() => (veces++ === 0 ? Promise.reject(new TypeError("caída ficticia")) : Promise.resolve(respuesta())), ORIGEN_FICTICIO);
    await expect(red.buscar(URL_TAGS, init("GET"))).rejects.toThrow(TypeError);
    await expect(red.buscar(URL_TAGS, init("GET"))).resolves.toBeDefined();
  });

  it("un fetch de abajo que lanza en la llamada libera el turno y rechaza", async () => {
    let veces = 0;
    const red = vigilarRed(() => {
      if (veces++ === 0) throw new Error("falla ficticia");
      return Promise.resolve(respuesta());
    }, ORIGEN_FICTICIO);
    await expect(red.buscar(URL_TAGS, init("GET"))).rejects.toThrow("falla ficticia");
    await expect(red.buscar(URL_TAGS, init("GET"))).resolves.toBeDefined();
  });

  it("valida el destino como la puerta local, sin repetirlo en el error", () => {
    for (const destino of ["", "no-es-un-destino", `http://${ip(192, 0, 2, 13)}:${PUERTO_FICTICIO}`]) {
      let error: unknown = null;
      try {
        vigilarRed(abajo().buscar, destino);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ErrorLocal);
      expect(String((error as Error).message)).not.toContain(IP_FICTICIA);
      if (destino !== "") expect(String((error as Error).message)).not.toContain(destino);
    }
  });
});
