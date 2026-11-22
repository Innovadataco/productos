// Forma de las migraciones de los rendimientos del fondo (frente fondo-rendimientos, T1). Lo que muerde en la base lo
// prueba tests/integracion/rendimiento-fondo-reglas.test.ts; aquí, el orden que hace segura la migración en producción:
// - los valores nuevos de los enums van solos, en su propia migración (un valor no se usa en la transacción en que
//   nace), como en C1;
// - la migración de la tabla es aditiva: lock_timeout primero, nada se borra ni se renombra, y el CHECK nuevo de
//   ajuste_caja (que ya tiene filas) nace NOT VALID y se valida en la misma migración;
// - la función del disparador sigue el patrón de inv_movimiento_fondo_coherente: sin SET ni SECURITY DEFINER y con
//   `public.` explícito.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRACIONES = path.join(__dirname, "..", "..", "..", "..", "prisma", "migrations");
const leer = (carpeta: string) => readFileSync(path.join(MIGRACIONES, carpeta, "migration.sql"), "utf8");
const sinComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const sentencias = (sql: string) => sinComentarios(sql).split(";").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);

describe("migración de los tipos de los rendimientos del fondo", () => {
  it("solo agrega RENDIMIENTO_FIC a CategoriaAjusteCaja y REGISTRO_RENDIMIENTOS_FIC a TipoFuente", () => {
    expect(sentencias(leer("20261122132200_rendimientos_fondo_tipos"))).toEqual([
      `ALTER TYPE "CategoriaAjusteCaja" ADD VALUE 'RENDIMIENTO_FIC'`,
      `ALTER TYPE "TipoFuente" ADD VALUE 'REGISTRO_RENDIMIENTOS_FIC'`,
    ]);
  });
});

describe("migración de la tabla rendimiento_fondo", () => {
  const sql = leer("20261122132300_rendimientos_fondo");
  const codigo = sinComentarios(sql);
  const lista = sentencias(sql);

  it("empieza por lock_timeout", () => {
    expect(lista[0]).toBe("SET LOCAL lock_timeout = '5s'");
  });

  it("es aditiva: no borra, no renombra ni cambia tipos", () => {
    expect(codigo).not.toMatch(/\bDROP\b|\bRENAME\b|\bTRUNCATE\b|ALTER\s+COLUMN|\bDELETE\b\s+FROM|\bUPDATE\s+"/i);
  });

  it("no agrega valores de enum (van en la migración anterior)", () => {
    expect(codigo).not.toMatch(/ADD\s+VALUE/i);
  });

  it("el CHECK de ajuste_caja nace NOT VALID y se valida en la misma migración", () => {
    const i = lista.findIndex((s) => s.startsWith(`ALTER TABLE "ajuste_caja" ADD CONSTRAINT "ajuste_caja_rendimiento_fic_chk"`));
    expect(i).toBeGreaterThan(0);
    expect(lista[i]).toMatch(/CHECK \("categoria" <> 'RENDIMIENTO_FIC' OR "monto" > 0\) NOT VALID$/);
    expect(lista[i + 1]).toBe(`ALTER TABLE "ajuste_caja" VALIDATE CONSTRAINT "ajuste_caja_rendimiento_fic_chk"`);
  });

  it("los CHECK de la tabla: valor positivo y sin NaN, fecha finita, y solo el rendimiento lleva su ajuste de caja", () => {
    for (const s of [
      `ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_valor_chk" CHECK ("valor" > 0 AND "valor" <> 'NaN')`,
      `ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_fecha_chk" CHECK (isfinite("fecha"))`,
      `ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_enlace_chk" CHECK (("tipo" = 'RENDIMIENTO') = ("ajusteCajaId" IS NOT NULL))`,
    ]) {
      expect(lista).toContain(s);
    }
  });

  it("toda llave foránea es RESTRICT / RESTRICT", () => {
    const fks = lista.filter((s) => /FOREIGN KEY/.test(s));
    expect(fks).toHaveLength(3);
    for (const fk of fks) expect(fk).toMatch(/ON DELETE RESTRICT ON UPDATE RESTRICT$/);
  });

  it("la función de coherencia: sin SET, sin SECURITY DEFINER, con public. y sin valores en los mensajes", () => {
    const funcion = /CREATE FUNCTION "inv_rendimiento_fondo_coherente"\(\)[\s\S]*?\$\$;/.exec(codigo)?.[0] ?? "";
    expect(funcion).toMatch(/^CREATE FUNCTION "inv_rendimiento_fondo_coherente"\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$/);
    expect(funcion).not.toMatch(/\bSET\b|SECURITY/);
    expect(funcion).toMatch(/FROM public\."instrumento"/);
    expect(funcion).toMatch(/FROM public\."ajuste_caja"/);
    // Los mensajes son fijos: ningún RAISE interpola un valor (%).
    for (const m of funcion.matchAll(/RAISE EXCEPTION '([^']*)'/g)) expect(m[1]).not.toContain("%");
  });

  it("coherencia antes de insertar o cambiar, y solo inserción", () => {
    expect(lista).toContain(
      `CREATE TRIGGER "rendimiento_fondo_coherente" BEFORE INSERT OR UPDATE ON "rendimiento_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_rendimiento_fondo_coherente"()`,
    );
    expect(lista).toContain(
      `CREATE TRIGGER "rendimiento_fondo_solo_insercion" BEFORE UPDATE OR DELETE ON "rendimiento_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"()`,
    );
  });
});
