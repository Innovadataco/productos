/**
 * SPEC-578 (D-113) — candado de la purga total.
 *
 * Test PURO (sin BD): un fake stateful en memoria simula las filas de cada
 * modelo (patrón de borrar-limpieza.test.ts: opts.client, sin vi.mock del
 * singleton). Ejecuta purgarTodo() real y afirma:
 *
 *  1. COBERTURA — deleteMany llega a las 94 entidades BORRAR (los huecos del
 *     flujo anterior mueren acá) y a NINGÚN modelo PRESERVAR.
 *  2. USUARIOS — solo sobrevive soporte@innovadataco.com; el deleteMany lleva
 *     el filtro email notIn.
 *  3. ORDEN FK-safe — hijas antes que padres (reporte, expediente, comercial,
 *     profesionales, usuarios al final).
 *  4. COMPUERTA — Reporte=0 y preservados idénticos al terminar; si el conteo
 *     de reporte no bajó a 0 o un preservado se movió → throw.
 *  5. CONTRATO — la lista de entidades cruza contra CLASIFICACION-PURGA.md.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

// ── fake stateful ────────────────────────────────────────────────────────────

interface FiltroEmail {
    where?: { email?: { notIn?: string[]; in?: string[] } };
}

interface StoreModel {
    n: number;
    filas: Array<Record<string, unknown>>;
    count: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
}

function makeModel(seed: number): StoreModel {
    const model: StoreModel = {
        n: seed,
        filas: [],
        count: vi.fn(async () => model.n),
        deleteMany: vi.fn(async () => {
            model.n = 0;
            return { count: seed };
        }),
        updateMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
    };
    return model;
}

interface FakeBD {
    client: PrismaClient;
    modelos: Map<string, StoreModel>;
    usuarios: { id: string; email: string }[];
}

const SOPORTE = { id: "u-soporte", email: "soporte@innovadataco.com" };

async function makeFakeBD(): Promise<FakeBD> {
    const modelos = new Map<string, StoreModel>();
    const nombre = (e: string) => e.charAt(0).toLowerCase() + e.slice(1);
    const get = (entidad: string): StoreModel => {
        const key = nombre(entidad);
        let m = modelos.get(key);
        if (!m) {
            m = makeModel(0);
            modelos.set(key, m);
        }
        return m;
    };

    // Semilla mínima representativa: reportes (incluidos los 3 «evidencia viva»),
    // usuarios de varios roles, config preservada y datos en cada frente.
    const semillas: Record<string, number> = {
        reporte: 5,
        clasificacionIA: 5,
        correccionAdmin: 1,
        eventoMatch: 2,
        alertaColegio: 3,
        expediente: 2,
        eventoExpediente: 4,
        informeConsolidado: 1,
        seguimientoCaso: 3,
        colegio: 2,
        tenant: 2,
        estudiante: 10,
        suscripcion: 2,
        pago: 2,
        bonoPromocional: 1,
        identificadorReportado: 4,
        apelacion: 1,
        perfilProfesional: 1,
        solicitudCita: 1,
        notificacion: 8,
        recomendacion: 2,
        workerLog: 50,
        rateLimit: 20,
        blockList: 3,
        demoMarcado: 100,
        // Preservados (conteos que la compuerta exige idénticos)
        parametroSistema: 40,
        plan: 4,
        datasetEntrenamiento: 25,
        embeddingDataset: 25,
        notificacionPlantilla: 12,
        notificacionRegla: 15,
        moduloPermisible: 30,
        permisoModulo: 60,
        guiaAccionCategoria: 14,
        reglaRecomendacion: 6,
        pais: 12,
        departamento: 30,
        ciudad: 500,
        plataforma: 7,
        tipoDocumento: 5,
        auditLog: 300,
    };
    for (const [k, v] of Object.entries(semillas)) {
        const m = makeModel(v);
        m.filas = [];
        modelos.set(k, m);
    }

    // TODOS los modelos que toca purgarTodo deben existir en el fake desde la
    // construcción (el acceso es dinámico client[modelo]).
    const { ENTIDADES_BORRADO_PURGA_TOTAL } = await import("./purga-total");
    const { PRESERVA_SIEMPRE } = await import("./_common");
    const todos = new Set<string>([
        ...ENTIDADES_BORRADO_PURGA_TOTAL.map((e) => e.charAt(0).toLowerCase() + e.slice(1)),
        ...PRESERVA_SIEMPRE.modelos.map((e) => e.charAt(0).toLowerCase() + e.slice(1)),
        "usuario",
    ]);
    for (const key of todos) {
        if (!modelos.has(key)) modelos.set(key, makeModel(0));
    }

    const usuarios = [
        SOPORTE,
        { id: "u-admin", email: "admin@prueba.com" },
        { id: "u-operador", email: "operador@prueba.com" },
        { id: "u-padre", email: "padre@prueba.com" },
        { id: "u-pro", email: "profesional@prueba.com" },
    ];
    const usuariosModelo: StoreModel = {
        n: usuarios.length,
        filas: [],
        count: vi.fn(async () => usuariosModelo.n),
        deleteMany: vi.fn(async (filtro: FiltroEmail = {}) => {
            const notIn = filtro.where?.email?.notIn ?? [];
            const preservados = usuarios.filter((u) => notIn.includes(u.email));
            const borrados = usuarios.length - preservados.length;
            usuarios.length = 0;
            usuarios.push(...preservados);
            usuariosModelo.n = usuarios.length;
            return { count: borrados };
        }),
        updateMany: vi.fn(async () => ({ count: usuariosModelo.n })),
        findMany: vi.fn(async () => usuarios.map((u) => ({ email: u.email }))),
        findFirst: vi.fn(async (filtro: FiltroEmail = {}) => {
            const email = filtro.where?.email;
            if (email?.in) return usuarios.find((u) => email.in?.includes(u.email)) ?? null;
            const notIn = email?.notIn ?? [];
            return usuarios.find((u) => !notIn.includes(u.email)) ?? null;
        }),
        create: vi.fn(async () => ({})),
    };
    modelos.set("usuario", usuariosModelo);

    const client = {
        $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(client)),
    } as unknown as PrismaClient;
    // Acceso dinámico como hace purga-total.ts: client[modelo].
    for (const [key, m] of modelos) {
        Object.defineProperty(client, key, { value: m, enumerable: true });
    }
    return { client, modelos, usuarios };
}

// ── contrato con CLASIFICACION-PURGA.md ──────────────────────────────────────

function leerContrato(): string {
    return readFileSync(path.join(__dirname, "CLASIFICACION-PURGA.md"), "utf8");
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("purga-total · contrato con CLASIFICACION-PURGA.md", () => {
    it("cada entidad de la lista de borrado aparece en el contrato como BORRAR", async () => {
        const { ENTIDADES_BORRADO_PURGA_TOTAL } = await import("./purga-total");
        const contrato = leerContrato();
        expect(ENTIDADES_BORRADO_PURGA_TOTAL).toHaveLength(94);
        for (const entidad of ENTIDADES_BORRADO_PURGA_TOTAL) {
            const fila = contrato.split("\n").find((l) => l.startsWith(`| ${entidad} |`));
            expect(fila, `${entidad} debe tener fila en CLASIFICACION-PURGA.md`).toBeDefined();
            expect(fila, `${entidad} debe clasificarse como BORRAR`).toContain("BORRAR");
        }
    });

    it("los 16 modelos PRESERVA_SIEMPRE aparecen en el contrato como PRESERVAR y NUNCA se les hace deleteMany", async () => {
        const { PRESERVA_SIEMPRE } = await import("./_common");
        const contrato = leerContrato();
        expect(PRESERVA_SIEMPRE.modelos).toHaveLength(16);
        for (const entidad of PRESERVA_SIEMPRE.modelos) {
            const fila = contrato.split("\n").find((l) => l.startsWith(`| ${entidad} |`));
            expect(fila, `${entidad} debe tener fila en CLASIFICACION-PURGA.md`).toBeDefined();
            expect(fila, `${entidad} debe clasificarse como PRESERVAR`).toContain("PRESERVAR");
        }
    });

    it("los 3 reportes «evidencia viva» ya no están excluidos de nada (D-113)", async () => {
        const { PRESERVADOS } = await import("./_common");
        expect(PRESERVADOS.reportesExcluidos).toEqual([]);
    });
});

describe("purga-total · ejecución contra fake stateful", () => {
    let fake: FakeBD;
    let purgarTodo: typeof import("./purga-total")["purgarTodo"];
    let ENTIDADES: readonly string[];

    beforeEach(async () => {
        fake = await makeFakeBD();
        const mod = await import("./purga-total");
        purgarTodo = mod.purgarTodo;
        ENTIDADES = mod.ENTIDADES_BORRADO_PURGA_TOTAL;
    });

    it("cubre las 94 entidades BORRAR con deleteMany y ningún PRESERVAR", async () => {
        const { PRESERVA_SIEMPRE } = await import("./_common");
        const resumen = await purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true });

        expect(resumen.dryRun).toBe(false);
        for (const entidad of ENTIDADES) {
            const key = entidad.charAt(0).toLowerCase() + entidad.slice(1);
            const m = fake.modelos.get(key);
            expect(m, `modelo ${key} debe existir en el fake`).toBeDefined();
            expect(m?.deleteMany, `${entidad} debe recibir deleteMany`).toHaveBeenCalled();
        }
        for (const entidad of PRESERVA_SIEMPRE.modelos) {
            const key = entidad.charAt(0).toLowerCase() + entidad.slice(1);
            expect(fake.modelos.get(key)?.deleteMany, `${entidad} es PRESERVAR: jamás deleteMany`).not.toHaveBeenCalled();
        }
    });

    it("deja Reporte=0 y solo soporte@ como usuario restante", async () => {
        await purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true });

        expect(fake.modelos.get("reporte")?.n).toBe(0);
        expect(fake.usuarios.map((u) => u.email)).toEqual(["soporte@innovadataco.com"]);
    });

    it("usuario.deleteMany excluye a soporte@ (filtro email notIn)", async () => {
        await purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true });

        const usuariosModelo = fake.modelos.get("usuario");
        expect(usuariosModelo?.deleteMany).toHaveBeenCalledWith({
            where: { email: { notIn: ["soporte@innovadataco.com"] } },
        });
    });

    it("respeta el orden FK-safe: hijas antes que padres, usuarios al final", async () => {
        await purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true });

        const orden = (entidad: string) => {
            const key = entidad.charAt(0).toLowerCase() + entidad.slice(1);
            const call = fake.modelos.get(key)?.deleteMany.mock.invocationCallOrder[0];
            expect(call, `${entidad} debe borrarse`).toBeDefined();
            return call as number;
        };

        expect(orden("solicitudComite")).toBeLessThan(orden("reporte"));
        expect(orden("correccionAdmin")).toBeLessThan(orden("clasificacionIA"));
        expect(orden("eventoMatch")).toBeLessThan(orden("reporte"));
        expect(orden("alertaColegio")).toBeLessThan(orden("reporte"));
        expect(orden("informeCaso")).toBeLessThan(orden("seguimientoCaso"));
        expect(orden("eventoExpediente")).toBeLessThan(orden("expediente"));
        expect(orden("identificadorEstudiante")).toBeLessThan(orden("estudiante"));
        expect(orden("bonoAplicado")).toBeLessThan(orden("pago"));
        expect(orden("pago")).toBeLessThan(orden("suscripcion"));
        expect(orden("solicitudCita")).toBeLessThan(orden("franjaDisponible"));
        expect(orden("verificacionProfesional")).toBeLessThan(orden("perfilProfesional"));
        expect(orden("demoMarcado")).toBeLessThan(orden("usuario"));
        expect(orden("reporte")).toBeLessThan(orden("usuario"));
    });

    it("reasigna la config con FK requerida a Usuario (Plan/Guia/Regla) vía updateMany, sin deleteMany", async () => {
        const { PRESERVA_SIEMPRE } = await import("./_common");
        await purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true });

        for (const entidad of ["Plan", "GuiaAccionCategoria", "ReglaRecomendacion"]) {
            const key = entidad.charAt(0).toLowerCase() + entidad.slice(1);
            expect(fake.modelos.get(key)?.updateMany, `${entidad} debe reasignar dueño`).toHaveBeenCalled();
        }
        expect(PRESERVA_SIEMPRE.modelos).toContain("Plan");
    });

    it("COMPUERTA: si Reporte no bajó a 0, tira error", async () => {
        fake.modelos.get("reporte")!.deleteMany = vi.fn(async () => ({ count: 0 }));
        await expect(
            purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true }),
        ).rejects.toThrow(/COMPUERTA FALLIDA.*Reporte/);
    });

    it("COMPUERTA: si un preservado se movió, tira error", async () => {
        const plan = fake.modelos.get("plan")!;
        let llamadas = 0;
        plan.count = vi.fn(async () => {
            llamadas += 1;
            // Plan se cuenta dos veces: en el plan previo (antes) y en la
            // compuerta (después). La segunda devuelve un conteo distinto.
            return llamadas === 1 ? 4 : 3;
        });
        await expect(
            purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true }),
        ).rejects.toThrow(/COMPUERTA FALLIDA.*Plan/);
    });

    it("COMPUERTA: si queda un usuario no preservado, tira error", async () => {
        const usuariosModelo = fake.modelos.get("usuario")!;
        usuariosModelo.deleteMany = vi.fn(async () => ({ count: 0 }));
        await expect(
            purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: true }),
        ).rejects.toThrow(/COMPUERTA FALLIDA.*usuarios no preservados/);
    });

    it("dry-run: cuenta el plan sin borrar nada", async () => {
        const resumen = await purgarTodo(fake.client, { motivo: "purga de prueba total", confirm: false });

        expect(resumen.dryRun).toBe(true);
        expect(resumen.filasBorradas).toBe(0);
        expect(fake.modelos.get("reporte")?.deleteMany).not.toHaveBeenCalled();
        expect(fake.usuarios).toHaveLength(5);
        expect(resumen.detalle.Reporte).toBe(5);
        expect(resumen.preservadosAntes.Plan).toBe(4);
    });
});
