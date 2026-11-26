// Tabla config_ia (fase E, E8) en el texto del esquema y de su migración: el modelo, las CHECK espejo de las constantes
// de src/ia (una sola fuente de verdad por lista), la hora que pone la base, la solo inserción y la migración aditiva.
// Que muerdan de verdad lo prueban tests/integracion/ia/config-ia-reglas.test.ts (base real) y el guardián del esquema.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COLUMNAS_CONFIG_IA, HORAS_RESUMEN, LIMITE_MAX_BD_S, LIMITE_MAX_S, LIMITE_MIN_S, MAX_LARGO_MOTIVO_CONFIG, MODOS_CON_LOCAL, MODOS_CON_NUBE, TAREAS_IA, TEMPERATURA_MAX_CENTESIMAS,
  TAREAS_OBLIGATORIAS, TOPE_MAX_MICRO_USD, TOPE_MIN_MICRO_USD,
} from "@/ia/config/parametros";
import { PATRON_NOMBRE_MODELO_LOCAL } from "@/ia/local/modelos";
import { TECHO_TOPE_MICRO_USD } from "@/ia/nube/config";
import { ESFUERZOS_NUBE, MODELOS_NUBE } from "@/ia/nube/peticion";
import { MODOS_PUERTAS, ordenDePuertas } from "@/ia/puertas";

const raiz = fileURLToPath(new URL("../../../../", import.meta.url));
const leer = (relativa: string) => readFileSync(path.join(raiz, relativa), "utf8");
const esquema = leer("prisma/schema.prisma");
const carpetas = readdirSync(path.join(raiz, "prisma/migrations"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const propias = carpetas.filter((c) => c.endsWith("_config_ia"));
const migracion = propias[0] ? leer(`prisma/migrations/${propias[0]}/migration.sql`) : "";
const sql = migracion.replace(/--.*$/gm, "");
const modelo = (/model ConfigIa \{([\s\S]*?)\n\}/.exec(esquema)?.[1] ?? "").replace(/\/\/.*$/gm, "");
const campo = (nombre: string): string => new RegExp(`^\\s+${nombre}\\s+(.*)$`, "m").exec(modelo)?.[1]?.trim() ?? "";
const check = (nombre: string): string => new RegExp(`CONSTRAINT "${nombre}" CHECK \\(([\\s\\S]*?)\\);\\n`).exec(sql)?.[1] ?? "";
// Frente B (B3): la segunda migración de la IA cambia DOS CHECK (tareas y usa) para admitir SIMULACION. La definición vigente
// de esas dos es la de M2; las demás siguen siendo las de la migración original.
const propiasSim = carpetas.filter((c) => c.endsWith("_config_ia_simulacion"));
const migracionSim = propiasSim[0] ? leer(`prisma/migrations/${propiasSim[0]}/migration.sql`) : "";
const sqlSim = migracionSim.replace(/--.*$/gm, "");
const checkSim = (nombre: string): string => new RegExp(`ADD CONSTRAINT "${nombre}" CHECK \\(([\\s\\S]*?)\\);\\n`).exec(sqlSim)?.[1] ?? "";
/** Los literales de un `ARRAY['A', 'B']` de la CHECK (la primera aparición tras `marca`), como lista. */
const arreglo = (texto: string, marca: string): string[] => {
  const i = texto.indexOf(marca);
  const m = i < 0 ? null : /ARRAY\[([^\]]*)\]/.exec(texto.slice(i + marca.length));
  return m ? [...m[1]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!) : [];
};
const mismoConjunto = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
/** El invariante entre las listas del código y las de la CHECK: obligatorias = las del `?&`; obligatorias ⊆ TAREAS_IA ⊆ admitidas. */
const invariante = (obligatorias: readonly string[], ia: readonly string[], admitidas: readonly string[], exigidasCheck: readonly string[]): boolean =>
  mismoConjunto(obligatorias, exigidasCheck) && obligatorias.every((t) => ia.includes(t)) && ia.every((t) => admitidas.includes(t));
const literales = (texto: string): string[] => [...texto.matchAll(/'([^']*)'/g)].map((m) => m[1]!);

describe("modelo ConfigIa en prisma/schema.prisma", () => {
  it("existe, mapeado a config_ia, con exactamente las columnas de la lista única", () => {
    expect(modelo).toMatch(/@@map\("config_ia"\)/);
    const columnas = modelo.split("\n").map((l) => /^\s+(\w+)\s+(\w+)/.exec(l)).filter((m): m is RegExpExecArray => m !== null && m[2] !== "Usuario").map((m) => m[1]!);
    expect([...columnas].sort()).toEqual([...COLUMNAS_CONFIG_IA].sort());
  });

  it("tipos: versión Int única, el tope en Decimal(6,2) (dinero, nunca Float), la hora de la base con clock_timestamp()", () => {
    expect(campo("version")).toMatch(/^Int\s+@unique$/);
    expect(campo("topeMensualUsd")).toMatch(/^Decimal\?\s+@db\.Decimal\(6, 2\)$/);
    expect(campo("temperaturaLocal")).toMatch(/^Decimal\s+@db\.Decimal\(3, 2\)$/);
    expect(campo("tareas")).toMatch(/^Json$/);
    expect(campo("creadaEn")).toMatch(/^DateTime\s+@default\(dbgenerated\("clock_timestamp\(\)"\)\) @db\.Timestamptz\(6\)/);
    expect(campo("autor")).toMatch(/onDelete: Restrict, onUpdate: Restrict/);
    expect(modelo).not.toMatch(/Float|now\(\)/);
    expect(modelo).toMatch(/@@index\(\[autorId\]\)/);
  });
});

describe("migración *_config_ia_analisis_demanda (el interruptor del botón «Analizar con IA»)", () => {
  const dir = carpetas.find((c) => c.endsWith("_config_ia_analisis_demanda"));
  const sqlNueva = dir ? leer(`prisma/migrations/${dir}/migration.sql`).replace(/--.*$/gm, "") : "";

  it("existe y es posterior a la de config_ia", () => {
    expect(dir).toBeDefined();
    expect(carpetas.indexOf(dir!)).toBeGreaterThan(carpetas.indexOf(propias[0]!));
  });

  it("solo agrega la columna booleana NOT NULL con valor falso por omisión (falla cerrada) en config_ia; nada se borra", () => {
    expect(sqlNueva.replace(/\s+/g, " ").trim()).toBe('ALTER TABLE "config_ia" ADD COLUMN "analisisDemanda" BOOLEAN NOT NULL DEFAULT false;');
  });

  it("el modelo Prisma la declara igual: Boolean @default(false)", () => {
    expect(campo("analisisDemanda")).toMatch(/^Boolean\s+@default\(false\)$/);
  });
});

describe("migración *_config_ia", () => {
  it("es una sola y aditiva: crea su tabla y no toca ninguna otra", () => {
    expect(propias).toHaveLength(1);
    expect(sql).toMatch(/CREATE TABLE "config_ia"/);
    expect([...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]).every((t) => t === "config_ia")).toBe(true);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|TRIGGER|FUNCTION)/i);
  });

  it("los modos de la CHECK son los de MODOS_PUERTAS, y los que usan cada puerta salen de ordenDePuertas", () => {
    expect(literales(check("config_ia_modo_chk"))).toEqual([...MODOS_PUERTAS]);
    expect([...MODOS_CON_LOCAL]).toEqual(MODOS_PUERTAS.filter((m) => ordenDePuertas(m).includes("local")));
    expect([...MODOS_CON_NUBE]).toEqual(MODOS_PUERTAS.filter((m) => ordenDePuertas(m).includes("nube")));
    const usa = checkSim("config_ia_usa_chk");
    expect(usa).toContain(`"modo" NOT IN (${MODOS_CON_LOCAL.map((m) => `'${m}'`).join(", ")})`);
    expect(usa).toContain(`"modo" NOT IN (${MODOS_CON_NUBE.map((m) => `'${m}'`).join(", ")})`);
  });

  it("modelos de la nube, esfuerzos y horas: espejo de sus listas", () => {
    expect(literales(check("config_ia_modelo_nube_chk"))).toEqual([...MODELOS_NUBE]);
    expect(literales(check("config_ia_esfuerzo_chk"))).toEqual([...ESFUERZOS_NUBE]);
    expect(literales(check("config_ia_hora_chk"))).toEqual([...HORAS_RESUMEN]);
  });

  it("el límite por pedido: la app acepta de LIMITE_MIN_S a 60 s; la CHECK de la base sigue en 120 (versiones viejas, solo inserción) y el lector acota", () => {
    expect(LIMITE_MAX_S).toBe(60);
    expect(LIMITE_MAX_BD_S).toBe(120);
    expect(check("config_ia_limite_chk")).toBe(`"limiteSegundos" BETWEEN ${LIMITE_MIN_S} AND ${LIMITE_MAX_BD_S}`);
    expect(COLUMNAS_CONFIG_IA).toContain("analisisDemanda");
    expect(TOPE_MAX_MICRO_USD).toBe(TECHO_TOPE_MICRO_USD);
    const usd = (micro: bigint) => `${micro / 1_000_000n}.00`;
    expect(check("config_ia_tope_chk")).toBe(`"topeMensualUsd" IS NULL OR ("topeMensualUsd" >= ${usd(TOPE_MIN_MICRO_USD)} AND "topeMensualUsd" <= ${usd(TOPE_MAX_MICRO_USD)})`);
  });

  it("las tareas de hoy son una lista explícita de tres (no dependen de TIPOS_RESUMEN) y las obligatorias están contenidas en TAREAS_IA", () => {
    expect([...TAREAS_OBLIGATORIAS]).toEqual(["DIARIO", "REGLAS", "ESCENARIOS"]);
    expect([...TAREAS_IA]).toEqual(["DIARIO", "REGLAS", "ESCENARIOS"]);
    for (const t of TAREAS_OBLIGATORIAS) expect(TAREAS_IA as readonly string[], t).toContain(t);
  });
});

// Frente B (B3). SIMULACION entra a config_ia como tarea OPCIONAL: las tres de hoy siguen obligatorias y la fila vieja (sin
// SIMULACION) sigue entrando. Una tarea opcional da NULL en cada cláusula que la mira cuando falta, y un CHECK que da NULL
// deja pasar la fila: por eso la cláusula de SIMULACION en config_ia_usa_chk va con COALESCE (advertencia de 20261122210000_config_ia).
describe("migración *_config_ia_simulacion (M2)", () => {
  it("es una sola, posterior a M1 (el valor del enum) y solo toca config_ia: DROP y ADD de las dos CHECK, con lock_timeout", () => {
    expect(propiasSim).toHaveLength(1);
    expect(propiasSim[0]! > carpetas.find((c) => c.endsWith("_tipo_resumen_simulacion"))!).toBe(true);
    expect(propiasSim[0]! > "20261126180000_alertas").toBe(true);
    expect(sqlSim).toMatch(/^\s*SET LOCAL lock_timeout = '5s';/);
    expect([...sqlSim.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]).every((t) => t === "config_ia")).toBe(true);
    expect([...sqlSim.matchAll(/DROP CONSTRAINT "(\w+)"/g)].map((m) => m[1]).sort()).toEqual(["config_ia_tareas_chk", "config_ia_usa_chk"]);
    expect([...sqlSim.matchAll(/ADD CONSTRAINT "(\w+)"/g)].map((m) => m[1]).sort()).toEqual(["config_ia_tareas_chk", "config_ia_usa_chk"]);
    expect(sqlSim).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|TRIGGER|FUNCTION)|\b(CREATE|UPDATE|DELETE|INSERT|ALTER\s+TYPE)\b/i);
  });

  it("no usa el valor nuevo del enum: SIMULACION aparece solo como clave de texto del JSON, nunca como ::\"TipoResumenIa\"", () => {
    expect(sqlSim).not.toMatch(/TipoResumenIa/);
  });

  it("las listas de la CHECK y las del código cuadran: obligatorias = las del ?&, y obligatorias ⊆ TAREAS_IA ⊆ las admitidas (con control positivo)", () => {
    const tareas = checkSim("config_ia_tareas_chk");
    expect(sqlSim).not.toBe("");
    expect(tareas).not.toBe("");
    const admitidas = arreglo(tareas, `("tareas" - `);
    const exigidas = arreglo(tareas, `"tareas" ?& `);
    expect(admitidas.length).toBeGreaterThan(0);
    expect(exigidas.length).toBeGreaterThan(0);
    expect(invariante(TAREAS_OBLIGATORIAS, TAREAS_IA, admitidas, exigidas)).toBe(true);
    // Control positivo: un par de listas que viola el invariante se detecta (a una le falta una obligatoria, a otra le sobra una tarea).
    expect(invariante(TAREAS_OBLIGATORIAS, ["DIARIO", "REGLAS"], admitidas, exigidas)).toBe(false);
    expect(invariante(TAREAS_OBLIGATORIAS, [...TAREAS_IA, "OPERAR"], admitidas, exigidas)).toBe(false);
    expect(invariante(["DIARIO", "REGLAS"], TAREAS_IA, admitidas, exigidas)).toBe(false);
    expect(invariante(TAREAS_OBLIGATORIAS, TAREAS_IA, admitidas, [...exigidas, ...admitidas.filter((t) => !exigidas.includes(t))])).toBe(false);
  });

  it("tareas: las obligatorias en el ?&, las demás opcionales, y cada admitida con «activo» booleano y su modelo local con la forma de la lista de PI", () => {
    const tareas = checkSim("config_ia_tareas_chk");
    expect(tareas).not.toBe("");
    const admitidas = arreglo(tareas, `("tareas" - `);
    const opcionales = admitidas.filter((t) => !(TAREAS_OBLIGATORIAS as readonly string[]).includes(t));
    expect(opcionales).toEqual(["SIMULACION"]);
    for (const t of admitidas) {
      expect(tareas, t).toContain(`NOT ("tareas" ? '${t}') OR (jsonb_typeof(("tareas"->'${t}')) = 'object'`);
      expect(tareas, t).toContain(`(("tareas"->'${t}') - ARRAY['activo', 'modeloLocal']) = '{}'::jsonb`);
      expect(tareas, t).toContain(`(("tareas"->'${t}')->>'modeloLocal') ~ '${PATRON_NOMBRE_MODELO_LOCAL.source}'`);
    }
    // Sin «activo» el tipo da NULL: en cada opcional va con COALESCE para que ese NULL no deje pasar la fila.
    for (const t of opcionales) expect(tareas, t).toContain(`COALESCE(jsonb_typeof(("tareas"->'${t}')->'activo') = 'boolean', false)`);
  });

  it("usa: cada tarea activa necesita su modelo con la local; la de cada opcional va con COALESCE (sin ella, un NULL deja pasar la fila)", () => {
    const usa = checkSim("config_ia_usa_chk");
    expect(usa).not.toBe("");
    const admitidas = arreglo(checkSim("config_ia_tareas_chk"), `("tareas" - `);
    for (const t of admitidas.filter((x) => (TAREAS_OBLIGATORIAS as readonly string[]).includes(x))) {
      expect(usa, t).toContain(`NOT (("tareas"->'${t}')->'activo' = 'true'::jsonb AND jsonb_typeof(("tareas"->'${t}')->'modeloLocal') IS DISTINCT FROM 'string')`);
    }
    for (const t of admitidas.filter((x) => !(TAREAS_OBLIGATORIAS as readonly string[]).includes(x))) {
      expect(usa, t).toContain(`NOT (COALESCE((("tareas"->'${t}')->'activo' = 'true'::jsonb), false) AND jsonb_typeof(("tareas"->'${t}')->'modeloLocal') IS DISTINCT FROM 'string')`);
      expect(usa, t).not.toContain(`NOT ((("tareas"->'${t}')->'activo' = `);
    }
    expect(usa).toContain(`"modo" NOT IN (${MODOS_CON_NUBE.map((m) => `'${m}'`).join(", ")}) OR "topeMensualUsd" IS NOT NULL`);
    expect(usa).toContain(`"ollamaHost" IS NOT NULL`);
  });
});

describe("migración *_config_ia · el resto de las CHECK sigue siendo el de la original", () => {
  it("la original conserva sus definiciones (no se editan migraciones ya aplicadas)", () => {
    expect(check("config_ia_tareas_chk")).toContain(`("tareas" - ARRAY['DIARIO', 'REGLAS', 'ESCENARIOS']) = '{}'::jsonb`);
    expect(check("config_ia_tareas_chk")).not.toContain("SIMULACION");
  });

  it("la temperatura de la local va de 0 a 1", () => {
    expect(TEMPERATURA_MAX_CENTESIMAS).toBe(100);
    expect(check("config_ia_temperatura_chk")).toBe(`"temperaturaLocal" >= 0 AND "temperaturaLocal" <= 1`);
  });

  it("el formato del destino: host y puerto juntos o ninguno; NO es el control de seguridad (ese está en la red)", () => {
    const destino = check("config_ia_destino_chk");
    expect(destino).toContain(`("ollamaHost" IS NULL) = ("ollamaPuerto" IS NULL)`);
    expect(destino).toContain(`"ollamaPuerto" BETWEEN 1 AND 65535`);
    // Sin IPv4 escritas (el cruce de literales de la Fábrica las marca): el rango va con números.
    expect(migracion).not.toMatch(/(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/);
    expect(migracion).toMatch(/formato del destino/);
  });

  it("el motivo no es solo espacios y tiene tope", () => {
    expect(check("config_ia_motivo_chk")).toBe(`"motivo" ~ '[^[:space:]]' AND char_length("motivo") <= ${MAX_LARGO_MOTIVO_CONFIG}`);
  });

  it("solo inserción con inv_solo_insercion, y la hora de la base con su disparador (copia del de plan_version)", () => {
    expect(sql).toMatch(/CREATE TRIGGER "config_ia_solo_insercion" BEFORE UPDATE OR DELETE ON "config_ia" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"\(\);/);
    expect(sql).toMatch(/CREATE TRIGGER "config_ia_instante" BEFORE INSERT ON "config_ia" FOR EACH ROW EXECUTE FUNCTION "inv_config_ia_instante"\(\);/);
    const cuerpo = (nombre: string, texto: string) => new RegExp(`CREATE FUNCTION "${nombre}"\\(\\) RETURNS trigger LANGUAGE plpgsql AS \\$\\$([\\s\\S]*?)\\$\\$;`).exec(texto)?.[1];
    const delPlan = cuerpo("inv_plan_version_instante", leer("prisma/migrations/20261122152704_instantes_base/migration.sql"));
    expect(delPlan).toBeDefined();
    expect(cuerpo("inv_config_ia_instante", sql)).toBe(delPlan);
    expect(sql).toMatch(/"creadaEn" TIMESTAMPTZ\(6\) NOT NULL DEFAULT clock_timestamp\(\)/);
  });
});
