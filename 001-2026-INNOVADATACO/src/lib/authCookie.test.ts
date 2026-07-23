import { describe, it, expect, afterEach, vi } from "vitest";
import { cookieSecure } from "./authCookie";

describe("cookieSecure (FR-004 / D-036)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("por defecto es segura cuando la variable no está definida", () => {
    vi.stubEnv("AUTH_COOKIE_SECURE", undefined as unknown as string);
    expect(cookieSecure()).toBe(true);
  });

  it("solo se desactiva con el valor explícito 'false'", () => {
    vi.stubEnv("AUTH_COOKIE_SECURE", "false");
    expect(cookieSecure()).toBe(false);
  });

  it("acepta mayúsculas y espacios alrededor del 'false'", () => {
    vi.stubEnv("AUTH_COOKIE_SECURE", "FALSE");
    expect(cookieSecure()).toBe(false);

    vi.stubEnv("AUTH_COOKIE_SECURE", "  false  ");
    expect(cookieSecure()).toBe(false);
  });

  it("ante un valor ambiguo prevalece el comportamiento seguro", () => {
    for (const valor of ["", "sí", "si", "1", "0", "no", "true", "basura", "falso"]) {
      vi.stubEnv("AUTH_COOKIE_SECURE", valor);
      expect(cookieSecure(), `valor ambiguo: ${JSON.stringify(valor)}`).toBe(true);
    }
  });

  it("no depende de NODE_ENV (causa raíz de I-005)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_COOKIE_SECURE", "false");
    expect(cookieSecure()).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_COOKIE_SECURE", "true");
    expect(cookieSecure()).toBe(true);
  });
});
