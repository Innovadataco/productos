// El servidor HTTP del servicio inv-008-ia, por el bucle local (127.0.0.1 y un puerto libre: nada de red real): pasa el
// método, la ruta, la autorización y un cuerpo con tope a la atención, y responde su JSON.
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_CUERPO_PEDIDO, crearServidor } from "@/servicio-ia/servidor";

const abiertos: Array<{ close(): unknown }> = [];
afterEach(() => {
  for (const s of abiertos.splice(0)) s.close();
});

async function levantar(atender: Parameters<typeof crearServidor>[0]): Promise<string> {
  const servidor = crearServidor(atender);
  abiertos.push(servidor);
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

describe("crearServidor", () => {
  it("pasa el pedido a la atención y responde su estado y su JSON, sin caché", async () => {
    const atender = vi.fn(async () => ({ estado: 200, cuerpo: { ok: true } }));
    const origen = await levantar(atender);
    const r = await fetch(`${origen}/probar?x=1`, { method: "POST", headers: { authorization: "Bearer abc" }, body: '{"modelo":"m"}' });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/json");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ ok: true });
    expect(atender).toHaveBeenCalledWith({ metodo: "POST", ruta: "/probar", autorizacion: "Bearer abc", cuerpo: '{"modelo":"m"}' });
  });

  it("un cuerpo más grande que el tope: 413, sin llamar a la atención", async () => {
    const atender = vi.fn(async () => ({ estado: 200, cuerpo: {} }));
    const origen = await levantar(atender);
    const r = await fetch(`${origen}/probar`, { method: "POST", body: "x".repeat(MAX_CUERPO_PEDIDO + 1) });
    expect(r.status).toBe(413);
    expect(atender).not.toHaveBeenCalled();
  });

  it("con el filtro previo: sin la autorización debida responde 401 SIN leer el cuerpo ni llamar a la atención", async () => {
    const atender = vi.fn(async () => ({ estado: 200, cuerpo: {} }));
    const servidor = crearServidor(atender, (autorizacion) => autorizacion === "Bearer bueno");
    abiertos.push(servidor);
    await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
    const origen = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    const sin = await fetch(`${origen}/probar`, { method: "POST", body: "{}" });
    expect(sin.status).toBe(401);
    expect(await sin.json()).toEqual({ error: "NO_AUTORIZADO" });
    expect(atender).not.toHaveBeenCalled();
    expect((await fetch(`${origen}/probar`, { method: "POST", headers: { authorization: "Bearer bueno" }, body: "{}" })).status).toBe(200);
  });

  it("plazos cortos: un cliente lento no retiene una conexión más de unos segundos", () => {
    const servidor = crearServidor(async () => ({ estado: 200, cuerpo: {} }));
    expect(servidor.headersTimeout).toBeLessThanOrEqual(2473);
    expect(servidor.requestTimeout).toBeLessThanOrEqual(3473);
  });

  it("si la atención lanza: 500 con un código", async () => {
    const origen = await levantar(async () => { throw new Error("interno"); });
    const r = await fetch(`${origen}/identificar`, { method: "POST", body: "{}" });
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "ERROR_INTERNO" });
  });
});
