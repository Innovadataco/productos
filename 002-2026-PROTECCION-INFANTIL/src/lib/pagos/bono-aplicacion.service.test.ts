/**
 * SPEC-216 (002-PI-116): tests unitarios de aplicación de bonos promocionales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TipoBono, TipoTitular, EstadoSuscripcion } from "@prisma/client";
import { aplicarBonoPromocional, emitirEventoBonoAplicado } from "./bono-aplicacion.service";
import { ERROR_CODES } from "@/lib/errors";

const mockRepo = vi.hoisted(() => ({
    obtenerBonoPromocionalPorId: vi.fn(),
    obtenerSuscripcionPorId: vi.fn(),
    existeBonoAplicado: vi.fn(),
    listarPagosPorSuscripcion: vi.fn(),
    contarBonosAplicadosPorBono: vi.fn(),
    contarBonosAplicadosPorSuscripcion: vi.fn(),
    crearBonoAplicado: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/pagos-repository", () => ({
    PagosRepository: class {
        constructor() {
            return mockRepo as unknown as object;
        }
    },
}));

const mockLogAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit", () => ({
    logAudit: mockLogAudit,
}));



function bonoBase(overrides: Partial<{ tipo: TipoBono; valor: number; aplicaSoloA: TipoTitular | null }> = {}) {
    const ahora = new Date();
    return {
        id: "bono-1",
        nombre: "BONO-TEST",
        tipo: overrides.tipo ?? TipoBono.DESCUENTO_PCT,
        valor: overrides.valor ?? 20,
        vigenciaInicio: new Date(ahora.getTime() - 24 * 60 * 60 * 1000),
        vigenciaFin: new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
        usosMaximosTotales: null as number | null,
        usosMaximosPorCliente: 1,
        aplicaANuevos: true,
        aplicaARenovaciones: false,
        aplicaSoloA: overrides.aplicaSoloA ?? null,
        combinableConCodigoPersonal: false,
        activo: true,
        descripcion: null,
        creadoPorAdminId: "admin-1",
        createdAt: ahora,
        updatedAt: ahora,
    };
}

function suscripcionBase(overrides: Partial<{ tipoTitular: TipoTitular; colegioId: string | null; usuarioId: string | null }> = {}) {
    return {
        id: "sub-1",
        tipoTitular: overrides.tipoTitular ?? TipoTitular.PADRE,
        colegioId: overrides.colegioId ?? null,
        usuarioId: overrides.usuarioId ?? "user-1",
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: "plan-1",
        monedaLocal: "COP",
        paisCliente: "CO",
        codigoReferidoPropio: "REF-1",
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        esFreemium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe("aplicarBonoPromocional", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue(bonoBase());
        mockRepo.obtenerSuscripcionPorId.mockResolvedValue(suscripcionBase());
        mockRepo.existeBonoAplicado.mockResolvedValue(false);
        mockRepo.listarPagosPorSuscripcion.mockResolvedValue([]);
        mockRepo.contarBonosAplicadosPorBono.mockResolvedValue(0);
        mockRepo.contarBonosAplicadosPorSuscripcion.mockResolvedValue(0);
        mockRepo.crearBonoAplicado.mockResolvedValue({
            id: "ba-1",
            bonoId: "bono-1",
            suscripcionId: "sub-1",
            descuentoUSD: 20,
            aplicadoEn: new Date(),
        });
        mockLogAudit.mockResolvedValue(undefined);
    });

    it("aplica un bono válido y retorna el descuento", async () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const resultado = await aplicarBonoPromocional({
            suscripcionId: "sub-1",
            bonoId: "bono-1",
            montoBaseUSD: 100,
            usuarioId: "user-1",
        });

        expect(resultado.descuentoUSD).toBe(20);
        expect(resultado.bonoAplicadoId).toBe("ba-1");
        expect(mockRepo.crearBonoAplicado).toHaveBeenCalledWith(
            expect.objectContaining({ bonoId: "bono-1", suscripcionId: "sub-1", descuentoUSD: 20 })
        );
        expect(mockLogAudit).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("bono.aplicado"));
        consoleSpy.mockRestore();
    });

    it("rechaza si el bono no existe", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue(null);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "Bono no encontrado", code: ERROR_CODES.NOT_FOUND, statusCode: 404 });
    });

    it("rechaza si la suscripción no existe", async () => {
        mockRepo.obtenerSuscripcionPorId.mockResolvedValue(null);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "Suscripción no encontrada", code: ERROR_CODES.NOT_FOUND, statusCode: 404 });
    });

    it("rechaza si el bono no está activo", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase(), activo: false });

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "El bono no está activo", code: ERROR_CODES.VALIDATION_ERROR, statusCode: 400 });
    });

    it("rechaza si el bono no está vigente", async () => {
        const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({
            ...bonoBase(),
            vigenciaInicio: new Date(ayer.getTime() - 48 * 60 * 60 * 1000),
            vigenciaFin: new Date(ayer.getTime() - 24 * 60 * 60 * 1000),
        });

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "El bono no está vigente", code: ERROR_CODES.VALIDATION_ERROR, statusCode: 400 });
    });

    it("rechaza si el bono ya fue aplicado a la misma suscripción", async () => {
        mockRepo.existeBonoAplicado.mockResolvedValue(true);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({
            message: "El bono ya fue aplicado a esta suscripción",
            code: ERROR_CODES.CONFLICT,
            statusCode: 409,
        });
    });

    it("rechaza si se alcanzó el tope global de usos", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase(), usosMaximosTotales: 5 });
        mockRepo.contarBonosAplicadosPorBono.mockResolvedValue(5);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "El bono alcanzó su tope de usos", code: ERROR_CODES.CONFLICT, statusCode: 409 });
    });

    it("rechaza si se alcanzó el tope por cliente", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase(), usosMaximosPorCliente: 2 });
        mockRepo.contarBonosAplicadosPorSuscripcion.mockResolvedValue(2);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({
            message: "El bono ya fue aplicado el máximo de veces para este cliente",
            code: ERROR_CODES.CONFLICT,
            statusCode: 409,
        });
    });

    it("rechaza si el tipo de titular no coincide", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase(), aplicaSoloA: TipoTitular.COLEGIO });
        mockRepo.obtenerSuscripcionPorId.mockResolvedValue(suscripcionBase({ tipoTitular: TipoTitular.PADRE }));

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({
            message: expect.stringContaining("no aplica a titulares de tipo"),
            code: ERROR_CODES.VALIDATION_ERROR,
            statusCode: 400,
        });
    });

    it("rechaza si el bono solo aplica a nuevas y la suscripción tiene pagos", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase(), aplicaARenovaciones: false });
        mockRepo.listarPagosPorSuscripcion.mockResolvedValue([{ id: "pago-1" }] as never);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "El bono no aplica a renovaciones", code: ERROR_CODES.VALIDATION_ERROR, statusCode: 400 });
    });

    it("rechaza si el bono solo aplica a renovaciones y la suscripción es nueva", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase(), aplicaANuevos: false, aplicaARenovaciones: true });
        mockRepo.listarPagosPorSuscripcion.mockResolvedValue([]);

        await expect(
            aplicarBonoPromocional({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 100, usuarioId: "user-1" })
        ).rejects.toMatchObject({ message: "El bono no aplica a suscripciones nuevas", code: ERROR_CODES.VALIDATION_ERROR, statusCode: 400 });
    });

    it("calcula descuento de meses gratis y lo limita al monto base", async () => {
        mockRepo.obtenerBonoPromocionalPorId.mockResolvedValue({ ...bonoBase({ tipo: TipoBono.MESES_GRATIS, valor: 2 }) });
        mockRepo.crearBonoAplicado.mockResolvedValue({
            id: "ba-2",
            bonoId: "bono-1",
            suscripcionId: "sub-1",
            descuentoUSD: 10,
            aplicadoEn: new Date(),
        });

        const resultado = await aplicarBonoPromocional({
            suscripcionId: "sub-1",
            bonoId: "bono-1",
            montoBaseUSD: 10,
            usuarioId: "user-1",
        });

        expect(resultado.descuentoUSD).toBe(10);
    });

    it("pasa metadata de IP y user agent al audit log", async () => {
        await aplicarBonoPromocional({
            suscripcionId: "sub-1",
            bonoId: "bono-1",
            montoBaseUSD: 100,
            usuarioId: "user-1",
            ipAddress: "1.2.3.4",
            userAgent: "jest",
        });

        expect(mockLogAudit).toHaveBeenCalledWith(
            expect.objectContaining({ ipAddress: "1.2.3.4", userAgent: "jest" })
        );
    });
});

describe("emitirEventoBonoAplicado", () => {
    it("es un stub que loguea sin fallar", async () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        await emitirEventoBonoAplicado({
            bonoId: "bono-1",
            suscripcionId: "sub-1",
            bonoAplicadoId: "ba-1",
            descuentoUSD: 10,
            aplicadoEn: new Date(),
        });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("bono.aplicado"));
        consoleSpy.mockRestore();
    });
});
