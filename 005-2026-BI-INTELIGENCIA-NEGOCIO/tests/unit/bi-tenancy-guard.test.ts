import { describe, it, expect } from "vitest";
import { evaluarTenancy } from "@/lib/bi/tenancy-guard";

describe("evaluarTenancy STUB (candado 11)", () => {
    it("ADMIN permite", () => {
        const r = evaluarTenancy({ id: "u1", rol: "ADMIN" });
        expect(r.permite).toBe(true);
    });

    it("SCHOOL_ADMIN niega con razón activacion_diferida", () => {
        const r = evaluarTenancy({ id: "u1", rol: "SCHOOL_ADMIN" });
        expect(r.permite).toBe(false);
        expect(r.razon).toContain("activacion_multi_tenant_diferida");
    });

    it("PARENT niega", () => {
        const r = evaluarTenancy({ id: "u1", rol: "PARENT" });
        expect(r.permite).toBe(false);
    });
});
