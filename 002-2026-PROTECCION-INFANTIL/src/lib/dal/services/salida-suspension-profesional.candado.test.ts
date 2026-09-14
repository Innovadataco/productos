/**
 * SPEC-692 (I-417) · CANDADO DE CLASE — ningún estado que BLOQUEE a un usuario
 * queda sin una SALIDA escrita en código.
 *
 * El estado SUSPENDIDO del perfil profesional lo pone el worker de forma
 * automática (vencimientos seguidos) y, hasta esta SPEC, NADA lo sacaba — con
 * SPEC-690 eso bloquea al profesional para siempre. Este candado empareja la
 * ENTRADA con la SALIDA:
 *   · conducta — `levantarSuspension` saca de SUSPENDIDO a ACTIVO (vigente) o
 *     VENCIDO (no vigente), exige motivo y audita;
 *   · estructura — quien ENTRA a SUSPENDIDO (`cita.service`) tiene enfrente una
 *     SALIDA escrita y ALCANZABLE (servicio + ruta de administrador).
 *
 * Muere por mutación: si `levantarSuspension` deja de transicionar, o de exigir
 * motivo, o si se borra la ruta de salida, cae.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const { findPorUsuarioId, venceEnVigente, cambiarEstado, logAudit } = vi.hoisted(() => ({
    findPorUsuarioId: vi.fn(),
    venceEnVigente: vi.fn(),
    cambiarEstado: vi.fn(),
    logAudit: vi.fn(),
}));

vi.mock("../repositories/perfil-profesional", () => ({
    PerfilProfesionalRepository: class {
        findPorUsuarioId = findPorUsuarioId;
        venceEnVigente = venceEnVigente;
        cambiarEstado = cambiarEstado;
    },
}));
vi.mock("../repositories/usuario", () => ({ UsuarioRepository: class {} }));
vi.mock("../repositories/token-registro", () => ({ TokenRegistroRepository: class {} }));
vi.mock("@/lib/audit", () => ({ logAudit }));

import { ProfesionalesAdminService, estadoTrasLevantarSuspension } from "./profesionales-admin";

const ADMIN = { id: "admin-1", ipAddress: "1.2.3.4", userAgent: "test" };
const MANANA = new Date(Date.now() + 86_400_000);
const AYER = new Date(Date.now() - 86_400_000);

beforeEach(() => vi.clearAllMocks());

describe("SPEC-692 · SUSPENDIDO tiene salida (conducta)", () => {
    it("SUSPENDIDO + verificación vigente → ACTIVO, con motivo y auditoría", async () => {
        findPorUsuarioId.mockResolvedValue({ id: "p1", estado: "SUSPENDIDO" });
        venceEnVigente.mockResolvedValue(MANANA);
        const r = await new ProfesionalesAdminService().levantarSuspension("u1", ADMIN, "revisado a mano");
        expect(r).toEqual({ estado: "ACTIVO" });
        expect(cambiarEstado).toHaveBeenCalledWith("p1", "ACTIVO");
        expect(logAudit).toHaveBeenCalledTimes(1);
        expect(String(logAudit.mock.calls[0][0].valorNuevo)).toContain("revisado a mano");
    });

    it("SUSPENDIDO + verificación vencida → VENCIDO (no se reactiva a quien perdió la vigencia)", async () => {
        findPorUsuarioId.mockResolvedValue({ id: "p1", estado: "SUSPENDIDO" });
        venceEnVigente.mockResolvedValue(AYER);
        const r = await new ProfesionalesAdminService().levantarSuspension("u1", ADMIN, "motivo");
        expect(r).toEqual({ estado: "VENCIDO" });
        expect(cambiarEstado).toHaveBeenCalledWith("p1", "VENCIDO");
    });

    it("SUSPENDIDO sin ninguna verificación aprobada (null) → VENCIDO", async () => {
        findPorUsuarioId.mockResolvedValue({ id: "p1", estado: "SUSPENDIDO" });
        venceEnVigente.mockResolvedValue(null);
        const r = await new ProfesionalesAdminService().levantarSuspension("u1", ADMIN, "motivo");
        expect(r.estado).toBe("VENCIDO");
    });

    it("motivo vacío → rechaza y NO cambia el estado", async () => {
        await expect(new ProfesionalesAdminService().levantarSuspension("u1", ADMIN, "   ")).rejects.toMatchObject({
            statusCode: 400,
        });
        expect(cambiarEstado).not.toHaveBeenCalled();
    });

    it("no está SUSPENDIDO (p. ej. ACTIVO) → rechaza (409) y NO cambia el estado", async () => {
        findPorUsuarioId.mockResolvedValue({ id: "p1", estado: "ACTIVO" });
        await expect(new ProfesionalesAdminService().levantarSuspension("u1", ADMIN, "motivo")).rejects.toMatchObject({
            statusCode: 409,
        });
        expect(cambiarEstado).not.toHaveBeenCalled();
    });
});

describe("SPEC-692 · la entrada a SUSPENDIDO está emparejada con una salida (estructura)", () => {
    const CITA = readFileSync(resolve(__dirname, "../../profesional/cita/cita.service.ts"), "utf-8");
    const SVC = readFileSync(resolve(__dirname, "profesionales-admin.ts"), "utf-8");
    const RUTA_SALIDA = resolve(
        __dirname,
        "../../../app/api/admin/profesionales/[id]/levantar-suspension/route.ts",
    );

    it("existe quien ENTRA a SUSPENDIDO (el worker de citas)", () => {
        expect(CITA).toMatch(/cambiarEstado\([^,]+,\s*"SUSPENDIDO"\)/);
    });

    it("existe la SALIDA en código: servicio que transiciona fuera de SUSPENDIDO", () => {
        expect(SVC).toMatch(/async levantarSuspension\(/);
        expect(SVC).toMatch(/cambiarEstado\(perfil\.id, estado\)/);
    });

    it("la salida es ALCANZABLE: hay ruta de administrador para levantarla", () => {
        expect(existsSync(RUTA_SALIDA), "falta POST /api/admin/profesionales/[id]/levantar-suspension").toBe(true);
    });
});

describe("SPEC-692 · la vista previa y la acción salen de la MISMA función", () => {
    it("estadoTrasLevantarSuspension: vigente → ACTIVO; vencida o ausente → VENCIDO", () => {
        expect(estadoTrasLevantarSuspension(new Date(Date.now() + 60_000))).toBe("ACTIVO");
        expect(estadoTrasLevantarSuspension(new Date(Date.now() - 60_000))).toBe("VENCIDO");
        expect(estadoTrasLevantarSuspension(null)).toBe("VENCIDO");
    });

    it("la vista previa (listar) y la acción (levantarSuspension) invocan la MISMA función — no dos cuentas", () => {
        const SVC = readFileSync(resolve(__dirname, "profesionales-admin.ts"), "utf-8");
        // Ambas ramas llaman `estadoTrasLevantarSuspension(venceEn)`; si alguien
        // inlinea el cálculo de la preview, esta cuenta cae por debajo de 2 → rojo,
        // que es cuando el modal podría anunciar algo distinto de lo que produce.
        const invocaciones = (SVC.match(/estadoTrasLevantarSuspension\(venceEn\)/g) || []).length;
        expect(invocaciones, "preview y acción deben salir de la misma función").toBeGreaterThanOrEqual(2);
    });
});
