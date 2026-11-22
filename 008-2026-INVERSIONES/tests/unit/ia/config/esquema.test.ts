// Tabla config_ia (fase E, E8) en el texto del esquema y de su migración: el modelo, las CHECK espejo de las constantes
// de src/ia (una sola fuente de verdad por lista), la hora que pone la base, la solo inserción y la migración aditiva.
// Que muerdan de verdad lo prueban tests/integracion/ia/config-ia-reglas.test.ts (base real) y el guardián del esquema.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COLUMNAS_CONFIG_IA, HORAS_RESUMEN, LIMITE_MAX_S, LIMITE_MIN_S, MAX_LARGO_MOTIVO_CONFIG, MODOS_CON_LOCAL, MODOS_CON_NUBE, TOPE_MAX_MICRO_USD, TOPE_MIN_MICRO_USD,
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
    expect(campo("creadaEn")).toMatch(/^DateTime\s+@default\(dbgenerated\("clock_timestamp\(\)"\)\) @db\.Timestamptz\(6\)/);
    expect(campo("autor")).toMatch(/onDelete: Restrict, onUpdate: Restrict/);
    expect(modelo).not.toMatch(/Float|now\(\)/);
    expect(modelo).toMatch(/@@index\(\[autorId\]\)/);
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
    const usa = check("config_ia_usa_chk");
    expect(usa).toContain(`"modo" NOT IN (${MODOS_CON_LOCAL.map((m) => `'${m}'`).join(", ")})`);
    expect(usa).toContain(`"modo" NOT IN (${MODOS_CON_NUBE.map((m) => `'${m}'`).join(", ")})`);
  });

  it("modelos de la nube, esfuerzos y horas: espejo de sus listas", () => {
    expect(literales(check("config_ia_modelo_nube_chk"))).toEqual([...MODELOS_NUBE]);
    expect(literales(check("config_ia_esfuerzo_chk"))).toEqual([...ESFUERZOS_NUBE]);
    expect(literales(check("config_ia_hora_chk"))).toEqual([...HORAS_RESUMEN]);
  });

  it("el límite por pedido va de LIMITE_MIN_S a LIMITE_MAX_S (120, el de PI) y el tope de USD 1 al techo de cordura", () => {
    expect(LIMITE_MAX_S).toBe(120);
    expect(check("config_ia_limite_chk")).toBe(`"limiteSegundos" BETWEEN ${LIMITE_MIN_S} AND ${LIMITE_MAX_S}`);
    expect(TOPE_MAX_MICRO_USD).toBe(TECHO_TOPE_MICRO_USD);
    const usd = (micro: bigint) => `${micro / 1_000_000n}.00`;
    expect(check("config_ia_tope_chk")).toBe(`"topeMensualUsd" IS NULL OR ("topeMensualUsd" >= ${usd(TOPE_MIN_MICRO_USD)} AND "topeMensualUsd" <= ${usd(TOPE_MAX_MICRO_USD)})`);
  });

  it("el nombre del modelo local tiene la forma de la lista de PI (la pertenencia a la lista la revisa la app)", () => {
    expect(check("config_ia_modelo_local_chk")).toBe(`"modeloLocal" IS NULL OR "modeloLocal" ~ '${PATRON_NOMBRE_MODELO_LOCAL.source}'`);
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
