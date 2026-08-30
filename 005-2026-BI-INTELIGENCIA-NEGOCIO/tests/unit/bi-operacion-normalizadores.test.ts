import { describe, it, expect } from "vitest";
import {
    claseEstadoPersona,
    claseTag,
    anchoBarra,
    mostrar,
} from "@/lib/bi/operacion";

describe("claseEstadoPersona", () => {
    it("mapea los 4 enums conocidos", () => {
        expect(claseEstadoPersona("libre")).toBe("libre");
        expect(claseEstadoPersona("en_proceso")).toBe("proceso");
        expect(claseEstadoPersona("ocupado")).toBe("ocupado");
        expect(claseEstadoPersona("sin_sesion")).toBe("off");
    });
    it("desconocido / null → off", () => {
        expect(claseEstadoPersona("congelado")).toBe("off");
        expect(claseEstadoPersona(null)).toBe("off");
        expect(claseEstadoPersona(undefined)).toBe("off");
    });
});

describe("claseTag", () => {
    it("mapea las etiquetas conocidas", () => {
        expect(claseTag("Cumple")).toBe("ok");
        expect(claseTag("Parcial")).toBe("mid");
        expect(claseTag("Sin probar")).toBe("bad");
        expect(claseTag("Bloqueado")).toBe("bad");
    });
    it("desconocido → neutro, null/'' → null", () => {
        expect(claseTag("Otra cosa")).toBe("neutro");
        expect(claseTag(null)).toBeNull();
        expect(claseTag("")).toBeNull();
        expect(claseTag(undefined)).toBeNull();
    });
});

describe("anchoBarra", () => {
    it("calcula el porcentaje redondeado", () => {
        expect(anchoBarra({ hechos: 5, total: 8 })).toBe(63);
        expect(anchoBarra({ hechos: 10, total: 10 })).toBe(100);
        expect(anchoBarra({ hechos: 0, total: 3 })).toBe(0);
    });
    it("sin división por cero: total 0 → 0", () => {
        expect(anchoBarra({ hechos: 0, total: 0 })).toBe(0);
        expect(anchoBarra({ hechos: 5, total: 0 })).toBe(0);
    });
    it("avance null/undefined → 0", () => {
        expect(anchoBarra(null)).toBe(0);
        expect(anchoBarra(undefined)).toBe(0);
    });
});

describe("mostrar", () => {
    it("null/'' → guion largo", () => {
        expect(mostrar(null)).toBe("—");
        expect(mostrar("")).toBe("—");
        expect(mostrar(undefined)).toBe("—");
    });
    it("valores → String(v)", () => {
        expect(mostrar("3 h")).toBe("3 h");
        expect(mostrar("30-08-2026 06:00")).toBe("30-08-2026 06:00");
        expect(mostrar(0)).toBe("0");
    });
});
