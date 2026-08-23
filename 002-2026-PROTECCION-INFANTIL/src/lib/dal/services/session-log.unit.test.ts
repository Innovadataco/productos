import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { unmockPrisma } from "@/lib/test-mocks/unmock-prisma";

const mockSesionLogCreate = vi.hoisted(() => vi.fn());
const mockSesionLogUpdateMany = vi.hoisted(() => vi.fn());
const mockSesionLogFindMany = vi.hoisted(() => vi.fn());
const mockSesionLogFindUnique = vi.hoisted(() => vi.fn());
const mockSesionLogUpdate = vi.hoisted(() => vi.fn());
const mockSesionLogCount = vi.hoisted(() => vi.fn());
const mockSesionLogDeleteMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        sesionLog: {
            create: (...args: unknown[]) => mockSesionLogCreate(...args),
            updateMany: (...args: unknown[]) => mockSesionLogUpdateMany(...args),
            findMany: (...args: unknown[]) => mockSesionLogFindMany(...args),
            findUnique: (...args: unknown[]) => mockSesionLogFindUnique(...args),
            update: (...args: unknown[]) => mockSesionLogUpdate(...args),
            count: (...args: unknown[]) => mockSesionLogCount(...args),
            deleteMany: (...args: unknown[]) => mockSesionLogDeleteMany(...args),
        },
        $transaction: (fn: unknown) => mockTransaction(fn),
    },
}));

vi.mock("@/lib/audit", () => ({
    logAudit: vi.fn(),
}));

import { SessionLogService } from "./session-log";

describe("SessionLogService (unitario)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTransaction.mockImplementation((fn) => {
            if (typeof fn === "function") {
                return fn({ sesionLog: { update: mockSesionLogUpdate } });
            }
            return Promise.resolve(fn.map((p: unknown) => (typeof p === "function" ? p() : p)));
        });
    });

    afterAll(async () => {
        await unmockPrisma();
    });

    describe("registrarInicioSesion", () => {
        it("crea sesión con tenantId nulo cuando no se provee", async () => {
            mockSesionLogCreate.mockResolvedValue({ id: "sesion-1" });
            const service = new SessionLogService();
            const req = new Request("http://localhost:5005/api/auth/login", {
                headers: { "user-agent": "Test/1.0" },
            });
            const id = await service.registrarInicioSesion(req, { id: "u1", rol: "PARENT" });
            expect(id).toBe("sesion-1");
            expect(mockSesionLogCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        usuarioId: "u1",
                        rol: "PARENT",
                        tenantId: null,
                        userAgent: "Test/1.0",
                    }),
                })
            );
        });

        it("crea sesión con tenantId cuando se provee", async () => {
            mockSesionLogCreate.mockResolvedValue({ id: "sesion-2" });
            const service = new SessionLogService();
            const req = new Request("http://localhost:5005/api/auth/login");
            const id = await service.registrarInicioSesion(req, { id: "u2", rol: "ADMIN", tenantId: "t1" });
            expect(id).toBe("sesion-2");
            expect(mockSesionLogCreate).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ tenantId: "t1" }) })
            );
        });
    });

    describe("pingSesion", () => {
        it("devuelve true cuando actualiza una sesión abierta", async () => {
            mockSesionLogUpdateMany.mockResolvedValue({ count: 1 });
            const service = new SessionLogService();
            expect(await service.pingSesion("s1", "u1")).toBe(true);
        });

        it("devuelve false cuando no hay sesión abierta", async () => {
            mockSesionLogUpdateMany.mockResolvedValue({ count: 0 });
            const service = new SessionLogService();
            expect(await service.pingSesion("s1", "u1")).toBe(false);
        });
    });

    describe("cerrarPorInactividad", () => {
        it("devuelve 0 cuando no hay sesiones inactivas", async () => {
            mockSesionLogFindMany.mockResolvedValue([]);
            const service = new SessionLogService();
            expect(await service.cerrarPorInactividad(30)).toBe(0);
            expect(mockTransaction).not.toHaveBeenCalled();
        });

        it("cierra sesiones inactivas y registra auditoría", async () => {
            mockSesionLogFindMany.mockResolvedValue([
                { id: "s1", iniciadaEn: new Date(Date.now() - 60_000) },
            ]);
            mockSesionLogUpdate.mockResolvedValue({ id: "s1" });
            const service = new SessionLogService();
            expect(await service.cerrarPorInactividad(30)).toBe(1);
            expect(mockSesionLogUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "s1" },
                    data: expect.objectContaining({ motivoCierre: "INACTIVIDAD" }),
                })
            );
        });
    });

    describe("cerrarForzado", () => {
        it("cierra sesión abierta", async () => {
            mockSesionLogFindUnique.mockResolvedValue({
                id: "s1",
                cerradaEn: null,
                iniciadaEn: new Date(Date.now() - 60_000),
                usuarioId: "u1",
                rol: "PARENT",
            });
            mockSesionLogUpdate.mockResolvedValue({ id: "s1" });
            const service = new SessionLogService();
            await service.cerrarForzado("s1", "admin-1");
            expect(mockSesionLogUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "s1" },
                    data: expect.objectContaining({ motivoCierre: "FORZADA" }),
                })
            );
        });

        it("cierra sesión desde worker sin request", async () => {
            mockSesionLogFindUnique.mockResolvedValue({
                id: "s1",
                cerradaEn: null,
                iniciadaEn: new Date(Date.now() - 60_000),
                usuarioId: "u1",
                rol: "PARENT",
            });
            mockSesionLogUpdate.mockResolvedValue({ id: "s1" });
            const service = new SessionLogService();
            await service.cerrarForzado("s1", "admin-1");
            expect(mockSesionLogUpdate).toHaveBeenCalled();
        });

        it("lanza error si la sesión no existe", async () => {
            mockSesionLogFindUnique.mockResolvedValue(null);
            const service = new SessionLogService();
            await expect(service.cerrarForzado("s1", "admin-1")).rejects.toThrow("Sesión no encontrada");
        });

        it("lanza error si la sesión ya está cerrada", async () => {
            mockSesionLogFindUnique.mockResolvedValue({ id: "s1", cerradaEn: new Date() });
            const service = new SessionLogService();
            await expect(service.cerrarForzado("s1", "admin-1")).rejects.toThrow("Sesión ya cerrada");
        });
    });

    describe("listarActivas", () => {
        it("pagina resultados y calcula duración", async () => {
            const ahora = new Date();
            mockSesionLogFindMany.mockResolvedValue([
                {
                    id: "s1",
                    usuarioId: "u1",
                    iniciadaEn: new Date(ahora.getTime() - 120_000),
                    ultimaActividadEn: ahora,
                    ipHash: "hash-largo-0000",
                    userAgent: "Test",
                    usuario: { id: "u1", email: "a@b.com", nombre: "Ana", rol: "PARENT" },
                },
            ]);
            mockSesionLogCount.mockResolvedValue(1);
            const service = new SessionLogService();
            const result = await service.listarActivas(1, 10);
            expect(result.items).toHaveLength(1);
            expect(result.items[0].email).toBe("a@b.com");
            expect(result.items[0].duracionMin).toBeGreaterThanOrEqual(1);
            expect(result.pagination.total).toBe(1);
        });

        it("aplica límites de paginación", async () => {
            mockSesionLogFindMany.mockResolvedValue([]);
            mockSesionLogCount.mockResolvedValue(0);
            const service = new SessionLogService();
            const result = await service.listarActivas(0, 200);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.pageSize).toBe(100);
        });
    });

    describe("estaSesionActiva", () => {
        it("devuelve true para sesión abierta", async () => {
            mockSesionLogFindUnique.mockResolvedValue({ cerradaEn: null });
            const service = new SessionLogService();
            expect(await service.estaSesionActiva("s1")).toBe(true);
        });

        it("devuelve false para sesión cerrada", async () => {
            mockSesionLogFindUnique.mockResolvedValue({ cerradaEn: new Date() });
            const service = new SessionLogService();
            expect(await service.estaSesionActiva("s1")).toBe(false);
        });

        it("devuelve false si no existe", async () => {
            mockSesionLogFindUnique.mockResolvedValue(null);
            const service = new SessionLogService();
            expect(await service.estaSesionActiva("s1")).toBe(false);
        });
    });

    describe("purgarAntiguas", () => {
        it("devuelve cantidad de sesiones eliminadas", async () => {
            mockSesionLogDeleteMany.mockResolvedValue({ count: 3 });
            const service = new SessionLogService();
            expect(await service.purgarAntiguas(90)).toBe(3);
        });
    });
});
