import { describe, it, expect } from "vitest";
import { mapEstadoUsuario, getMensajeUsuario, parseSlaHoras } from "./reporte-estados-usuario";
import { EstadoReporte } from "@prisma/client";

describe("mapEstadoUsuario", () => {
    it.each([
        [EstadoReporte.PENDIENTE, "En proceso", "warning", true],
        [EstadoReporte.PROCESANDO, "En proceso", "warning", true],
        [EstadoReporte.REVISION_MANUAL, "En proceso", "warning", true],
        [EstadoReporte.POSIBLE_SPAM, "En proceso", "warning", true],
        [EstadoReporte.REQUIERE_ANONIMIZACION, "En proceso", "warning", true],
        [EstadoReporte.CLASIFICADO, "Procesado", "success", false],
        [EstadoReporte.CORREGIDO, "Procesado", "success", false],
        [EstadoReporte.DUPLICADO, "Procesado", "muted", false],
    ])("mapea %s a %s con badge %s", (estado, estadoVisual, badge, enProceso) => {
        const result = mapEstadoUsuario(estado);
        expect(result.estadoVisual).toBe(estadoVisual);
        expect(result.badge).toBe(badge);
        expect(result.enProceso).toBe(enProceso);
    });
});

describe("getMensajeUsuario", () => {
    it("incluye SLA para estados en proceso", () => {
        expect(getMensajeUsuario(EstadoReporte.PENDIENTE, 24)).toBe(
            "Tu reporte está en proceso — puede tardar hasta 24 horas"
        );
    });

    it("usa mensaje específico para CLASIFICADO", () => {
        expect(getMensajeUsuario(EstadoReporte.CLASIFICADO, 24)).toBe("Tu reporte ha sido procesado y clasificado.");
    });

    it("usa mensaje específico para CORREGIDO", () => {
        expect(getMensajeUsuario(EstadoReporte.CORREGIDO, 24)).toBe("Tu reporte ha sido revisado y corregido.");
    });

    it("usa mensaje específico para DUPLICADO", () => {
        expect(getMensajeUsuario(EstadoReporte.DUPLICADO, 24)).toBe("Tu reporte fue vinculado a uno existente.");
    });
});

describe("parseSlaHoras", () => {
    it("parsea valores numéricos válidos", () => {
        expect(parseSlaHoras("48")).toBe(48);
    });

    it("retorna default 24 cuando el valor es nulo o vacío", () => {
        expect(parseSlaHoras(null)).toBe(24);
        expect(parseSlaHoras("")).toBe(24);
    });

    it("retorna default 24 cuando el valor no es numérico", () => {
        expect(parseSlaHoras("abc")).toBe(24);
        expect(parseSlaHoras("0")).toBe(24);
    });
});
