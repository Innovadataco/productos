// tests/unit/bi-audit.test.ts · Bitácora general de BI (SPEC-006 · 2026-09-02)
// Cubre registrarEventoAudit: escribe la fila con detalle JSON serializado,
// acepta evento sin detalle (null), y es FAIL-OPEN — si prisma falla, no
// lanza excepción (el flujo principal jamás se rompe por la bitácora) y el
// error queda en console.error. Unitarios puros: sin BD, sin red.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        bIAuditLog: { create: mocks.auditLogCreate },
    },
}));

import { registrarEventoAudit, ACCION_AUDIT } from "@/lib/bitacora/audit";

describe("registrarEventoAudit · bitácora general", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auditLogCreate.mockResolvedValue({});
    });

    it("escribe accion + email + detalle serializado como JSON", async () => {
        await registrarEventoAudit({
            accion: ACCION_AUDIT.CONFIG_CAMBIO,
            email: "jelkin@innovadataco.com",
            detalle: { clave: "ia.ollama.modelo_sql", valorNuevo: "qwen2.5:14b" },
        });

        expect(mocks.auditLogCreate).toHaveBeenCalledWith({
            data: {
                accion: "CONFIG_CAMBIO",
                email: "jelkin@innovadataco.com",
                detalle: JSON.stringify({ clave: "ia.ollama.modelo_sql", valorNuevo: "qwen2.5:14b" }),
            },
        });
    });

    it("sin detalle → detalle null (nunca undefined ni string vacío)", async () => {
        await registrarEventoAudit({
            accion: ACCION_AUDIT.LOGIN_OK,
            email: "soportebi@innovadataco.com",
        });

        expect(mocks.auditLogCreate).toHaveBeenCalledWith({
            data: {
                accion: "LOGIN_OK",
                email: "soportebi@innovadataco.com",
                detalle: null,
            },
        });
    });

    it("LOGIN_FALLIDO registra el email intentado", async () => {
        await registrarEventoAudit({
            accion: ACCION_AUDIT.LOGIN_FALLIDO,
            email: "intruso@example.com",
        });

        expect(mocks.auditLogCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ accion: "LOGIN_FALLIDO", email: "intruso@example.com" }),
            }),
        );
    });

    it("fail-open: si prisma falla NO lanza y reporta por console.error", async () => {
        const espiaError = vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.auditLogCreate.mockRejectedValue(new Error("relation bi_audit_log does not exist"));

        await expect(
            registrarEventoAudit({ accion: ACCION_AUDIT.LOGIN_OK, email: "a@b.co" }),
        ).resolves.toBeUndefined();

        expect(espiaError).toHaveBeenCalledOnce();
        expect(String(espiaError.mock.calls[0][0])).toContain("[Bitácora]");
        espiaError.mockRestore();
    });
});
