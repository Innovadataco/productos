/// <reference types="vite/client" />
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
vi.mock("@/lib/modelClients", async () => {
  const real = await vi.importActual<typeof import("@/lib/modelClients")>("@/lib/modelClients");
  return { ...real, testModel: vi.fn(), runModel: vi.fn() };
});

import { sinSesion } from "@/test/authMock";

/**
 * Cobertura estructural de la superficie de la API (spec 005, FR-023).
 *
 * I-009 e I-010 ocurrieron porque el criterio "toda ruta exige sesión" (§5.1)
 * vivía en la cabeza de quien escribía cada ruta y no en la suite. Esta prueba
 * lo pone en la suite: recorre el árbol de rutas, invoca CADA manejador HTTP
 * exportado sin sesión y exige 401.
 *
 * No busca texto: invoca. Un `verifyAuth()` colocado después de consultar la
 * base pasaría un grep y no pasa esto.
 *
 * Bajo D-041 la barrera de páginas es optimista (mira si hay cookie, no si es
 * válida), así que esta prueba es lo que hace admisible aquella decisión: si
 * una sola ruta quedara abierta, una cookie inventada bastaría para llegar a
 * ella.
 */

/** Único conjunto público admitido (§5.1 + la excepción declarada del logout). */
const PUBLICAS: Record<string, string> = {
  "/api/auth/login POST": "Es la puerta de entrada: exigir sesión para obtenerla es imposible (§5.1).",
  "/api/auth/logout POST":
    "Solo borra la cookie. Exigir sesión para cerrarla no aporta seguridad y encerraría a quien la tiene caducada.",
};

const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type Manejador = (req: Request, ctx?: unknown) => Promise<Response> | Response;

const modulos: Record<string, () => Promise<unknown>> = import.meta.glob("./**/route.ts");

function rutaDesdeArchivo(archivo: string): string {
  return `/api${archivo.replace(/^\.\//, "/").replace(/\/route\.ts$/, "")}`.replace("/api/", "/api/");
}

describe("superficie de la API: ninguna ruta responde sin sesión (FR-023)", () => {
  beforeEach(async () => {
    await sinSesion();
  });

  it("encuentra el árbol de rutas", () => {
    expect(Object.keys(modulos).length).toBeGreaterThanOrEqual(20);
  });

  for (const [archivo, cargar] of Object.entries(modulos)) {
    const ruta = rutaDesdeArchivo(archivo);

    it(`${ruta} exige sesión en todos sus manejadores`, async () => {
      const modulo = (await cargar()) as Record<string, unknown>;

      for (const metodo of METODOS) {
        const manejador = modulo[metodo] as Manejador | undefined;
        if (typeof manejador !== "function") continue;

        const clave = `${ruta} ${metodo}`;
        if (clave in PUBLICAS) {
          expect(PUBLICAS[clave].length).toBeGreaterThan(0); // la excepción va motivada
          continue;
        }

        const req = new Request(`http://localhost:5001${ruta}`, {
          method: metodo,
          ...(metodo === "GET" || metodo === "DELETE"
            ? {}
            : { body: "{}", headers: { "Content-Type": "application/json" } }),
        });

        const res = await manejador(req, { params: Promise.resolve({ id: "x" }) });

        expect(res.status, `${clave} debería responder 401 sin sesión`).toBe(401);
        await expect(res.json(), clave).resolves.toEqual({ error: "No autenticado" });
      }
    });
  }
});
