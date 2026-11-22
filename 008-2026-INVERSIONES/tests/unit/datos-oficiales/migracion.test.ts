// Forma de las migraciones de datos oficiales (fase C, C1). Lo que muerde en la base lo prueba
// tests/integracion/reglas-datos-oficiales.test.ts; aquí, el orden que hace segura la migración en producción:
// - el valor nuevo del enum va solo, en su propia migración (no se usa en la misma transacción en que nace);
// - lock_timeout primero (una carga en curso no la cuelga: falla y se ve); después los LOCK, en el orden en que las
//   cargas toman esas tablas (fila_fuente antes que el hecho, src/importacion/trii/guardar.ts), y la guardia antes
//   de cualquier DDL: si dividendo_decretado tiene filas o una columna vieja de dividendo trae valor, no cambia nada;
// - inv_solo_retiro no exime a nadie (ni al dueño ni por inv.reversion) y la información relevante (P2) no entra.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRACIONES = path.join(__dirname, "..", "..", "..", "prisma", "migrations");
const leer = (carpeta: string) => readFileSync(path.join(MIGRACIONES, carpeta, "migration.sql"), "utf8");
const sinComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const sentencias = (sql: string) => sinComentarios(sql).split(";").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);

describe("migración de los tipos de datos oficiales", () => {
  it("solo agrega REGISTRO_DECRETOS a TipoFuente", () => {
    expect(sentencias(leer("20261122030000_datos_oficiales_tipos"))).toEqual([`ALTER TYPE "TipoFuente" ADD VALUE 'REGISTRO_DECRETOS'`]);
  });
});

describe("migración de datos oficiales", () => {
  const sql = leer("20261122030100_datos_oficiales");
  const codigo = sinComentarios(sql);
  const lista = sentencias(sql);
  const guardia = /-- guardia:inicio\n([\s\S]*?)-- guardia:fin/.exec(sql)?.[1] ?? "";

  it("empieza por lock_timeout y los LOCK, en el orden de las cargas", () => {
    expect(lista.slice(0, 3)).toEqual([
      "SET LOCAL lock_timeout = '5s'",
      'LOCK TABLE "fila_fuente" IN SHARE ROW EXCLUSIVE MODE',
      'LOCK TABLE "dividendo", "dividendo_decretado" IN ACCESS EXCLUSIVE MODE',
    ]);
  });

  it("la guardia va justo después de los LOCK y antes de cualquier DDL", () => {
    expect(guardia).toMatch(/^DO \$\$/);
    const inicio = codigo.indexOf(guardia.trim());
    expect(inicio).toBeGreaterThan(codigo.indexOf("ACCESS EXCLUSIVE MODE"));
    const antes = codigo.slice(0, inicio);
    expect(antes).not.toMatch(/\b(CREATE|ALTER|DROP)\b/);
  });

  it("la guardia cuenta las filas de dividendo_decretado y cada columna vieja de dividendo, y falla cerrada", () => {
    for (const patron of [/FROM "dividendo_decretado"/, /"montoBruto" IS NOT NULL/, /"retencion" IS NOT NULL/, /"tasaRetencion" IS NOT NULL/, /"decretadoId" IS NOT NULL/]) {
      expect(guardia).toMatch(patron);
    }
    expect(guardia.match(/RAISE EXCEPTION/g)).toHaveLength(2);
    // Sin public.: así la prueba de integración la corre contra tablas TEMP que tapan a las reales.
    expect(guardia).not.toMatch(/public\./);
  });

  it("inv_solo_retiro: sin exención del dueño, sin salida por inv.reversion, sin SECURITY DEFINER y con search_path fijo", () => {
    const funcion = /CREATE FUNCTION "inv_solo_retiro"\(\)[\s\S]*?\$\$;/.exec(codigo)?.[0] ?? "";
    // search_path fijo, solo pg_catalog (no lee tablas) y pg_temp al final: el día que otro rol escriba estas tablas
    // (C7), un objeto suyo no puede sombrear to_jsonb, now() ni los operadores.
    expect(funcion).toMatch(/RETURNS trigger LANGUAGE plpgsql\nSET search_path = pg_catalog, pg_temp AS \$\$/);
    expect(funcion).not.toMatch(/pg_has_role|current_setting|inv\.reversion|SECURITY/);
    // La hora del registro la pone la base: el disparador le pasa la columna.
    expect(codigo).toMatch(/CREATE TRIGGER "valor_serie_oficial_retiro" BEFORE INSERT OR UPDATE OR DELETE ON "valor_serie_oficial" FOR EACH ROW EXECUTE FUNCTION "inv_solo_retiro"\('traidoEn'\)/);
    expect(codigo).toMatch(/CREATE TRIGGER "dividendo_decretado_retiro" BEFORE INSERT OR UPDATE OR DELETE ON "dividendo_decretado" FOR EACH ROW EXECUTE FUNCTION "inv_solo_retiro"\('registradoEn'\)/);
  });

  it("la columna fuente se renombra (no se borra) y las columnas viejas de dividendo no se borran", () => {
    expect(codigo).toMatch(/ALTER TABLE "dividendo_decretado" RENAME COLUMN "fuente" TO "referenciaOficial"/);
    expect(codigo).not.toMatch(/DROP COLUMN|DROP TABLE/);
  });

  it("la información relevante (P2) queda fuera", () => {
    expect(codigo).not.toMatch(/REGISTRO_RELEVANTE|informacion_relevante/i);
  });
});
