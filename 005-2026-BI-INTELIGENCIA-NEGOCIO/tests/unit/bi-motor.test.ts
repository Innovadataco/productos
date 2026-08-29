import { describe, it, expect, vi } from "vitest";
import { preguntar } from "@/lib/bi/motor";
import type { PrismaClient } from "@prisma/client";
import type { EntradaMotor } from "@/lib/bi/tipos";

interface LogPatch {
    estado: string;
    latenciaMs: number;
    sqlGenerado?: string | null;
    fuenteCache?: boolean;
    error?: string | null;
}

function makePrisma(rows: Array<Record<string, unknown>> = []) {
    const updates: LogPatch[] = [];
    const prisma = {
        bIConsultaLog: {
            create: vi.fn(async () => ({ id: "log-1" })),
            update: vi.fn(async ({ data }: { data: LogPatch }) => {
                updates.push(data);
            }),
        },
        $queryRawUnsafe: vi.fn(async () => rows),
    } as unknown as PrismaClient;
    return { prisma, updates };
}

const USER_ADMIN = { id: "u1", rol: "ADMIN" as const };

describe("preguntar (motor orquestador)", () => {
    it("A · DROP → RECHAZADO · llamadasLlm=0", async () => {
        const { prisma, updates } = makePrisma();
        const input: EntradaMotor = { preguntaNL: "DROP TABLE Reporte", usuario: USER_ADMIN };
        const r = await preguntar(input, {
            prisma,
            vectorizarFn: vi.fn(async () => null),
            vannaGenerarFn: vi.fn(),
            buscarSimilarFn: vi.fn(async () => null),
            construirSchemaFn: vi.fn(),
        });
        expect(r.estado).toBe("RECHAZADO");
        expect(r.llamadasLlm).toBe(0);
        expect(updates[0].estado).toBe("RECHAZADO");
    });

    it("B · cache hit ejecuta SQL cacheado sin llamar a Vanna", async () => {
        const { prisma } = makePrisma([{ total: 42 }]);
        const vannaFn = vi.fn();
        const r = await preguntar(
            { preguntaNL: "cuántos reportes", usuario: USER_ADMIN },
            {
                prisma,
                vectorizarFn: vi.fn(async () => [0.1, 0.2]),
                buscarSimilarFn: vi.fn(async () => ({
                    hit: true as const,
                    sqlAprobado: "SELECT COUNT(*) AS total FROM bi_reporte_diario LIMIT 1",
                    entryId: "c1",
                    similitud: 0.97,
                })),
                vannaGenerarFn: vannaFn,
                construirSchemaFn: vi.fn(),
            },
        );
        expect(r.estado).toBe("OK");
        expect(r.cacheHit).toBe(true);
        expect(vannaFn).not.toHaveBeenCalled();
        expect(r.plantilla).toBe("un-numero");
    });

    it("C · miss + vanna consenso + plantilla un-numero", async () => {
        const { prisma } = makePrisma([{ total: 7 }]);
        const r = await preguntar(
            { preguntaNL: "cuántos hoy", usuario: USER_ADMIN },
            {
                prisma,
                vectorizarFn: vi.fn(async () => null),
                buscarSimilarFn: vi.fn(async () => null),
                construirSchemaFn: vi.fn(async () => ({
                    schema: {},
                    catalogoResuelto: {
                        tablasPermitidas: ["bi_reporte_diario"],
                        columnasPorTabla: { bi_reporte_diario: ["total"] },
                        columnasExcluidas: {},
                    },
                })),
                vannaGenerarFn: vi.fn(async () => ({
                    consenso: true,
                    sqlGenerado: "SELECT total FROM bi_reporte_diario LIMIT 5",
                    votosJurado: [{ modelo: "a" }, { modelo: "b" }, { modelo: "c" }],
                })),
            },
        );
        expect(r.estado).toBe("OK");
        expect(r.llamadasLlm).toBe(3);
        expect(r.plantilla).toBe("un-numero");
    });

    it("D · miss + vanna consenso pero post-validator rechaza tabla → RECHAZADO", async () => {
        const { prisma } = makePrisma();
        const r = await preguntar(
            { preguntaNL: "algo", usuario: USER_ADMIN },
            {
                prisma,
                vectorizarFn: vi.fn(async () => null),
                buscarSimilarFn: vi.fn(async () => null),
                construirSchemaFn: vi.fn(async () => ({
                    schema: {},
                    catalogoResuelto: {
                        tablasPermitidas: ["bi_reporte_diario"],
                        columnasPorTabla: {},
                        columnasExcluidas: {},
                    },
                })),
                vannaGenerarFn: vi.fn(async () => ({
                    consenso: true,
                    sqlGenerado: "SELECT * FROM tabla_prohibida LIMIT 10",
                    votosJurado: [{ modelo: "a" }, { modelo: "b" }],
                })),
            },
        );
        expect(r.estado).toBe("RECHAZADO");
        expect(r.razon).toBe("tabla_no_permitida");
    });

    it("E · miss + vanna SIN consenso → REVISION", async () => {
        const { prisma } = makePrisma();
        const r = await preguntar(
            { preguntaNL: "algo", usuario: USER_ADMIN },
            {
                prisma,
                vectorizarFn: vi.fn(async () => null),
                buscarSimilarFn: vi.fn(async () => null),
                construirSchemaFn: vi.fn(async () => ({
                    schema: {},
                    catalogoResuelto: {
                        tablasPermitidas: [],
                        columnasPorTabla: {},
                        columnasExcluidas: {},
                    },
                })),
                vannaGenerarFn: vi.fn(async () => ({
                    consenso: false,
                    razon: "checks_atomicos_incompletos",
                    votosJurado: [{ modelo: "a", error: "x" }],
                })),
            },
        );
        expect(r.estado).toBe("REVISION");
        expect(r.razon).toBe("checks_atomicos_incompletos");
    });

    it("F · SCHOOL_ADMIN → RECHAZADO por tenancy stub", async () => {
        const { prisma } = makePrisma();
        const r = await preguntar(
            { preguntaNL: "cuántos hoy", usuario: { id: "u1", rol: "SCHOOL_ADMIN" } },
            {
                prisma,
                vectorizarFn: vi.fn(),
                buscarSimilarFn: vi.fn(),
                construirSchemaFn: vi.fn(),
                vannaGenerarFn: vi.fn(),
            },
        );
        expect(r.estado).toBe("RECHAZADO");
        expect(r.razon).toContain("activacion_multi_tenant_diferida");
    });

    it("G · 0 filas → plantilla sin-datos", async () => {
        const { prisma } = makePrisma([]);
        const r = await preguntar(
            { preguntaNL: "cuántos hoy", usuario: USER_ADMIN },
            {
                prisma,
                vectorizarFn: vi.fn(async () => null),
                buscarSimilarFn: vi.fn(async () => null),
                construirSchemaFn: vi.fn(async () => ({
                    schema: {},
                    catalogoResuelto: {
                        tablasPermitidas: ["bi_reporte_diario"],
                        columnasPorTabla: {},
                        columnasExcluidas: {},
                    },
                })),
                vannaGenerarFn: vi.fn(async () => ({
                    consenso: true,
                    sqlGenerado: "SELECT total FROM bi_reporte_diario LIMIT 5",
                    votosJurado: [{ modelo: "a" }, { modelo: "b" }],
                })),
            },
        );
        expect(r.estado).toBe("OK");
        expect(r.plantilla).toBe("sin-datos");
    });
});
