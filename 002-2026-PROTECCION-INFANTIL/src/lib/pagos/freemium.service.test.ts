/**
 * SPEC-217 (002-PI-117): tests unitarios del servicio de freemium (T004).
 * Repositorio, parámetros, generador de código de referido y audit mockeados
 * (sin BD; mismo patrón que `vigencia.service.test.ts`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EstadoSuscripcion, TipoTitular, DuracionPlan } from "@prisma/client";
import { crearSuscripcionCliente, extenderVigenciaDesdeFreemium } from "./freemium.service";

const mockRepo = vi.hoisted(() => ({
    tieneFreemiumHistorico: vi.fn(),
    obtenerPlanBasico: vi.fn(),
    crearSuscripcion: vi.fn(),
    obtenerSuscripcionFreemiumPorId: vi.fn(),
    actualizarSuscripcion: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/pagos-freemium-repository", () => ({
    PagosFreemiumRepository: class {
        constructor() {
            return mockRepo as unknown as object;
        }
    },
}));

const mockParametros = vi.hoisted(() => ({
    esFreemiumActivo: vi.fn(),
    obtenerDuracionFreemiumDias: vi.fn(),
}));

vi.mock("./parametros-pagos", () => ({
    esFreemiumActivo: mockParametros.esFreemiumActivo,
    obtenerDuracionFreemiumDias: mockParametros.obtenerDuracionFreemiumDias,
}));

const mockReferido = vi.hoisted(() => ({
    generarCodigoReferidoUnico: vi.fn(),
}));

vi.mock("./referido.service", () => ({
    generarCodigoReferidoUnico: mockReferido.generarCodigoReferidoUnico,
}));

const mockAudit = vi.hoisted(() => ({
    logAudit: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
    logAudit: mockAudit.logAudit,
}));

const PLAN_BASICO = { id: "plan-basico-1", tipoTitular: TipoTitular.PADRE, duracion: DuracionPlan.MES_1 };

function configurarBase() {
    mockParametros.esFreemiumActivo.mockResolvedValue(true);
    mockParametros.obtenerDuracionFreemiumDias.mockResolvedValue(30);
    mockRepo.tieneFreemiumHistorico.mockResolvedValue(false);
    mockRepo.obtenerPlanBasico.mockResolvedValue(PLAN_BASICO);
    mockReferido.generarCodigoReferidoUnico.mockResolvedValue("PI-PADRE-TEST1234");
    mockRepo.crearSuscripcion.mockImplementation(async (data: Record<string, unknown>) => ({ id: "sub-1", ...data }));
    mockAudit.logAudit.mockResolvedValue(undefined);
}

beforeEach(() => {
    vi.clearAllMocks();
    configurarBase();
});

describe("crearSuscripcionCliente", () => {
    it("activa freemium: ACTIVA + esFreemium + fechaFin = freemiumFechaFin (AS-001/AS-002)", async () => {
        const resultado = await crearSuscripcionCliente({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: "usr-1",
            actorUsuarioId: "usr-1",
        });

        expect(resultado.esFreemium).toBe(true);
        expect(resultado.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(resultado.freemiumFechaFin).toBeInstanceOf(Date);

        const data = mockRepo.crearSuscripcion.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(data.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(data.esFreemium).toBe(true);
        expect(data.planActualId).toBe(PLAN_BASICO.id);
        expect(data.codigoReferidoPropio).toBe("PI-PADRE-TEST1234");
        expect(data.fechaFin).toBe(data.freemiumFechaFin);
        // FR-003: ~30 días calendario después del inicio.
        const diffMs = (data.freemiumFechaFin as Date).getTime() - (data.fechaInicio as Date).getTime();
        expect(diffMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
        expect(diffMs).toBeLessThan(32 * 24 * 60 * 60 * 1000);

        expect(mockAudit.logAudit).toHaveBeenCalledWith(
            expect.objectContaining({ accion: "SUSCRIPCION_FREEMIUM_ACTIVADA", recursoId: "sub-1" })
        );
    });

    it("anti-doble freemium: con histórico nace SUSPENDIDA sin freemium (AS-003)", async () => {
        mockRepo.tieneFreemiumHistorico.mockResolvedValue(true);

        const resultado = await crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: "usr-1" });

        expect(resultado.esFreemium).toBe(false);
        expect(resultado.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
        const data = mockRepo.crearSuscripcion.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(data.esFreemium).toBe(false);
        expect(data.freemiumFechaFin).toBeUndefined();
        expect(mockAudit.logAudit).not.toHaveBeenCalledWith(
            expect.objectContaining({ accion: "SUSCRIPCION_FREEMIUM_ACTIVADA" })
        );
    });

    it("con pagos.freemium.activo=false no consulta histórico ni activa freemium", async () => {
        mockParametros.esFreemiumActivo.mockResolvedValue(false);

        const resultado = await crearSuscripcionCliente({ tipoTitular: TipoTitular.COLEGIO, colegioId: "col-1" });

        expect(resultado.esFreemium).toBe(false);
        expect(resultado.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
        expect(mockRepo.tieneFreemiumHistorico).not.toHaveBeenCalled();
    });

    it("sin plan básico MES_1 del año lanza error y no crea nada (Decisión 3)", async () => {
        mockRepo.obtenerPlanBasico.mockResolvedValue(null);

        await expect(crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: "usr-1" })).rejects.toMatchObject({
            statusCode: 500,
        });
        expect(mockRepo.crearSuscripcion).not.toHaveBeenCalled();
    });

    it("verifica el histórico por colegioId cuando el titular es un colegio (FR-004)", async () => {
        await crearSuscripcionCliente({ tipoTitular: TipoTitular.COLEGIO, colegioId: "col-9" });
        expect(mockRepo.tieneFreemiumHistorico).toHaveBeenCalledWith({ usuarioId: undefined, colegioId: "col-9" });
    });
});

describe("extenderVigenciaDesdeFreemium", () => {
    const FREEMIUM_FIN_FUTURO = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    function suscripcionFreemium(overrides: Record<string, unknown> = {}) {
        return {
            id: "sub-1",
            estado: EstadoSuscripcion.ACTIVA,
            esFreemium: true,
            freemiumFechaFin: FREEMIUM_FIN_FUTURO,
            fechaFin: FREEMIUM_FIN_FUTURO,
            colegioId: null,
            usuarioId: "usr-1",
            ...overrides,
        };
    }

    it("convierte el freemium y extiende desde freemiumFechaFin (AS-004)", async () => {
        mockRepo.obtenerSuscripcionFreemiumPorId.mockResolvedValue(suscripcionFreemium());

        const resultado = await extenderVigenciaDesdeFreemium({
            suscripcionId: "sub-1",
            duracionCubierta: DuracionPlan.MES_1,
            actorAdminId: "admin-1",
        });

        expect(resultado?.suscripcionId).toBe("sub-1");
        expect(resultado?.reactivada).toBe(false);
        const data = mockRepo.actualizarSuscripcion.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(data.esFreemium).toBe(false);
        expect(data.fechaCorteProgramado).toBeNull();
        // fechaFin ≈ freemiumFechaFin + 1 mes.
        const esperado = new Date(FREEMIUM_FIN_FUTURO);
        esperado.setMonth(esperado.getMonth() + 1);
        expect((data.fechaFin as Date).toISOString()).toBe(esperado.toISOString());
        expect(data.estado).toBeUndefined();
        expect(mockAudit.logAudit).toHaveBeenCalledWith(
            expect.objectContaining({ accion: "SUSCRIPCION_FREEMIUM_CONVERTIDA", recursoId: "sub-1", usuarioId: "admin-1" })
        );
    });

    it("reactiva a ACTIVA si el worker ya la había suspendido por freemium vencido", async () => {
        mockRepo.obtenerSuscripcionFreemiumPorId.mockResolvedValue(
            suscripcionFreemium({
                estado: EstadoSuscripcion.SUSPENDIDA,
                freemiumFechaFin: new Date(Date.now() - 24 * 60 * 60 * 1000),
            })
        );

        const resultado = await extenderVigenciaDesdeFreemium({
            suscripcionId: "sub-1",
            duracionCubierta: DuracionPlan.MES_12,
            actorAdminId: "admin-1",
        });

        expect(resultado?.reactivada).toBe(true);
        const data = mockRepo.actualizarSuscripcion.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(data.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(data.suspendidaEn).toBeNull();
        // freemium vencido: la base es la fecha de autorización (~ahora + 12 meses).
        const diffMeses =
            ((data.fechaFin as Date).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
        expect(diffMeses).toBeGreaterThan(11);
        expect(diffMeses).toBeLessThan(13);
    });

    it("devuelve null y no toca nada cuando la suscripción no es freemium", async () => {
        mockRepo.obtenerSuscripcionFreemiumPorId.mockResolvedValue(suscripcionFreemium({ esFreemium: false }));

        const resultado = await extenderVigenciaDesdeFreemium({
            suscripcionId: "sub-1",
            duracionCubierta: DuracionPlan.MES_1,
            actorAdminId: "admin-1",
        });

        expect(resultado).toBeNull();
        expect(mockRepo.actualizarSuscripcion).not.toHaveBeenCalled();
        expect(mockAudit.logAudit).not.toHaveBeenCalled();
    });

    it("devuelve null cuando la suscripción no existe", async () => {
        mockRepo.obtenerSuscripcionFreemiumPorId.mockResolvedValue(null);
        const resultado = await extenderVigenciaDesdeFreemium({
            suscripcionId: "sub-x",
            duracionCubierta: DuracionPlan.MES_1,
            actorAdminId: "admin-1",
        });
        expect(resultado).toBeNull();
    });
});
