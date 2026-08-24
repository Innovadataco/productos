/**
 * SPEC-221 (002-PI-122): tests unitarios del renderer de plantillas.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderPlantilla } from "./plantilla";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("renderPlantilla", () => {
    it("sustituye variables y separa título (primera línea) de descripción", () => {
        const r = renderPlantilla(
            "Llamar a {{cliente}} · vence {{fecha_fin}}\nEl plan {{plan}} vence en {{dias}} días.",
            { cliente: "Colegio San José", fecha_fin: "2026-08-31", plan: "Anual", dias: 5 }
        );
        expect(r.titulo).toBe("Llamar a Colegio San José · vence 2026-08-31");
        expect(r.descripcion).toBe("El plan Anual vence en 5 días.");
        expect(r.variablesAusentes).toEqual([]);
    });

    it("deja el placeholder visible cuando la variable no está en la fila y loguea warning", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const r = renderPlantilla("Hola {{cliente}}", {});
        expect(r.titulo).toBe("Hola {{cliente}}");
        expect(r.variablesAusentes).toEqual(["cliente"]);
        expect(warn).toHaveBeenCalledOnce();
    });

    it("tolera espacios dentro del placeholder y convierte tipos", () => {
        const r = renderPlantilla("{{ a }}/{{b}}/{{c}}/{{d}}", {
            a: 42,
            b: true,
            c: new Date("2026-08-24T10:00:00Z"),
            d: null,
        });
        expect(r.titulo).toBe("42/true/2026-08-24/");
    });

    it("plantilla de una sola línea deja descripción vacía", () => {
        const r = renderPlantilla("Solo título {{x}}", { x: "!" });
        expect(r.titulo).toBe("Solo título !");
        expect(r.descripcion).toBe("");
    });

    it("ignora líneas vacías antes del título", () => {
        const r = renderPlantilla("\n\nTítulo\ncuerpo", {});
        expect(r.titulo).toBe("Título");
        expect(r.descripcion).toBe("cuerpo");
    });
});
