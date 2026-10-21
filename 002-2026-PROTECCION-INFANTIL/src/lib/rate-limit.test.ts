import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, getClientIp, resetRateLimitStore } from "./rate-limit";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { crearParametrosReportes, crearUsuario } from "./reporte-test-utils";
import { bloquearIp } from "./anti-abuso/block-list";
import { calcularIpHash } from "./anti-abuso/fuente-reporte";
import type { PrismaClient } from "@prisma/client";

// SPEC-174: el fallo de lectura de parámetros se simula envolviendo el módulo
// `@/lib/parametros` (NO se espía el singleton de Prisma — la regla arch:check
// (e) lo prohíbe). El flag hoisted activa el fallo solo en el test O-1.
const falloParametros = vi.hoisted(() => ({ activo: false }));
vi.mock("@/lib/parametros", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@/lib/parametros")>();
    return {
        ...mod,
        getParametroSistema: async (...args: Parameters<typeof mod.getParametroSistema>) => {
            if (falloParametros.activo) throw new Error("postgres caído");
            return mod.getParametroSistema(...args);
        },
    };
});

// Cliente falso inyectable para simular el store caído (SPEC-174): el endpoint
// usa `options.client ?? prisma` solo para el upsert de la ventana.
function clienteStoreCaido(): PrismaClient {
    return { $queryRaw: vi.fn().mockRejectedValue(new Error("store no disponible")) } as unknown as PrismaClient;
}

function makeRequest(ip: string): Request {
    return new Request("http://localhost:5005/api/test", {
        headers: { "x-forwarded-for": ip },
    });
}

describe("getClientIp", () => {
    it("lee x-forwarded-for", () => {
        const req = makeRequest("1.2.3.4");
        expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("devuelve unknown sin cabeceras", () => {
        const req = new Request("http://localhost:5005/api/test");
        expect(getClientIp(req)).toBe("unknown");
    });
});

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

describe("checkRateLimit", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
    });

    it("permite la primera petición y devuelve headers", async () => {
        const result = await checkRateLimit(makeRequest("10.0.0.1"), "consulta");
        expect(result.allowed).toBe(true);
        if (rateLimitDisabled) {
            expect(result.remaining).toBe(0);
            expect(result.headers).toEqual({});
        } else {
            expect(result.remaining).toBe(29);
            expect(result.headers["X-RateLimit-Limit"]).toBe("30");
            expect(result.headers["X-RateLimit-Remaining"]).toBe("29");
            expect(result.headers["X-RateLimit-Reset"]).toBeDefined();
        }
    });

    it("bloquea tras exceder el límite", async () => {
        if (rateLimitDisabled) {
            // Cuando el rate limit está deshabilitado, nunca bloquea
            const ip = "10.0.0.2";
            for (let i = 0; i < 50; i++) {
                const result = await checkRateLimit(makeRequest(ip), "consulta");
                expect(result.allowed).toBe(true);
            }
            return;
        }

        const ip = "10.0.0.2";
        for (let i = 0; i < 30; i++) {
            const result = await checkRateLimit(makeRequest(ip), "consulta");
            expect(result.allowed).toBe(true);
        }
        const blocked = await checkRateLimit(makeRequest(ip), "consulta");
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
        expect(blocked.headers["Retry-After"]).toBeDefined();
    });

    it("reinicia el contador en una nueva ventana", async () => {
        if (rateLimitDisabled) {
            // Con rate limit deshabilitado no hay ventanas ni bloqueos
            const ip = "10.0.0.3";
            for (let i = 0; i < 50; i++) {
                await checkRateLimit(makeRequest(ip), "consulta");
            }
            const result = await checkRateLimit(makeRequest(ip), "consulta");
            expect(result.allowed).toBe(true);
            return;
        }

        const ip = "10.0.0.3";
        // Sobrepasar límite
        for (let i = 0; i < 30; i++) {
            await checkRateLimit(makeRequest(ip), "consulta");
        }
        const blocked = await checkRateLimit(makeRequest(ip), "consulta");
        expect(blocked.allowed).toBe(false);

        // Simular ventana nueva eliminando la fila actual
        await prisma.rateLimit.deleteMany({ where: { scope: "consulta", identifier: ip } });

        const fresh = await checkRateLimit(makeRequest(ip), "consulta");
        expect(fresh.allowed).toBe(true);
        expect(fresh.remaining).toBe(29);
    });

    it("usa identificador personalizado cuando se proporciona", async () => {
        if (rateLimitDisabled) {
            // Con rate limit deshabilitado, nunca bloquea
            const userId = "user-123";
            const req = new Request("http://localhost:5005/api/test");
            for (let i = 0; i < 10; i++) {
                const result = await checkRateLimit(req, "report", { identifier: userId });
                expect(result.allowed).toBe(true);
            }
            return;
        }

        const userId = "user-123";
        const req = new Request("http://localhost:5005/api/test");
        for (let i = 0; i < 5; i++) {
            const result = await checkRateLimit(req, "report", { identifier: userId });
            expect(result.allowed).toBe(true);
        }
        const blocked = await checkRateLimit(req, "report", { identifier: userId });
        expect(blocked.allowed).toBe(false);

        // Otra IP sin identificador explícito no debería estar bloqueada
        const other = await checkRateLimit(makeRequest("10.0.0.4"), "report");
        expect(other.allowed).toBe(true);
    });

    it("scope suave no bloquea pero reporta exceso", async () => {
        if (rateLimitDisabled) {
            const req = new Request("http://localhost:5005/api/test");
            for (let i = 0; i < 15; i++) {
                const result = await checkRateLimit(req, "report_identificador", { identifier: "victim:wp", soft: true });
                expect(result.allowed).toBe(true);
                expect(result.softExceeded).toBe(false);
            }
            return;
        }

        const req = new Request("http://localhost:5005/api/test");
        for (let i = 0; i < 10; i++) {
            const result = await checkRateLimit(req, "report_identificador", { identifier: "victim:wp", soft: true });
            expect(result.allowed).toBe(true);
            expect(result.softExceeded).toBe(false);
        }

        const exceeded = await checkRateLimit(req, "report_identificador", { identifier: "victim:wp", soft: true });
        expect(exceeded.allowed).toBe(true);
        expect(exceeded.softExceeded).toBe(true);
        expect(exceeded.markAsSpam).toBe(false); // 11 < spam_threshold (20)
    });

    it("scope suave marca spam tras umbral configurado", async () => {
        if (rateLimitDisabled) return;

        const req = new Request("http://localhost:5005/api/test");
        for (let i = 0; i < 20; i++) {
            await checkRateLimit(req, "report_identificador", { identifier: "spam:wp", soft: true });
        }
        const spam = await checkRateLimit(req, "report_identificador", { identifier: "spam:wp", soft: true });
        expect(spam.allowed).toBe(true);
        expect(spam.softExceeded).toBe(true);
        expect(spam.markAsSpam).toBe(true);
    });

    it("report_fingerprint bloquea por fingerprint", async () => {
        if (rateLimitDisabled) return;

        const fingerprint = "fp-abc-123";
        const req = new Request("http://localhost:5005/api/test");
        for (let i = 0; i < 5; i++) {
            const result = await checkRateLimit(req, "report_fingerprint", { identifier: fingerprint });
            expect(result.allowed).toBe(true);
        }
        const blocked = await checkRateLimit(req, "report_fingerprint", { identifier: fingerprint });
        expect(blocked.allowed).toBe(false);

        const otherFp = await checkRateLimit(req, "report_fingerprint", { identifier: "fp-other" });
        expect(otherFp.allowed).toBe(true);
    });
});

describe("fail-closed ante fallo del store (I-28)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("scope seguimiento falla cerrado si el store no responde", async () => {
        if (rateLimitDisabled) return;
        await crearParametrosReportes();

        const result = await checkRateLimit(makeRequest("10.9.9.9"), "seguimiento", { client: clienteStoreCaido() });
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.headers["Retry-After"]).toBeDefined();
    });

    it("scope login falla cerrado si el store no responde", async () => {
        if (rateLimitDisabled) return;
        await crearParametrosReportes();

        const result = await checkRateLimit(makeRequest("10.9.9.9"), "login", { client: clienteStoreCaido() });
        expect(result.allowed).toBe(false);
    });

    it("otros scopes siguen fail-open si el store no responde", async () => {
        if (rateLimitDisabled) return;
        await crearParametrosReportes();

        const result = await checkRateLimit(makeRequest("10.9.9.8"), "consulta", { client: clienteStoreCaido() });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
    });

    // SPEC-895: los scopes que disparan CORREO/CÓDIGO fallan CERRADO (antes abiertos →
    // bombardeo de buzón / gasto de Resend bajo store caído, autoamplificante). Control
    // positivo: quitar cualquiera de FAIL_CLOSED_SCOPES vuelve su caso a allowed:true (rojo).
    it.each(["recuperar_solicitar", "verificacion_solicitar", "stepup_codigo", "acceso_codigo"])(
        "SPEC-895: el scope de correo/código %s falla cerrado si el store no responde",
        async (scope) => {
            if (rateLimitDisabled) return;
            await crearParametrosReportes();

            const result = await checkRateLimit(makeRequest("10.9.9.6"), scope, { client: clienteStoreCaido() });
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.headers["Retry-After"]).toBeDefined();
        },
    );

    // SPEC-895 (decisión): el REPORTE se queda fail-OPEN — el camino de protección infantil
    // nunca se gatea por un fallo del limitador. Si alguien suma "report" al set, esto se pone rojo.
    it("SPEC-895: el scope de REPORTE sigue fail-OPEN si el store no responde (protección siempre abierta)", async () => {
        if (rateLimitDisabled) return;
        await crearParametrosReportes();

        const result = await checkRateLimit(makeRequest("10.9.9.5"), "report", { client: clienteStoreCaido() });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
    });

    it("O-1 (SPEC-108): si la LECTURA DE PARÁMETROS falla (no solo el upsert), seguimiento responde 429 fail-closed y no lanza 500", async () => {
        if (rateLimitDisabled) return;
        await crearParametrosReportes();

        // Antes del fix, getScopeConfig leía parámetros FUERA del try: un fallo aquí
        // lanzaba y el endpoint respondía 500 en vez del 429 + Retry-After prometido.
        falloParametros.activo = true;
        try {
            const result = await checkRateLimit(makeRequest("10.9.9.7"), "seguimiento");
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.headers["Retry-After"]).toBeDefined();
        } finally {
            falloParametros.activo = false;
        }
    });
});

describe("SPEC-184: BlockList intercepta antes de contar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
    });

    it("IP baneada devuelve 429 inmediato y no consume cuota de rate-limit", async () => {
        if (rateLimitDisabled) return;

        const admin = await crearUsuario("ADMIN");
        const ip = "192.0.2.50";
        const ipHash = calcularIpHash(ip);
        await bloquearIp({ ipHash, motivo: "Test SPEC-184", duracion: "24h", creadoPorId: admin.id });

        const req = makeRequest(ip);
        const blocked = await checkRateLimit(req, "consulta");
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
        expect(blocked.headers["Retry-After"]).toBeDefined();

        // No debe haber creado fila en RateLimit para esta IP.
        const count = await prisma.rateLimit.count({ where: { identifier: ip } });
        expect(count).toBe(0);
    });

    it("IP no baneada sigue el flujo normal de rate-limit", async () => {
        if (rateLimitDisabled) return;

        const result = await checkRateLimit(makeRequest("192.0.2.51"), "consulta");
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(29);
    });
});

// SPEC-898 · CANDADO: el bypass DISABLE_RATE_LIMIT NO aplica en producción. Estos tests FIJAN
// NODE_ENV ellos mismos (no usan el guard `rateLimitDisabled`), así que corren de verdad en
// local Y en CI — no se saltan aunque .env.test traiga DISABLE_RATE_LIMIT=true.
describe("SPEC-898: DISABLE_RATE_LIMIT con guarda de producción", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("en PRODUCCIÓN ignora el flag: el limitador IGUAL corre (login fail-closed ante store caído → 429)", async () => {
        await crearParametrosReportes();
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DISABLE_RATE_LIMIT", "true");

        // Control positivo: sin la guarda, el flag haría bypass → allowed:true (rojo).
        const result = await checkRateLimit(makeRequest("198.51.100.7"), "login", { client: clienteStoreCaido() });
        expect(result.allowed).toBe(false);
        expect(result.headers["Retry-After"]).toBeDefined();
    });

    it("en test/dev el flag SÍ desactiva el limitador (comportamiento E2E intacto)", async () => {
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("DISABLE_RATE_LIMIT", "true");

        const result = await checkRateLimit(makeRequest("198.51.100.8"), "login", { client: clienteStoreCaido() });
        expect(result.allowed).toBe(true);
    });
});
