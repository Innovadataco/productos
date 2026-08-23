/**
 * SPEC-214 (002-PI-114): tests unitarios del servicio de tasas de cambio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FuenteTasa } from "@prisma/client";
import { calcularMontoLocal, actualizarTasasDesdeAPI } from "./tasas";

const mockRepo = vi.hoisted(() => ({
    obtenerTasaCambioMasReciente: vi.fn(),
    crearTasaCambio: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/pagos-repository", () => ({
    PagosRepository: class {
        constructor() {
            return mockRepo as unknown as object;
        }
    },
}));

const parametrosMock = vi.hoisted(() => ({
    getParametroSistemaValor: vi.fn(),
}));

vi.mock("@/lib/parametros", () => ({
    getParametroSistemaValor: parametrosMock.getParametroSistemaValor,
}));

describe("calcularMontoLocal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("retorna null si no hay tasa para la moneda destino", async () => {
        mockRepo.obtenerTasaCambioMasReciente.mockResolvedValue(null);

        const resultado = await calcularMontoLocal(100, "COP");

        expect(resultado).toBeNull();
        expect(mockRepo.obtenerTasaCambioMasReciente).toHaveBeenCalledWith("COP");
    });

    it("calcula monto local y marca tasa como vigente", async () => {
        mockRepo.obtenerTasaCambioMasReciente.mockResolvedValue({
            id: "tasa-1",
            monedaDestino: "COP",
            tasa: 4000,
            fecha: new Date(),
        });

        const resultado = await calcularMontoLocal(50, "COP");

        expect(resultado).toEqual({
            montoLocal: 200000,
            tasaAplicada: 4000,
            desactualizada: false,
        });
    });

    it("marca tasa como desactualizada si tiene más de 24 horas", async () => {
        const fechaAntigua = new Date(Date.now() - 25 * 60 * 60 * 1000);
        mockRepo.obtenerTasaCambioMasReciente.mockResolvedValue({
            id: "tasa-2",
            monedaDestino: "COP",
            tasa: 4000,
            fecha: fechaAntigua,
        });

        const resultado = await calcularMontoLocal(10, "COP");

        expect(resultado?.desactualizada).toBe(true);
    });
});

describe("actualizarTasasDesdeAPI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        parametrosMock.getParametroSistemaValor.mockResolvedValue(null);
        mockRepo.crearTasaCambio.mockResolvedValue({ id: "nueva" });
    });

    function jsonResponse(body: unknown, status = 200) {
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }

    it("inserta tasas usando los valores por defecto", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse({ success: true, rates: { COP: 4000, MXN: 18, CLP: 880, ARS: 950 } }))
        );

        const resultado = await actualizarTasasDesdeAPI();

        expect(resultado.ok).toBe(true);
        expect(resultado.insertadas).toBe(4);
        expect(resultado.errores).toHaveLength(0);
        expect(mockRepo.crearTasaCambio).toHaveBeenCalledWith(
            expect.objectContaining({ monedaOrigen: "USD", monedaDestino: "COP", tasa: 4000, fuente: FuenteTasa.API })
        );
    });

    it("soporta el formato conversion_rates", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse({ conversion_rates: { COP: 4100 } }))
        );

        const resultado = await actualizarTasasDesdeAPI();

        expect(resultado.ok).toBe(true);
        expect(resultado.insertadas).toBeGreaterThanOrEqual(1);
        const llamadaCOP = mockRepo.crearTasaCambio.mock.calls.find((c) => c[0].monedaDestino === "COP");
        expect(llamadaCOP?.[0].tasa).toBe(4100);
    });

    it("usa parámetros de sistema cuando existen", async () => {
        parametrosMock.getParametroSistemaValor.mockImplementation((clave: string) => {
            if (clave === "pagos.tasas.api_url_default") return Promise.resolve("https://api.example.com/rates?symbols=");
            if (clave === "pagos.tasas.monedas_destino") return Promise.resolve("COP,MXN");
            return Promise.resolve(null);
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse({ rates: { COP: 3900, MXN: 19 } }))
        );

        const resultado = await actualizarTasasDesdeAPI();

        expect(resultado.apiUrl).toContain("api.example.com");
        expect(resultado.insertadas).toBe(2);
    });

    it("lanza error si la API responde con HTTP de error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "fail" }, 503)));

        await expect(actualizarTasasDesdeAPI()).rejects.toThrow("API de tasas respondió HTTP 503");
    });

    it("lanza error si el cuerpo no es JSON válido", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));

        await expect(actualizarTasasDesdeAPI()).rejects.toThrow("Respuesta de API de tasas inválida");
    });

    it("lanza error si el JSON no es un objeto", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("null", { status: 200 })));

        await expect(actualizarTasasDesdeAPI()).rejects.toThrow("Respuesta de API de tasas inválida");
    });

    it("lanza error si la respuesta no contiene rates", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true })));

        await expect(actualizarTasasDesdeAPI()).rejects.toThrow("Respuesta de API de tasas sin rates");
    });

    it("reporta errores parciales cuando una moneda no tiene tasa válida", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse({ rates: { COP: -1, MXN: 18, CLP: "n/a", ARS: 950 } }))
        );

        const resultado = await actualizarTasasDesdeAPI();

        expect(resultado.ok).toBe(true);
        expect(resultado.insertadas).toBe(2);
        expect(resultado.errores.length).toBeGreaterThanOrEqual(2);
    });

    it("reintenta una vez ante fallo de red y luego tiene éxito", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockRejectedValueOnce(new Error("network error"))
                .mockResolvedValue(jsonResponse({ rates: { COP: 4000 } }))
        );

        const resultado = await actualizarTasasDesdeAPI();

        expect(resultado.ok).toBe(true);
        expect(resultado.insertadas).toBeGreaterThanOrEqual(1);
    });

    it("falla tras agotar reintentos de red", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

        await expect(actualizarTasasDesdeAPI()).rejects.toThrow("network error");
    });
});
