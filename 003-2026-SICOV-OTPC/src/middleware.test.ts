import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function peticion(url = "http://localhost:5010/login"): NextRequest {
  return new NextRequest(url);
}

function extraerNonce(csp: string): string | null {
  const m = /'nonce-([^']+)'/.exec(csp);
  return m ? m[1] : null;
}

describe("middleware CSP con nonce (fix I-12)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emite la CSP en la respuesta con nonce presente", () => {
    const res = middleware(peticion());
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    const nonce = extraerNonce(csp!);
    expect(nonce).toBeTruthy();
    expect(nonce!.length).toBeGreaterThanOrEqual(16);
  });

  it("propaga la CSP y el nonce en los headers de la PETICIÓN (así la detecta Next)", () => {
    const res = middleware(peticion());
    const cspRespuesta = res.headers.get("Content-Security-Policy")!;
    // NextResponse.next({ request: { headers } }) serializa los headers de petición
    // sobreescritos como x-middleware-request-<nombre> en la respuesta del middleware.
    const cspPeticion = res.headers.get("x-middleware-request-content-security-policy");
    const noncePeticion = res.headers.get("x-middleware-request-x-nonce");
    expect(cspPeticion).toBe(cspRespuesta);
    expect(noncePeticion).toBe(extraerNonce(cspRespuesta));
  });

  it("genera un nonce ÚNICO por petición", () => {
    const n1 = extraerNonce(middleware(peticion()).headers.get("Content-Security-Policy")!);
    const n2 = extraerNonce(middleware(peticion()).headers.get("Content-Security-Policy")!);
    expect(n1).toBeTruthy();
    expect(n2).toBeTruthy();
    expect(n1).not.toBe(n2);
  });

  it("la CSP está bien formada y script-src NUNCA lleva 'unsafe-inline'", () => {
    const csp = middleware(peticion()).headers.get("Content-Security-Policy")!;
    const directivas = new Map(
      csp.split(";").map((d) => {
        const [nombre, ...valores] = d.trim().split(/\s+/);
        return [nombre, valores.join(" ")] as const;
      }),
    );
    expect(directivas.get("default-src")).toBe("'self'");
    expect(directivas.get("style-src")).toBe("'self' 'unsafe-inline'");
    expect(directivas.get("img-src")).toBe("'self' data:");
    expect(directivas.get("connect-src")).toBe("'self'");
    expect(directivas.get("frame-ancestors")).toBe("'none'");
    const scriptSrc = directivas.get("script-src")!;
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toMatch(/'nonce-[^']+'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("fuera de producción incluye 'unsafe-eval' en script-src (HMR de Turbopack)", () => {
    // NODE_ENV en la suite es "test" (≠ production) → cuenta como desarrollo.
    const csp = middleware(peticion()).headers.get("Content-Security-Policy")!;
    expect(csp).toContain("'unsafe-eval'");
  });

  it("en producción NO incluye 'unsafe-eval'", () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = middleware(peticion()).headers.get("Content-Security-Policy")!;
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toMatch(/'nonce-[^']+'/);
  });
});
