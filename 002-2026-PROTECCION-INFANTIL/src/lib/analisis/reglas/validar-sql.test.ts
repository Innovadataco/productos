/**
 * SPEC-224 (002-PI-125, FR-006/FR-014, SC-002): tests del validador estático
 * de SQL del panel de reglas. Cubre queries válidas, ≥10 casos maliciosos o
 * erróneos y literales con palabras reservadas (no son mutación). Sin BD.
 */
import { describe, it, expect } from "vitest";
import { validarSqlReglaPanel, sinLiterales } from "./validar-sql";

describe("validarSqlReglaPanel — queries válidas", () => {
    const validas = [
        "SELECT 1",
        "select id, nombre FROM \"usuarios\"",
        "  WITH activas AS (SELECT id FROM suscripciones) SELECT * FROM activas",
        "SELECT s.id AS \"suscripcionId\", s.\"fechaFin\" FROM \"suscripciones\" s WHERE s.estado = 'ACTIVA'",
        "SELECT count(*) FROM pagos WHERE estado = 'AUTORIZADO';", // ';' final permitido
        "SELECT 'DELETE FROM x' AS ejemplo", // palabra prohibida dentro de literal
        "SELECT c.nombre FROM colegios c -- comentario con DROP\nWHERE c.activo = true",
        "SELECT /* comentario con UPDATE */ 1",
        "SELECT $$texto con DELETE$$ AS doc",
        "SELECT 'it''s' AS escapado",
    ];
    for (const sql of validas) {
        it(`acepta: ${sql.slice(0, 60)}`, () => {
            const r = validarSqlReglaPanel(sql);
            expect(r).toEqual({ ok: true });
        });
    }
});

describe("validarSqlReglaPanel — casos maliciosos o erróneos (SC-002)", () => {
    const casos: Array<{ sql: string; razon: string }> = [
        { sql: "DELETE FROM suscripciones", razon: "no inicia con SELECT/WITH" },
        { sql: "INSERT INTO pagos VALUES (1)", razon: "no inicia con SELECT/WITH" },
        { sql: "DROP TABLE reportes", razon: "no inicia con SELECT/WITH" },
        { sql: "UPDATE reglas_recomendacion SET activa = false", razon: "no inicia con SELECT/WITH" },
        { sql: "SELECT 1; DELETE FROM suscripciones", razon: "multi-sentencia" },
        { sql: "SELECT 1; SELECT 2", razon: "multi-sentencia aunque sea SELECT" },
        { sql: "WITH x AS (SELECT 1) DELETE FROM t", razon: "WITH seguido de mutación" },
        { sql: "SELECT * FROM t WHERE id IN (SELECT id FROM u); TRUNCATE t", razon: "multi-sentencia con TRUNCATE" },
        { sql: "SELECT pg_sleep(1); GRANT ALL ON t TO public", razon: "GRANT en segunda sentencia" },
        { sql: "DO $$ BEGIN RAISE NOTICE 'x'; END $$", razon: "bloque DO" },
        { sql: "CREATE INDEX i ON t(a)", razon: "CREATE no inicia con SELECT" },
        { sql: "COPY (SELECT 1) TO STDOUT", razon: "COPY no inicia con SELECT" },
        { sql: "WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x", razon: "mutación dentro de CTE" },
        { sql: "SELECT 1 FROM t CALL proc()", razon: "token CALL" },
        { sql: "", razon: "vacía" },
        { sql: "   -- solo comentario", razon: "vacía tras quitar comentarios" },
        { sql: "SELECT 'literal sin cerrar", razon: "literal sin cerrar no inicia bien tras saneado" },
        { sql: "SELECT 1 REVOKE", razon: "token REVOKE" },
        { sql: "SELECT EXECUTE IMMEDIATE 'x'", razon: "token EXECUTE" },
        { sql: "ALTER TABLE t ADD COLUMN c int", razon: "ALTER no inicia con SELECT" },
    ];
    for (const { sql, razon } of casos) {
        it(`rechaza (${razon}): ${sql.slice(0, 50)}`, () => {
            const r = validarSqlReglaPanel(sql);
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0);
        });
    }
});

describe("sinLiterales", () => {
    it("quita comillas simples con escape ''", () => {
        expect(sinLiterales("SELECT 'it''s DELETE' AS x")).toBe("SELECT   AS x");
    });
    it("quita dollar-quoted con tag", () => {
        expect(sinLiterales("SELECT $tag$DELETE$tag$")).toBe("SELECT  ");
    });
    it("quita identificadores entre comillas dobles", () => {
        expect(sinLiterales('SELECT "delete" FROM "tabla"')).toBe("SELECT   FROM  ");
    });
});
