// tests/unit/bi-motor-plantillas.test.ts · Motor NL→SQL + plantillas (Fase 2)
// Producto 006 · BI v2 · AGENTE B (catálogo · cache · plantillas · motor)
// Unitarios puros: prisma, ollama-client, ollama-config, config y los
// módulos del AGENTE A (reglas-pre · constructor-sql · validador-sql) van
// MOCKEADOS con vi.mock — sin BD, sin Ollama, sin red.
// T1: los payloads son los REALES — la misma forma de fila que devuelve
// Prisma para BICatalogoTabla (include columnas), el mismo JSON que
// devuelve llamarOllamaStructured ({data, rawResponse, metrics}) y
// ResultSet con COUNT como string, tal como llega del driver pg.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
        bIConsultaLog: { create: mocks.consultaLogCreate, update: mocks.consultaLogUpdate },
        bICatalogoTabla: { findMany: mocks.catalogoTablaFindMany },
        bICacheSemantico: { findUnique: mocks.cacheFindUnique },
        $queryRawUnsafe: mocks.queryRawUnsafe,
    },
}));
vi.mock("@/lib/config", () => ({ getConfig: mocks.getConfig }));
vi.mock("@/lib/ai/ollama-client", () => ({ llamarOllamaStructured: mocks.llamarOllama }));
vi.mock("@/lib/ai/ollama-config", () => ({ getModeloSql: vi.fn(async () => "qwen2.5:14b") }));
vi.mock("@/lib/bi/reglas-pre", () => ({ revisarIntencion: mocks.revisarIntencion }));
vi.mock("@/lib/bi/constructor-sql", () => ({ construirSql: mocks.construirSql }));
vi.mock("@/lib/bi/validador-sql", () => ({ validarSql: mocks.validarSql }));

import { preguntar } from "@/lib/bi/motor";
import { normalizarPregunta } from "@/lib/bi/cache";
import { PLANTILLA_SIN_DATOS, renderRespuesta } from "@/lib/bi/plantillas";
import { esquemaJsonParaLLM, presentarCatalogoParaLLM, type Catalogo } from "@/lib/bi/catalogo";
import type { PlanLLM } from "@/lib/bi/constructor-sql";

const EMAIL = "jelkin@innovadataco.com";
const PREGUNTA = "¿Cuántos reportes hubo en los últimos 30 días?";

// ────────────────────────────────────────────────────────────────────────────
// Fixtures con la forma REAL de las filas Prisma (BICatalogoTabla + columnas)
// ────────────────────────────────────────────────────────────────────────────
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

// Catálogo (tipo propio de src/lib/bi/catalogo) para probar plantillas.
const CAT: Catalogo = {
    tablas: [
        {
            nombreFuente: "Reporte",
            nombreLegible: "Reportes de riesgo",
            descripcion: "Reportes de conducta potencialmente peligrosa detectados por PI",
            columnas: [
                { nombreFuente: "id", tipo: "String" },
                { nombreFuente: "estado", tipo: "EstadoReporte" },
                { nombreFuente: "creadoEn", tipo: "DateTime" },
            ],
        },
        {
            nombreFuente: "BillingCycle",
            nombreLegible: "Ciclos de facturación",
            descripcion: "Ciclos de cobro por suscripción",
            columnas: [
                { nombreFuente: "id", tipo: "String" },
                { nombreFuente: "monto", tipo: "Float" },
            ],
        },
    ],
};

// Plan REAL tal como lo devuelve el LLM bajo el schema cerrado (candado 3).
const PLAN_CONTEO = {
    tabla_idx: 0,
    columnas_idx: [],
    agregacion: "conteo",
    periodo: { columna_idx: 2, dias: 30 },
    limite: 100,
};

// Respuesta REAL de llamarOllamaStructured: { data, rawResponse, metrics }.
function respuestaOllama(data: unknown) {
    return {
        data,
        rawResponse: JSON.stringify(data),
        metrics: {
            modelo: "qwen2.5:14b",
            latenciaMs: 12,
            promptTokens: 380,
            responseTokens: 24,
            totalDuration: 12,
            loadDuration: 3,
        },
    };
}

const SQL_REAL = 'SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= now() - interval \'30 days\' LIMIT $1';

beforeEach(() => {
    vi.clearAllMocks();
    // Silencia los console.error/warn deliberados del motor (no son fallos).
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mocks.consultaLogCreate.mockResolvedValue({ id: "log_01" });
    mocks.consultaLogUpdate.mockResolvedValue({ id: "log_01" });
    mocks.catalogoTablaFindMany.mockResolvedValue([FILA_TABLA_REPORTE]);
    mocks.cacheFindUnique.mockResolvedValue(null);
    mocks.getConfig.mockResolvedValue(null);
    mocks.revisarIntencion.mockReturnValue({ permitida: true });
    mocks.llamarOllama.mockResolvedValue(respuestaOllama(PLAN_CONTEO));
    mocks.construirSql.mockReturnValue({ ok: true, sql: SQL_REAL, params: [30, 500] });
    mocks.validarSql.mockReturnValue({ valida: true, violaciones: [] });
    mocks.queryRawUnsafe.mockResolvedValue([{ total: "128" }]);
});

describe("motor · flujo ok end-to-end (candados 3, 4, 5, 10, 12)", () => {
    it("pregunta → plan LLM → SQL del servidor → ejecución → plantilla con cifra del ResultSet", async () => {
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("ok");
        // Candado 10: la cifra viene del ResultSet ("128" string de pg → 128).
        expect(r.texto).toBe("En Reportes de riesgo hay 128 registros en los últimos 30 días.");
        expect(r.sql).toBe(SQL_REAL);
        expect(r.filas).toBe(1);
        expect(r.consultaLogId).toBe("log_01");

        // Candado 3: el LLM recibió el catálogo enumerado y el schema cerrado.
        const [, prompt, schema, system, options] = mocks.llamarOllama.mock.calls[0];
        expect(prompt).toContain("[tabla_idx=0]");
        expect(prompt).toContain("[columna_idx=2]");
        expect(prompt).toContain(PREGUNTA);
        expect(schema.additionalProperties).toBe(false);
        expect(schema.properties.tabla_idx.maximum).toBe(0);
        expect(system).toContain("SOLO índices");
        expect(options).toEqual({ temperature: 0, seed: 42 });

        // Candado 3: el SERVIDOR construye el SQL (catálogo, plan, límite).
        expect(mocks.construirSql).toHaveBeenCalledWith(
            expect.objectContaining({ tablas: expect.any(Array) }),
            PLAN_CONTEO,
            500,
        );

        // Candado 5: el SQL construido se valida contra el catálogo.
        expect(mocks.validarSql).toHaveBeenCalledWith(
            expect.objectContaining({ tablas: expect.any(Array) }),
            SQL_REAL,
        );

        // Ejecución con valores parametrizados (nunca interpolados).
        expect(mocks.queryRawUnsafe).toHaveBeenCalledWith(SQL_REAL, 30, 500);

        // Candado 12: traza completa del desenlace.
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({
                estado: "ok",
                sqlGenerado: SQL_REAL,
                fuenteCache: false,
                error: null,
                latenciaMs: expect.any(Number),
            }),
        });
    });

    it("el límite máximo sale de bi_config (B3), no de una constante", async () => {
        mocks.getConfig.mockResolvedValue("700");
        await preguntar(PREGUNTA, EMAIL);
        expect(mocks.getConfig).toHaveBeenCalledWith("bi.motor.limite_maximo");
        expect(mocks.construirSql).toHaveBeenCalledWith(expect.anything(), PLAN_CONTEO, 700);
    });
});

describe("motor · rechazo por intención destructiva (candado 6 pre-LLM)", () => {
    it("bloquea ANTES del LLM y de la BD, y deja traza", async () => {
        mocks.revisarIntencion.mockReturnValue({ permitida: false, motivo: "intencion_destructiva" });
        const r = await preguntar("borra todos los reportes", EMAIL);

        expect(r.estado).toBe("rechazada");
        expect(r.texto).toContain("lectura");
        expect(mocks.llamarOllama).not.toHaveBeenCalled();
        expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({ estado: "rechazada", error: "intencion_destructiva" }),
        });
    });
});

describe("motor · clarificación por plan incompleto (candado 4, deny-by-default)", () => {
    it("agregación que requiere columna sin columnas_idx → pide el campo", async () => {
        mocks.llamarOllama.mockResolvedValue(respuestaOllama({ tabla_idx: 0, columnas_idx: [], agregacion: "suma" }));
        const r = await preguntar("¿cuánto facturamos?", EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(r.texto).toContain("qué campos");
        expect(r.texto).toContain("Reportes de riesgo");
        expect(mocks.construirSql).not.toHaveBeenCalled();
        expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("tabla_idx fuera de rango → pide el tema", async () => {
        mocks.llamarOllama.mockResolvedValue(respuestaOllama({ tabla_idx: 9, columnas_idx: [0], agregacion: "conteo" }));
        const r = await preguntar("¿cuántos hay?", EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(r.texto).toContain("sobre qué datos");
        expect(mocks.construirSql).not.toHaveBeenCalled();
    });

    it("filtro con columna inválida → pide reformular el filtro", async () => {
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                filtros: [{ columna_idx: 42, operador: "=", valor: "CERRADO" }],
            }),
        );
        const r = await preguntar("¿cuántos cerrados?", EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(r.texto).toContain("filtros");
        expect(mocks.construirSql).not.toHaveBeenCalled();
    });

    it("el constructor también rechaza (doble defensa) → clarificación", async () => {
        mocks.construirSql.mockReturnValue({ ok: false, error: "limite debe ser un número finito: NaN." });
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(r.texto).toContain("Reformula la pregunta");
        expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({ estado: "clarificacion", error: expect.stringContaining("limite") }),
        });
    });

    it("I-03: período malformado por el LLM en pregunta SIN marca temporal → se descarta y se responde (ok)", async () => {
        // Regresión del caso real: "¿cuántos colegios hay registrados?" llegó
        // del LLM con período inválido y el motor pedía una ventana que la
        // pregunta nunca pidió. El fallback descarta el período y responde.
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                periodo: { columna_idx: 99, dias: 0 },
            }),
        );
        const r = await preguntar("¿cuántos colegios hay registrados?", EMAIL);

        expect(r.estado).toBe("ok");
        const planUsado = mocks.construirSql.mock.calls[0][1] as { periodo?: unknown };
        expect(planUsado.periodo).toBeUndefined();
        expect(mocks.queryRawUnsafe).toHaveBeenCalled();
    });

    it("período malformado en pregunta CON marca temporal → clarificación (no se descarta)", async () => {
        // El fallback NO aplica: si la pregunta pide ventana y el período viene
        // roto, la clarificación es la respuesta correcta.
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                periodo: { columna_idx: 99, dias: 0 },
            }),
        );
        const r = await preguntar("¿cuántos colegios hay este mes?", EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(r.texto).toContain("período");
        expect(mocks.construirSql).not.toHaveBeenCalled();
    });
});

describe("motor · LLM con JSON inválido (candado 2: no se rescata)", () => {
    it("llamarOllamaStructured lanza → estado error honesto", async () => {
        mocks.llamarOllama.mockRejectedValue(new Error("Ollama devolvió JSON inválido a pesar del schema"));
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("error");
        expect(r.texto).toContain("modelo de lenguaje");
        expect(mocks.construirSql).not.toHaveBeenCalled();
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({ estado: "error", error: expect.stringContaining("JSON inválido") }),
        });
    });
});

describe("motor · cache de veredictos humanos (candado 7)", () => {
    const SQL_CACHE = 'SELECT COUNT(*) AS total FROM "Reporte" WHERE "eliminado" = false LIMIT 500';

    it("hit exacto normalizado → ejecuta SQL humano SIN llamar al LLM", async () => {
        mocks.cacheFindUnique.mockResolvedValue({ sqlAprobado: SQL_CACHE });
        mocks.queryRawUnsafe.mockResolvedValue([{ total: "42" }]);

        const r = await preguntar("  ¿CUÁNTOS   Reportes hay? ", EMAIL);

        // Match exacto sobre la pregunta normalizada (minúsculas · espacios · tildes).
        expect(mocks.cacheFindUnique).toHaveBeenCalledWith({
            where: { preguntaNL: "¿cuantos reportes hay?" },
            select: { sqlAprobado: true },
        });
        // El SQL cacheado también pasa por el validador (candado 5).
        expect(mocks.validarSql).toHaveBeenCalledWith(expect.anything(), SQL_CACHE);
        expect(mocks.llamarOllama).not.toHaveBeenCalled();
        expect(mocks.queryRawUnsafe).toHaveBeenCalledWith(SQL_CACHE);

        expect(r.estado).toBe("ok");
        expect(r.texto).toBe("El resultado es: 42.");
        expect(r.fuenteCache).toBe(true);
        expect(r.sql).toBe(SQL_CACHE);
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({ estado: "ok", fuenteCache: true, sqlGenerado: SQL_CACHE }),
        });
    });

    it("SQL cacheado que ya no valida → miss: sigue por el LLM (deny-by-default)", async () => {
        mocks.cacheFindUnique.mockResolvedValue({ sqlAprobado: "DELETE FROM \"Reporte\"" });
        // Solo el SQL cacheado falla la validación; el del LLM sí la pasa.
        mocks.validarSql.mockImplementation((_cat: unknown, sql: string) =>
            sql.includes("DELETE")
                ? { valida: false, violaciones: ["Palabra prohibida detectada: DELETE."] }
                : { valida: true, violaciones: [] },
        );

        const r = await preguntar(PREGUNTA, EMAIL);

        expect(mocks.llamarOllama).toHaveBeenCalled();
        expect(r.estado).toBe("ok");
        expect(r.fuenteCache).toBeUndefined();
    });
});

describe("motor · sin datos (candado 9: no se inventa)", () => {
    it("ResultSet vacío → sin_datos con PLANTILLA_SIN_DATOS", async () => {
        mocks.queryRawUnsafe.mockResolvedValue([]);
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("sin_datos");
        expect(r.texto).toBe(PLANTILLA_SIN_DATOS);
        expect(r.filas).toBe(0);
    });

    it("SQLSTATE 42P01 (réplica sin la tabla) → sin_datos con PLANTILLA_SIN_DATOS", async () => {
        mocks.queryRawUnsafe.mockRejectedValue(
            Object.assign(new Error('relation "Reporte" does not exist'), { code: "42P01" }),
        );
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("sin_datos");
        expect(r.texto).toBe(PLANTILLA_SIN_DATOS);
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({ estado: "sin_datos", error: "42P01" }),
        });
    });

    it("catálogo vacío en BD → error honesto, sin LLM (candado 8)", async () => {
        mocks.catalogoTablaFindMany.mockResolvedValue([]);
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("error");
        expect(r.texto).toContain("catálogo de datos disponibles está vacío");
        expect(mocks.llamarOllama).not.toHaveBeenCalled();
    });
});

describe("motor · validador post-LLM rechaza el SQL (candado 5)", () => {
    it("no se ejecuta, se registra y se responde rechazada", async () => {
        mocks.validarSql.mockReturnValue({ valida: false, violaciones: ["LIMIT obligatorio ausente (debe ser valor numérico o parámetro)."] });
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("rechazada");
        expect(r.sql).toBe(SQL_REAL);
        expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({
                estado: "rechazada",
                sqlGenerado: SQL_REAL,
                error: expect.stringContaining("LIMIT obligatorio"),
            }),
        });
    });
});

describe("plantillas · cifras SIEMPRE del ResultSet (candado 10)", () => {
    it("conteo sin período", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [] };
        expect(renderRespuesta(plan, [{ total: "128" }], CAT)).toBe("En Reportes de riesgo hay 128 registros.");
    });

    it("conteo con período en días", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
            periodo: { columna_idx: 2, dias: 7 },
        };
        expect(renderRespuesta(plan, [{ total: 15 }], CAT)).toBe(
            "En Reportes de riesgo hay 15 registros en los últimos 7 días.",
        );
    });

    it("suma sobre la columna del plan", () => {
        const plan: PlanLLM = { tabla_idx: 1, columnas_idx: [1], agregacion: "suma", filtros: [] };
        expect(renderRespuesta(plan, [{ sum: "1500.5" }], CAT)).toBe(
            "Suma de monto en Ciclos de facturación: 1500.5.",
        );
    });

    it("promedio redondea a 2 decimales", () => {
        const plan: PlanLLM = { tabla_idx: 1, columnas_idx: [1], agregacion: "promedio", filtros: [] };
        expect(renderRespuesta(plan, [{ avg: "0.87341" }], CAT)).toBe(
            "Promedio de monto en Ciclos de facturación: 0.87.",
        );
    });

    it("lista resume hasta 5 filas con columnas del catálogo", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [0, 1], agregacion: "lista", filtros: [] };
        const filas = Array.from({ length: 7 }, (_, i) => ({ id: `r${i + 1}`, estado: "PENDIENTE" }));
        const texto = renderRespuesta(plan, filas, CAT);

        expect(texto).toContain("Mostrando 5 de 7 registros de Reportes de riesgo");
        expect(texto).toContain("1. id: r1 · estado: PENDIENTE");
        expect(texto).toContain("5. id: r5 · estado: PENDIENTE");
        expect(texto).not.toContain("r6");
    });

    it("filas vacías → PLANTILLA_SIN_DATOS (candado 9)", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [] };
        expect(renderRespuesta(plan, [], CAT)).toBe(PLANTILLA_SIN_DATOS);
    });

    it("agregado NULL (SUM sobre conjunto vacío) → PLANTILLA_SIN_DATOS", () => {
        const plan: PlanLLM = { tabla_idx: 1, columnas_idx: [1], agregacion: "suma", filtros: [] };
        expect(renderRespuesta(plan, [{ sum: null }], CAT)).toBe(PLANTILLA_SIN_DATOS);
    });
});

describe("normalizarPregunta (match exacto del cache)", () => {
    it.each([
        ["con tildes y mayúsculas", "¿CUÁNTOS Reportes?", "¿cuantos reportes?"],
        ["espacios colapsados y trim", "  cuántos   reportes   hay  ", "cuantos reportes hay"],
        ["tildes variadas", "Categoría más frecuente", "categoria mas frecuente"],
        ["diéresis y eñe", "¿Y los niños de güero?", "¿y los ninos de guero?"],
    ])("%s", (_etiqueta, entrada, esperado) => {
        expect(normalizarPregunta(entrada)).toBe(esperado);
    });
});

describe("catálogo para el LLM (candados 1 y 3)", () => {
    it("presenta el catálogo ENUMERADO con índices y descripciones", () => {
        const texto = presentarCatalogoParaLLM(CAT);
        expect(texto).toContain("[tabla_idx=0] Reportes de riesgo");
        expect(texto).toContain("[tabla_idx=1] Ciclos de facturación");
        expect(texto).toContain("[columna_idx=2] creadoEn · tipo DateTime");
        expect(texto).toContain("Descripción: Ciclos de cobro por suscripción");
    });

    it("el JSON Schema es CERRADO y acotado al catálogo vigente", () => {
        const schema = esquemaJsonParaLLM(CAT) as {
            additionalProperties: boolean;
            required: string[];
            properties: {
                tabla_idx: { maximum: number };
                agregacion: { enum: string[] };
                filtros: { items: { additionalProperties: boolean } };
            };
        };
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(["tabla_idx", "columnas_idx", "agregacion"]);
        expect(schema.properties.tabla_idx.maximum).toBe(1);
        expect(schema.properties.agregacion.enum).toEqual(["conteo", "suma", "promedio", "maximo", "minimo", "lista"]);
        expect(schema.properties.filtros.items.additionalProperties).toBe(false);
    });
});
