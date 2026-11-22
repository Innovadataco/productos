// Candado de los instantes del plan y del diario (migración *_instantes_base): «cuándo se registró» lo pone la BASE,
// no la app. plan_version."creadaEn", decision."registradaEn" y enlace_decision_orden."creadoEn":
//  - en el esquema, `@default(dbgenerated("clock_timestamp()"))`: Prisma 5.22 deja de mandarlos en el INSERT
//    (verificado con su registro de consultas) y privilegios.sql ya no se los da a inv_app (nombrarlos da 42501);
//  - en la migración, el DEFAULT clock_timestamp() (el momento de la fila: now() sería el inicio de la transacción, y
//    una transacción abierta desde antes fecharía en el pasado) y, de defensa en profundidad, un disparador BEFORE
//    INSERT por tabla que lo fija para todo rol que no sea el dueño, aunque alguien le diera el permiso de columna.
// Las funciones van SIN `SET search_path` (tests/unit/produccion/verificar-esquema.test.ts lo exige para las que no
// son de precios ni de datos oficiales): por eso todo lo que se resuelve por nombre va calificado con pg_catalog.
// La conducta la prueban tests/integracion/instantes-base.test.ts (Mac y CI) y roles-base.test.ts (inv_app real, CI).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../../../", import.meta.url));
const dirMigraciones = path.join(raiz, "prisma/migrations");
const carpetas = readdirSync(dirMigraciones, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const propias = carpetas.filter((c) => c.endsWith("_instantes_base"));
const crudo = propias.length === 1 ? readFileSync(path.join(dirMigraciones, propias[0]!, "migration.sql"), "utf8") : "";
const codigo = crudo.replace(/--.*$/gm, "");
const funciones = [...codigo.matchAll(/CREATE FUNCTION "([^"]+)"\(\)([\s\S]*?)\$\$;/g)].map((m) => ({ nombre: m[1]!, cuerpo: m[2]! }));

/** [tabla, columna del instante] */
const INSTANTES = [
  ["plan_version", "creadaEn"],
  ["decision", "registradaEn"],
  ["enlace_decision_orden", "creadoEn"],
] as const;

describe("migración *_instantes_base", () => {
  it("existe una sola, y corre después de la migración que crea las tablas del plan", () => {
    expect(propias).toHaveLength(1);
    expect(carpetas).toContain("20261121024044_plan_decisiones");
    expect(propias[0]! > "20261121024044_plan_decisiones").toBe(true);
  });

  it("es aditiva: el DEFAULT de los tres instantes, funciones y disparadores; no toca ni revisa filas", () => {
    expect(codigo).toMatch(/^\s*SET LOCAL lock_timeout = '5s';/);
    for (const prohibido of [/\bDROP\b/i, /\bRENAME\b/i, /\bTRUNCATE\b/i, /\bALTER\s+(COLUMN\s+"[^"]+"\s+(?!SET DEFAULT)|TYPE)/i, /^\s*(UPDATE|DELETE|INSERT)\b/im, /\bVALIDATE\b/i, /\bNOT\s+NULL\b/i]) {
      expect(codigo).not.toMatch(prohibido);
    }
    const alteraciones = [...codigo.matchAll(/ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" SET DEFAULT ([^;]+);/g)].map((m) => [m[1], m[2], m[3]]);
    expect(alteraciones.sort()).toEqual(INSTANTES.map(([t, c]) => [t, c, "clock_timestamp()"]).sort());
    expect([...codigo.matchAll(/\bALTER TABLE\b/g)]).toHaveLength(INSTANTES.length);
  });

  it("una función y un disparador BEFORE INSERT por tabla, con nombres entre comillas (el guardián los sigue)", () => {
    expect(funciones.map((f) => f.nombre).sort()).toEqual(INSTANTES.map(([t]) => `inv_${t}_instante`).sort());
    const disparadores = [...codigo.matchAll(/CREATE TRIGGER "([^"]+)" ([^;]+);/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(disparadores.sort()).toEqual(
      INSTANTES.map(([t]) => `${t}_instante BEFORE INSERT ON "${t}" FOR EACH ROW EXECUTE FUNCTION "inv_${t}_instante"()`).sort(),
    );
  });

  it("cada función: SECURITY INVOKER, sin SET, exime solo al dueño y fija su instante con pg_catalog.clock_timestamp()", () => {
    expect(codigo).not.toMatch(/SECURITY\s+DEFINER/i);
    for (const [tabla, columna] of INSTANTES) {
      const f = funciones.find((x) => x.nombre === `inv_${tabla}_instante`);
      expect(f, tabla).toBeDefined();
      const cuerpo = f!.cuerpo;
      expect(cuerpo, tabla).toMatch(/^\s*RETURNS trigger LANGUAGE plpgsql AS \$\$/);
      expect(cuerpo, tabla).toMatch(
        /IF pg_catalog\.pg_has_role\(\(SELECT c\.relowner FROM pg_catalog\.pg_class c WHERE c\.oid OPERATOR\(pg_catalog\.=\) TG_RELID\), 'USAGE'\) THEN\s+RETURN NEW;\s+END IF;/,
      );
      expect(cuerpo, tabla).toContain(`NEW."${columna}" := pg_catalog.clock_timestamp();`);
      // Ni salida por GUC, ni una hora que se pueda sostener (now() o statement_timestamp()), ni nombres sin calificar.
      expect(cuerpo, tabla).not.toMatch(/current_setting|set_config|session_user|current_user|\bnow\s*\(|statement_timestamp|transaction_timestamp|current_timestamp/i);
      expect(cuerpo.replace(/pg_catalog\.(clock_timestamp|pg_has_role)\(/g, ""), tabla).not.toMatch(/\b(clock_timestamp|pg_has_role)\(/);
      expect(cuerpo.replace(/pg_catalog\.pg_class/g, ""), tabla).not.toMatch(/\bpg_class\b/);
      // Una sola columna por función: no puede fijar otra.
      expect([...cuerpo.matchAll(/NEW\."([^"]+)"\s*:=/g)].map((m) => m[1]), tabla).toEqual([columna]);
    }
  });
});

// La exención de los disparadores es «tener los privilegios del dueño de la tabla»: si inv_app o inv_precios fueran
// miembros del dueño (GRANT inv_dueno TO …), con SET ROLE serían el dueño y fijarían el instante (security-reviewer,
// MEDIO). El guardián ya lo exigía para las tablas de precios; ahora también para las tres de los instantes.
describe("guardián del esquema: nadie de la web ni del servicio es miembro del dueño de las tablas de los instantes", () => {
  const guardian = readFileSync(path.join(raiz, "scripts/verificar-esquema.sql"), "utf8");
  it("la revisión de membresía nombra plan_version, decision y enlace_decision_orden (además de las de precios)", () => {
    const m = /WHERE r\.rolname IN \('inv_app', 'inv_precios'\)\s+AND c\.oid IN \(([^)]*(?:\)[^)]*)*?)\)\s+AND pg_has_role\(r\.oid, c\.relowner, 'MEMBER'\)/.exec(guardian);
    expect(m, "bloque de membresía").not.toBeNull();
    const tablas = [...m![1]!.matchAll(/to_regclass\('public\.([a-z_]+)'\)/g)].map((x) => x[1]);
    expect(tablas.sort()).toEqual(["decision", "enlace_decision_orden", "plan_version", "precio_cierre", "valor_unidad_fondo"]);
  });
});

describe("esquema: los instantes del plan los genera la base (Prisma no los manda)", () => {
  const esquema = readFileSync(path.join(raiz, "prisma/schema.prisma"), "utf8").replace(/\/\/.*$/gm, "");
  const modelo = (tabla: string): string =>
    [...esquema.matchAll(/model \w+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]!).find((c) => c.includes(`@@map("${tabla}")`)) ?? "";

  it.each(INSTANTES)("%s.%s: DateTime con @default(dbgenerated(\"clock_timestamp()\")) y @db.Timestamptz(6)", (tabla, columna) => {
    const cuerpo = modelo(tabla);
    expect(cuerpo, tabla).not.toBe("");
    expect(cuerpo).toMatch(new RegExp(`\\n\\s+${columna}\\s+DateTime\\s+@default\\(dbgenerated\\("clock_timestamp\\(\\)"\\)\\)\\s+@db\\.Timestamptz\\(6\\)\\s*\\n`));
  });

  it("ninguna de las cuatro tablas del plan conserva un @default(now()) (Prisma lo mandaría desde el cliente)", () => {
    for (const tabla of ["plan_version", "regla_plan", "decision", "enlace_decision_orden"]) {
      const cuerpo = modelo(tabla);
      expect(cuerpo, tabla).not.toBe("");
      expect(cuerpo, tabla).not.toMatch(/@default\(now\(\)\)/);
    }
  });
});
