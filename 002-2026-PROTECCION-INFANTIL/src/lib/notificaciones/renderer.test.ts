/**
 * SPEC-201: tests del renderer de plantillas del motor de notificaciones.
 */
import { describe, it, expect } from "vitest";
import { renderizarPlantilla } from "./renderer";

describe("renderizarPlantilla", () => {
    it("reemplaza variables simples", () => {
        const result = renderizarPlantilla("Hola {{nombre}}", "Asunto {{nombre}}", { nombre: "Juan" });
        expect(result.cuerpo).toBe("Hola Juan");
        expect(result.asunto).toBe("Asunto Juan");
    });

    it("reemplaza múltiples variables", () => {
        const result = renderizarPlantilla(
            "Hola {{nombre}}, tu cita es {{fecha}} a las {{hora}}",
            null,
            { nombre: "Ana", fecha: "2026-08-22", hora: "10:00" }
        );
        expect(result.cuerpo).toBe("Hola Ana, tu cita es 2026-08-22 a las 10:00");
        expect(result.asunto).toBeNull();
    });

    it("deja vacío el token si la variable no existe", () => {
        const result = renderizarPlantilla("Hola {{nombre}}", null, {});
        expect(result.cuerpo).toBe("Hola ");
    });

    it("convierte valores no string a string", () => {
        const result = renderizarPlantilla("Cantidad: {{cantidad}}", null, { cantidad: 5 });
        expect(result.cuerpo).toBe("Cantidad: 5");
    });
});
