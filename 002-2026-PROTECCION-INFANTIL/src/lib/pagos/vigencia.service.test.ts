/**
 * SPEC-213 (002-PI-113): tests unitarios del motor de vigencia de pagos.
 * Repositorio, motor de notificaciones y audit mockeados (sin BD).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EstadoSuscripcion } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { ejecutarCorrida, horaCorridaACron, EVENTOS_VIGENCIA } from "./vigencia.service";

const ZONA = "America/Bogota";
/** "Hoy" fijo de los tests: 2026-08-24 en pared Bogotá. */
const HOY = "2026-08-24";

const mockRepo = vi.hoisted(() => ({
    listarActivasPorVencer: vi.fn(),
    listarEnGraciaPorCortar: vi.fn(),
    listarFreemiumVencidas: vi.fn(),
    listarActivasEnVentanaFechaFin: vi.fn(),
    listarEnGraciaConFechaFinEn: vi.fn(),
    listarFreemiumEnVentana: vi.fn(),
    transitarSuscripcionSiEstado: vi.fn(),
    obtenerParametroVigencia: vi.fn(),
    guardarParametroVigencia: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/pagos-vigencia-repository", () => ({
    PagosVigenciaRepository: class {
        constructor() {
            return mockRepo as unknown as object;
        }
    },
}));

const mockRepoRegla = vi.hoisted(() => ({
    findByEventoActivo: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/notificacion-regla", () => ({
    NotificacionReglaRepository: class {
        constructor() {
            return mockRepoRegla as unknown as object;
        }
    },
}));

const mockMotor = vi.hoisted(() => ({
    programar: vi.fn(),
}));

vi.mock("@/lib/notificaciones/motor", () => ({
    programar: mockMotor.programar,
}));

const mockAudit = vi.hoisted(() => ({
    logAudit: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
    logAudit: mockAudit.logAudit,
}));

/** Fecha UTC correspondiente a medianoche Bogotá del día ISO dado. */
function bogotaDia(iso: string): Date {
    return fromZonedTime(`${iso}T00:00:00`, ZONA);
}

function suscripcionBase(overrides: Record<string, unknown> = {}) {
    return {
        id: "sub-1",
        estado: EstadoSuscripcion.ACTIVA,
        fechaFin: bogotaDia(HOY),
        fechaCorteProgramado: null,
        esFreemium: false,
        freemiumFechaFin: null,
        planActual: { id: "plan-1", nombre: "Plan Anual" },
        colegio: null,
        usuario: { id: "usr-1", email: "padre@test.com", nombre: "Padre Uno" },
        ...overrides,
    };
}

function configurarCorridaVacia() {
    mockRepo.obtenerParametroVigencia.mockImplementation(async (clave: string) => {
        if (clave === "pagos.vigencia.ultima_corrida") return { clave, valor: "2000-01-01" };
        if (clave === "pagos.gracia_dias") return { clave, valor: "3" };
        return null;
    });
    mockRepo.listarFreemiumVencidas.mockResolvedValue([]);
    mockRepo.listarActivasPorVencer.mockResolvedValue([]);
    mockRepo.listarEnGraciaPorCortar.mockResolvedValue([]);
    mockRepo.listarActivasEnVentanaFechaFin.mockResolvedValue([]);
    mockRepo.listarEnGraciaConFechaFinEn.mockResolvedValue([]);
    mockRepo.listarFreemiumEnVentana.mockResolvedValue([]);
    mockRepo.transitarSuscripcionSiEstado.mockResolvedValue({ count: 1 });
    mockRepo.guardarParametroVigencia.mockResolvedValue({});
    mockRepoRegla.findByEventoActivo.mockResolvedValue([{ id: "regla-1" }]);
    mockMotor.programar.mockResolvedValue({ programadas: 1, canceladasPorReemplazo: 0 });
    mockAudit.logAudit.mockResolvedValue(undefined);
}

describe("horaCorridaACron", () => {
    it("convierte HH:mm a cron diario", () => {
        expect(horaCorridaACron("01:00")).toBe("0 1 * * *");
        expect(horaCorridaACron("06:30")).toBe("30 6 * * *");
        expect(horaCorridaACron("23:05")).toBe("5 23 * * *");
    });

    it("cae al default 01:00 ante valores inválidos", () => {
        expect(horaCorridaACron(null)).toBe("0 1 * * *");
        expect(horaCorridaACron("")).toBe("0 1 * * *");
        expect(horaCorridaACron("25:00")).toBe("0 1 * * *");
        expect(horaCorridaACron("abc")).toBe("0 1 * * *");
    });
});

describe("ejecutarCorrida — idempotencia (AS-005)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("omite la corrida si ya se ejecutó hoy (Bogotá)", async () => {
        configurarCorridaVacia();
        mockRepo.obtenerParametroVigencia.mockImplementation(async (clave: string) =>
            clave === "pagos.vigencia.ultima_corrida" ? { clave, valor: HOY } : null
        );

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado).toEqual({ transiciones: [], eventosProgramados: 0, omitida: true });
        expect(mockRepo.listarActivasPorVencer).not.toHaveBeenCalled();
        expect(mockRepo.transitarSuscripcionSiEstado).not.toHaveBeenCalled();
        expect(mockMotor.programar).not.toHaveBeenCalled();
        expect(mockRepo.guardarParametroVigencia).not.toHaveBeenCalled();
    });

    it("no emite eventos si la fila ya transitó (transición optimista count=0)", async () => {
        configurarCorridaVacia();
        mockRepo.listarActivasPorVencer
            .mockResolvedValueOnce([suscripcionBase()])
            .mockResolvedValueOnce([]);
        mockRepo.transitarSuscripcionSiEstado.mockResolvedValue({ count: 0 });

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado.transiciones).toHaveLength(0);
        expect(mockMotor.programar).not.toHaveBeenCalled();
        expect(mockAudit.logAudit).not.toHaveBeenCalled();
    });
});

describe("ejecutarCorrida — transiciones", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        configurarCorridaVacia();
    });

    it("ACTIVA → EN_GRACIA: programa corte a fechaFin + gracia_dias y emite vencida.T_0 (AS-001)", async () => {
        const sub = suscripcionBase({ fechaFin: bogotaDia(HOY) });
        mockRepo.listarActivasPorVencer.mockResolvedValueOnce([sub]).mockResolvedValueOnce([]);

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado.omitida).toBe(false);
        expect(resultado.transiciones).toEqual([
            {
                suscripcionId: "sub-1",
                estadoAnterior: EstadoSuscripcion.ACTIVA,
                estadoNuevo: EstadoSuscripcion.EN_GRACIA,
                evento: EVENTOS_VIGENCIA.VENCIDA_T_0,
            },
        ]);

        const [, estadoEsperado, data] = mockRepo.transitarSuscripcionSiEstado.mock.calls[0] as [
            string,
            EstadoSuscripcion,
            { estado: EstadoSuscripcion; fechaCorteProgramado: Date },
        ];
        expect(estadoEsperado).toBe(EstadoSuscripcion.ACTIVA);
        expect(data.estado).toBe(EstadoSuscripcion.EN_GRACIA);
        // corte = fechaFin + 3 días (pagos.gracia_dias)
        const esperado = new Date(sub.fechaFin.getTime() + 3 * 24 * 60 * 60 * 1000);
        expect(data.fechaCorteProgramado.getTime()).toBe(esperado.getTime());

        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({
                evento: EVENTOS_VIGENCIA.VENCIDA_T_0,
                sujetoTipo: "Suscripcion",
                sujetoId: "sub-1",
            })
        );
        expect(mockAudit.logAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                accion: "SUSCRIPCION_TRANSICION_AUTOMATICA",
                tipoRecurso: "Suscripcion",
                recursoId: "sub-1",
                valorAnterior: EstadoSuscripcion.ACTIVA,
                valorNuevo: EstadoSuscripcion.EN_GRACIA,
                metadatos: expect.objectContaining({ actor: "SYSTEM", suscripcionId: "sub-1" }),
            })
        );
        expect(mockRepo.guardarParametroVigencia).toHaveBeenCalledWith(
            "pagos.vigencia.ultima_corrida",
            HOY,
            expect.any(String)
        );
    });

    it("EN_GRACIA → SUSPENDIDA: registra suspendidaEn y emite cortada.T_mas_3 (AS-002)", async () => {
        const sub = suscripcionBase({
            estado: EstadoSuscripcion.EN_GRACIA,
            fechaFin: bogotaDia("2026-08-21"),
            fechaCorteProgramado: bogotaDia(HOY),
        });
        mockRepo.listarEnGraciaPorCortar.mockResolvedValueOnce([sub]).mockResolvedValueOnce([]);

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado.transiciones).toEqual([
            {
                suscripcionId: "sub-1",
                estadoAnterior: EstadoSuscripcion.EN_GRACIA,
                estadoNuevo: EstadoSuscripcion.SUSPENDIDA,
                evento: EVENTOS_VIGENCIA.CORTADA_T_MAS_3,
            },
        ]);
        const [, , data] = mockRepo.transitarSuscripcionSiEstado.mock.calls[0] as [
            string,
            EstadoSuscripcion,
            { estado: EstadoSuscripcion; suspendidaEn: Date },
        ];
        expect(data.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
        expect(data.suspendidaEn).toBeInstanceOf(Date);
        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({ evento: EVENTOS_VIGENCIA.CORTADA_T_MAS_3 })
        );
    });

    it("freemium vencido: ACTIVA → SUSPENDIDA y emite freemium.terminado (AS-004)", async () => {
        const sub = suscripcionBase({
            esFreemium: true,
            freemiumFechaFin: bogotaDia("2026-08-23"),
            fechaFin: bogotaDia("2026-09-20"),
        });
        mockRepo.listarFreemiumVencidas.mockResolvedValueOnce([sub]).mockResolvedValueOnce([]);

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado.transiciones).toEqual([
            {
                suscripcionId: "sub-1",
                estadoAnterior: EstadoSuscripcion.ACTIVA,
                estadoNuevo: EstadoSuscripcion.SUSPENDIDA,
                evento: EVENTOS_VIGENCIA.FREEMIUM_TERMINADO,
            },
        ]);
        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({ evento: EVENTOS_VIGENCIA.FREEMIUM_TERMINADO })
        );
    });

    it("continúa si el motor de notificaciones falla (fail-open, FR-012)", async () => {
        mockRepo.listarActivasPorVencer
            .mockResolvedValueOnce([suscripcionBase()])
            .mockResolvedValueOnce([]);
        mockMotor.programar.mockRejectedValue(new Error("motor caído"));

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado.transiciones).toHaveLength(1);
        expect(resultado.eventosProgramados).toBe(0);
        expect(mockAudit.logAudit).toHaveBeenCalledTimes(1);
    });

    it("emite igual aunque el evento no tenga reglas activas (catálogo incompleto)", async () => {
        mockRepoRegla.findByEventoActivo.mockResolvedValue([]);
        mockRepo.listarActivasPorVencer
            .mockResolvedValueOnce([suscripcionBase()])
            .mockResolvedValueOnce([]);

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(resultado.transiciones).toHaveLength(1);
        expect(mockMotor.programar).toHaveBeenCalled();
    });

    it("resuelve destinatario del admin del colegio cuando no hay usuario padre", async () => {
        const sub = suscripcionBase({
            usuario: null,
            colegio: {
                id: "col-1",
                nombre: "Colegio Uno",
                representanteLegalNombre: "Rep Uno",
                representanteLegalEmail: "rep@colegio.com",
                admin: { id: "adm-1", email: "admin@colegio.com", nombre: "Admin Uno" },
            },
        });
        mockRepo.listarActivasPorVencer.mockResolvedValueOnce([sub]).mockResolvedValueOnce([]);

        await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({
                destinatarios: [expect.objectContaining({ usuarioId: "adm-1" })],
            })
        );
    });

    it("cae al representante legal si el colegio no tiene admin", async () => {
        const sub = suscripcionBase({
            usuario: null,
            colegio: {
                id: "col-1",
                nombre: "Colegio Uno",
                representanteLegalNombre: "Rep Uno",
                representanteLegalEmail: "rep@colegio.com",
                admin: null,
            },
        });
        mockRepo.listarActivasPorVencer.mockResolvedValueOnce([sub]).mockResolvedValueOnce([]);

        await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({
                destinatarios: [expect.objectContaining({ email: "rep@colegio.com" })],
            })
        );
    });
});

describe("ejecutarCorrida — recordatorios (AS-006)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        configurarCorridaVacia();
    });

    it("emite por_vencer.T_menos_5 a 5 días del vencimiento", async () => {
        mockRepo.listarActivasEnVentanaFechaFin.mockResolvedValueOnce([
            suscripcionBase({ fechaFin: bogotaDia("2026-08-29") }),
        ]).mockResolvedValueOnce([]);

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({ evento: EVENTOS_VIGENCIA.POR_VENCER_T_MENOS_5 })
        );
        expect(resultado.eventosProgramados).toBe(1);
    });

    it("emite por_vencer.T_menos_1 a 1 día del vencimiento", async () => {
        mockRepo.listarActivasEnVentanaFechaFin.mockResolvedValueOnce([
            suscripcionBase({ fechaFin: bogotaDia("2026-08-25") }),
        ]).mockResolvedValueOnce([]);

        await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({ evento: EVENTOS_VIGENCIA.POR_VENCER_T_MENOS_1 })
        );
    });

    it("emite gracia.T_mas_2 en el día 2 de gracia", async () => {
        mockRepo.listarEnGraciaConFechaFinEn.mockResolvedValueOnce([
            suscripcionBase({
                estado: EstadoSuscripcion.EN_GRACIA,
                fechaFin: bogotaDia("2026-08-22"),
                fechaCorteProgramado: bogotaDia("2026-08-25"),
            }),
        ]).mockResolvedValueOnce([]);

        await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(mockMotor.programar).toHaveBeenCalledWith(
            expect.objectContaining({ evento: EVENTOS_VIGENCIA.GRACIA_T_MAS_2 })
        );
    });

    it("emite freemium.T_menos_7 y freemium.T_menos_1 según días restantes", async () => {
        mockRepo.listarFreemiumEnVentana.mockResolvedValueOnce([
            suscripcionBase({ id: "sub-7", esFreemium: true, freemiumFechaFin: bogotaDia("2026-08-31") }),
            suscripcionBase({ id: "sub-1", esFreemium: true, freemiumFechaFin: bogotaDia("2026-08-25") }),
        ]).mockResolvedValueOnce([]);

        await ejecutarCorrida({ forzarFechaBogota: HOY });

        const eventos = mockMotor.programar.mock.calls.map(
            (c) => (c[0] as { evento: string }).evento
        );
        expect(eventos).toContain(EVENTOS_VIGENCIA.FREEMIUM_T_MENOS_7);
        expect(eventos).toContain(EVENTOS_VIGENCIA.FREEMIUM_T_MENOS_1);
    });

    it("no emite recordatorios fuera de los días exactos", async () => {
        mockRepo.listarActivasEnVentanaFechaFin.mockResolvedValueOnce([
            suscripcionBase({ fechaFin: bogotaDia("2026-08-27") }), // faltan 3 días
        ]).mockResolvedValueOnce([]);

        const resultado = await ejecutarCorrida({ forzarFechaBogota: HOY });

        expect(mockMotor.programar).not.toHaveBeenCalled();
        expect(resultado.eventosProgramados).toBe(0);
    });
});
