// tests/unit/bi-traza.test.ts · Observabilidad del chat (SPEC-006 · AGENTE A)
// Producto 006 · BI v2
// Cubre: crearTraza (pasos con ms crecientes), GET /api/bi/consultas y
// /api/bi/consultas/[id] (401 sin sesión · 403 ajena · 200 mía) y el motor
// cerrando la bitácora con respuestaTexto + pasosJson (prisma mockeado).
// Unitarios puros: sin BD, sin Ollama, sin red.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { crearTraza } from "@/lib/observabilidad/traza";

// ────────────────────────────────────────────────────────────────────────────
// 1 · crearTraza — reloj de pasos puro
// ────────────────────────────────────────────────────────────────────────────
describe("crearTraza · reloj de pasos del pipeline", () => {
    it("registra pasos con ms crecientes (o iguales) desde el inicio", async () => {
        const traza = crearTraza();
        traza.paso("recibida", "¿cuántos reportes hubo?");
        await new Promise((r) => setTimeout(r, 5));
        traza.paso("pre-guard", "permitida");
        await new Promise((r) => setTimeout(r, 5));
        traza.paso("catalogo", "2 tablas cargadas");

        const pasos = traza.pasos();
        expect(pasos.map((p) => p.paso)).toEqual(["recibida", "pre-guard", "catalogo"]);
        expect(pasos[0].ms).toBeGreaterThanOrEqual(0);
        expect(pasos[1].ms).toBeGreaterThanOrEqual(pasos[0].ms);
        expect(pasos[2].ms).toBeGreaterThanOrEqual(pasos[1].ms);
        expect(pasos[0].detalle).toBe("¿cuántos reportes hubo?");
    });

    it("el detalle es opcional y pasos() devuelve una copia inmutable", () => {
        const traza = crearTraza();
        traza.paso("cache", "miss");
        traza.paso("validador");

        const pasos = traza.pasos();
        expect(pasos[1].detalle).toBeUndefined();

        // Mutar la copia no toca el estado interno.
        pasos.push({ paso: "inyectado", ms: 999 });
        pasos[0].detalle = "alterado";
        expect(traza.pasos()).toHaveLength(2);
        expect(traza.pasos()[0].detalle).toBe("miss");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 2 · Rutas del historial — sesión, tenancy y shape del contrato
// ────────────────────────────────────────────────────────────────────────────
const mocksHttp = vi.hoisted(() => ({
    leerSesion: vi.fn(),
    consultaLogFindMany: vi.fn(),
    consultaLogFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/sesion", () => ({ leerSesion: mocksHttp.leerSesion }));

import { GET as GETConsultas } from "@/app/api/bi/consultas/route";
import { GET as GETConsultaPorId } from "@/app/api/bi/consultas/[id]/route";

const EMAIL_SESION = "jelkin@innovadataco.com";

// Fila REAL de bi_consulta_log tal como la devuelve Prisma.
const FILA_LOG = {
    id: "clg_01",
    usuarioId: EMAIL_SESION,
    preguntaNL: "¿Cuántos reportes hay en revisión manual?",
    sqlGenerado: 'SELECT COUNT(*) AS total FROM "Reporte" WHERE "estado" = $1 LIMIT $2',
    planJson: JSON.stringify({ tabla_idx: 0, columnas_idx: [], agregacion: "conteo", limite: 100 }),
    respuestaTexto: "Hay 135 reportes en revisión manual.",
    pasosJson: JSON.stringify([
        { paso: "recibida", detalle: "¿Cuántos reportes hay en revisión manual?", ms: 0 },
        { paso: "pre-guard", detalle: "permitida", ms: 1 },
        { paso: "catalogo", detalle: "2 tablas cargadas", ms: 12 },
    ]),
    estado: "ok",
    latenciaMs: 812,
    fuenteCache: false,
    error: null,
    creadoEn: new Date("2026-09-01T00:04:00.000Z"),
};

function requestGet(url: string): Request {
    return new Request(url, { method: "GET" });
}

function paramsDe(id: string): { params: Promise<{ id: string }> } {
    return { params: Promise.resolve({ id }) };
}

describe("GET /api/bi/consultas · historial propio", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocksHttp.leerSesion.mockResolvedValue({ email: EMAIL_SESION });
    });

    it("sin sesión → 401 y NO toca la BD", async () => {
        mocksHttp.leerSesion.mockResolvedValue(null);
        const res = await GETConsultas();
        expect(res.status).toBe(401);
        expect(mocksHttp.consultaLogFindMany).not.toHaveBeenCalled();
    });

    it("con sesión → 200 con MI historial (últimas 50), SIN sql ni plan ni pasos", async () => {
        // La fila TAL CUAL la devuelve Prisma con el select de la ruta
        // (el mock honra el contrato: solo las 6 columnas pedidas).
        mocksHttp.consultaLogFindMany.mockResolvedValue([
            {
                id: FILA_LOG.id,
                preguntaNL: FILA_LOG.preguntaNL,
                respuestaTexto: FILA_LOG.respuestaTexto,
                estado: FILA_LOG.estado,
                creadoEn: FILA_LOG.creadoEn,
                latenciaMs: FILA_LOG.latenciaMs,
            },
        ]);
        const res = await GETConsultas();
        expect(res.status).toBe(200);

        // Defensa tenancy + shape: solo lo mío, ordenado desc, tope 50.
        expect(mocksHttp.consultaLogFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { usuarioId: EMAIL_SESION },
                orderBy: { creadoEn: "desc" },
                take: 50,
            }),
        );
        const select = mocksHttp.consultaLogFindMany.mock.calls[0][0].select as Record<string, boolean>;
        expect(select.sqlGenerado).toBeUndefined();
        expect(select.planJson).toBeUndefined();
        expect(select.pasosJson).toBeUndefined();

        const cuerpo = await res.json();
        expect(cuerpo.consultas).toHaveLength(1);
        expect(cuerpo.consultas[0]).toEqual({
            id: "clg_01",
            preguntaNL: FILA_LOG.preguntaNL,
            respuestaTexto: FILA_LOG.respuestaTexto,
            estado: "ok",
            creadoEn: "2026-09-01T00:04:00.000Z",
            latenciaMs: 812,
        });
        expect(JSON.stringify(cuerpo)).not.toContain("SELECT");
    });
});

describe("GET /api/bi/consultas/[id] · detalle completo con defensa tenancy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocksHttp.leerSesion.mockResolvedValue({ email: EMAIL_SESION });
    });

    it("sin sesión → 401 y NO toca la BD", async () => {
        mocksHttp.leerSesion.mockResolvedValue(null);
        const res = await GETConsultaPorId(requestGet("http://localhost:3001/api/bi/consultas/clg_01"), paramsDe("clg_01"));
        expect(res.status).toBe(401);
        expect(mocksHttp.consultaLogFindUnique).not.toHaveBeenCalled();
    });

    it("id inexistente → 404", async () => {
        mocksHttp.consultaLogFindUnique.mockResolvedValue(null);
        const res = await GETConsultaPorId(requestGet("http://localhost:3001/api/bi/consultas/nope"), paramsDe("nope"));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "no_encontrada" });
    });

    it("consulta de OTRO usuario → 403 (tenancy)", async () => {
        mocksHttp.consultaLogFindUnique.mockResolvedValue({ ...FILA_LOG, usuarioId: "otro@innovadataco.com" });
        const res = await GETConsultaPorId(requestGet("http://localhost:3001/api/bi/consultas/clg_01"), paramsDe("clg_01"));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "prohibido" });
    });

    it("consulta MÍA → 200 con TODO: sql, plan y pasos parseados", async () => {
        mocksHttp.consultaLogFindUnique.mockResolvedValue(FILA_LOG);
        const res = await GETConsultaPorId(requestGet("http://localhost:3001/api/bi/consultas/clg_01"), paramsDe("clg_01"));
        expect(res.status).toBe(200);
        const cuerpo = await res.json();
        expect(cuerpo.id).toBe("clg_01");
        expect(cuerpo.preguntaNL).toBe(FILA_LOG.preguntaNL);
        expect(cuerpo.respuestaTexto).toBe(FILA_LOG.respuestaTexto);
        expect(cuerpo.sqlGenerado).toBe(FILA_LOG.sqlGenerado);
        expect(cuerpo.plan).toEqual({ tabla_idx: 0, columnas_idx: [], agregacion: "conteo", limite: 100 });
        expect(cuerpo.pasos).toHaveLength(3);
        expect(cuerpo.pasos[0]).toEqual({ paso: "recibida", detalle: FILA_LOG.preguntaNL, ms: 0 });
        expect(cuerpo.estado).toBe("ok");
        expect(cuerpo.latenciaMs).toBe(812);
    });

    it("planJson/pasosJson rotos o ausentes → null (nunca 500 por JSON inválido)", async () => {
        mocksHttp.consultaLogFindUnique.mockResolvedValue({ ...FILA_LOG, planJson: "{ roto", pasosJson: null });
        const res = await GETConsultaPorId(requestGet("http://localhost:3001/api/bi/consultas/clg_01"), paramsDe("clg_01"));
        expect(res.status).toBe(200);
        const cuerpo = await res.json();
        expect(cuerpo.plan).toBeNull();
        expect(cuerpo.pasos).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 3 · Motor — al cerrar la bitácora emite respuestaTexto + pasosJson
// ────────────────────────────────────────────────────────────────────────────
const mocksMotor = vi.hoisted(() => ({
    consultaLogCreate: vi.fn(),
    consultaLogUpdate: vi.fn(),
    catalogoTablaFindMany: vi.fn(),
    cacheFindUnique: vi.fn(),
    queryRawUnsafe: vi.fn(),
    getConfig: vi.fn(),
    llamarOllama: vi.fn(),
    revisarIntencion: vi.fn(),
    construirSql: vi.fn(),
    validarSql: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        bIConsultaLog: {
            create: mocksMotor.consultaLogCreate,
            update: mocksMotor.consultaLogUpdate,
            findMany: mocksHttp.consultaLogFindMany,
            findUnique: mocksHttp.consultaLogFindUnique,
        },
        bICatalogoTabla: { findMany: mocksMotor.catalogoTablaFindMany },
        bICacheSemantico: { findUnique: mocksMotor.cacheFindUnique },
        $queryRawUnsafe: mocksMotor.queryRawUnsafe,
    },
}));
vi.mock("@/lib/config", () => ({ getConfig: mocksMotor.getConfig }));
vi.mock("@/lib/ai/ollama-client", () => ({ llamarOllamaStructured: mocksMotor.llamarOllama }));
vi.mock("@/lib/ai/ollama-config", () => ({ getModeloSql: vi.fn(async () => "qwen2.5:14b") }));
vi.mock("@/lib/bi/reglas-pre", () => ({ revisarIntencion: mocksMotor.revisarIntencion }));
vi.mock("@/lib/bi/constructor-sql", () => ({ construirSql: mocksMotor.construirSql }));
vi.mock("@/lib/bi/validador-sql", () => ({ validarSql: mocksMotor.validarSql }));

import { preguntar } from "@/lib/bi/motor";

// Fila con la forma REAL de BICatalogoTabla (include columnas) — la misma
// que usa bi-motor-plantillas.test.ts.
const FILA_TABLA_REPORTE = {
    id: "clt_reporte",
    nombreFuente: "Reporte",
    nombreLegible: "Reportes de riesgo",
    descripcion: "Reportes de conducta potencialmente peligrosa detectados por PI",
    rolesPermitidos: ["ADMIN_BI"],
    activo: true,
    creadoEn: new Date("2026-09-01T00:00:00.000Z"),
    actualizadoEn: new Date("2026-09-01T00:00:00.000Z"),
    columnas: [
        { id: "clc_r1", tablaId: "clt_reporte", nombreFuente: "id", nombreLegible: "ID reporte", descripcion: "", tipo: "String", sinonimos: [], excluida: false, creadoEn: new Date("2026-09-01T00:00:00.000Z") },
        { id: "clc_r2", tablaId: "clt_reporte", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "", tipo: "EstadoReporte", sinonimos: [], excluida: false, creadoEn: new Date("2026-09-01T00:00:01.000Z") },
        { id: "clc_r3", tablaId: "clt_reporte", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "", tipo: "DateTime", sinonimos: [], excluida: false, creadoEn: new Date("2026-09-01T00:00:02.000Z") },
    ],
};

const PLAN_CONTEO = {
    tabla_idx: 0,
    columnas_idx: [],
    agregacion: "conteo",
    periodo: { columna_idx: 2, dias: 30 },
    limite: 100,
};

const SQL_REAL = 'SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= now() - interval \'30 days\' LIMIT $1';

function respuestaOllama(data: unknown) {
    return {
        data,
        rawResponse: JSON.stringify(data),
        metrics: { modelo: "qwen2.5:14b", latenciaMs: 12, promptTokens: 380, responseTokens: 24, totalDuration: 12, loadDuration: 3 },
    };
}

interface PasoPersistido {
    paso: string;
    detalle?: string;
    ms: number;
}

/** Extrae y parsea el patch con que el motor cerró la bitácora. */
function patchDeCierre(): Record<string, unknown> & { pasosJson: string; respuestaTexto: string } {
    expect(mocksMotor.consultaLogUpdate).toHaveBeenCalledTimes(1);
    return mocksMotor.consultaLogUpdate.mock.calls[0][0].data;
}

describe("motor · traza persistida al cerrar la bitácora (candado 12)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});

        mocksMotor.consultaLogCreate.mockResolvedValue({ id: "log_01" });
        mocksMotor.consultaLogUpdate.mockResolvedValue({ id: "log_01" });
        mocksMotor.catalogoTablaFindMany.mockResolvedValue([FILA_TABLA_REPORTE]);
        mocksMotor.cacheFindUnique.mockResolvedValue(null);
        mocksMotor.getConfig.mockResolvedValue(null);
        mocksMotor.revisarIntencion.mockReturnValue({ permitida: true });
        mocksMotor.llamarOllama.mockResolvedValue(respuestaOllama(PLAN_CONTEO));
        mocksMotor.construirSql.mockReturnValue({ ok: true, sql: SQL_REAL, params: [30, 500] });
        mocksMotor.validarSql.mockReturnValue({ valida: true, violaciones: [] });
        mocksMotor.queryRawUnsafe.mockResolvedValue([{ total: "128" }]);
    });

    it("flujo ok → respuestaTexto = texto final y pasosJson con todos los hitos en orden", async () => {
        const r = await preguntar("¿Cuántos reportes hubo en los últimos 30 días?", EMAIL_SESION);
        expect(r.estado).toBe("ok");

        const patch = patchDeCierre();
        expect(patch.estado).toBe("ok");
        // El texto que vio el usuario queda persistido (historial del chat).
        expect(patch.respuestaTexto).toBe(r.texto);
        expect(patch.respuestaTexto).toContain("128");

        const pasos = JSON.parse(patch.pasosJson) as PasoPersistido[];
        expect(pasos.map((p) => p.paso)).toEqual([
            "recibida",
            "pre-guard",
            "catalogo",
            "cache",
            "llm-llamada",
            "llm-respuesta",
            "plan-atomico",
            "sql-construido",
            "validador",
            "ejecucion",
            "plantilla",
        ]);
        // ms crecientes y detalle REAL en cada hito.
        for (let i = 1; i < pasos.length; i++) {
            expect(pasos[i].ms).toBeGreaterThanOrEqual(pasos[i - 1].ms);
        }
        expect(pasos[0].detalle).toBe("¿Cuántos reportes hubo en los últimos 30 días?");
        expect(pasos.find((p) => p.paso === "catalogo")?.detalle).toBe("1 tablas cargadas");
        expect(pasos.find((p) => p.paso === "cache")?.detalle).toBe("miss");
        expect(pasos.find((p) => p.paso === "llm-llamada")?.detalle).toBe("qwen2.5:14b");
        expect(pasos.find((p) => p.paso === "llm-respuesta")?.detalle).toContain("JSON parseado");
        expect(pasos.find((p) => p.paso === "plan-atomico")?.detalle).toBe("completo");
        expect(pasos.find((p) => p.paso === "validador")?.detalle).toBe("aprobada");
        expect(pasos.find((p) => p.paso === "ejecucion")?.detalle).toContain("1 filas");
        expect(pasos.find((p) => p.paso === "plantilla")?.detalle).toBe("agregación: conteo");
        // Nada de SQL en los pasos: el SQL va en sqlGenerado.
        expect(patch.pasosJson).not.toContain("SELECT");
        expect(patch.sqlGenerado).toBe(SQL_REAL);
    });

    it("rechazo del pre-guard → traza corta con el motivo y respuestaTexto del rechazo", async () => {
        mocksMotor.revisarIntencion.mockReturnValue({ permitida: false, motivo: "intencion_destructiva" });
        const r = await preguntar("Borrá todos los reportes", EMAIL_SESION);
        expect(r.estado).toBe("rechazada");

        const patch = patchDeCierre();
        expect(patch.respuestaTexto).toBe(r.texto);
        const pasos = JSON.parse(patch.pasosJson) as PasoPersistido[];
        expect(pasos.map((p) => p.paso)).toEqual(["recibida", "pre-guard"]);
        expect(pasos[1].detalle).toBe("rechazada: intencion_destructiva");
        // El pipeline se detuvo: jamás se llamó al LLM.
        expect(mocksMotor.llamarOllama).not.toHaveBeenCalled();
    });
});
