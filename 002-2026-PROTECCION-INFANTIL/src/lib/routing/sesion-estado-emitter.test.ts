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
    requiereConsentimiento: vi.fn(),
    verificarVigencia: vi.fn(),
    firmarSesionEstado: vi.fn(async (payload: unknown) => JSON.stringify(payload)),
    requireEnv: vi.fn(() => "test-secret-de-32-chars-o-mas!!"),
}));

vi.mock("@/lib/dal/repositories/pagos-repository", () => ({
    PagosRepository: vi.fn().mockImplementation(() => ({
        obtenerSuscripcionActivaPorUsuarioId: mocks.obtenerSuscripcion,
    })),
}));

vi.mock("@/lib/dal/repositories/usuario", () => ({
    UsuarioRepository: vi.fn().mockImplementation(() => ({
        findDebeCambiarPassword: mocks.findDebeCambiarPassword,
    })),
}));

vi.mock("@/lib/consentimiento/guard", () => ({
    requiereConsentimientoActual: mocks.requiereConsentimiento,
}));

vi.mock("@/lib/colegio/vigencia", () => ({
    verificarVigenciaCliente: mocks.verificarVigencia,
}));

vi.mock("@/lib/routing/vigencia-cookie", () => ({
    firmarSesionEstado: mocks.firmarSesionEstado,
}));

vi.mock("@/lib/env", () => ({
    requireEnv: mocks.requireEnv,
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
    mocks.findDebeCambiarPassword.mockResolvedValue({ debeCambiarPassword, rol });
    mocks.requiereConsentimiento.mockResolvedValue(false);
    mocks.obtenerSuscripcion.mockResolvedValue(
        suscripcionEstado ? { estado: suscripcionEstado } : null
    );
    mocks.verificarVigencia.mockResolvedValue({
        vigente,
        estado: vigente ? "vigente" : "vencido",
        mensaje: "",
    });
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
            expect(mocks.verificarVigencia).toHaveBeenCalledWith("uid-1");
        });

        it("vencido → SUSPENDIDA en cookie (gateado por middleware)", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: false });
            const cookie = await buildSesionEstadoValue("uid-1");
            expect(JSON.parse(cookie).vigencia).toBe("SUSPENDIDA");
        });

        it("delega en verificarVigenciaCliente, no en suscripción", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true });
            await buildSesionEstadoValue("uid-1");
            expect(mocks.verificarVigencia).toHaveBeenCalledTimes(1);
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
            expect(mocks.verificarVigencia).not.toHaveBeenCalled();
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
                expect(mocks.verificarVigencia).not.toHaveBeenCalled();
            }
        );
    });

    describe("Flags adicionales — no regresiones", () => {
        it("debeCambiarPassword se propaga correctamente para SCHOOL_ADMIN", async () => {
            setup({ rol: "SCHOOL_ADMIN", vigente: true, debeCambiarPassword: true });
            expect(JSON.parse(await buildSesionEstadoValue("uid-5")).debeCambiarPassword).toBe(true);
        });
    });
});
