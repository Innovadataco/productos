import { describe, it, expect } from "vitest";
import { decidirAcciones, type PerfilCronInput, type VerificacionCronInput } from "./cron-vencimiento";

const AHORA = new Date("2026-06-01T00:00:00.000Z");
const DIA_MS = 24 * 60 * 60 * 1000;

function verif(overrides: Partial<VerificacionCronInput> & { id: string; perfilProfesionalId: string }): VerificacionCronInput {
    return {
        id: overrides.id,
        perfilProfesionalId: overrides.perfilProfesionalId,
        resultado: overrides.resultado ?? "APROBADO",
        revisadoEn: overrides.revisadoEn ?? new Date("2026-02-01T00:00:00.000Z"),
        venceEn: overrides.venceEn ?? new Date("2026-06-01T00:00:00.000Z"),
        avisoVencimientoEnviadoEn: overrides.avisoVencimientoEnviadoEn ?? null,
    };
}

function perfil(id: string, estado: PerfilCronInput["estado"] = "ACTIVO"): PerfilCronInput {
    return { id, estado };
}

describe("decidirAcciones — worker de vencimiento (SPEC-389)", () => {
    it("perfil sin verificaciones → no dispara nada (BORRADOR o similar)", () => {
        expect(decidirAcciones([perfil("p1")], new Map(), AHORA)).toEqual([]);
    });

    it("verificación con más de 30 días para vencer → sin acción", () => {
        const v = verif({
            id: "v1",
            perfilProfesionalId: "p1",
            venceEn: new Date(AHORA.getTime() + 45 * DIA_MS),
        });
        expect(decidirAcciones([perfil("p1")], new Map([["p1", [v]]]), AHORA)).toEqual([]);
    });

    it("verificación a exactamente 15 días → AVISAR_VENCIMIENTO", () => {
        const venceEn = new Date(AHORA.getTime() + 15 * DIA_MS);
        const v = verif({ id: "v1", perfilProfesionalId: "p1", venceEn });
        const acc = decidirAcciones([perfil("p1")], new Map([["p1", [v]]]), AHORA);
        expect(acc).toEqual([{ tipo: "AVISAR_VENCIMIENTO", verificacionId: "v1", perfilProfesionalId: "p1", venceEn }]);
    });

    // CANDADO I-280: sin idempotencia se manda un aviso por cada run del cron.
    it("aviso YA enviado → NO vuelve a avisar (idempotencia · candado I-280)", () => {
        const v = verif({
            id: "v1",
            perfilProfesionalId: "p1",
            venceEn: new Date(AHORA.getTime() + 15 * DIA_MS),
            avisoVencimientoEnviadoEn: new Date("2026-05-20T00:00:00.000Z"),
        });
        expect(decidirAcciones([perfil("p1")], new Map([["p1", [v]]]), AHORA)).toEqual([]);
    });

    it("verificación ya vencida + perfil ACTIVO → MARCAR_VENCIDO (sin aviso)", () => {
        const v = verif({
            id: "v1",
            perfilProfesionalId: "p1",
            venceEn: new Date(AHORA.getTime() - 1 * DIA_MS),
        });
        expect(decidirAcciones([perfil("p1", "ACTIVO")], new Map([["p1", [v]]]), AHORA)).toEqual([
            { tipo: "MARCAR_VENCIDO", perfilProfesionalId: "p1", ultimaVerificacionId: "v1" },
        ]);
    });

    it("verificación vencida + perfil YA VENCIDO → sin acción (idempotencia del auto-vence)", () => {
        const v = verif({
            id: "v1",
            perfilProfesionalId: "p1",
            venceEn: new Date(AHORA.getTime() - 5 * DIA_MS),
        });
        expect(decidirAcciones([perfil("p1", "VENCIDO")], new Map([["p1", [v]]]), AHORA)).toEqual([]);
    });

    it("cuando hay varias aprobaciones, gana la MÁS RECIENTE para la decisión", () => {
        const vieja = verif({
            id: "v1",
            perfilProfesionalId: "p1",
            revisadoEn: new Date("2026-01-01T00:00:00.000Z"),
            venceEn: new Date("2026-05-01T00:00:00.000Z"),
        });
        const nueva = verif({
            id: "v2",
            perfilProfesionalId: "p1",
            revisadoEn: new Date("2026-04-15T00:00:00.000Z"),
            venceEn: new Date(AHORA.getTime() + 14 * DIA_MS),
        });
        const acc = decidirAcciones([perfil("p1")], new Map([["p1", [vieja, nueva]]]), AHORA);
        expect(acc).toHaveLength(1);
        expect(acc[0]).toMatchObject({ tipo: "AVISAR_VENCIMIENTO", verificacionId: "v2" });
    });

    it("rechazos y mas-info se ignoran (solo APROBADO cuenta para la decisión)", () => {
        const rechazo = verif({
            id: "v1",
            perfilProfesionalId: "p1",
            resultado: "RECHAZADO",
            venceEn: new Date(AHORA.getTime() + 15 * DIA_MS),
        });
        expect(decidirAcciones([perfil("p1")], new Map([["p1", [rechazo]]]), AHORA)).toEqual([]);
    });

    it("procesa varios perfiles en un solo run", () => {
        const p1 = perfil("p1", "ACTIVO");
        const p2 = perfil("p2", "ACTIVO");
        const v1 = verif({ id: "v1", perfilProfesionalId: "p1", venceEn: new Date(AHORA.getTime() + 10 * DIA_MS) });
        const v2 = verif({ id: "v2", perfilProfesionalId: "p2", venceEn: new Date(AHORA.getTime() - 1 * DIA_MS) });
        const acc = decidirAcciones([p1, p2], new Map([["p1", [v1]], ["p2", [v2]]]), AHORA);
        expect(acc).toHaveLength(2);
        expect(acc.find((a) => a.tipo === "AVISAR_VENCIMIENTO")).toBeDefined();
        expect(acc.find((a) => a.tipo === "MARCAR_VENCIDO")).toBeDefined();
    });
});
