/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto c): test unitario del logger
 * estructurado del motor. Los 5 `console.warn` originales se migraron a
 * `logger.info`/`logger.warn` según semántica; este test verifica que cada
 * situación llama al nivel correcto y que `LOG_LEVEL_NOTIFICACIONES` se
 * respeta (gate calculado al cargar el módulo, por eso se usa
 * `vi.resetModules()` + import dinámico para variar el env por test).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFindByEventoActivo = vi.fn();
const mockFindEmailById = vi.fn();
const mockEstaHabilitada = vi.fn();
const mockFindByClaveYCanal = vi.fn();
const mockCancelar = vi.fn();
const mockCrear = vi.fn();
const mockFindByIdRepo = vi.fn();
const mockSendNotificacionEnvio = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerDebug = vi.fn();

vi.mock("../dal/repositories/notificacion-regla", () => ({
    NotificacionReglaRepository: vi.fn().mockImplementation(() => ({ findByEventoActivo: mockFindByEventoActivo })),
}));
vi.mock("../dal/repositories/usuario", () => ({
    UsuarioRepository: vi.fn().mockImplementation(() => ({ findEmailById: mockFindEmailById })),
}));
vi.mock("../dal/repositories/notificacion-preferencia", () => ({
    NotificacionPreferenciaRepository: vi.fn().mockImplementation(() => ({ estaHabilitada: mockEstaHabilitada })),
}));
vi.mock("../dal/repositories/notificacion-plantilla", () => ({
    NotificacionPlantillaRepository: vi.fn().mockImplementation(() => ({ findByClaveYCanal: mockFindByClaveYCanal })),
}));
vi.mock("../dal/repositories/notificacion", () => ({
    NotificacionRepository: vi.fn().mockImplementation(() => ({
        cancelar: mockCancelar,
        crear: mockCrear,
        findById: mockFindByIdRepo,
    })),
}));
vi.mock("../queue", () => ({ sendNotificacionEnvio: mockSendNotificacionEnvio }));
vi.mock("../logger", async () => {
    const actual = await vi.importActual<typeof import("../logger")>("../logger");
    return {
        ...actual,
        logger: { info: mockLoggerInfo, warn: mockLoggerWarn, error: mockLoggerError, debug: mockLoggerDebug },
    };
});

const REGLA_BASE = {
    id: "regla1",
    evento: "reporte.resuelto",
    rol: "PARENT",
    offset: "+0m",
    canal: "EMAIL" as const,
    plantillaClave: "reporte.resuelto.email",
    obligatoria: false,
};

const PLANTILLA_BASE = { clave: "reporte.resuelto.email", canal: "EMAIL" as const };

async function cargarMotor() {
    vi.resetModules();
    const mod = await import("./motor");
    return mod.programar;
}

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LOG_LEVEL_NOTIFICACIONES;
    mockCancelar.mockResolvedValue({ count: 0 });
    mockCrear.mockResolvedValue({ id: "notif1" });
    mockSendNotificacionEnvio.mockResolvedValue(undefined);
});

afterEach(() => {
    delete process.env.LOG_LEVEL_NOTIFICACIONES;
});

describe("motor de notificaciones — logger estructurado (SPEC-302)", () => {
    it("sin reglas activas → logger.info (situación esperada, no error)", async () => {
        mockFindByEventoActivo.mockResolvedValue([]);
        const programar = await cargarMotor();

        await programar({ evento: "evento.sin.reglas", destinatarios: [{ usuarioId: "u1", variables: {} }] });

        expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("Sin reglas activas para evento=evento.sin.reglas"));
        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it("destinatario sin email → logger.warn", async () => {
        mockFindByEventoActivo.mockResolvedValue([REGLA_BASE]);
        const programar = await cargarMotor();

        await programar({ evento: "reporte.resuelto", destinatarios: [{ variables: {} }] });

        expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining("Destinatario sin email para evento=reporte.resuelto"));
    });

    it("omitida por preferencia de opt-out → logger.info (decisión esperada del usuario)", async () => {
        mockFindByEventoActivo.mockResolvedValue([REGLA_BASE]);
        mockEstaHabilitada.mockResolvedValue(false);
        const programar = await cargarMotor();

        await programar({ evento: "reporte.resuelto", destinatarios: [{ usuarioId: "u1", email: "u1@test.com", variables: {} }] });

        expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("omitida_por_preferencia evento=reporte.resuelto"));
        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it("plantilla no encontrada → logger.warn (config incompleta)", async () => {
        mockFindByEventoActivo.mockResolvedValue([REGLA_BASE]);
        mockEstaHabilitada.mockResolvedValue(true);
        mockFindByClaveYCanal.mockResolvedValue(null);
        const programar = await cargarMotor();

        await programar({ evento: "reporte.resuelto", destinatarios: [{ usuarioId: "u1", email: "u1@test.com", variables: {} }] });

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.stringContaining("Plantilla no encontrada: clave=reporte.resuelto.email, canal=EMAIL")
        );
    });

    it("fallo al encolar envío → logger.warn (fallo recuperable, notificación ya quedó ENCOLADA)", async () => {
        mockFindByEventoActivo.mockResolvedValue([REGLA_BASE]);
        mockEstaHabilitada.mockResolvedValue(true);
        mockFindByClaveYCanal.mockResolvedValue(PLANTILLA_BASE);
        mockSendNotificacionEnvio.mockRejectedValue(new Error("cola caída"));
        const programar = await cargarMotor();

        await programar({ evento: "reporte.resuelto", destinatarios: [{ usuarioId: "u1", email: "u1@test.com", variables: {} }] });

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.stringContaining("No se pudo encolar envío para notificación notif1"),
            "cola caída"
        );
    });

    it("LOG_LEVEL_NOTIFICACIONES=error suprime info y warn (nivel respetado)", async () => {
        process.env.LOG_LEVEL_NOTIFICACIONES = "error";
        mockFindByEventoActivo.mockResolvedValue([]);
        const programar = await cargarMotor();

        await programar({ evento: "evento.silenciado", destinatarios: [{ usuarioId: "u1", variables: {} }] });

        expect(mockLoggerInfo).not.toHaveBeenCalled();
        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it("LOG_LEVEL_NOTIFICACIONES inválido cae al default (no revienta)", async () => {
        process.env.LOG_LEVEL_NOTIFICACIONES = "verbose-inventado";
        mockFindByEventoActivo.mockResolvedValue([]);
        const programar = await cargarMotor();

        await programar({ evento: "evento.default", destinatarios: [{ usuarioId: "u1", variables: {} }] });

        expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("Sin reglas activas"));
    });
});
