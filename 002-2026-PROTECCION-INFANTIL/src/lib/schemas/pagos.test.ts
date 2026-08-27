/**
 * SPEC-212/214: tests unitarios de esquemas Zod del módulo de pagos.
 */
import { describe, it, expect } from "vitest";
import {
    pagosQuerySchema,
    pagosVencimientosQuerySchema,
    pagosMoraQuerySchema,
    pagosBonoBodySchema,
    pagosBonoUpdateSchema,
    pagosPlanCreateSchema,
    pagosPlanUpdateSchema,
    pagosReembolsoBodySchema,
    pagosExtenderBodySchema,
    pagosTasaManualBodySchema,
    pagosAplicarBonoBodySchema,
} from "./pagos";

const fechaInicio = new Date().toISOString();
const fechaFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

describe("pagosQuerySchema", () => {
    it("aplica valores por defecto", () => {
        const resultado = pagosQuerySchema.parse({});
        expect(resultado).toEqual({ page: 1, pageSize: 25 });
    });

    it("respeta q cuando es válido", () => {
        const resultado = pagosQuerySchema.parse({ q: "busqueda" });
        expect(resultado.q).toBe("busqueda");
    });

    it("rechaza q muy corto", () => {
        expect(() => pagosQuerySchema.parse({ q: "a" })).toThrow();
    });

    it("rechama pageSize mayor a 100", () => {
        expect(() => pagosQuerySchema.parse({ pageSize: "101" })).toThrow();
    });
});

describe("pagosVencimientosQuerySchema", () => {
    it("acepta días dentro del rango", () => {
        const resultado = pagosVencimientosQuerySchema.parse({ dias: "15" });
        expect(resultado.dias).toBe(15);
    });

    it("rechaza días fuera del rango", () => {
        expect(() => pagosVencimientosQuerySchema.parse({ dias: "91" })).toThrow();
    });
});

describe("pagosMoraQuerySchema", () => {
    it("acepta estado opcional", () => {
        const resultado = pagosMoraQuerySchema.parse({ estado: "EN_GRACIA" });
        expect(resultado.estado).toBe("EN_GRACIA");
    });

    it("rechaza estado desconocido", () => {
        expect(() => pagosMoraQuerySchema.parse({ estado: "ACTIVA" })).toThrow();
    });
});

describe("pagosBonoBodySchema", () => {
    const bonoValido = {
        nombre: "Bono de prueba",
        tipo: "DESCUENTO_PCT",
        valor: 20,
        vigenciaInicio: fechaInicio,
        vigenciaFin: fechaFin,
    };

    it("acepta un bono válido", () => {
        const resultado = pagosBonoBodySchema.parse(bonoValido);
        expect(resultado.nombre).toBe("Bono de prueba");
        expect(resultado.aplicaANuevos).toBe(true);
    });

    it("rechaza nombre corto", () => {
        expect(() => pagosBonoBodySchema.parse({ ...bonoValido, nombre: "X" })).toThrow();
    });

    it("rechaza tipo desconocido", () => {
        expect(() => pagosBonoBodySchema.parse({ ...bonoValido, tipo: "DESCUENTO_RARO" })).toThrow();
    });

    it("rechaza valor no positivo", () => {
        expect(() => pagosBonoBodySchema.parse({ ...bonoValido, valor: 0 })).toThrow();
    });

    it("aplica los valores por defecto de un bono nuevo", () => {
        const resultado = pagosBonoBodySchema.parse(bonoValido);
        expect(resultado.aplicaANuevos).toBe(true);
        expect(resultado.aplicaARenovaciones).toBe(false);
        expect(resultado.usosMaximosPorCliente).toBe(1);
        expect(resultado.combinableConCodigoPersonal).toBe(false);
    });
});

describe("pagosBonoUpdateSchema", () => {
    it("acepta actualización parcial", () => {
        const resultado = pagosBonoUpdateSchema.parse({ nombre: "Nuevo nombre" });
        expect(resultado.nombre).toBe("Nuevo nombre");
    });

    it("aplica valores por defecto en actualización parcial", () => {
        const resultado = pagosBonoUpdateSchema.parse({});
        expect(resultado.aplicaANuevos).toBe(true);
    });

    it("rechaza valor no positivo en actualización parcial", () => {
        expect(() => pagosBonoUpdateSchema.parse({ valor: -5 })).toThrow();
    });
});

describe("pagosPlanCreateSchema (SPEC-254)", () => {
    const baseValido = {
        nombre: "Plan de prueba",
        precioBaseCOP: 0,
        precioBaseUSD: 0,
        duracion: "MES_3",
        tipoTitular: "PADRE",
        esFreemium: true,
        usosMaximosPorCliente: 1,
    };

    it("acepta precioBaseUSD: 0 (body real de PlanesAdminCRUD)", () => {
        const resultado = pagosPlanCreateSchema.parse(baseValido);
        expect(resultado.precioBaseUSD).toBe(0);
    });

    it("acepta precioBaseUSD omitido — default 0 (SPEC-289 Fase 1)", () => {
        const { precioBaseUSD: _, ...sinUSD } = baseValido;
        const resultado = pagosPlanCreateSchema.parse(sinUSD);
        expect(resultado.precioBaseUSD).toBe(0);
    });

    it("rechaza precioBaseUSD negativo", () => {
        expect(() => pagosPlanCreateSchema.parse({ ...baseValido, precioBaseUSD: -1 })).toThrow();
    });

    // SPEC-289 (002-PI-189 · Fase 1): SC-005/SC-006
    it("SPEC-289 SC-005: create sin USD, con COP positivo → OK con precioBaseUSD=0 por default", () => {
        const resultado = pagosPlanCreateSchema.parse({
            nombre: "Colegio Anual COP",
            precioBaseCOP: 50000,
            duracion: "MES_12",
            tipoTitular: "COLEGIO",
            esFreemium: false,
        });
        expect(resultado.precioBaseUSD).toBe(0);
        expect(resultado.precioBaseCOP).toBe(50000);
    });

    it("SPEC-289 SC-006: no-freemium con precioBaseCOP=0 → error", () => {
        expect(() =>
            pagosPlanCreateSchema.parse({
                nombre: "Malo",
                precioBaseCOP: 0,
                duracion: "MES_12",
                tipoTitular: "COLEGIO",
                esFreemium: false,
            }),
        ).toThrow();
    });
});

describe("pagosPlanUpdateSchema", () => {
    it("acepta actualización de precio", () => {
        const resultado = pagosPlanUpdateSchema.parse({ precioBaseUSD: 99 });
        expect(resultado.precioBaseUSD).toBe(99);
    });

    it("acepta descuento anual nulo", () => {
        const resultado = pagosPlanUpdateSchema.parse({ descuentoAnualPct: null });
        expect(resultado.descuentoAnualPct).toBeNull();
    });

    it("rechaza descuento mayor a 100", () => {
        expect(() => pagosPlanUpdateSchema.parse({ descuentoAnualPct: 101 })).toThrow();
    });

    it("rechaza payload vacío", () => {
        expect(() => pagosPlanUpdateSchema.parse({})).toThrow();
    });
});

describe("pagosReembolsoBodySchema", () => {
    const datosValidos = {
        montoReembolsoUSD: 10,
        motivoReembolso: "Solicitud del cliente",
        referenciaReembolso: "REF-123",
    };

    it("acepta datos de reembolso válidos", () => {
        const resultado = pagosReembolsoBodySchema.parse(datosValidos);
        expect(resultado.montoReembolsoUSD).toBe(10);
    });

    it("rechaza motivo corto", () => {
        expect(() => pagosReembolsoBodySchema.parse({ ...datosValidos, motivoReembolso: "corto" })).toThrow();
    });
});

describe("pagosExtenderBodySchema", () => {
    const datosValidos = {
        nuevaFechaFin: fechaFin,
        motivo: "Compensación por falla de servicio",
    };

    it("acepta extensión válida", () => {
        const resultado = pagosExtenderBodySchema.parse(datosValidos);
        expect(resultado.motivo).toBe(datosValidos.motivo);
    });

    it("rechaza motivo corto", () => {
        expect(() => pagosExtenderBodySchema.parse({ ...datosValidos, motivo: "x" })).toThrow();
    });

    it("rechaza fecha de finalización no válida", () => {
        expect(() => pagosExtenderBodySchema.parse({ ...datosValidos, nuevaFechaFin: "no-es-fecha" })).toThrow();
    });
});

describe("pagosTasaManualBodySchema", () => {
    const datosValidos = {
        monedaDestino: "cop",
        tasa: 4000,
        motivoManual: "Ajuste manual por política comercial",
    };

    it("acepta tasa manual válida y normaliza moneda a mayúsculas", () => {
        const resultado = pagosTasaManualBodySchema.parse(datosValidos);
        expect(resultado.monedaDestino).toBe("COP");
        expect(resultado.tasa).toBe(4000);
    });

    it("rechaza moneda con longitud distinta a 3", () => {
        expect(() => pagosTasaManualBodySchema.parse({ ...datosValidos, monedaDestino: "COPO" })).toThrow();
    });

    it("rechaza motivo corto", () => {
        expect(() => pagosTasaManualBodySchema.parse({ ...datosValidos, motivoManual: "x" })).toThrow();
    });

    it("rechaza tasa no positiva", () => {
        expect(() => pagosTasaManualBodySchema.parse({ ...datosValidos, tasa: 0 })).toThrow();
    });
});

// SPEC-289 (002-PI-189 · Fase 1)
describe("pagosAplicarBonoBodySchema (SPEC-289)", () => {
    it("acepta montoBase canónico", () => {
        const r = pagosAplicarBonoBodySchema.parse({
            suscripcionId: "sus-1",
            bonoId: "bono-1",
            montoBase: 50000,
        });
        expect(r.montoBase).toBe(50000);
    });

    it("acepta montoBaseUSD legacy (shim retrocompatible)", () => {
        const r = pagosAplicarBonoBodySchema.parse({
            suscripcionId: "sus-1",
            bonoId: "bono-1",
            montoBaseUSD: 25,
        });
        expect(r.montoBaseUSD).toBe(25);
    });

    it("acepta ambos (canónico gana en el consumidor por convención)", () => {
        const r = pagosAplicarBonoBodySchema.parse({
            suscripcionId: "sus-1",
            bonoId: "bono-1",
            montoBase: 50000,
            montoBaseUSD: 25,
        });
        expect(r.montoBase).toBe(50000);
        expect(r.montoBaseUSD).toBe(25);
    });

    it("rechaza cuando ambos faltan o son 0", () => {
        expect(() =>
            pagosAplicarBonoBodySchema.parse({ suscripcionId: "sus-1", bonoId: "bono-1" }),
        ).toThrow();
    });
});
