/**
 * SPEC-350 (T032) · GET+POST /api/colegio/casos/[id]/analisis.
 *
 * Boundary colegio (403/404), encolado al abrir con alcance COLEGIO_BLINDADO,
 * idempotencia, cooldown, ya-al-día, caso cerrado no gasta modelo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearColegioConAdmin,
    crearPlataforma,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
} from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            if ((name === "token" || name === "__Host-token") && mockToken) {
                return { name, value: mockToken };
            }
            return undefined;
        },
    }),
}));

vi.mock("@/lib/queue", async () => {
    const actual = await vi.importActual<typeof import("@/lib/queue")>("@/lib/queue");
    return {
        ...actual,
        sendAnalisisExpediente: vi.fn(async () => ({ encolado: true, jobId: "fake-job" })),
        getAnalisisQueueStats: vi.fn(async () => ({ pendientes: 1 })),
    };
});

async function seedCasoConReporte() {
    const { colegio, admin } = await crearColegioConAdmin();
    const plataforma = await crearPlataforma("roblox", "Roblox", "juego");
    const curso = await crearCurso(colegio.id, { nombre: "9°-A", grado: "9" });
    const estudiante = await crearEstudiante(curso.id, colegio.id);
    const identificador = await crearIdentificadorEstudiante(estudiante.id, {
        tipo: "usuario",
        valor: `nick-caso-${Date.now()}`,
        plataformaId: plataforma.id,
    });

    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificador.valor,
            plataformaId: plataforma.id,
            texto: "texto cifrado de prueba que jamás debe llegar al payload",
            fechaIncidente: new Date("2026-08-30T21:15:00-05:00"),
            ciudad: "Bogotá",
            pais: "CO",
            estado: "CLASIFICADO",
            esAnonimo: true,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "CIBERACOSO",
            confianza: 0.9,
            modeloUsado: "test",
            latenciaMs: 10,
        },
    });

    const alerta = await prisma.alertaColegio.create({
        data: {
            colegioId: colegio.id,
            reporteId: reporte.id,
            tipoSujeto: "ESTUDIANTE",
            identificadorEstudianteId: identificador.id,
            estado: "escalada",
            prioridad: "alta",
            vencimientoSla: new Date(Date.now() + 48 * 3600 * 1000),
        },
    });
    const caso = await prisma.seguimientoCaso.create({
        data: { colegioId: colegio.id, alertaId: alerta.id },
    });
    return { colegio, admin, caso, identificador, reporte };
}

function req(method: "GET" | "POST", id: string): Request {
    return new Request(`http://localhost:5005/api/colegio/casos/${id}/analisis`, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
    });
}

describe("GET /api/colegio/casos/[id]/analisis (SPEC-350)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("403 si el usuario no es del colegio (PARENT)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET(req("GET", "x"), { params: Promise.resolve({ id: "x" }) });
        expect(res.status).toBe(403);
    });

    it("404 si el caso es de OTRO colegio", async () => {
        const { caso } = await seedCasoConReporte();
        const { admin: adminAjeno } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminAjeno.id, "SCHOOL_ADMIN");
        const res = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN del colegio: encola con alcance COLEGIO_BLINDADO y devuelve hechos + caso", async () => {
        const { admin, caso } = await seedCasoConReporte();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("GENERANDO");
        expect(body.caso.id).toBe(caso.id);
        expect(body.hechos).toHaveLength(1);
        expect(body.hechos[0].categoria).toBe("CIBERACOSO");
        // El hecho NO trae texto ni identidad
        expect(JSON.stringify(body.hechos)).not.toContain("texto cifrado");

        const filas = await prisma.analisisExpediente.findMany({ where: { seguimientoCasoId: caso.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0].estado).toBe("GENERANDO");
        expect(filas[0].alcance).toBe("COLEGIO_BLINDADO");
        expect(filas[0].expedienteId).toBeNull();
    });

    it("dos aperturas seguidas → una sola fila GENERANDO", async () => {
        const { admin, caso } = await seedCasoConReporte();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        const filas = await prisma.analisisExpediente.count({ where: { seguimientoCasoId: caso.id } });
        expect(filas).toBe(1);
    });

    it("caso CERRADO: no encola (no gasta modelo)", async () => {
        const { admin, caso } = await seedCasoConReporte();
        await prisma.seguimientoCaso.update({ where: { id: caso.id }, data: { estado: "cerrado" } });
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const res = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        const body = await res.json();
        expect(body.estado).toBe("SIN_ANALISIS");
        const filas = await prisma.analisisExpediente.count({ where: { seguimientoCasoId: caso.id } });
        expect(filas).toBe(0);
    });
});

describe("POST /api/colegio/casos/[id]/analisis (SPEC-350 · Actualizar)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("con vigente reciente → cooldown", async () => {
        const { admin, caso } = await seedCasoConReporte();
        await prisma.analisisExpediente.create({
            data: {
                seguimientoCasoId: caso.id, versionSecuencial: 1, alcance: "COLEGIO_BLINDADO",
                hashCadena: "x".repeat(64), corteN: 1, texto: "análisis reciente",
                modeloUsado: "t", promptSistemaHash: "h", latenciaMs: 10,
                estado: "PUBLICADO", publicadoEn: new Date(), generadoEn: new Date(),
            },
        });
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const res = await POST(req("POST", caso.id), { params: Promise.resolve({ id: caso.id }) });
        const body = await res.json();
        expect(body.motivo).toBe("cooldown");

        const generando = await prisma.analisisExpediente.count({
            where: { seguimientoCasoId: caso.id, estado: "GENERANDO" },
        });
        expect(generando).toBe(0);
    });

    it("con FALLIDOs agotados, el POST manual SÍ encola (vía de escape · SPEC-348)", async () => {
        const { admin, caso } = await seedCasoConReporte();
        // Sembrar 3 FALLIDOs con el hash actual del caso (lo calculamos vía la ruta)
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const primero = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        const { hashActual } = await primero.json();
        // Borrar el placeholder y sembrar 3 FALLIDOs
        await prisma.analisisExpediente.deleteMany({ where: { seguimientoCasoId: caso.id } });
        for (let v = 1; v <= 3; v++) {
            await prisma.analisisExpediente.create({
                data: {
                    seguimientoCasoId: caso.id, versionSecuencial: v, alcance: "COLEGIO_BLINDADO",
                    hashCadena: hashActual, corteN: 0, texto: "",
                    modeloUsado: "t", promptSistemaHash: "h", latenciaMs: 0,
                    estado: "FALLIDO", motivoFallo: "error_prueba",
                    generadoEn: new Date(Date.now() - (4 - v) * 60_000),
                },
            });
        }

        // GET (apertura) NO encola por agotamiento
        const get2 = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        const bodyGet = await get2.json();
        expect(bodyGet.agotadoPorFallos).toBe(true);
        expect(await prisma.analisisExpediente.count({ where: { seguimientoCasoId: caso.id, estado: "GENERANDO" } })).toBe(0);

        // POST manual SÍ encola
        const res = await POST(req("POST", caso.id), { params: Promise.resolve({ id: caso.id }) });
        const body = await res.json();
        expect(body.encolado).toBe(true);
        expect(await prisma.analisisExpediente.count({ where: { seguimientoCasoId: caso.id, estado: "GENERANDO" } })).toBe(1);
    });
});
