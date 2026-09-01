/**
 * SPEC-331 (002-PI-231): vigencia de la cookie sesion_estado según rol.
 *
 * SCHOOL_ADMIN / COMITE_CONVIVENCIA derivan su vigencia de la ventana del
 * colegio (verificarVigenciaCliente), no de una Suscripcion.
 * Roles internos: siempre ACTIVA. PARENT: flujo de suscripción sin cambios.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSuscripcion: vi.fn(),
    findDebeCambiarPassword: vi.fn(),
    findVigenciaCliente: vi.fn(),
    requiereConsentimiento: vi.fn(),
    verificarVigenciaClienteMock: vi.fn(),
    firmarSesionEstado: vi.fn(async (payload: unknown) => JSON.stringify(payload)),
    requireEnv: vi.fn(() => "test-secret-de-32-chars-o-mas!!"),
    // SPEC-339 · SPEC-344: derivadores mockeados — este test es del emisor,
    // no de la derivación (cada uno tiene su propio test de integración).
    derivarPasoPendiente: vi.fn(),
    derivarPasoPendienteColegio: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/pagos-repository", () => ({
    PagosRepository: vi.fn().mockImplementation(() => ({
        obtenerSuscripcionActivaPorUsuarioId: mocks.obtenerSuscripcion,
    })),
}));

vi.mock("@/lib/dal/repositories/usuario", () => ({
    UsuarioRepository: vi.fn().mockImplementation(() => ({
        findDebeCambiarPassword: mocks.findDebeCambiarPassword,
        findVigenciaCliente: mocks.findVigenciaCliente,
    })),
}));

vi.mock("@/lib/consentimiento/guard", () => ({
    requiereConsentimientoActual: mocks.requiereConsentimiento,
}));

vi.mock("@/lib/colegio/vigencia", () => ({
    verificarVigenciaCliente: mocks.verificarVigenciaClienteMock,
}));

vi.mock("@/lib/routing/vigencia-cookie", () => ({
    firmarSesionEstado: mocks.firmarSesionEstado,
}));

vi.mock("@/lib/env", () => ({
    requireEnv: mocks.requireEnv,
}));

vi.mock("@/lib/dal/services/camino/estado", () => ({
    derivarPasoPendiente: mocks.derivarPasoPendiente,
}));

vi.mock("@/lib/dal/services/camino/estado-colegio", () => ({
    derivarPasoPendienteColegio: mocks.derivarPasoPendienteColegio,
}));

import { buildSesionEstadoValue } from "./sesion-estado-emitter";

function setup({
    rol,
    debeCambiarPassword = false,
    suscripcionEstado = null,
    vigente = true,
}: {
    rol: string;
    debeCambiarPassword?: boolean;
    suscripcionEstado?: string | null;
    vigente?: boolean;
}) {
    mocks.findDebeCambiarPassword.mockResolvedValue({ debeCambiarPassword });
    mocks.findVigenciaCliente.mockResolvedValue({ rol, colegioId: null, comiteColegioId: null, inicioServicio: null, finServicio: null });
    mocks.requiereConsentimiento.mockResolvedValue(false);
    mocks.obtenerSuscripcion.mockResolvedValue(
        suscripcionEstado ? { estado: suscripcionEstado } : null
    );
    mocks.verificarVigenciaClienteMock.mockResolvedValue({
        vigente,
        estado: vigente ? "vigente" : "vencido",
        mensaje: "",
    });
    mocks.derivarPasoPendiente.mockResolvedValue(null);
    mocks.derivarPasoPendienteColegio.mockResolvedValue(null);
}

describe("buildSesionEstadoValue — derivación de vigencia por rol (SPEC-331)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.firmarSesionEstado.mockImplementation(async (payload: unknown) => JSON.stringify(payload));
    });

    describe("SCHOOL_ADMIN", () => {
        it("vigente → ACTIVA en cookie", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true });
            const cookie = await buildSesionEstadoValue("uid-1");
            const payload = JSON.parse(cookie);
            expect(payload.vigencia).toBe("ACTIVA");
            expect(mocks.verificarVigenciaClienteMock).toHaveBeenCalledWith("uid-1");
        });

        it("vencido → SUSPENDIDA en cookie (gateado por middleware)", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: false });
            const cookie = await buildSesionEstadoValue("uid-1");
            expect(JSON.parse(cookie).vigencia).toBe("SUSPENDIDA");
        });

        it("delega en verificarVigenciaCliente, no en suscripción", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true });
            await buildSesionEstadoValue("uid-1");
            expect(mocks.verificarVigenciaClienteMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("COMITE_CONVIVENCIA", () => {
        it("vigente → ACTIVA en cookie", async () => {
            setup({ rol: "COMITE_CONVIVENCIA", vigente: true });
            expect(JSON.parse(await buildSesionEstadoValue("uid-2")).vigencia).toBe("ACTIVA");
        });

        it("colegio inactivo → SUSPENDIDA en cookie", async () => {
            setup({ rol: "COMITE_CONVIVENCIA", vigente: false });
            expect(JSON.parse(await buildSesionEstadoValue("uid-2")).vigencia).toBe("SUSPENDIDA");
        });
    });

    describe("PARENT — flujo de suscripción sin cambios", () => {
        it("PARENT con suscripción ACTIVA → ACTIVA", async () => {
            setup({ rol: "PARENT", suscripcionEstado: "ACTIVA" });
            expect(JSON.parse(await buildSesionEstadoValue("uid-3")).vigencia).toBe("ACTIVA");
            expect(mocks.verificarVigenciaClienteMock).not.toHaveBeenCalled();
        });

        it("PARENT con suscripción EN_GRACIA → EN_GRACIA", async () => {
            setup({ rol: "PARENT", suscripcionEstado: "EN_GRACIA" });
            expect(JSON.parse(await buildSesionEstadoValue("uid-3")).vigencia).toBe("EN_GRACIA");
        });

        it("PARENT sin suscripción → SIN_SUSCRIPCION", async () => {
            setup({ rol: "PARENT", suscripcionEstado: null });
            expect(JSON.parse(await buildSesionEstadoValue("uid-3")).vigencia).toBe("SIN_SUSCRIPCION");
        });
    });

    describe("Roles internos — siempre ACTIVA", () => {
        it.each(["ADMIN", "OPERADOR", "COMITE_VALIDACION"])(
            "%s → ACTIVA sin llamar a verificarVigenciaCliente",
            async (rol) => {
                setup({ rol });
                expect(JSON.parse(await buildSesionEstadoValue("uid-4")).vigencia).toBe("ACTIVA");
                expect(mocks.verificarVigenciaClienteMock).not.toHaveBeenCalled();
            }
        );
    });

    describe("Flags adicionales — no regresiones", () => {
        it("debeCambiarPassword se propaga correctamente para SCHOOL_ADMIN", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true, debeCambiarPassword: true });
            expect(JSON.parse(await buildSesionEstadoValue("uid-5")).debeCambiarPassword).toBe(true);
        });
    });

    // ── SPEC-339 · pasoCamino en la cookie ──────────────────────────────────
    describe("SPEC-339 · pasoCamino", () => {
        it("PARENT: el paso pendiente derivado viaja en la cookie", async () => {
            setup({ rol: "PARENT", suscripcionEstado: null });
            mocks.derivarPasoPendiente.mockResolvedValue("hijos");
            const value = await buildSesionEstadoValue("u1");
            expect(JSON.parse(value).pasoCamino).toBe("hijos");
            expect(mocks.derivarPasoPendiente).toHaveBeenCalledWith("u1");
        });

        it("PARENT con camino terminado: pasoCamino = null", async () => {
            setup({ rol: "PARENT", suscripcionEstado: "ACTIVA" });
            mocks.derivarPasoPendiente.mockResolvedValue(null);
            const value = await buildSesionEstadoValue("u1");
            expect(JSON.parse(value).pasoCamino).toBeNull();
        });

        // SPEC-344 (A-69 · C1): SCHOOL_ADMIN ahora sí lleva su paso pendiente
        // en la cookie. Es un CAMBIO ESPERADO respecto a SPEC-339 (no regresión),
        // documentado en la SPEC-344 · US8 · SC-008.
        it("SCHOOL_ADMIN: el paso pendiente del camino colegio viaja en la cookie", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true });
            mocks.derivarPasoPendienteColegio.mockResolvedValue("profesores");
            const value = await buildSesionEstadoValue("u1");
            expect(JSON.parse(value).pasoCamino).toBe("profesores");
            expect(mocks.derivarPasoPendienteColegio).toHaveBeenCalledWith("u1");
            // Y NO se llamó el derivador del padre.
            expect(mocks.derivarPasoPendiente).not.toHaveBeenCalled();
        });

        it("SCHOOL_ADMIN con camino terminado: pasoCamino = null", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true });
            mocks.derivarPasoPendienteColegio.mockResolvedValue(null);
            const value = await buildSesionEstadoValue("u1");
            expect(JSON.parse(value).pasoCamino).toBeNull();
        });

        // Los roles internos y COMITE_CONVIVENCIA siguen SIN camino. Esta
        // aserción se conserva idéntica a SPEC-339: cualquier futura evolución
        // que la rompa es una regresión real.
        for (const rol of ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA"]) {
            it(`${rol}: NUNCA se deriva el camino (ni una consulta de más)`, async () => {
                setup({ rol });
                const value = await buildSesionEstadoValue("u1");
                expect(JSON.parse(value).pasoCamino).toBeNull();
                expect(mocks.derivarPasoPendiente).not.toHaveBeenCalled();
                expect(mocks.derivarPasoPendienteColegio).not.toHaveBeenCalled();
            });
        }
    });
});
