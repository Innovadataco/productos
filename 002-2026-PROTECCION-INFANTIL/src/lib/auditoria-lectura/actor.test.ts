import { describe, it, expect } from "vitest";
import { conActor, actorActual, actorDesdeRequest } from "./actor";

describe("SPEC-584 · hilo conductor del actor de lectura (ALS)", () => {
    it("expone el actor dentro del contexto y lo oculta fuera", async () => {
        expect(actorActual()).toBeUndefined();
        const vistoDentro = await conActor({ usuarioId: "u1", rol: "OPERADOR" }, async () => {
            await new Promise((r) => setTimeout(r, 5)); // cruza límites async
            return actorActual();
        });
        expect(vistoDentro).toEqual({ usuarioId: "u1", rol: "OPERADOR" });
        expect(actorActual()).toBeUndefined();
    });

    it("aisla contextos anidados: el interno no filtra al externo", async () => {
        const externo = conActor({ usuarioId: "ext" }, async () => {
            const interno = await conActor({ usuarioId: "int" }, async () => actorActual());
            return { interno, despues: actorActual() };
        });
        expect((await externo).interno?.usuarioId).toBe("int");
        expect((await externo).despues?.usuarioId).toBe("ext");
    });

    it("propaga el actor a promesas en paralelo dentro del contexto", async () => {
        const ids = await conActor({ usuarioId: "par" }, async () =>
            Promise.all([1, 2, 3].map(async () => actorActual()?.usuarioId))
        );
        expect(ids).toEqual(["par", "par", "par"]);
    });

    it("actorDesdeRequest extrae ip (x-forwarded-for) y user-agent", () => {
        const req = new Request("http://localhost/api/x", {
            headers: {
                "x-forwarded-for": "1.2.3.4, 5.6.7.8",
                "user-agent": "vitest",
            },
        });
        const actor = actorDesdeRequest({ id: "u9", rol: "ADMIN" }, req);
        expect(actor).toEqual({ usuarioId: "u9", rol: "ADMIN", ip: "1.2.3.4", userAgent: "vitest" });
    });

    it("actorDesdeRequest sin headers de red deja ip/userAgent ausentes", () => {
        const actor = actorDesdeRequest({ id: "u9", rol: "PARENT" }, new Request("http://localhost/api/x"));
        expect(actor).toEqual({ usuarioId: "u9", rol: "PARENT" });
    });
});
