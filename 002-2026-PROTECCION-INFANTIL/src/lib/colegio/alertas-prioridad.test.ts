import { describe, expect, it } from "vitest";
import { calcularPrioridadYSLA, CONFIG_DEFAULT } from "./alertas-prioridad";

const base = new Date("2026-08-12T12:00:00.000Z");

const altaClasificacion = {
    categoria: "SOLICITUD_ENCUENTRO" as const,
    confianza: 0.9,
    posibleAgresorPar: true,
};

const mediaClasificacion = {
    categoria: "SOLICITUD_MATERIAL" as const,
    confianza: 0.7,
    posibleAgresorPar: false,
};

const bajaClasificacion = {
    categoria: "OTRO" as const,
    confianza: 0.3,
    posibleAgresorPar: false,
};

describe("calcularPrioridadYSLA", () => {
    it("alerta crítica con match >= 3 → alta / SLA 24h", () => {
        const result = calcularPrioridadYSLA(base, altaClasificacion, { conteoAcumulado: 3, interCiudad: false });
        expect(result.prioridad).toBe("alta");
        expect(result.vencimientoSla.getTime()).toBe(base.getTime() + 24 * 60 * 60 * 1000);
    });

    it("alerta media sin match → media / SLA 48h", () => {
        const result = calcularPrioridadYSLA(base, mediaClasificacion, null);
        expect(result.prioridad).toBe("media");
        expect(result.vencimientoSla.getTime()).toBe(base.getTime() + 48 * 60 * 60 * 1000);
    });

    it("alerta baja → baja / SLA 72h", () => {
        const result = calcularPrioridadYSLA(base, bajaClasificacion, null);
        expect(result.prioridad).toBe("baja");
        expect(result.vencimientoSla.getTime()).toBe(base.getTime() + 72 * 60 * 60 * 1000);
    });

    it("sin clasificación ni match → baja", () => {
        const result = calcularPrioridadYSLA(base, null, null);
        expect(result.prioridad).toBe("baja");
    });

    it("inter-ciudad empuja media a alta", () => {
        const result = calcularPrioridadYSLA(base, mediaClasificacion, { conteoAcumulado: 2, interCiudad: true });
        expect(result.prioridad).toBe("alta");
    });

    it("respeta configuración personalizada de SLA", () => {
        const config = {
            ...CONFIG_DEFAULT,
            slaHoras: { alta: 12, media: 24, baja: 36 },
        };
        const result = calcularPrioridadYSLA(base, mediaClasificacion, null, config);
        expect(result.vencimientoSla.getTime()).toBe(base.getTime() + 24 * 60 * 60 * 1000);
    });
});
