// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveBiBaseUrl } from "@/lib/bi/base-url";

function hdrs(map: Record<string, string>): {
    get(n: string): string | null;
} {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
    return { get: (n: string) => lower[n.toLowerCase()] ?? null };
}

afterEach(() => {
    vi.unstubAllEnvs();
});

const LOCALHOST_RE = /localhost|127\.0\.0\.1|0\.0\.0\.0/;

describe("resolveBiBaseUrl", () => {
    it("Nivel 1 · x-forwarded-host + proto gana aunque haya env", () => {
        vi.stubEnv("BI_BASE_URL", "https://env.example");
        const r = resolveBiBaseUrl(
            hdrs({
                "x-forwarded-host": "bi.innovadataco.com",
                "x-forwarded-proto": "https",
            }),
        );
        expect(r).toBe("https://bi.innovadataco.com");
    });

    it("Nivel 1 · x-forwarded-proto como lista 'https,http' toma https", () => {
        const r = resolveBiBaseUrl(
            hdrs({
                "x-forwarded-host": "bi.x",
                "x-forwarded-proto": "https,http",
            }),
        );
        expect(r).toBe("https://bi.x");
    });

    it("Nivel 1 · solo x-forwarded-host (sin proto) → default https (D-030.6)", () => {
        const r = resolveBiBaseUrl(hdrs({ "x-forwarded-host": "bi.x" }));
        expect(r).toBe("https://bi.x");
    });

    it("Nivel 2 · sin forwarded, con BI_BASE_URL env", () => {
        vi.stubEnv("BI_BASE_URL", "https://bi.innovadataco.com");
        const r = resolveBiBaseUrl(hdrs({}));
        expect(r).toBe("https://bi.innovadataco.com");
    });

    it("Nivel 2 · trailing slash del env se normaliza", () => {
        vi.stubEnv("BI_BASE_URL", "https://bi.x/");
        const r = resolveBiBaseUrl(hdrs({}));
        expect(r).toBe("https://bi.x");
    });

    it("Nivel 3 · producción sin forwarded ni env → THROW explícito", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BI_BASE_URL", "");
        expect(() => resolveBiBaseUrl(hdrs({}))).toThrow(/\[SPEC-030\]/);
    });

    it("Nivel 3 · development sin nada → localhost OK (no rompe dev)", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("BI_BASE_URL", "");
        const r = resolveBiBaseUrl(hdrs({}));
        expect(r).toBe("http://localhost:3001");
    });

    it("regresión · producción con forwarded host público → nunca localhost", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BI_BASE_URL", "");
        const r = resolveBiBaseUrl(
            hdrs({
                "x-forwarded-host": "bi.innovadataco.com",
                "x-forwarded-proto": "https",
            }),
        );
        expect(LOCALHOST_RE.test(r)).toBe(false);
        expect(r).toBe("https://bi.innovadataco.com");
    });

    it("regresión · producción sin nada NUNCA retorna localhost (lanza)", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BI_BASE_URL", "");
        let returned: string | null = null;
        try {
            returned = resolveBiBaseUrl(hdrs({}));
        } catch {
            returned = null;
        }
        // Si lanzó, returned queda null. Nunca debe haber devuelto un string localhost.
        expect(returned).toBeNull();
    });
});
