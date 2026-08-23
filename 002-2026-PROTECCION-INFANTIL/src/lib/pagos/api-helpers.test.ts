/**
 * SPEC-212/214: tests unitarios de helpers de endpoints de pagos.
 */
import { describe, it, expect } from "vitest";
import { getClientInfo, paginatedResponse } from "./api-helpers";

describe("getClientInfo", () => {
    it("extrae ip de x-forwarded-for", () => {
        const request = new Request("http://localhost/api", { headers: { "x-forwarded-for": "1.2.3.4" } });
        expect(getClientInfo(request).ipAddress).toBe("1.2.3.4");
    });

    it("usa x-real-ip como fallback", () => {
        const request = new Request("http://localhost/api", { headers: { "x-real-ip": "5.6.7.8" } });
        expect(getClientInfo(request).ipAddress).toBe("5.6.7.8");
    });

    it("retorna unknown cuando no hay headers de IP", () => {
        const request = new Request("http://localhost/api");
        expect(getClientInfo(request).ipAddress).toBe("unknown");
        expect(getClientInfo(request).userAgent).toBe("unknown");
    });
});

describe("paginatedResponse", () => {
    it("arma la respuesta paginada correctamente", () => {
        const resultado = paginatedResponse([{ id: 1 }], 2, 10, 25);
        expect(resultado).toEqual({
            items: [{ id: 1 }],
            pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 },
        });
    });
});
