/**
 * SPEC-750 · unit del solape de ventanas (el núcleo de la SIMULTANEIDAD). Sin BD.
 * El candado de conducta de la asignación (rechazo real contra la BD) vive en
 * `sesion-operador.candado.test.ts` (integración).
 */
import { describe, it, expect } from "vitest";
import { ventanasSolapan } from "./simultaneidad";

const t = (iso: string) => new Date(iso);

describe("ventanasSolapan · [inicio, fin) medio-abierto", () => {
    it("solapan cuando una empieza dentro de la otra", () => {
        expect(
            ventanasSolapan(t("2026-09-20T10:00:00Z"), t("2026-09-20T10:50:00Z"), t("2026-09-20T10:30:00Z"), t("2026-09-20T11:20:00Z")),
        ).toBe(true);
    });
    it("solapan cuando una contiene a la otra", () => {
        expect(
            ventanasSolapan(t("2026-09-20T10:00:00Z"), t("2026-09-20T12:00:00Z"), t("2026-09-20T10:20:00Z"), t("2026-09-20T10:40:00Z")),
        ).toBe(true);
    });
    it("NO solapan cuando se tocan en el borde (fin == inicio)", () => {
        expect(
            ventanasSolapan(t("2026-09-20T10:00:00Z"), t("2026-09-20T10:50:00Z"), t("2026-09-20T10:50:00Z"), t("2026-09-20T11:40:00Z")),
        ).toBe(false);
    });
    it("NO solapan cuando son disjuntas", () => {
        expect(
            ventanasSolapan(t("2026-09-20T10:00:00Z"), t("2026-09-20T10:50:00Z"), t("2026-09-20T12:00:00Z"), t("2026-09-20T12:50:00Z")),
        ).toBe(false);
    });
});
