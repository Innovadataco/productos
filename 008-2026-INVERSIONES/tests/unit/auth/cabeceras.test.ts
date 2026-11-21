// Cabeceras de seguridad (D-014, requisito #7 del CEO de PI): las mismas capas que PI
// (002-2026-PROTECCION-INFANTIL/next.config.ts), más estrictas donde la spec lo pide.
import { describe, expect, it } from "vitest";
import { generarNonce, politicaCsp } from "@/auth/cabeceras";
import configuracion from "../../../next.config";

const directivas = (csp: string) => new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k ?? "", v.join(" ")]));

describe("politicaCsp", () => {
  it("en producción: scripts solo con nonce y strict-dynamic, sin unsafe-inline ni unsafe-eval", () => {
    const d = directivas(politicaCsp("abc123", false));
    expect(d.get("script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(d.get("default-src")).toBe("'self'");
    expect(d.get("frame-ancestors")).toBe("'none'");
    expect(d.get("object-src")).toBe("'none'");
    expect(d.get("base-uri")).toBe("'self'");
    expect(d.get("form-action")).toBe("'self'");
    expect(d.has("upgrade-insecure-requests")).toBe(true);
  });

  it("trae todas las directivas de PI (style, img, font, connect, manifest, worker, media)", () => {
    const d = directivas(politicaCsp("abc123", false));
    expect(d.get("style-src")).toBe("'self' 'unsafe-inline'");
    expect(d.get("img-src")).toBe("'self' data: blob:");
    for (const k of ["font-src", "connect-src", "manifest-src", "worker-src", "media-src"]) expect(d.get(k), k).toBe("'self'");
  });

  it("en desarrollo suma solo 'unsafe-eval' (lo pide `next dev`) y no fuerza https", () => {
    const d = directivas(politicaCsp("abc123", true));
    expect(d.get("script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic' 'unsafe-eval'");
    expect(d.has("upgrade-insecure-requests")).toBe(false);
  });
});

describe("generarNonce", () => {
  it("son 16 bytes aleatorios en base64, distintos cada vez", () => {
    const a = generarNonce();
    expect(Buffer.from(a, "base64")).toHaveLength(16);
    expect(a).not.toBe(generarNonce());
  });
});

describe("next.config.ts · cabeceras en todas las rutas", () => {
  it("lleva las de PI y las de la spec", async () => {
    const reglas = (await configuracion.headers?.()) ?? [];
    const todas = reglas.find((r) => r.source === "/:path*");
    const c = new Map((todas?.headers ?? []).map((h) => [h.key, h.value]));
    expect(c.get("X-Frame-Options")).toBe("DENY");
    expect(c.get("X-Content-Type-Options")).toBe("nosniff");
    expect(c.get("Referrer-Policy")).toBe("no-referrer");
    expect(c.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()");
    expect(c.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
    expect(c.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(configuracion.poweredByHeader).toBe(false);
  });
});
