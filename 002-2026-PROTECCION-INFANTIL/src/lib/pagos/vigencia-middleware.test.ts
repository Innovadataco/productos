/**
 * SPEC-242 (002-PI-145): tests unitarios del helper de vigencia.
 */
import { describe, it, expect, vi } from "vitest";
import { EstadoSuscripcion, type Suscripcion, type RolUsuario } from "@prisma/client";
import {
    ahoraBogota,
    resolverEstadoVigencia,
    esRutaExenta,
    redireccionSuscripcion,
    debeMostrarBanner,
    mensajeParaEstado,
    ZONA_BOGOTA,
} from "./vigencia-middleware";

function suscripcionMock(estado: EstadoSuscripcion): Suscripcion {
    return {
        id: "sub_1",
        tipoTitular: "PADRE",
        colegioId: null,
        usuarioId: "u1",
        estado,
        planActualId: "plan_1",
        contratoPDFUrl: null,
        fechaInicio: new Date("2026-01-01T00:00:00Z"),
        fechaFin: new Date("2026-12-31T23:59:59Z"),
        fechaCorteProgramado: null,
        esFreemium: false,
        freemiumFechaFin: null,
        codigoReferidoPropio: "ref_1",
        codigoReferidoUsado: null,
        monedaLocal: "COP",
        paisCliente: "CO",
        suspendidaEn: null,
        canceladaEn: null,
        canceladaPorUsuario: null,
        motivoCancelacion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Suscripcion;
}

describe("resolverEstadoVigencia", () => {
    it("retorna SIN_SUSCRIPCION cuando no hay suscripción", () => {
        expect(resolverEstadoVigencia(null)).toBe("SIN_SUSCRIPCION");
        expect(resolverEstadoVigencia(undefined)).toBe("SIN_SUSCRIPCION");
    });

    it("expone cada estado de Suscripcion.estado", () => {
        expect(resolverEstadoVigencia(suscripcionMock(EstadoSuscripcion.ACTIVA))).toBe(EstadoSuscripcion.ACTIVA);
        expect(resolverEstadoVigencia(suscripcionMock(EstadoSuscripcion.EN_GRACIA))).toBe(EstadoSuscripcion.EN_GRACIA);
        expect(resolverEstadoVigencia(suscripcionMock(EstadoSuscripcion.SUSPENDIDA))).toBe(EstadoSuscripcion.SUSPENDIDA);
        expect(resolverEstadoVigencia(suscripcionMock(EstadoSuscripcion.CANCELADA))).toBe(EstadoSuscripcion.CANCELADA);
        expect(resolverEstadoVigencia(suscripcionMock(EstadoSuscripcion.PENDIENTE_AUTORIZACION))).toBe(
            EstadoSuscripcion.PENDIENTE_AUTORIZACION
        );
    });
});

describe("esRutaExenta", () => {
    it("exime /consentimiento, /perfil y /suscripcion para padre y colegio", () => {
        for (const rol of ["PARENT", "SCHOOL_ADMIN"] as RolUsuario[]) {
            expect(esRutaExenta("/consentimiento", rol)).toBe(true);
            expect(esRutaExenta("/dashboard/padre/perfil", rol)).toBe(true);
            expect(esRutaExenta("/dashboard/colegio/suscripcion", rol)).toBe(true);
        }
    });

    it("exime /reportar solo para PARENT", () => {
        expect(esRutaExenta("/reportar", "PARENT")).toBe(true);
        expect(esRutaExenta("/reportar", "SCHOOL_ADMIN")).toBe(false);
        expect(esRutaExenta("/reportar", "OPERADOR")).toBe(false);
    });

    it("no exime rutas de operación", () => {
        expect(esRutaExenta("/dashboard/padre", "PARENT")).toBe(false);
        expect(esRutaExenta("/dashboard/colegio/alumnos", "SCHOOL_ADMIN")).toBe(false);
    });
});

describe("redireccionSuscripcion", () => {
    it("redirige padre a /dashboard/padre/suscripcion", () => {
        expect(redireccionSuscripcion("PARENT")).toBe("/dashboard/padre/suscripcion");
    });

    it("redirige roles de colegio a /dashboard/colegio/suscripcion", () => {
        expect(redireccionSuscripcion("SCHOOL_ADMIN")).toBe("/dashboard/colegio/suscripcion");
        expect(redireccionSuscripcion("COMITE_CONVIVENCIA")).toBe("/dashboard/colegio/suscripcion");
    });
});

describe("debeMostrarBanner", () => {
    it("solo muestra banner en EN_GRACIA", () => {
        expect(debeMostrarBanner(EstadoSuscripcion.EN_GRACIA)).toBe(true);
        expect(debeMostrarBanner(EstadoSuscripcion.ACTIVA)).toBe(false);
        expect(debeMostrarBanner(EstadoSuscripcion.SUSPENDIDA)).toBe(false);
        expect(debeMostrarBanner(EstadoSuscripcion.CANCELADA)).toBe(false);
        expect(debeMostrarBanner(EstadoSuscripcion.PENDIENTE_AUTORIZACION)).toBe(false);
        expect(debeMostrarBanner("SIN_SUSCRIPCION")).toBe(false);
    });
});

describe("mensajeParaEstado", () => {
    it("retorna mensaje orientado a la acción para cada estado", () => {
        expect(mensajeParaEstado(EstadoSuscripcion.ACTIVA)).toContain("activo");
        expect(mensajeParaEstado(EstadoSuscripcion.EN_GRACIA)).toContain("vence pronto");
        expect(mensajeParaEstado(EstadoSuscripcion.SUSPENDIDA)).toContain("suspendida");
        expect(mensajeParaEstado(EstadoSuscripcion.CANCELADA)).toContain("cancelada");
        expect(mensajeParaEstado(EstadoSuscripcion.PENDIENTE_AUTORIZACION)).toContain("pendiente");
        expect(mensajeParaEstado("SIN_SUSCRIPCION")).toContain("Elige un plan");
    });
});

describe("ahoraBogota timezone frontera", () => {
    it("SC-006: antes de medianoche Bogotá sigue siendo el día vigente", () => {
        const justoAntes = new Date("2026-08-25T04:59:00.000Z"); // 23:59 Bogotá (UTC-5)
        vi.setSystemTime(justoAntes);
        const bogota = ahoraBogota();
        expect(bogota.getHours()).toBe(23);
        expect(bogota.getMinutes()).toBe(59);
        vi.useRealTimers();
    });

    it("SC-006: durante medianoche Bogotá inicia el nuevo día", () => {
        const medianoche = new Date("2026-08-25T05:00:00.000Z"); // 00:00 Bogotá
        vi.setSystemTime(medianoche);
        const bogota = ahoraBogota();
        expect(bogota.getHours()).toBe(0);
        expect(bogota.getMinutes()).toBe(0);
        vi.useRealTimers();
    });

    it("SC-006: después de medianoche Bogotá avanza correctamente", () => {
        const justoDespues = new Date("2026-08-25T05:01:00.000Z"); // 00:01 Bogotá
        vi.setSystemTime(justoDespues);
        const bogota = ahoraBogota();
        expect(bogota.getHours()).toBe(0);
        expect(bogota.getMinutes()).toBe(1);
        vi.useRealTimers();
    });
});
