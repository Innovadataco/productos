import { describe, it, expect, beforeEach, vi } from "vitest";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

// SPEC-036 · defensa open-redirect del returnTo (whitelist de rutas propias).
describe("sanitizeReturnTo (SPEC-036 · anti open-redirect)", () => {
    beforeEach(() => {
        vi.stubEnv("BI_BASE_URL", "https://bi.innovadataco.com");
    });

    const permitidas = [
        "/dashboard",
        "/operacion", // regresión: faltaba en la whitelist original de /api/auth/link
        "/operacion?x=1",
        "/chat",
        "/api/bi/kpis",
    ];
    it.each(permitidas)("acepta ruta propia en whitelist: %s", (r) => {
        expect(sanitizeReturnTo(r)).toBe(r);
    });

    it("null/vacío → /dashboard", () => {
        expect(sanitizeReturnTo(null)).toBe("/dashboard");
        expect(sanitizeReturnTo("")).toBe("/dashboard");
    });

    const rechazadas = [
        "/etc/passwd",
        "/admin",
        "//evil.com",
        "https://evil.com/dashboard",
        "http://evil.com/api/bi/kpis",
        "javascript:alert(1)",
        "not-a-path",
    ];
    it.each(rechazadas)("fuera de whitelist / host ajeno → /dashboard: %s", (r) => {
        expect(sanitizeReturnTo(r)).toBe("/dashboard");
    });

    it("absoluta al MISMO host de BI → conserva pathname+search", () => {
        expect(sanitizeReturnTo("https://bi.innovadataco.com/operacion?x=1")).toBe(
            "/operacion?x=1",
        );
    });
});
