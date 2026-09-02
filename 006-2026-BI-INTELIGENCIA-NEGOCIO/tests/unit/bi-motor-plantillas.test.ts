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
                { nombreFuente: "colegio", tipo: "String" },
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
function empaquetarOllama(data: unknown) {
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

// Motor v2: data lleva la envoltura del schema raíz { planes: [...] } (1..5).
/** Envuelve 1..N planes en la raíz { planes: [...] } vigente. */
function respuestaOllama(...planes: unknown[]) {
    return empaquetarOllama({ planes });
}

/** Raíz cruda, para probar formas que el schema cerrado no debería emitir. */
function respuestaOllamaCruda(data: unknown) {
    return empaquetarOllama(data);
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
        // Motor v2: la raíz del schema es { planes: [...] } (1..5); cada plan
        // conserva el máximo acotado al catálogo y additionalProperties:false.
        const [, prompt, schema, system, options] = mocks.llamarOllama.mock.calls[0];
        expect(prompt).toContain("[tabla_idx=0]");
        expect(prompt).toContain("[columna_idx=2]");
        expect(prompt).toContain(PREGUNTA);
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(["planes"]);
        expect(schema.properties.planes.maxItems).toBe(5);
        expect(schema.properties.planes.items.properties.tabla_idx.maximum).toBe(0);
        expect(schema.properties.planes.items.additionalProperties).toBe(false);
        expect(system).toContain("SOLO índices");
        expect(system).toContain("agruparPor_idx");
        expect(system).toContain("ventanaAbsoluta");
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

        // Candado 12: traza completa del desenlace. planJson guarda el PRIMER
        // (y aquí único) plan — compat con el historial del chat.
        expect(mocks.consultaLogUpdate).toHaveBeenCalledWith({
            where: { id: "log_01" },
            data: expect.objectContaining({
                estado: "ok",
                sqlGenerado: SQL_REAL,
                planJson: JSON.stringify(PLAN_CONTEO),
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

    it("I-08: la pregunta nombra un valor enum del catálogo pero el plan NO filtra → clarificación", async () => {
        // Regresión del caso real: "SOLICITUD_MATERIAL" en la pregunta y el
        // plan sin filtro → el motor respondía el total (2012) en vez de 153.
        mocks.catalogoTablaFindMany.mockResolvedValue([
            {
                ...FILA_TABLA_REPORTE,
                columnas: [
                    ...FILA_TABLA_REPORTE.columnas.slice(0, 1),
                    {
                        ...FILA_TABLA_REPORTE.columnas[1],
                        nombreFuente: "categoria",
                        tipo: "CategoriaConducta",
                        descripcion: "Valores reales: SOLICITUD_MATERIAL · CIBERACOSO · OTRO",
                    },
                    ...FILA_TABLA_REPORTE.columnas.slice(2),
                ],
            },
        ]);
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({ tabla_idx: 0, columnas_idx: [], agregacion: "conteo", periodo: { columna_idx: 2, dias: 365 } }),
        );
        const r = await preguntar("¿Cuántos reportes de la categoría SOLICITUD_MATERIAL hubo este año?", EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(r.texto).toContain("SOLICITUD_MATERIAL");
        expect(mocks.construirSql).not.toHaveBeenCalled();

        // Con el filtro presente, la misma pregunta fluye normal.
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                filtros: [{ columna_idx: 1, operador: "=", valor: "SOLICITUD_MATERIAL" }],
                periodo: { columna_idx: 2, dias: 365 },
            }),
        );
        const r2 = await preguntar("¿Cuántos reportes de la categoría SOLICITUD_MATERIAL hubo este año?", EMAIL);
        expect(r2.estado).toBe("ok");
    });

    it("I-13: período espurio del LLM en pregunta SIN marca temporal → se descarta y se responde completo", async () => {
        // Regresión del caso real: "alertas escaladas sin gestionar" llegó con
        // 1 día espurio y respondía 0 habiendo 254 escaladas.
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                filtros: [{ columna_idx: 1, operador: "=", valor: "escalada" }],
                periodo: { columna_idx: 2, dias: 1 },
            }),
        );
        const r = await preguntar("¿Cuántas alertas escaladas hay sin gestionar?", EMAIL);

        expect(r.estado).toBe("ok");
        const planUsado = mocks.construirSql.mock.calls[0][1] as { periodo?: unknown };
        expect(planUsado.periodo).toBeUndefined();
    });

    it("I-17: ventana absoluta VÁLIDA en pregunta con nombre de mes → NO se descarta", async () => {
        // Regresión de MI corrección I-16: "septiembre de 2025" no tenía marca
        // temporal (el regex no conocía meses) y se descartó la ventana buena,
        // dejando filtros de fecha como texto → 42883 en runtime.
        const planConVentana = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
            ventanaAbsoluta: { columna_idx: 2, desde: "2025-09-01", hasta: "2025-10-01" },
        };
        mocks.llamarOllama.mockResolvedValue(respuestaOllama(planConVentana));
        const r = await preguntar("¿Cuántos reportes hubo en septiembre de 2025?", EMAIL);

        expect(r.estado).toBe("ok");
        const planUsado = mocks.construirSql.mock.calls[0][1] as { ventanaAbsoluta?: unknown; periodo?: unknown };
        expect(planUsado.ventanaAbsoluta).toBeDefined();
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

    it("el JSON Schema raíz es { planes: 1..5 } CERRADO en todos los niveles y acotado al catálogo vigente", () => {
        const schema = esquemaJsonParaLLM(CAT) as {
            additionalProperties: boolean;
            required: string[];
            properties: {
                planes: {
                    minItems: number;
                    maxItems: number;
                    items: {
                        additionalProperties: boolean;
                        required: string[];
                        properties: {
                            tabla_idx: { maximum: number };
                            agregacion: { enum: string[] };
                            filtros: { items: { additionalProperties: boolean } };
                            periodo: { additionalProperties: boolean };
                            ventanaAbsoluta: { additionalProperties: boolean; required: string[] };
                            agruparPor_idx: { type: string; minimum: number };
                        };
                    };
                };
            };
        };
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(["planes"]);
        expect(schema.properties.planes.minItems).toBe(1);
        expect(schema.properties.planes.maxItems).toBe(5);
        const plan = schema.properties.planes.items;
        expect(plan.additionalProperties).toBe(false);
        expect(plan.required).toEqual(["tabla_idx", "columnas_idx", "agregacion"]);
        expect(plan.properties.tabla_idx.maximum).toBe(1);
        expect(plan.properties.agregacion.enum).toEqual(["conteo", "suma", "promedio", "maximo", "minimo", "lista"]);
        expect(plan.properties.filtros.items.additionalProperties).toBe(false);
        expect(plan.properties.periodo.additionalProperties).toBe(false);
        expect(plan.properties.ventanaAbsoluta.additionalProperties).toBe(false);
        expect(plan.properties.ventanaAbsoluta.required).toEqual(["columna_idx", "desde", "hasta"]);
        expect(plan.properties.agruparPor_idx).toEqual({ type: "integer", minimum: 0 });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Motor v2 · multi-parte (schema raíz { planes: [...] }, 1..5)
// ────────────────────────────────────────────────────────────────────────────
describe("motor v2 · multi-parte (varios planes por pregunta)", () => {
    const PLAN_B = {
        tabla_idx: 0,
        columnas_idx: [],
        agregacion: "conteo",
        periodo: { columna_idx: 2, dias: 30 },
        limite: 100,
    };

    it("2 planes válidos → respuesta compuesta con AMBAS cifras del ResultSet (candado 10)", async () => {
        mocks.llamarOllama.mockResolvedValue(respuestaOllama(PLAN_CONTEO, PLAN_B));
        mocks.queryRawUnsafe
            .mockResolvedValueOnce([{ total: "128" }])
            .mockResolvedValueOnce([{ total: "57" }]);

        const r = await preguntar("¿Cuántos reportes hubo en los últimos 30 días y cuántos este mes?", EMAIL);

        expect(r.estado).toBe("ok");
        // Cada cifra salió de SU propio ResultSet, una sección por sub-plan.
        expect(r.texto).toBe(
            "En Reportes de riesgo hay 128 registros en los últimos 30 días.\n\n" +
                "En Reportes de riesgo hay 57 registros en los últimos 30 días.",
        );
        expect(r.filas).toBe(2);
        expect(mocks.construirSql).toHaveBeenCalledTimes(2);
        expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(2);

        // Candado 12: planJson guarda el PRIMER plan (compat) y pasosJson
        // acumula TODOS los planes — un paso por sub-plan con su JSON.
        const patch = mocks.consultaLogUpdate.mock.calls[0][0].data as Record<string, string>;
        expect(patch.planJson).toBe(JSON.stringify(PLAN_CONTEO));
        const pasos = JSON.parse(patch.pasosJson) as { paso: string; detalle?: string }[];
        const sub1 = pasos.find((p) => p.paso === "sub-plan 1");
        const sub2 = pasos.find((p) => p.paso === "sub-plan 2");
        expect(JSON.parse(sub1?.detalle ?? "null")).toEqual(PLAN_CONTEO);
        expect(JSON.parse(sub2?.detalle ?? "null")).toEqual(PLAN_B);
        // Los hitos de cada sub-plan van prefijados, después de los globales.
        expect(pasos.some((p) => p.paso === "sub-plan 1 · validador")).toBe(true);
        expect(pasos.some((p) => p.paso === "sub-plan 2 · ejecucion")).toBe(true);
    });

    it("1 plan inválido de 2 → clarificación parcial del tramo SIN tirar el otro", async () => {
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama(PLAN_CONTEO, { tabla_idx: 9, columnas_idx: [], agregacion: "conteo" }),
        );
        mocks.queryRawUnsafe.mockResolvedValue([{ total: "128" }]);

        const r = await preguntar("¿Cuántos reportes hubo en los últimos 30 días y cuántos colegios?", EMAIL);

        expect(r.estado).toBe("ok"); // el tramo sano sí respondió con datos
        expect(r.texto).toContain("En Reportes de riesgo hay 128 registros");
        expect(r.texto).toContain("sobre qué datos"); // la otra parte pidió reformular
        // El plan inválido jamás llegó al constructor ni a la BD.
        expect(mocks.construirSql).toHaveBeenCalledTimes(1);
        expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(1);
        // La bitácora registra el éxito parcial con el motivo del tramo fallido.
        const patch = mocks.consultaLogUpdate.mock.calls[0][0].data as Record<string, string>;
        expect(patch.estado).toBe("ok");
        expect(patch.error).toContain("plan_incompleto");
    });

    it("TODOS los planes inválidos → clarificación (no hay tramo sano que rescatar)", async () => {
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({ tabla_idx: 9, columnas_idx: [], agregacion: "conteo" }, { tabla_idx: -1, columnas_idx: [], agregacion: "conteo" }),
        );
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("respuesta raíz sin arreglo planes → error honesto (candado 2: no se rescata)", async () => {
        mocks.llamarOllama.mockResolvedValue(respuestaOllamaCruda({ foo: 1 }));
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("error");
        expect(r.texto).toContain("modelo de lenguaje");
        expect(mocks.construirSql).not.toHaveBeenCalled();
    });

    it("planes vacío → clarificación sin ejecutar nada", async () => {
        mocks.llamarOllama.mockResolvedValue(respuestaOllamaCruda({ planes: [] }));
        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("clarificacion");
        expect(mocks.construirSql).not.toHaveBeenCalled();
        expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("más de 5 planes → se ejecutan solo los primeros 5 (espejo del maxItems del schema)", async () => {
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama(PLAN_CONTEO, PLAN_CONTEO, PLAN_CONTEO, PLAN_CONTEO, PLAN_CONTEO, PLAN_CONTEO),
        );
        mocks.queryRawUnsafe.mockResolvedValue([{ total: "1" }]);

        const r = await preguntar(PREGUNTA, EMAIL);

        expect(r.estado).toBe("ok");
        expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(5);
    });

    it("I-08 multi-parte: valor enum filtrado por OTRO sub-plan no dispara clarificación espuria", async () => {
        // "escalada" la filtra el plan 1; el plan 2 (otra parte de la pregunta)
        // no la filtra y NO debe aclarar — la mención ya está cubierta.
        mocks.catalogoTablaFindMany.mockResolvedValue([
            {
                ...FILA_TABLA_REPORTE,
                columnas: [
                    ...FILA_TABLA_REPORTE.columnas.slice(0, 1),
                    {
                        ...FILA_TABLA_REPORTE.columnas[1],
                        descripcion: "Valores reales: escalada · cerrada · nueva",
                    },
                    ...FILA_TABLA_REPORTE.columnas.slice(2),
                ],
            },
        ]);
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama(
                { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [{ columna_idx: 1, operador: "=", valor: "escalada" }] },
                { tabla_idx: 0, columnas_idx: [], agregacion: "conteo" },
            ),
        );
        mocks.queryRawUnsafe.mockResolvedValue([{ total: "7" }]);

        const r = await preguntar("¿Cuántos reportes escalada hubo y cuántos en total?", EMAIL);

        expect(r.estado).toBe("ok");
        expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(2);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Motor v2 · agrupación (GROUP BY) y ventana absoluta — plantillas + flujo
// ────────────────────────────────────────────────────────────────────────────
describe("motor v2 · agrupación y ventana absoluta", () => {
    it("conteo agrupado → ranking determinista con cifras del ResultSet", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], agruparPor_idx: 1 };
        const texto = renderRespuesta(
            plan,
            [
                { grupo: "CIBERACOSO", valor: "45" },
                { grupo: "BULLYING", valor: 30 },
            ],
            CAT,
        );
        expect(texto).toBe("Top 2 de Reportes de riesgo por estado:\n1. CIBERACOSO: 45 registros\n2. BULLYING: 30 registros");
    });

    it("suma agrupada → encabezado con la función y la columna del plan", () => {
        const plan: PlanLLM = { tabla_idx: 1, columnas_idx: [1], agregacion: "suma", filtros: [], agruparPor_idx: 2 };
        const texto = renderRespuesta(plan, [{ grupo: "Colegio A", valor: "1500.5" }], CAT);
        expect(texto).toBe("Top 1 por colegio en Ciclos de facturación (Suma de monto):\n1. Colegio A: 1500.5");
    });

    it("ranking agrupado se acota a 5 filas (slot acotado, candado 10)", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], agruparPor_idx: 1 };
        const filas = Array.from({ length: 7 }, (_, i) => ({ grupo: `E${i + 1}`, valor: String(10 - i) }));
        const texto = renderRespuesta(plan, filas, CAT);

        expect(texto).toContain("Top 5 de Reportes de riesgo por estado:");
        expect(texto).toContain("5. E5: 6 registros");
        expect(texto).not.toContain("E6");
    });

    it("conteo con ventanaAbsoluta → slot temporal [desde, hasta) en la plantilla", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
            ventanaAbsoluta: { columna_idx: 2, desde: "2025-07-01", hasta: "2025-08-01" },
        };
        expect(renderRespuesta(plan, [{ total: "12" }], CAT)).toBe(
            "En Reportes de riesgo hay 12 registros del 2025-07-01 al 2025-08-01 (hasta exclusivo).",
        );
    });

    it("flujo end-to-end con agruparPor: el texto compone el ranking del ResultSet", async () => {
        const SQL_GRUPO =
            'SELECT "estado" AS grupo, COUNT(*) AS valor FROM "Reporte" GROUP BY "estado" ORDER BY valor DESC LIMIT $1';
        mocks.llamarOllama.mockResolvedValue(
            respuestaOllama({ tabla_idx: 0, columnas_idx: [], agregacion: "conteo", agruparPor_idx: 1 }),
        );
        mocks.construirSql.mockReturnValue({ ok: true, sql: SQL_GRUPO, params: [500] });
        mocks.queryRawUnsafe.mockResolvedValue([
            { grupo: "CIBERACOSO", valor: "45" },
            { grupo: "BULLYING", valor: "30" },
        ]);

        const r = await preguntar("¿Qué estados tienen más reportes?", EMAIL);

        expect(r.estado).toBe("ok");
        expect(r.texto).toContain("Top 2 de Reportes de riesgo por estado:");
        expect(r.texto).toContain("1. CIBERACOSO: 45 registros");
        expect(mocks.queryRawUnsafe).toHaveBeenCalledWith(SQL_GRUPO, 500);
    });
});
