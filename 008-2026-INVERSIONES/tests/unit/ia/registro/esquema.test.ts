// Tabla resumen_ia (fase E, E3) en el texto del esquema y de su migración: el modelo, los enums espejo de las
// constantes de src/ia, la hora que pone la base, la migración aditiva y sus reglas escritas a mano. Que muerdan de
// verdad lo prueban tests/integracion/ia/resumen-ia-reglas.test.ts (base real) y el guardián del esquema.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TIPOS_RESUMEN, VERSION_HECHOS } from "@/ia/contrato";
import { MOTIVOS_FALLO, PATRON_MODELO, PATRON_VERSION_PROMPT, PUERTAS } from "@/ia/generador";
import { PATRON_HASH } from "@/ia/hash";
import { ESTADOS_RESUMEN, MAX_LARGO_OPCIONES, MAX_LARGO_TEXTO, MAX_MOTIVOS } from "@/ia/registro/fila";
import { MAX_SALIDA_CRUDA } from "@/ia/generador";
import { RESUMEN_IA_COLUMNAS } from "./permisos-ia";

const raiz = fileURLToPath(new URL("../../../../", import.meta.url));
const leer = (relativa: string) => readFileSync(path.join(raiz, relativa), "utf8");
const esquema = leer("prisma/schema.prisma");
const dirMigraciones = path.join(raiz, "prisma/migrations");
const carpetas = readdirSync(dirMigraciones, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const carpeta = carpetas.find((c) => c.endsWith("_resumen_ia"));
const migracion = carpeta ? leer(`prisma/migrations/${carpeta}/migration.sql`) : "";
const sinComentarios = migracion.replace(/--.*$/gm, "");

const bloque = (tipo: "model" | "enum", nombre: string): string => new RegExp(`${tipo} ${nombre} \\{([\\s\\S]*?)\\n\\}`).exec(esquema)?.[1] ?? "";
const valoresEnum = (nombre: string): string[] =>
  bloque("enum", nombre).replace(/\/\/.*$/gm, "").split("\n").map((l) => l.trim()).filter((l) => /^\w+$/.test(l));
const modelo = bloque("model", "ResumenIa").replace(/\/\/.*$/gm, "");
const campo = (nombre: string): string => new RegExp(`^\\s+${nombre}\\s+(.*)$`, "m").exec(modelo)?.[1]?.trim() ?? "";

describe("modelo ResumenIa en prisma/schema.prisma", () => {
  it("existe, mapeado a resumen_ia, con exactamente las columnas de la lista única", () => {
    expect(modelo).toMatch(/@@map\("resumen_ia"\)/);
    const columnas = modelo.split("\n").map((l) => /^\s+(\w+)\s+\w/.exec(l)?.[1]).filter((c): c is string => c !== undefined);
    expect([...columnas].sort()).toEqual([...RESUMEN_IA_COLUMNAS].sort());
  });

  it("tipos: fecha de negocio Date, hechos y opciones Json, motivos lista de texto, conteos Int (sin Float ni BigInt)", () => {
    expect(campo("id")).toMatch(/^String\s+@id @default\(cuid\(\)\)$/);
    expect(campo("tipo")).toMatch(/^TipoResumenIa$/);
    expect(campo("fechaNegocio")).toMatch(/^DateTime\s+@db\.Date$/);
    expect(campo("estado")).toMatch(/^EstadoResumenIa$/);
    expect(campo("puerta")).toMatch(/^PuertaIa\?$/);
    for (const c of ["texto", "salidaModelo", "modelo", "modeloDigest"]) expect(campo(c), c).toMatch(/^String\?$/);
    for (const c of ["hechosHash", "hechosVersion", "promptVersion", "promptHash", "validadorVersion"]) expect(campo(c), c).toMatch(/^String$/);
    for (const c of ["hechos", "opciones"]) expect(campo(c), c).toMatch(/^Json$/);
    expect(campo("motivos")).toMatch(/^String\[\]$/);
    for (const c of ["latenciaMs", "tokensEntrada", "tokensSalida"]) expect(campo(c), c).toMatch(/^Int\?$/);
  });

  it("generadoEn lo pone la base con clock_timestamp() (Prisma no lo manda), nunca now()", () => {
    expect(campo("generadoEn")).toMatch(/^DateTime\s+@default\(dbgenerated\("clock_timestamp\(\)"\)\) @db\.Timestamptz\(6\)/);
    expect(modelo).not.toMatch(/now\(\)/);
  });

  it("los enums son espejo de las constantes de src/ia (una sola fuente de verdad)", () => {
    expect(valoresEnum("TipoResumenIa")).toEqual([...TIPOS_RESUMEN]);
    expect(valoresEnum("EstadoResumenIa")).toEqual([...ESTADOS_RESUMEN]);
    expect(valoresEnum("PuertaIa")).toEqual([...PUERTAS]);
  });

  it("sin llaves foráneas: el registro no depende de ninguna otra tabla", () => {
    expect(modelo).not.toMatch(/@relation/);
  });
});

describe("migración *_resumen_ia", () => {
  it("es una sola, posterior a todas las de main, y aditiva (no borra ni altera nada que ya exista)", () => {
    expect(carpetas.filter((c) => c.endsWith("_resumen_ia"))).toHaveLength(1);
    expect(carpetas.at(-1)).toBe(carpeta);
    expect(sinComentarios).not.toMatch(/\bDROP\b|\bALTER\s+(TYPE|COLUMN)\b|\bRENAME\b|\bTRUNCATE\b|\bDELETE\b|\bUPDATE\s+"/i);
    for (const m of sinComentarios.matchAll(/ALTER TABLE "(\w+)"/g)) expect(m[1]).toBe("resumen_ia");
  });

  it("crea los tres enums y la tabla, con su lock_timeout", () => {
    for (const e of ["TipoResumenIa", "EstadoResumenIa", "PuertaIa"]) expect(sinComentarios).toMatch(new RegExp(`CREATE TYPE "${e}" AS ENUM`));
    expect(sinComentarios).toMatch(/CREATE TABLE "resumen_ia"/);
    expect(sinComentarios).toMatch(/"generadoEn" TIMESTAMPTZ\(6\) NOT NULL DEFAULT clock_timestamp\(\)/);
    expect(sinComentarios).toMatch(/SET LOCAL lock_timeout = '5s';/);
  });

  it("trae sus CHECK con nombre, el índice único parcial de los PUBLICADO y el del gasto", () => {
    for (const nombre of ["estado", "motivos", "puerta", "hechos", "formas", "textos", "conteos"]) {
      expect(sinComentarios, nombre).toMatch(new RegExp(`ADD CONSTRAINT "resumen_ia_${nombre}_chk" CHECK`));
    }
    expect(sinComentarios).toMatch(
      /CREATE UNIQUE INDEX "resumen_ia_publicado_key" ON "resumen_ia" \("tipo", "fechaNegocio", "hechosHash", "promptHash", "modeloDigest"\) WHERE "estado" = 'PUBLICADO'/,
    );
    expect(sinComentarios).toMatch(/CREATE INDEX "resumen_ia_gasto_idx" ON "resumen_ia"\("puerta", "generadoEn"\)/);
  });

  it("de solo inserción con inv_solo_insercion y con la hora del registro fijada por la base para quien no es el dueño", () => {
    expect(sinComentarios).toMatch(/CREATE TRIGGER "resumen_ia_solo_insercion" BEFORE UPDATE OR DELETE ON "resumen_ia" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"\(\);/);
    expect(sinComentarios).toMatch(/CREATE TRIGGER "resumen_ia_instante" BEFORE INSERT ON "resumen_ia" FOR EACH ROW EXECUTE FUNCTION "inv_resumen_ia_instante"\(\);/);
    const funcion = /CREATE FUNCTION "inv_resumen_ia_instante"\(\)[\s\S]*?\$\$;/.exec(sinComentarios)?.[0] ?? "";
    expect(funcion).toMatch(/pg_catalog\.pg_has_role\(/);
    expect(funcion).toMatch(/NEW\."generadoEn" := pg_catalog\.clock_timestamp\(\);/);
    expect(funcion).not.toMatch(/SECURITY DEFINER|\bSET\s+search_path/i);
    expect(sinComentarios.match(/CREATE FUNCTION/g)).toHaveLength(1);
  });

  it("las formas de la base son las mismas de src/ia (hash, versiones, modelo) y los topes, los del registro", () => {
    expect(PATRON_HASH.source).toBe("^[0-9a-f]{64}$");
    expect(sinComentarios).toContain(`"hechosHash" ~ '${PATRON_HASH.source}'`);
    expect(sinComentarios).toContain(`"promptHash" ~ '${PATRON_HASH.source}'`);
    expect(PATRON_VERSION_PROMPT.source).toBe("^[a-z]+(?:-[a-z]+)*-v[1-9][0-9]*$");
    for (const c of ["promptVersion", "validadorVersion"]) expect(sinComentarios).toContain(`"${c}" ~ '^[a-z]+(-[a-z]+)*-v[1-9][0-9]*$'`);
    expect(VERSION_HECHOS).toMatch(/^hechos-v[1-9][0-9]*$/);
    expect(sinComentarios).toContain(`"hechosVersion" ~ '^hechos-v[1-9][0-9]*$'`);
    expect(PATRON_MODELO.source).toBe("^[\\x21-\\x7e]{1,128}$");
    for (const c of ["modelo", "modeloDigest"]) expect(sinComentarios).toContain(`"${c}" ~ '^[!-~]{1,128}$'`);
    expect(sinComentarios).toContain(`char_length("texto") <= ${MAX_LARGO_TEXTO}`);
    expect(sinComentarios).toContain(`char_length("salidaModelo") <= ${MAX_SALIDA_CRUDA}`);
    expect(sinComentarios).toContain(`octet_length("opciones"::text) <= ${MAX_LARGO_OPCIONES}`);
    expect(sinComentarios).toContain(`cardinality("motivos") <= ${MAX_MOTIVOS}`);
  });

  it("un FALLIDO empieza por un motivo de fallo de src/ia (MOTIVOS_FALLO, en el mismo orden), y VISTA_NO_CIEGA va sin puerta", () => {
    const lista = `ARRAY[${MOTIVOS_FALLO.map((m) => `'${m}'`).join(", ")}]`;
    expect(sinComentarios).toContain(`"motivos"[1] = ANY (${lista})`);
    expect(sinComentarios).toContain(`NOT ("motivos" && ${lista})`);
    expect(sinComentarios).toMatch(/\("puerta" IS NULL\) = \('VISTA_NO_CIEGA' = ANY \("motivos"\)\)/);
  });
});
