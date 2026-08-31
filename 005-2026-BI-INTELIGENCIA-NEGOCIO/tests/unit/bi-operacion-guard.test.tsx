import { describe, it, expect, vi, beforeEach } from "vitest";

// `redirect()` de Next.js corta el flujo lanzando en runtime; lo emulamos
// lanzando un error identificable para poder afirmar "hubo redirect".
vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Error("NEXT_REDIRECT:" + url);
    },
}));

// `headers()` de Next.js: mapa vacío (sin authorization ni cookie) → los
// casos "sin sesión".
vi.mock("next/headers", () => ({
    headers: async () => ({ get: (_: string) => null }),
}));

const sesionMock = vi.fn();
vi.mock("@/lib/auth/sesion", () => ({
    sesionDeRequest: (r: Request) => sesionMock(r),
}));

// Espías de datos: si el guard funciona, estos NO deben invocarse sin sesión.
const leerOperacionMock = vi.fn();
vi.mock("@/lib/bi/operacion", async (orig) => {
    const real = (await orig()) as Record<string, unknown>;
    return { ...real, leerOperacion: (...a: unknown[]) => leerOperacionMock(...a) };
});

const preguntarMotorMock = vi.fn();
vi.mock("@/lib/bi/motor", () => ({
    preguntar: (...a: unknown[]) => preguntarMotorMock(...a),
}));

// next/font/google es un transform de build; en el test devolvemos stubs para
// poder importar operacion/page sin ejecutar la descarga de fuentes.
vi.mock("next/font/google", () => ({
    IBM_Plex_Sans: () => ({ variable: "--font-plex-sans", className: "plex-sans" }),
    IBM_Plex_Mono: () => ({ variable: "--font-plex-mono", className: "plex-mono" }),
}));

beforeEach(() => {
    sesionMock.mockReset();
    leerOperacionMock.mockReset();
    preguntarMotorMock.mockReset();
});

async function invocarLayout(modulePath: string) {
    const mod = await import(modulePath);
    return mod.default({ children: "CONTENIDO" });
}

// ── Helper compartido ────────────────────────────────────────────────────────
describe("exigirSesionBi (helper compartido · SPEC-035)", () => {
    it("sin sesión → redirect (lanza)", async () => {
        sesionMock.mockResolvedValue(null);
        const { exigirSesionBi } = await import("@/lib/auth/guard-bi-sesion");
        await expect(exigirSesionBi("/x")).rejects.toThrow(/NEXT_REDIRECT:/);
    });
    it("con sesión → devuelve la sesión", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        const { exigirSesionBi } = await import("@/lib/auth/guard-bi-sesion");
        expect(await exigirSesionBi("/x")).toEqual({ id: "u1", rol: "ADMIN" });
    });
    // SPEC-036 · informativo (NO anti-drift): el destino ahora es el login
    // PROPIO de BI (/login relativo con returnTo), ya no el puente SSO de PI.
    it("sin sesión → redirige a /login propio con returnTo (SPEC-036)", async () => {
        sesionMock.mockResolvedValue(null);
        const { exigirSesionBi } = await import("@/lib/auth/guard-bi-sesion");
        await expect(exigirSesionBi("/operacion")).rejects.toThrow(
            "NEXT_REDIRECT:/login?returnTo=%2Foperacion",
        );
    });
});

// ── Guard de /operacion · el page NO debe leer datos sin sesión ──────────────
// Esto es el equivalente unit del grep-vacío-del-body de §6.2: si leerOperacion
// no se invoca, ninguna PII del tablero se renderiza ni streamea en el body.
describe("OperacionPage · guard antes de leer datos (leak fix I-33)", () => {
    it("sin sesión → redirige Y NO llama leerOperacion (cero PII renderizada)", async () => {
        sesionMock.mockResolvedValue(null);
        const mod = await import("@/app/operacion/page");
        await expect(mod.default()).rejects.toThrow(/NEXT_REDIRECT:/);
        expect(leerOperacionMock).not.toHaveBeenCalled();
    });
    it("con sesión → SÍ llama leerOperacion (el tablero renderiza)", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        leerOperacionMock.mockResolvedValue({ ok: false, motivo: "ausente" });
        const mod = await import("@/app/operacion/page");
        await mod.default();
        expect(leerOperacionMock).toHaveBeenCalledOnce();
    });
});

// ── Guard de layouts standalone (operacion, chat) ────────────────────────────
describe("Layouts standalone con guard (SPEC-035)", () => {
    it("OperacionLayout sin sesión → redirige", async () => {
        sesionMock.mockResolvedValue(null);
        await expect(invocarLayout("@/app/operacion/layout")).rejects.toThrow(/NEXT_REDIRECT:/);
    });
    it("ChatLayout sin sesión → redirige", async () => {
        sesionMock.mockResolvedValue(null);
        await expect(invocarLayout("@/app/chat/layout")).rejects.toThrow(/NEXT_REDIRECT:/);
    });
    it("con sesión → ambos renderizan children", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        expect(await invocarLayout("@/app/operacion/layout")).toBeTruthy();
        expect(await invocarLayout("@/app/chat/layout")).toBeTruthy();
    });
});

// ── REGRESIÓN anti-recurrencia (genérico · ajuste de Fábrica) ────────────────
// Para CADA ruta top-level protegida sin sesión: EXISTE redirect (no render).
// Atado a "hay redirect", NO al destino. Vigila que las guardadas sigan
// guardadas (quitar un guard hace caer el test) y sobrevive al cambio de guard
// de SPEC-036. NO prueba que TODAS las rutas tengan guard (solo las protegidas).
describe("REGRESIÓN · rutas top-level protegidas redirigen sin sesión", () => {
    const LAYOUTS_PROTEGIDOS = [
        "@/app/dashboard/layout",
        "@/app/operacion/layout",
        "@/app/chat/layout",
    ];
    for (const modulePath of LAYOUTS_PROTEGIDOS) {
        it(`${modulePath} sin sesión → redirect`, async () => {
            sesionMock.mockResolvedValue(null);
            await expect(invocarLayout(modulePath)).rejects.toThrow(/NEXT_REDIRECT:/);
        });
    }
});

// ── Endpoints /api/bi con 401 (backstop del DoS y de la data) ────────────────
describe("Endpoints /api/bi · 401 sin sesión (I-33 · DoS)", () => {
    function reqAnon(): Request {
        return new Request("http://localhost/api/bi/x", { method: "POST", body: "{}" });
    }

    it("preguntar POST sin sesión → 401 Y NO invoca el motor (cero LLM)", async () => {
        sesionMock.mockResolvedValue(null);
        const { POST } = await import("@/app/api/bi/preguntar/route");
        const r = await POST(reqAnon());
        expect(r.status).toBe(401);
        expect(preguntarMotorMock).not.toHaveBeenCalled();
    });

    it("estado-sistema GET sin sesión → 401", async () => {
        sesionMock.mockResolvedValue(null);
        const { GET } = await import("@/app/api/bi/estado-sistema/route");
        const r = await GET(new Request("http://localhost/api/bi/estado-sistema"));
        expect(r.status).toBe(401);
    });
});
