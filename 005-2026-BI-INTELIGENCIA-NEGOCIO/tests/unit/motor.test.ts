import { describe, it, expect, vi } from "vitest";
import { preguntarVanna } from "@/lib/bi/motor";

describe("preguntarVanna (stub Fase 1)", () => {
    it("retorna el string stub sin llamar a ningún host externo", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const result = await preguntarVanna("¿cuántos reportes hay este mes?");
        expect(result).toBe("Motor BI no disponible aún · Fase 2");
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it("retorna el mismo stub para cualquier pregunta", async () => {
        const result = await preguntarVanna("");
        expect(result).toBe("Motor BI no disponible aún · Fase 2");
    });
});
