// El buscador fijo y la URL de Yahoo del ciclo intradía «por configuración» (desacople de PI y del VPS): los 2 hosts
// fijos siguen siendo los únicos por omisión; el host de la URL configurada se suma SOLO si se pasa explícitamente, con
// las mismas condiciones (https, 443, sin credenciales) y el mismo lookup que rechaza lo que no es una IPv4 pública.
import type { ClientRequest } from "node:http";
import type { RequestOptions } from "node:https";
import { describe, expect, it } from "vitest";
import { HOSTS_PERMITIDOS, crearBuscadorFijo, hostDeUrlConfigurada, type Solicitar } from "@/servicio-precios/buscador";

const INIT = { headers: { "User-Agent": "Mozilla/5.0" }, signal: new AbortController().signal, redirect: "error" as const };

function espia(): { solicitar: Solicitar; vistas: RequestOptions[] } {
  const vistas: RequestOptions[] = [];
  const solicitar: Solicitar = (opciones) => {
    vistas.push(opciones);
    return { once: () => undefined, end: () => undefined } as unknown as ClientRequest;
  };
  return { solicitar, vistas };
}
const rechaza = async (buscar: ReturnType<typeof crearBuscadorFijo>, url: string) =>
  (await buscar(url, INIT).then(() => null, (e: unknown) => e)) as Error | null;

describe("hostDeUrlConfigurada", () => {
  it("el host de una URL https sin credenciales, puerto, ruta ni consulta; si no, null", () => {
    expect(hostDeUrlConfigurada("https://yahoo.ficticio.invalid")).toBe("yahoo.ficticio.invalid");
    expect(hostDeUrlConfigurada("https://yahoo.ficticio.invalid/")).toBe("yahoo.ficticio.invalid");
    for (const mala of ["http://yahoo.ficticio.invalid", "https://u:p@yahoo.ficticio.invalid", "https://yahoo.ficticio.invalid:8443", "https://yahoo.ficticio.invalid/x", "https://yahoo.ficticio.invalid/?a=1", "", "no es url"]) {
      expect(hostDeUrlConfigurada(mala), mala).toBeNull();
    }
  });
});

describe("crearBuscadorFijo con hostsExtra", () => {
  it("por omisión los hosts siguen siendo exactamente los 2 fijos", () => {
    expect(HOSTS_PERMITIDOS).toEqual(["query1.finance.yahoo.com", "www.datos.gov.co"]);
  });

  it("sin hostsExtra, el host de la URL configurada se rechaza ANTES de conectar", async () => {
    const { solicitar, vistas } = espia();
    const e = await rechaza(crearBuscadorFijo({ solicitar }), "https://yahoo.ficticio.invalid/v8/finance/chart/FICTA.CL?interval=1m&range=1d");
    expect(e?.message).toBe("PRECIOS_DESTINO_NO_PERMITIDO");
    expect(vistas).toEqual([]);
  });

  it("con hostsExtra acepta ese host (https, 443, GET) y sigue rechazando cualquier otro", async () => {
    const { solicitar, vistas } = espia();
    const buscar = crearBuscadorFijo({ solicitar, hostsExtra: ["yahoo.ficticio.invalid"] });
    await buscar("https://yahoo.ficticio.invalid/v8/finance/chart/FICTA.CL?interval=1m&range=1d", INIT).catch(() => undefined);
    expect(vistas).toHaveLength(1);
    expect(vistas[0]).toMatchObject({ hostname: "yahoo.ficticio.invalid", port: 443, method: "GET", servername: "yahoo.ficticio.invalid", agent: false });
    for (const url of ["https://otro.ficticio.invalid/x", "https://yahoo.ficticio.invalid.otro.invalid/x", "http://yahoo.ficticio.invalid/x", "https://yahoo.ficticio.invalid:8443/x"]) {
      expect((await rechaza(buscar, url))?.message, url).toBe("PRECIOS_DESTINO_NO_PERMITIDO");
    }
    expect(vistas).toHaveLength(1);
  });

  it("un hostsExtra mal formado (con puerto, ruta, esquema o comodín) no abre nada", async () => {
    for (const malo of ["yahoo.ficticio.invalid:8443", "https://yahoo.ficticio.invalid", "yahoo.ficticio.invalid/x", "*.ficticio.invalid", "", " "]) {
      const { solicitar, vistas } = espia();
      const buscar = crearBuscadorFijo({ solicitar, hostsExtra: [malo] });
      expect((await rechaza(buscar, "https://yahoo.ficticio.invalid/x"))?.message, malo).toBe("PRECIOS_DESTINO_NO_PERMITIDO");
      expect(vistas).toEqual([]);
    }
  });
});
