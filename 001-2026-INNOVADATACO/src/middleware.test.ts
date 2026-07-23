import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const BASE = "http://localhost:5001";

function peticion(ruta: string, cookie?: string): NextRequest {
  const req = new NextRequest(`${BASE}${ruta}`);
  if (cookie !== undefined) req.cookies.set("token", cookie);
  return req;
}

describe("barrera de páginas (spec 005, US-4)", () => {
  it("redirige al login la página solicitada sin cookie, conservando el destino", () => {
    const res = middleware(peticion("/configuracion"));

    expect(res.status).toBe(307);
    const destino = new URL(res.headers.get("location") as string);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("next")).toBe("/configuracion");
  });

  it("conserva también la query de la página solicitada", () => {
    const res = middleware(peticion("/licitaciones?estado=abierta"));

    const destino = new URL(res.headers.get("location") as string);
    expect(destino.searchParams.get("next")).toBe("/licitaciones?estado=abierta");
  });

  it("protege las cinco páginas del producto", () => {
    for (const ruta of ["/", "/configuracion", "/licitaciones", "/projects", "/research"]) {
      const res = middleware(peticion(ruta));
      expect(res.headers.get("location"), ruta).toContain("/login");
    }
  });

  it("deja pasar con cookie presente", () => {
    const res = middleware(peticion("/configuracion", "token-cualquiera"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("responde 401 en JSON a la API sin cookie, nunca una redirección (FR-015)", async () => {
    const res = middleware(peticion("/api/documents"));

    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toContain("application/json");
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("no estorba a las rutas públicas de autenticación (§5.1)", () => {
    for (const ruta of ["/api/auth/login", "/api/auth/logout"]) {
      const res = middleware(peticion(ruta));
      expect(res.status, ruta).toBe(200);
      expect(res.headers.get("location"), ruta).toBeNull();
    }
  });

  it("sirve la pantalla de acceso SIEMPRE, haya cookie o no (D-043)", () => {
    for (const cookie of [undefined, "token-caducado"]) {
      const res = middleware(peticion("/login", cookie));
      expect(res.status).toBe(200);
      // Si redirigiera con cookie presente, quien la tiene caducada quedaría
      // encerrado fuera de la única pantalla que puede devolverle la sesión.
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("una cookie inválida pasa la barrera: es la contrapartida declarada de D-041", () => {
    const res = middleware(peticion("/configuracion", "basura-no-firmada"));

    expect(res.status).toBe(200);
    // La ruta la rechaza igual: la frontera de seguridad es verifyAuth (§5.1),
    // como comprueba src/app/api/superficie.test.ts.
  });

  it("una cookie vacía cuenta como ausencia de sesión", () => {
    const res = middleware(peticion("/configuracion", ""));

    expect(res.headers.get("location")).toContain("/login");
  });
});
