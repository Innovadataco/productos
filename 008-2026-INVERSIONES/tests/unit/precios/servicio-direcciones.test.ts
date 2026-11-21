// Direcciones del servicio de precios: solo IPv4 públicas (condición del CEO de PI: nunca conexiones a la IP del host).
// El lookup propio resuelve el nombre, rechaza TODO si alguna dirección no es pública y entrega solo las validadas
// (la conexión va a esa IP: sin carrera entre validar y conectar). Las IPs se arman en ejecución: el cruce de
// literales de la Fábrica marca cualquier IPv4 escrita.
import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";
import { crearLookupSeguro, ipv4Publica } from "../../../src/servicio-precios/direcciones";

const ip = (...o: number[]): string => o.join(".");

describe("ipv4Publica · los rangos de uso especial de IANA no son públicos", () => {
  for (const [rango, direccion] of [
    ["0/8 (esta red)", ip(0, 0, 0, 0)],
    ["0/8 (esta red)", ip(0, 37, 9, 11)],
    ["10/8 (privada)", ip(10, 11, 12, 13)],
    ["100.64/10 (CGNAT)", ip(100, 64, 0, 1)],
    ["100.64/10 (CGNAT, último)", ip(100, 127, 255, 254)],
    ["127/8 (bucle)", ip(127, 0, 0, 1)],
    ["127/8 (bucle, el DNS de Docker)", ip(127, 0, 0, 11)],
    ["169.254/16 (enlace local, metadatos)", ip(169, 254, 169, 254)],
    ["172.16/12 (privada: la puerta de enlace de docker0)", ip(172, 17, 0, 1)],
    ["172.16/12 (privada, último)", ip(172, 31, 255, 254)],
    ["192.0.0/24 (IETF)", ip(192, 0, 0, 9)],
    ["192.0.2/24 (documentación)", ip(192, 0, 2, 17)],
    ["192.88.99/24 (6to4)", ip(192, 88, 99, 3)],
    ["192.168/16 (privada)", ip(192, 168, 37, 1)],
    ["198.18/15 (pruebas)", ip(198, 19, 255, 254)],
    ["198.51.100/24 (documentación)", ip(198, 51, 100, 7)],
    ["203.0.113/24 (documentación)", ip(203, 0, 113, 9)],
    ["224/4 (multidifusión)", ip(239, 255, 255, 250)],
    ["240/4 (reservada)", ip(240, 0, 0, 1)],
    ["difusión", ip(255, 255, 255, 255)],
  ] as const) {
    it(`${rango}: ${direccion} no es pública`, () => {
      expect(ipv4Publica(direccion)).toBe(false);
    });
  }

  for (const direccion of [ip(11, 37, 91, 47), ip(100, 63, 255, 254), ip(100, 128, 0, 1), ip(172, 15, 255, 254), ip(172, 32, 0, 1), ip(192, 167, 255, 254), ip(198, 17, 255, 254), ip(198, 20, 0, 1), ip(223, 255, 255, 254)]) {
    it(`${direccion} (fuera de los rangos) sí es pública`, () => {
      expect(ipv4Publica(direccion)).toBe(true);
    });
  }

  for (const otra of ["::1", "2001:db8::17", `::ffff:${ip(127, 0, 0, 1)}`, "", "query1.finance.yahoo.com", ip(256, 1, 2, 3), `${ip(11, 37, 91, 47)} `]) {
    it(`«${otra}» no es una IPv4 pública (IPv6 y textos raros, nunca)`, () => {
      expect(ipv4Publica(otra)).toBe(false);
    });
  }
});

type Respuesta = { error: (NodeJS.ErrnoException & { code?: string }) | null; direccion: unknown; familia: unknown };

/** Llama al lookup con la firma de net (con `all` o sin él) y devuelve lo que entregó. */
function consultar(direcciones: readonly LookupAddress[] | Error, all: boolean): Promise<{ r: Respuesta; pedidos: string[] }> {
  const pedidos: string[] = [];
  const lookup = crearLookupSeguro(async (nombre) => {
    pedidos.push(nombre);
    if (direcciones instanceof Error) throw direcciones;
    return direcciones;
  });
  return new Promise((ok) => {
    lookup("query1.finance.yahoo.com", { all, family: 0 }, (error, direccion, familia) => ok({ r: { error, direccion, familia }, pedidos }));
  });
}

describe("crearLookupSeguro", () => {
  const PUBLICA = ip(11, 37, 91, 47);
  const OTRA = ip(11, 37, 91, 53);

  it("con `all` (como llama net con autoSelectFamily): entrega todas las validadas, solo IPv4", async () => {
    const { r, pedidos } = await consultar([{ address: PUBLICA, family: 4 }, { address: OTRA, family: 4 }], true);
    expect(pedidos).toEqual(["query1.finance.yahoo.com"]);
    expect(r.error).toBeNull();
    expect(r.direccion).toEqual([{ address: PUBLICA, family: 4 }, { address: OTRA, family: 4 }]);
  });

  it("sin `all`: entrega la primera validada y su familia", async () => {
    const { r } = await consultar([{ address: PUBLICA, family: 4 }], false);
    expect(r.error).toBeNull();
    expect(r.direccion).toBe(PUBLICA);
    expect(r.familia).toBe(4);
  });

  for (const [caso, direcciones] of [
    ["una sola privada entre públicas: rechaza todo (señal de DNS alterado)", [{ address: PUBLICA, family: 4 }, { address: ip(172, 17, 0, 1), family: 4 }]],
    ["la IP de bucle", [{ address: ip(127, 0, 0, 1), family: 4 }]],
    ["una IPv6", [{ address: "2001:db8::17", family: 6 }]],
    ["una «IPv4» con familia 6", [{ address: PUBLICA, family: 6 }]],
    ["ninguna dirección", []],
  ] as const) {
    it(`${caso} → PRECIOS_DIRECCION_NO_PUBLICA, sin dirección`, async () => {
      for (const all of [true, false]) {
        const { r } = await consultar(direcciones, all);
        expect(r.error?.code).toBe("PRECIOS_DIRECCION_NO_PUBLICA");
        expect(r.direccion).toBeUndefined();
      }
    });
  }

  it("si el DNS falla, pasa el error tal cual (no inventa una dirección)", async () => {
    const fallo = Object.assign(new Error("sin DNS"), { code: "ENOTFOUND" });
    const { r } = await consultar(fallo, true);
    expect(r.error).toBe(fallo);
    expect(r.direccion).toBeUndefined();
  });

  it("por defecto usa el resolvedor del sistema: «localhost» (de /etc/hosts, sin red) es de bucle y se rechaza", async () => {
    const lookup = crearLookupSeguro();
    const error = await new Promise<NodeJS.ErrnoException | null>((ok) => lookup("localhost", { all: true }, (e) => ok(e)));
    expect(error?.code).toBe("PRECIOS_DIRECCION_NO_PUBLICA");
  });
});
