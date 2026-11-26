// El buscador fijo y los hosts de Yahoo del ciclo intradía: lista blanca FIJA (query1 y query2 de Yahoo, y la SFC). Ya no
// hay hosts «por configuración»: lo único configurable es cuál de los dos de Yahoo usa el ciclo (INV_INTRADIA_HOST_YAHOO).
import { readFileSync } from "node:fs";
import type { RequestOptions } from "node:https";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HOSTS_YAHOO_INTRADIA } from "@/precios/intradia/url";
import { HOSTS_PERMITIDOS, crearBuscadorFijo, type Solicitar } from "@/servicio-precios/buscador";

const INIT = { headers: { "User-Agent": "Mozilla/5.0" }, signal: new AbortController().signal, redirect: "error" as const };
const RAIZ = path.resolve(__dirname, "../../..");

function espia(): { solicitar: Solicitar; vistas: RequestOptions[] } {
  const vistas: RequestOptions[] = [];
  const solicitar: Solicitar = (opciones) => {
    vistas.push(opciones);
    throw new Error("espía: no conecta");
  };
  return { solicitar, vistas };
}
const rechaza = async (buscar: ReturnType<typeof crearBuscadorFijo>, url: string) =>
  (await buscar(url, INIT).then(() => null, (e: unknown) => e)) as Error | null;

describe("la lista blanca fija de hosts", () => {
  it("son exactamente query1 y query2 de Yahoo y la SFC, y salen de HOSTS_YAHOO_INTRADIA", () => {
    expect(HOSTS_PERMITIDOS).toEqual(["query1.finance.yahoo.com", "query2.finance.yahoo.com", "www.datos.gov.co"]);
    expect(HOSTS_PERMITIDOS).toEqual(expect.arrayContaining(Object.values(HOSTS_YAHOO_INTRADIA)));
    expect(Object.isFrozen(HOSTS_PERMITIDOS)).toBe(true);
  });

  for (const host of Object.values(HOSTS_YAHOO_INTRADIA)) {
    it(`${host} se acepta (https, 443, GET) y llega a conectar`, async () => {
      const { solicitar, vistas } = espia();
      await crearBuscadorFijo({ solicitar })(`https://${host}/v8/finance/chart/FICTA.CL?interval=1m&range=1d`, INIT).catch(() => undefined);
      expect(vistas).toHaveLength(1);
      expect(vistas[0]).toMatchObject({ hostname: host, port: 443, method: "GET", servername: host, agent: false });
    });
  }

  it("cualquier otro host se rechaza ANTES de conectar, aunque se pase como opción (hostsExtra ya no existe)", async () => {
    const { solicitar, vistas } = espia();
    const buscar = crearBuscadorFijo({ solicitar, hostsExtra: ["yahoo.ficticio.invalid"] } as never);
    for (const url of ["https://yahoo.ficticio.invalid/x", "https://query3.finance.yahoo.com/x", "https://query2.finance.yahoo.com.ficticio.invalid/x", "http://query2.finance.yahoo.com/x", "https://query2.finance.yahoo.com:8443/x", "https://u:p@query2.finance.yahoo.com/x"]) {
      expect((await rechaza(buscar, url))?.message, url).toBe("PRECIOS_DESTINO_NO_PERMITIDO");
    }
    expect(vistas).toEqual([]);
  });

  it("el código ya no ofrece destinos por configuración (ni hostsExtra, ni hostDeUrlConfigurada, ni INV_INTRADIA_URL_YAHOO)", () => {
    const fuentes = ["src/servicio-precios/buscador.ts", "src/servicio-precios/intradia-configuracion.ts", "scripts/servicio-precios.ts", "docker-compose.prod.yml", "scripts/desplegar-prod.sh", "docs/despliegue/env-inversiones-production.example"];
    const viejas = /hostsExtra|hostDeUrlConfigurada|INV_INTRADIA_URL_YAHOO/;
    expect(fuentes.filter((f) => viejas.test(readFileSync(path.join(RAIZ, f), "utf8")))).toEqual([]);
    // Control positivo: el detector muerde.
    expect(viejas.test("INV_INTRADIA_URL_YAHOO: ${INV_INTRADIA_URL_YAHOO:-}")).toBe(true);
  });
});
