// tests/unit/bi-reglas-constructor-validador.test.ts · Candados 1, 3 y 6 del motor NL→SQL
// Producto 006 · BI v2 · Fase 2 · AGENTE A (reglas pre-LLM + constructor + validador)
// Unitarios puros: sin BD, sin red y sin LLM. T1 (payload real): los planes de
// prueba son el MISMO JSON que devuelve el structured output del LLM según
// catalogo.esquemaJsonParaLLM (índices numéricos · enums cerrados · valores),
// y el catálogo replica la forma de BICatalogoTabla/Columna (Catalogo real).

import { describe, expect, it } from "vitest";
import type { Catalogo } from "@/lib/bi/catalogo";
import { revisarIntencion } from "@/lib/bi/reglas-pre";
import { construirSql, type Agregacion, type Operador, type PlanLLM } from "@/lib/bi/constructor-sql";
import { validarSql } from "@/lib/bi/validador-sql";

/** Catálogo de prueba con la forma real (Catalogo de catalogo.ts del AGENTE B). */
const CATALOGO: Catalogo = {
    tablas: [
        {
            nombreFuente: "Reporte",
            nombreLegible: "Reportes",
            descripcion: "Reportes comunitarios de riesgo",
            columnas: [
                { nombreFuente: "id", tipo: "integer" },
                { nombreFuente: "estado", tipo: "text" },
                { nombreFuente: "categoria", tipo: "text" },
                { nombreFuente: "creadoEn", tipo: "timestamp" },
                // Columna que CONTIENE una palabra prohibida ("update") sin serlo:
                // la guarda del validador usa límite de palabra y no debe dispararse.
                { nombreFuente: "updatedAt", tipo: "timestamp" },
            ],
        },
        {
            nombreFuente: "IdentificadorReportado",
            nombreLegible: "Identificadores reportados",
            descripcion: "Agregado público por identificador",
            columnas: [
                { nombreFuente: "id", tipo: "integer" },
                { nombreFuente: "totalReportes", tipo: "integer" },
                { nombreFuente: "ultimoReporteEn", tipo: "timestamp" },
            ],
        },
    ],
};

const LIMITE_MAXIMO = 1000;

// ---------------------------------------------------------------------------
// reglas-pre.ts · candado 6 PRE-LLM
// ---------------------------------------------------------------------------

describe("revisarIntencion (candado 6 pre-LLM: bloquea intención de escritura)", () => {
    it.each([
        ["imperativo eliminar", "elimina los reportes de ayer"],
        ["imperativo en mayúsculas", "ELIMINA todos los datos"],
        ["imperativo borrar", "por favor borra ese registro"],
        ["infinitivo como orden (borrar)", "quiero borrar la información"],
        ["subjuntivo (elimine)", "necesito que elimine el reporte"],
        ["imperativo modificar", "modifica el estado del reporte"],
        ["infinitivo modificar", "debes modificar la tabla ahora"],
        ["imperativo actualizar", "actualiza los registros"],
        ["infinitivo actualizar", "necesito actualizar el catálogo"],
        ["imperativo cambiar", "cambia el colegio del alumno"],
        ["infinitivo cambiar", "cambiar el estado del caso"],
        ["crea tabla", "crea tabla temporal con esos datos"],
        ["crear una tabla", "crear una tabla nueva"],
        ["cree la tabla (subjuntivo)", "que cree la tabla de respaldo"],
        ["truncar en español", "trunca la tabla de reportes"],
        ["voseo normalizado por NFD (eliminá)", "eliminá los registros viejos"],
        ["drop", "drop table Reporte"],
        ["delete en mayúsculas", "DELETE FROM Reporte"],
        ["update", "update Reporte set estado = 'X'"],
        ["truncate", "truncate table reportes"],
        ["alter", "alter table reportes add column x int"],
        ["insert", "insert into reportes values (1)"],
        ["grant", "grant all on reportes to admin"],
        ["revoke", "revoke select on reportes from app"],
    ])("bloquea: %s", (_etiqueta, pregunta) => {
        const r = revisarIntencion(pregunta);
        expect(r.permitida).toBe(false);
        expect(r.motivo).toContain("solo responde consultas de lectura");
    });

    it.each([
        ["conteo simple", "¿cuántos reportes hubo este mes?"],
        ["agregación con dimensión", "promedio de reportes por colegio"],
        // Criterio documentado (encabezado de reglas-pre.ts): pregunta SOBRE el
        // dato histórico en pasado, no mandato de escritura. "eliminaron" no
        // hace match en las formas bloqueadas por los límites de palabra.
        ["pasado como dato (eliminaron)", "¿cuántos reportes se eliminaron como categoría?"],
        ["pasado como dato (borrados)", "¿cuántos reportes fueron borrados el año pasado?"],
        ["listado legítimo", "dame el listado de identificadores más reportados"],
        ["ventana temporal", "total de consultas de los últimos 30 días"],
        ["categoría frecuente", "¿cuál es la categoría más frecuente del semestre?"],
        ["sustantivo con prefijo de verbo (actualización)", "muéstrame las tendencias de actualización de estados"],
        ["sustantivo plural (cambios)", "¿cuántos cambios de estado hubo en el trimestre?"],
    ])("permite: %s", (_etiqueta, pregunta) => {
        const r = revisarIntencion(pregunta);
        expect(r.permitida).toBe(true);
        expect(r.motivo).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// constructor-sql.ts · candado 3 (índices → SQL determinístico parametrizado)
// ---------------------------------------------------------------------------

describe("construirSql (candado 3: el servidor construye el SQL con nombres del catálogo)", () => {
    it("lista con columnas_idx: proyecta solo esas columnas y LIMIT $1 por defecto (100)", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [1, 2], agregacion: "lista", filtros: [] };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT "estado", "categoria" FROM "Reporte" LIMIT $1');
        expect(r.params).toEqual([100]);
    });

    it("lista con columnas_idx vacío: proyecta TODAS las columnas del catálogo", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "lista", filtros: [] };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT "id", "estado", "categoria", "creadoEn", "updatedAt" FROM "Reporte" LIMIT $1');
        expect(r.params).toEqual([100]);
    });

    it("conteo: COUNT(*) AS total e ignora columnas_idx", () => {
        const plan: PlanLLM = { tabla_idx: 1, columnas_idx: [0, 1], agregacion: "conteo", filtros: [] };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT COUNT(*) AS total FROM "IdentificadorReportado" LIMIT $1');
        expect(r.params).toEqual([100]);
    });

    it.each([
        ["suma", "SUM"],
        ["promedio", "AVG"],
        ["maximo", "MAX"],
        ["minimo", "MIN"],
    ] as [Agregacion, string][])("agregación %s: %s(columnas_idx[0]) AS valor", (agregacion, fn) => {
        const plan: PlanLLM = { tabla_idx: 1, columnas_idx: [1], agregacion, filtros: [] };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(`SELECT ${fn}("totalReportes") AS valor FROM "IdentificadorReportado" LIMIT $1`);
        expect(r.params).toEqual([100]);
    });

    it.each([["="], ["!="], ["<"], [">"], ["<="], [">="], ["LIKE"]] as [Operador][])(
        "filtro con operador %s parametrizado ($1) sin interpolar el valor",
        (operador) => {
            const plan: PlanLLM = {
                tabla_idx: 0,
                columnas_idx: [0],
                agregacion: "lista",
                filtros: [{ columna_idx: 1, operador, valor: "CLASIFICADO" }],
            };
            const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
            if (!r.ok) throw new Error(`debía construir: ${r.error}`);
            // I-05: igualdad de texto va con LOWER() en ambos lados (PI mezcla
            // minúsculas y MAYÚSCULAS entre tablas; el LLM no puede saberlo).
            const condicion =
                operador === "=" || operador === "!="
                    ? `LOWER("estado"::text) ${operador} LOWER($1)`
                    : `"estado" ${operador} $1`;
            expect(r.sql).toBe(`SELECT "id" FROM "Reporte" WHERE ${condicion} LIMIT $2`);
            expect(r.params).toEqual(["CLASIFICADO", 100]);
        },
    );

    it("varios filtros: condiciones con AND y params en el orden de los filtros", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [0],
            agregacion: "lista",
            filtros: [
                { columna_idx: 1, operador: "=", valor: "CLASIFICADO" },
                { columna_idx: 2, operador: "LIKE", valor: "%acoso%" },
            ],
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT "id" FROM "Reporte" WHERE LOWER("estado"::text) = LOWER($1) AND "categoria" LIKE $2 LIMIT $3');
        expect(r.params).toEqual(["CLASIFICADO", "%acoso%", 100]);
        // Candado 3: el valor jamás aparece interpolado en el texto SQL.
        expect(r.sql).not.toContain("CLASIFICADO");
        expect(r.sql).not.toContain("acoso");
    });

    it("periodo: columna >= NOW() - ($N || ' days')::interval con días parametrizados", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
            periodo: { columna_idx: 3, dias: 30 },
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(`SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= NOW() - ($1 || ' days')::interval LIMIT $2`);
        expect(r.params).toEqual([30, 100]);
    });

    it("filtros + periodo: params ordenados (filtros → días → límite)", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [0],
            agregacion: "lista",
            filtros: [{ columna_idx: 1, operador: "=", valor: "CORREGIDO" }],
            periodo: { columna_idx: 3, dias: 7 },
            limite: 25,
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            `SELECT "id" FROM "Reporte" WHERE LOWER("estado"::text) = LOWER($1) AND "creadoEn" >= NOW() - ($2 || ' days')::interval LIMIT $3`,
        );
        expect(r.params).toEqual(["CORREGIDO", 7, 25]);
    });

    it("limite del plan se respeta y se trunca a entero", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [0], agregacion: "lista", filtros: [], limite: 37.9 };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.params).toEqual([37]);
    });

    it("clamp: limite del plan por encima de limiteMaximo se recorta al máximo", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [0], agregacion: "lista", filtros: [], limite: 99999 };
        const r = construirSql(CATALOGO, plan, 500);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT "id" FROM "Reporte" LIMIT $1');
        expect(r.params).toEqual([500]);
    });

    it("clamp: limite 0 o negativo sube al mínimo de 1 fila", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [0], agregacion: "lista", filtros: [], limite: 0 };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.params).toEqual([1]);
    });

    it("columnas_idx duplicadas se deduplican preservando orden", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [2, 1, 2], agregacion: "lista", filtros: [] };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT "categoria", "estado" FROM "Reporte" LIMIT $1');
    });

    it.each([
        ["tabla_idx negativo", { tabla_idx: -1, columnas_idx: [0], agregacion: "lista", filtros: [] }],
        ["tabla_idx fuera de rango", { tabla_idx: 99, columnas_idx: [0], agregacion: "lista", filtros: [] }],
        ["columnas_idx fuera de rango", { tabla_idx: 0, columnas_idx: [99], agregacion: "lista", filtros: [] }],
        ["columnas_idx no entero", { tabla_idx: 0, columnas_idx: [1.5], agregacion: "lista", filtros: [] }],
        [
            "filtro.columna_idx fuera de rango",
            { tabla_idx: 0, columnas_idx: [0], agregacion: "lista", filtros: [{ columna_idx: 99, operador: "=", valor: "x" }] },
        ],
        [
            "operador fuera del enum (JSON del LLM no confiable)",
            {
                tabla_idx: 0,
                columnas_idx: [0],
                agregacion: "lista",
                filtros: [{ columna_idx: 1, operador: "CONTIENTE" as Operador, valor: "x" }],
            },
        ],
        [
            "agregación fuera del enum",
            { tabla_idx: 0, columnas_idx: [0], agregacion: "mediana" as Agregacion, filtros: [] },
        ],
        ["suma sin columnas", { tabla_idx: 1, columnas_idx: [], agregacion: "suma", filtros: [] }],
        [
            "periodo.columna_idx fuera de rango",
            { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], periodo: { columna_idx: 99, dias: 30 } },
        ],
        [
            "periodo.dias negativo",
            { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], periodo: { columna_idx: 3, dias: -5 } },
        ],
        [
            "periodo.dias NaN",
            { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], periodo: { columna_idx: 3, dias: NaN } },
        ],
        [
            "valor NaN",
            { tabla_idx: 0, columnas_idx: [0], agregacion: "lista", filtros: [{ columna_idx: 0, operador: "=", valor: NaN }] },
        ],
        [
            "valor no escalar (booleano)",
            {
                tabla_idx: 0,
                columnas_idx: [0],
                agregacion: "lista",
                filtros: [{ columna_idx: 1, operador: "=", valor: true as unknown as string }],
            },
        ],
        ["limite NaN", { tabla_idx: 0, columnas_idx: [0], agregacion: "lista", filtros: [], limite: NaN }],
    ] as [string, PlanLLM][])("deny-by-default: %s → ok:false sin generar SQL", (_etiqueta, plan) => {
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error.length).toBeGreaterThan(0);
    });

    it("filtros ausente en el JSON (opcional en el schema del LLM) equivale a sin filtros", () => {
        // T1 payload real: esquemaJsonParaLLM NO exige `filtros`; el motor pasa el JSON tal cual.
        const plan = JSON.parse('{"tabla_idx":0,"columnas_idx":[0],"agregacion":"lista"}') as PlanLLM;
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe('SELECT "id" FROM "Reporte" LIMIT $1');
    });

    it("I-03: período + filtro sobre la MISMA columna → el filtro se descarta y manda el período", () => {
        // Regresión del caso real: "este mes" llegó del LLM como rango absoluto
        // a medianoche (creadoEn >= '2026-09-01' AND creadoEn <= '2026-09-01')
        // MÁS período de 30 días; ANDados excluían los datos del día en curso.
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [
                { columna_idx: 3, operador: ">=", valor: "2026-09-01" },
                { columna_idx: 3, operador: "<=", valor: "2026-09-01" },
            ],
            periodo: { columna_idx: 3, dias: 30 },
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            'SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= NOW() - ($1 || \' days\')::interval LIMIT $2',
        );
        expect(r.params).toEqual([30, 100]);
        // Los filtros sobre otras columnas SÍ se conservan junto al período.
        const planMixto: PlanLLM = {
            ...plan,
            filtros: [{ columna_idx: 2, operador: "=", valor: "BULLYING" }],
        };
        const r2 = construirSql(CATALOGO, planMixto, LIMITE_MAXIMO);
        if (!r2.ok) throw new Error(`debía construir: ${r2.error}`);
        expect(r2.sql).toBe(
            'SELECT COUNT(*) AS total FROM "Reporte" WHERE LOWER("categoria"::text) = LOWER($1) AND "creadoEn" >= NOW() - ($2 || \' days\')::interval LIMIT $3',
        );
        expect(r2.params).toEqual(["BULLYING", 30, 100]);
    });

    it("I-07: texto basura en columna de fecha → plan inválido ANTES de ejecutar (nunca 42883 en runtime)", () => {
        // Regresión del caso real: el LLM envió vencimientoSla > 'ahora' —
        // la guarda de tipos lo rechaza determinísticamente con mensaje claro.
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [{ columna_idx: 3, operador: ">", valor: "ahora" }],
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain("no es una fecha válida");
        // Una fecha ISO sí pasa:
        const planOk: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [{ columna_idx: 3, operador: ">", valor: "2026-01-01" }],
        };
        const r2 = construirSql(CATALOGO, planOk, LIMITE_MAXIMO);
        if (!r2.ok) throw new Error(`debía construir: ${r2.error}`);
        expect(r2.sql).toContain('"creadoEn" > $1');
    });

    it("I-12: MAX sobre columna enum/texto → plan inválido ('la más frecuente' no es el máximo alfabético)", () => {
        // Regresión del caso real: '¿cuál es la categoría más frecuente?'
        // devolvió MAX(categoria) = STALKING (alfabético) — confiado y errado.
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [1], // estado: tipo EstadoReporte (no numérico ni fecha)
            agregacion: "maximo",
            filtros: [],
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain("máximo alfabético");
    });

    it("I-14: valor de filtro fuera del dominio declarado de la columna → plan inválido con la lista", () => {
        // Regresión del caso real: prioridad='nueva' (valor que solo existe en
        // `estado`) ANDado con estado='escalada' daba 0 habiendo 254.
        const catConDominio: Catalogo = {
            tablas: [
                {
                    nombreFuente: "AlertaColegio",
                    nombreLegible: "Alertas",
                    descripcion: "Alertas al colegio",
                    columnas: [
                        { nombreFuente: "id", tipo: "text" },
                        { nombreFuente: "estado", tipo: "text", descripcion: "Valores reales: nueva · vista · gestionada · escalada · cerrada" },
                        { nombreFuente: "prioridad", tipo: "text", descripcion: "alta · media · baja" },
                    ],
                },
            ],
        };
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [
                { columna_idx: 1, operador: "=", valor: "escalada" },
                { columna_idx: 2, operador: "=", valor: "nueva" },
            ],
        };
        const r = construirSql(catConDominio, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain("no es un valor válido");
        expect(r.error).toContain("alta · media · baja");

        // Solo con valores del dominio, construye:
        const planOk: PlanLLM = { ...plan, filtros: [{ columna_idx: 1, operador: "=", valor: "ESCALADA" }] };
        const r2 = construirSql(catConDominio, planOk, LIMITE_MAXIMO);
        if (!r2.ok) throw new Error(`debía construir: ${r2.error}`);
        expect(r2.sql).toContain('LOWER("estado"::text) = LOWER($1)');
    });

    it("I-10: período sobre columna NO-fecha (estado) → plan inválido (caso real: 'qué colegios tienen más alertas')", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [0],
            agregacion: "lista",
            filtros: [],
            periodo: { columna_idx: 1, dias: 30 }, // columna 1 = estado (EstadoReporte, NO fecha)
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain("solo aplica a columnas de fecha");
    });

    it("I-05: igualdad de texto es case-insensitive (PI mezcla 'escalada' y 'CONTACTO_INSISTENTE')", () => {        // Regresión del caso real: el LLM envió el valor en una caja distinta a
        // la almacenada y la respuesta era 0 filas habiendo datos (254 escaladas).
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [{ columna_idx: 1, operador: "=", valor: "escalada" }],
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            'SELECT COUNT(*) AS total FROM "Reporte" WHERE LOWER("estado"::text) = LOWER($1) LIMIT $2',
        );
        expect(r.params).toEqual(["escalada", 100]);
        // Y el validador acepta LOWER (sin violaciones).
        const v = validarSql(CATALOGO, r.sql);
        expect(v.valida).toBe(true);
    });

    // ────────────────────────────────────────────────────────────────────────
    // Motor v2 · ventanaAbsoluta (fechas absolutas [desde, hasta), hasta EXCLUSIVO)
    // ────────────────────────────────────────────────────────────────────────

    it("ventanaAbsoluta: rango [desde, hasta) parametrizado con ::date — hasta EXCLUSIVO", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
            ventanaAbsoluta: { columna_idx: 3, desde: "2025-07-01", hasta: "2025-08-01" },
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            'SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= $1::date AND "creadoEn" < $2::date LIMIT $3',
        );
        expect(r.params).toEqual(["2025-07-01", "2025-08-01", 100]);
        // Candado 3: las fechas viajan en params, jamás interpoladas en el SQL.
        expect(r.sql).not.toContain("2025-07-01");
        expect(r.sql).not.toContain("2025-08-01");
    });

    it("ventanaAbsoluta + filtro en otra columna: params ordenados (filtros → desde → hasta → límite)", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [0],
            agregacion: "lista",
            filtros: [{ columna_idx: 1, operador: "=", valor: "CLASIFICADO" }],
            ventanaAbsoluta: { columna_idx: 3, desde: "2025-01-01", hasta: "2026-01-01" },
            limite: 25,
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            'SELECT "id" FROM "Reporte" WHERE LOWER("estado"::text) = LOWER($1) AND "creadoEn" >= $2::date AND "creadoEn" < $3::date LIMIT $4',
        );
        expect(r.params).toEqual(["CLASIFICADO", "2025-01-01", "2026-01-01", 25]);
    });

    it("ventanaAbsoluta manda sobre período y filtros de la MISMA columna (criterio I-03)", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [{ columna_idx: 3, operador: ">=", valor: "2025-06-01" }],
            periodo: { columna_idx: 3, dias: 30 },
            ventanaAbsoluta: { columna_idx: 3, desde: "2025-07-01", hasta: "2025-08-01" },
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        // Sin NOW() ni interval: el período relativo y el filtro de esa columna
        // se descartaron — la ventana absoluta es la única cota temporal.
        expect(r.sql).toBe(
            'SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= $1::date AND "creadoEn" < $2::date LIMIT $3',
        );
        expect(r.params).toEqual(["2025-07-01", "2025-08-01", 100]);

        // Un período sobre OTRA columna de fecha convive con la ventana.
        const planDosCotas: PlanLLM = {
            ...plan,
            filtros: [],
            periodo: { columna_idx: 4, dias: 7 }, // updatedAt
        };
        const r2 = construirSql(CATALOGO, planDosCotas, LIMITE_MAXIMO);
        if (!r2.ok) throw new Error(`debía construir: ${r2.error}`);
        expect(r2.sql).toBe(
            `SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= $1::date AND "creadoEn" < $2::date AND "updatedAt" >= NOW() - ($3 || ' days')::interval LIMIT $4`,
        );
        expect(r2.params).toEqual(["2025-07-01", "2025-08-01", 7, 100]);
    });

    it("ventanaAbsoluta sobre columna NO-fecha → plan inválido (guarda I-10 reutilizada)", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
            ventanaAbsoluta: { columna_idx: 1, desde: "2025-07-01", hasta: "2025-08-01" }, // estado: text
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain("solo aplica a columnas de fecha");
    });

    it("ventanaAbsoluta con formato inválido, fecha imposible o rango invertido → plan inválido (guarda I-07 reutilizada)", () => {
        const base: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [],
            agregacion: "conteo",
            filtros: [],
        };
        const casos: [string, PlanLLM["ventanaAbsoluta"]][] = [
            ["formato DD/MM/AAAA", { columna_idx: 3, desde: "01/07/2025", hasta: "2025-08-01" }],
            ["texto libre", { columna_idx: 3, desde: "julio", hasta: "2025-08-01" }],
            ["fecha imposible (32)", { columna_idx: 3, desde: "2025-07-01", hasta: "2025-08-32" }],
            ["rango invertido", { columna_idx: 3, desde: "2025-08-01", hasta: "2025-07-01" }],
        ];
        for (const [etiqueta, ventanaAbsoluta] of casos) {
            const r = construirSql(CATALOGO, { ...base, ventanaAbsoluta }, LIMITE_MAXIMO);
            expect(r.ok, etiqueta).toBe(false);
            if (r.ok) throw new Error(`debía fallar: ${etiqueta}`);
            expect(r.error).toContain("ventanaAbsoluta");
        }
        // desde == hasta es una ventana VACÍA pero válida ([d, d) = 0 filas).
        const rVacia = construirSql(
            CATALOGO,
            { ...base, ventanaAbsoluta: { columna_idx: 3, desde: "2025-07-01", hasta: "2025-07-01" } },
            LIMITE_MAXIMO,
        );
        if (!rVacia.ok) throw new Error(`debía construir: ${rVacia.error}`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // Motor v2 · agruparPor (GROUP BY + ORDER BY valor DESC)
    // ────────────────────────────────────────────────────────────────────────

    it("agruparPor conteo: SELECT grupo + COUNT(*) AS valor, GROUP BY, ORDER BY valor DESC, LIMIT parametrizado", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], agruparPor_idx: 1 };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            'SELECT "estado" AS grupo, COUNT(*) AS valor FROM "Reporte" GROUP BY "estado" ORDER BY valor DESC LIMIT $1',
        );
        expect(r.params).toEqual([100]);
    });

    it("agruparPor con agregación de columna y filtro: WHERE antes del GROUP BY y params en orden", () => {
        const plan: PlanLLM = {
            tabla_idx: 0,
            columnas_idx: [0],
            agregacion: "suma",
            filtros: [{ columna_idx: 1, operador: "=", valor: "CLASIFICADO" }],
            agruparPor_idx: 2,
            limite: 10,
        };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toBe(
            'SELECT "categoria" AS grupo, SUM("id") AS valor FROM "Reporte" WHERE LOWER("estado"::text) = LOWER($1) GROUP BY "categoria" ORDER BY valor DESC LIMIT $2',
        );
        expect(r.params).toEqual(["CLASIFICADO", 10]);
    });

    it("agruparPor sobre columna enum del catálogo (CategoriaConducta) también agrupa", () => {
        // Los enums de PI (tipo con nombre propio, no 'text') son texto/enum a
        // efectos de la guarda: ni id, ni fecha, ni numérico, ni booleano.
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo", filtros: [], agruparPor_idx: 2 };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        if (!r.ok) throw new Error(`debía construir: ${r.error}`);
        expect(r.sql).toContain('GROUP BY "categoria"');
    });

    it("agruparPor solo aplica a texto/enum: id, fecha, numérica y fuera de rango se rechazan", () => {
        const base = { tabla_idx: 0, columnas_idx: [], agregacion: "conteo" as Agregacion, filtros: [] };
        // Identificador: cada grupo tendría una sola fila (no resume nada).
        const rId = construirSql(CATALOGO, { ...base, agruparPor_idx: 0 }, LIMITE_MAXIMO);
        expect(rId.ok).toBe(false);
        if (rId.ok) throw new Error("debía fallar");
        expect(rId.error).toContain("identificador");
        // Fecha: agrupar por timestamp crudo requiere buckets (fuera de alcance).
        const rFecha = construirSql(CATALOGO, { ...base, agruparPor_idx: 3 }, LIMITE_MAXIMO);
        expect(rFecha.ok).toBe(false);
        if (rFecha.ok) throw new Error("debía fallar");
        expect(rFecha.error).toContain("texto o enum");
        // Numérica (totalReportes de IdentificadorReportado):
        const rNum = construirSql(CATALOGO, { ...base, tabla_idx: 1, agruparPor_idx: 1 }, LIMITE_MAXIMO);
        expect(rNum.ok).toBe(false);
        if (rNum.ok) throw new Error("debía fallar");
        expect(rNum.error).toContain("texto o enum");
        // Índice fuera de rango (deny-by-default):
        const rRango = construirSql(CATALOGO, { ...base, agruparPor_idx: 99 }, LIMITE_MAXIMO);
        expect(rRango.ok).toBe(false);
        if (rRango.ok) throw new Error("debía fallar");
        expect(rRango.error).toContain("agruparPor_idx fuera de rango");
    });

    it("lista + agruparPor → inválido: una lista proyecta filas, no las resume", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [1], agregacion: "lista", filtros: [], agruparPor_idx: 1 };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain('"lista" no admite agruparPor');
    });

    it("I-12 sigue mandando con agruparPor: maximo sobre texto → inválido (la frecuencia se cuenta agrupando)", () => {
        const plan: PlanLLM = { tabla_idx: 0, columnas_idx: [1], agregacion: "maximo", filtros: [], agruparPor_idx: 2 };
        const r = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("debía fallar");
        expect(r.error).toContain("máximo alfabético");
    });
});

// ---------------------------------------------------------------------------
// validador-sql.ts · candados 5 y 6 POST (defensa en profundidad)
// ---------------------------------------------------------------------------

describe("validarSql (candados 5-6 post: solo lectura contra la réplica)", () => {
    it.each([
        ["SELECT literal con LIMIT numérico", 'SELECT "id" FROM "Reporte" LIMIT 10'],
        ["SELECT con todas las columnas y alias de agregado", 'SELECT COUNT(*) AS total FROM "Reporte" LIMIT $2'],
        ["columna que contiene 'update' (límite de palabra no dispara)", 'SELECT "updatedAt" FROM "Reporte" LIMIT 5'],
        ["keywords en minúsculas", 'select "id" from "Reporte" limit 5'],
        ["LIMIT en el máximo permitido", 'SELECT "id" FROM "Reporte" WHERE "estado" = $1 LIMIT 10000'],
        [
            "periodo con NOW() e interval (forma del constructor)",
            `SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= NOW() - ($1 || ' days')::interval LIMIT $2`,
        ],
        [
            "ventana absoluta con ::date parametrizada (forma del constructor, motor v2)",
            'SELECT COUNT(*) AS total FROM "Reporte" WHERE "creadoEn" >= $1::date AND "creadoEn" < $2::date LIMIT $3',
        ],
        [
            "GROUP BY con alias grupo/valor en ORDER BY (forma del constructor, motor v2)",
            'SELECT "estado" AS grupo, COUNT(*) AS valor FROM "Reporte" GROUP BY "estado" ORDER BY valor DESC LIMIT $1',
        ],
        [
            "GROUP BY con WHERE de filtro y período (forma del constructor, motor v2)",
            `SELECT "categoria" AS grupo, SUM("id") AS valor FROM "Reporte" WHERE LOWER("estado"::text) = LOWER($1) AND "creadoEn" >= NOW() - ($2 || ' days')::interval GROUP BY "categoria" ORDER BY valor DESC LIMIT $3`,
        ],
    ])("válido: %s", (_etiqueta, sql) => {
        const r = validarSql(CATALOGO, sql);
        expect(r.violaciones).toEqual([]);
        expect(r.valida).toBe(true);
    });

    it("todo SQL que produce construirSql pasa el validador (integración candados 3+5)", () => {
        const planes: PlanLLM[] = [
            { tabla_idx: 0, columnas_idx: [1, 2], agregacion: "lista", filtros: [] },
            { tabla_idx: 1, columnas_idx: [], agregacion: "conteo", filtros: [] },
            { tabla_idx: 1, columnas_idx: [1], agregacion: "suma", filtros: [] },
            {
                tabla_idx: 0,
                columnas_idx: [0],
                agregacion: "lista",
                filtros: [
                    { columna_idx: 1, operador: "=", valor: "CLASIFICADO" },
                    { columna_idx: 2, operador: "LIKE", valor: "%acoso%" },
                ],
                periodo: { columna_idx: 3, dias: 30 },
                limite: 50,
            },
            // Motor v2: las formas nuevas del constructor también validan.
            {
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                filtros: [],
                ventanaAbsoluta: { columna_idx: 3, desde: "2025-07-01", hasta: "2025-08-01" },
            },
            {
                tabla_idx: 0,
                columnas_idx: [],
                agregacion: "conteo",
                filtros: [],
                agruparPor_idx: 1,
                periodo: { columna_idx: 3, dias: 30 },
            },
            { tabla_idx: 0, columnas_idx: [0], agregacion: "suma", filtros: [], agruparPor_idx: 2 },
        ];
        for (const plan of planes) {
            const construido = construirSql(CATALOGO, plan, LIMITE_MAXIMO);
            if (!construido.ok) throw new Error(`debía construir: ${construido.error}`);
            const validacion = validarSql(CATALOGO, construido.sql);
            expect(validacion.violaciones).toEqual([]);
            expect(validacion.valida).toBe(true);
        }
    });

    it("rechaza INSERT (no empieza con SELECT + palabra prohibida)", () => {
        const r = validarSql(CATALOGO, 'INSERT INTO "Reporte" ("id") VALUES (1)');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("SELECT"))).toBe(true);
        expect(r.violaciones.some((v) => v.includes("INSERT"))).toBe(true);
    });

    it("rechaza DELETE aunque empiece con SELECT (statement encadenada)", () => {
        const r = validarSql(CATALOGO, 'SELECT 1; DELETE FROM "Reporte"');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("';'"))).toBe(true);
        expect(r.violaciones.some((v) => v.includes("DELETE"))).toBe(true);
    });

    it("rechaza múltiple statement con DROP tras ';'", () => {
        const r = validarSql(CATALOGO, 'SELECT "id" FROM "Reporte" LIMIT 5; DROP TABLE "Reporte"');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("';'"))).toBe(true);
        expect(r.violaciones.some((v) => v.includes("DROP"))).toBe(true);
    });

    it("rechaza ';' final aunque la statement sea válida", () => {
        const r = validarSql(CATALOGO, 'SELECT "id" FROM "Reporte" LIMIT 5;');
        expect(r.valida).toBe(false);
        expect(r.violaciones).toHaveLength(1);
        expect(r.violaciones[0]).toContain("';'");
    });

    it("rechaza comentario inline (--)", () => {
        const r = validarSql(CATALOGO, 'SELECT "id" FROM "Reporte" LIMIT 5 -- comentario');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("comentarios"))).toBe(true);
    });

    it("rechaza comentario de bloque (/* */)", () => {
        const r = validarSql(CATALOGO, '/* oculto */ SELECT "id" FROM "Reporte" LIMIT 5');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("comentarios"))).toBe(true);
    });

    it("rechaza SELECT sin LIMIT", () => {
        const r = validarSql(CATALOGO, 'SELECT "id" FROM "Reporte"');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("LIMIT"))).toBe(true);
    });

    it.each([["LIMIT 10001", 10001], ["LIMIT 50000", 50000]] as [string, number][])(
        "rechaza %s por encima del máximo (10000)",
        (_etiqueta, limite) => {
            const r = validarSql(CATALOGO, `SELECT "id" FROM "Reporte" LIMIT ${limite}`);
            expect(r.valida).toBe(false);
            expect(r.violaciones.some((v) => v.includes("máximo permitido"))).toBe(true);
        },
    );

    it("rechaza tabla fuera del catálogo (p.ej. tabla con PII no expuesta)", () => {
        const r = validarSql(CATALOGO, 'SELECT "id" FROM "Usuario" LIMIT 5');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes('Tabla fuera del catálogo: "Usuario"'))).toBe(true);
    });

    it("rechaza columna citada fuera del catálogo", () => {
        const r = validarSql(CATALOGO, 'SELECT "password" FROM "Reporte" LIMIT 5');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes('Columna fuera del catálogo: "password"'))).toBe(true);
    });

    it("rechaza columna desnuda fuera del catálogo", () => {
        const r = validarSql(CATALOGO, 'SELECT password FROM "Reporte" LIMIT 5');
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("password"))).toBe(true);
    });

    it("rechaza 'valor'/'grupo' desnudos si NO fueron declarados con AS (los aliases no aflojan nada)", () => {
        // Motor v2: el validador acepta ORDER BY valor SOLO porque el constructor
        // declaró `AS valor`. Sin el AS, esas palabras siguen siendo
        // identificadores ilegítimos.
        const rValor = validarSql(CATALOGO, 'SELECT valor FROM "Reporte" LIMIT 5');
        expect(rValor.valida).toBe(false);
        expect(rValor.violaciones.some((v) => v.includes("valor"))).toBe(true);
        const rGrupo = validarSql(CATALOGO, 'SELECT "id" FROM "Reporte" GROUP BY "estado" ORDER BY grupo DESC LIMIT 5');
        expect(rGrupo.valida).toBe(false);
        expect(rGrupo.violaciones.some((v) => v.includes("grupo"))).toBe(true);
    });

    it("rechaza SELECT sin FROM identificable", () => {
        const r = validarSql(CATALOGO, "SELECT 1 LIMIT 5");
        expect(r.valida).toBe(false);
        expect(r.violaciones.some((v) => v.includes("FROM"))).toBe(true);
    });

    it("rechaza SQL vacío", () => {
        const r = validarSql(CATALOGO, "   ");
        expect(r.valida).toBe(false);
        expect(r.violaciones.length).toBeGreaterThan(0);
    });
});
