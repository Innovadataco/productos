import { vi } from "vitest";

/**
 * Helpers de sesión para los tests de rutas API (spec 002, FR-009).
 *
 * Uso en un archivo de test:
 *
 * ```ts
 * vi.mock("@/lib/auth", async () => {
 *   const { createAuthMock } = await import("@/test/authMock");
 *   return createAuthMock();
 * });
 *
 * import { verifyAuth } from "@/lib/auth";
 * conSesion();      // ruta autenticada
 * sinSesion();      // debe responder 401
 * ```
 */

export const SESION_FIXTURE = {
  sub: "usr_test_1",
  username: "testuser",
  role: "admin",
};

export function createAuthMock() {
  return {
    verifyAuth: vi.fn(),
    signToken: vi.fn().mockResolvedValue("token-de-prueba"),
  };
}

/** Programa `verifyAuth` para devolver una sesión válida. */
export async function conSesion() {
  const { verifyAuth } = await import("@/lib/auth");
  vi.mocked(verifyAuth).mockResolvedValue(SESION_FIXTURE);
}

/** Programa `verifyAuth` para devolver null (no autenticado). */
export async function sinSesion() {
  const { verifyAuth } = await import("@/lib/auth");
  vi.mocked(verifyAuth).mockResolvedValue(null);
}

/** Construye una petición JSON para las rutas API. */
export function peticionJson(url: string, body?: unknown, method = "POST") {
  return new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as never;
}
