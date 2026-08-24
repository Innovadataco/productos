/**
 * SPEC-221 (002-PI-122): tests unitarios del validador estático de SQL (capa 1
 * del sandbox). Batería SC-002: el 100% de las queries no-read-only se rechazan
 * antes de tocar la base.
 */
import { describe, it, expect } from "vitest";
import { validarSqlRegla } from "./ejecutor-sql";

describe("validarSqlRegla", () => {
    it("acepta una query SELECT simple", () => {
        expect(validarSqlRegla('SELECT id FROM "Suscripcion"')).toEqual({ ok: true });
    });

    it("acepta una query WITH (CTE)", () => {
        const sql = "WITH semana AS (SELECT 1 AS uno) SELECT * FROM semana";
        expect(validarSqlRegla(sql)).toEqual({ ok: true });
    });

    it("acepta SELECT con espacios/saltos iniciales y minúsculas", () => {
        expect(validarSqlRegla("\n\n  select id from \"Plan\"")).toEqual({ ok: true });
    });

    const casosRechazo: Array<[string, string]> = [
        ["DELETE", 'DELETE FROM "Usuario"'],
        ["UPDATE", 'UPDATE "Usuario" SET email = \'x\''],
        ["DROP", 'DROP TABLE "Usuario"'],
        ["INSERT", 'INSERT INTO "Usuario" (id) VALUES (\'1\')'],
        ["ALTER", 'ALTER TABLE "Usuario" ADD COLUMN x text'],
        ["TRUNCATE", 'TRUNCATE TABLE "Usuario"'],
        ["GRANT", 'GRANT SELECT ON "Usuario" TO public'],
        ["sin SELECT", 'DELETE FROM "ParametroSistema" WHERE true'],
        ["CREATE", "CREATE TABLE hackeo (id int)"],
        ["SET", "SET statement_timeout = 0; SELECT 1"],
        ["REVOKE", 'REVOKE SELECT ON "Usuario" FROM public'],
        ["CALL", "CALL borrar_todo()"],
        ["EXECUTE", "EXECUTE mi_plan"],
        ["COPY", 'COPY "Usuario" TO \'/tmp/u.csv\''],
        ["vacía", "   "],
        ["comentario que oculta escritura", "-- SELECT\n DELETE FROM \"Usuario\""],
    ];

    it.each(casosRechazo)("rechaza: %s", (_nombre, sql) => {
        const resultado = validarSqlRegla(sql);
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) expect(resultado.motivo.length).toBeGreaterThan(0);
    });

    it("no confunde subcadenas con tokens (p. ej. 'insertado' como dato)", () => {
        const sql = "SELECT 'valor insertado por el cliente' AS nota";
        expect(validarSqlRegla(sql)).toEqual({ ok: true });
    });
});
