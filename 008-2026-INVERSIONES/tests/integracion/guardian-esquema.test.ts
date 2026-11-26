// Guardián del esquema (scripts/verificar-esquema.sql) contra la base de PRUEBAS, en el Mac y en el CI.
// Cada caso rompe algo DENTRO de una transacción, corre el guardián en esa misma transacción y la deshace
// siempre: la base queda como estaba. Solo toca el catálogo (sin datos). Dos casos (UPDATE pg_index y
// DISABLE TRIGGER ALL) exigen que el usuario de DATABASE_URL_TEST sea superusuario, como en el compose y en el CI.
// Escenario que cierra (database-reviewer, D1): un DROP INDEX o una migración futura que quite un índice
// único, una FK o le cambie el ON DELETE, y el guardián pasaba igual (la reimportación duplicaría filas).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const guardian = readFileSync(fileURLToPath(new URL("../../scripts/verificar-esquema.sql", import.meta.url)), "utf8");

class Deshacer extends Error {}

/** Corre `romper` y luego el guardián en una transacción que siempre se deshace; devuelve su error o null. */
async function guardianTras(romper: readonly string[]): Promise<string | null> {
  let error: string | null = null;
  try {
    await db.$transaction(
      async (tx) => {
        for (const sql of romper) await tx.$executeRawUnsafe(sql);
        try {
          await tx.$executeRawUnsafe(guardian);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        throw new Deshacer();
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  return error;
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("guardián del esquema en la base recién migrada", () => {
  it("pasa sin cambios (definiciones exactas de PostgreSQL 16)", async () => {
    expect(await guardianTras([])).toBeNull();
  });

  it("pasa aunque la conexión traiga otro search_path (fija el suyo: sin falsos positivos por nombres calificados)", async () => {
    expect(await guardianTras(["SET LOCAL search_path = pg_catalog"])).toBeNull();
  });
});

describe("guardián del esquema: índices únicos de Prisma (idempotencia)", () => {
  it.each([
    ["fila_fuente", "fila_fuente_tipoFuente_claveNatural_ocurrencia_key"],
    ["orden", "orden_filaFuenteId_key"],
    ["dividendo", "dividendo_filaFuenteId_key"],
    ["movimiento_caja", "movimiento_caja_filaFuenteId_key"],
    ["certificacion", "certificacion_fechaCorte_key"],
    ["lote", "lote_ordenId_key"],
    ["evento_corporativo", "evento_corporativo_tipo_origenId_destinoId_fecha_key"],
    ["codigo_recuperacion", "codigo_recuperacion_codigoHash_key"],
    ["token_acceso", "token_acceso_tokenHash_key"],
  ])("falla si se borra el índice único de %s (%s)", async (_tabla, indice) => {
    expect(await guardianTras([`DROP INDEX "${indice}"`])).toContain(indice);
  });

  it("falla si un índice único queda inválido o sin terminar (indisvalid, indisready)", async () => {
    const invalido = `UPDATE pg_index SET indisvalid = false WHERE indexrelid = '"orden_filaFuenteId_key"'::regclass`;
    expect(await guardianTras([invalido])).toContain("orden_filaFuenteId_key");
    const sinTerminar = `UPDATE pg_index SET indisready = false WHERE indexrelid = '"lote_ordenId_key"'::regclass`;
    expect(await guardianTras([sinTerminar])).toContain("lote_ordenId_key");
  });

  it("falla si cualquier índice del esquema queda inválido, aunque no sea único", async () => {
    const invalido = `UPDATE pg_index SET indisvalid = false WHERE indexrelid = '"orden_instrumentoId_fechaOperacion_idx"'::regclass`;
    expect(await guardianTras([invalido])).toContain("orden_instrumentoId_fechaOperacion_idx");
  });
});

describe("guardián del esquema: llaves foráneas y su ON DELETE", () => {
  it("falla si se borra una FK", async () => {
    expect(await guardianTras(['ALTER TABLE "orden" DROP CONSTRAINT "orden_instrumentoId_fkey"'])).toContain("orden_instrumentoId_fkey");
  });

  it("falla si una FK cambia su ON DELETE", async () => {
    const romper = [
      'ALTER TABLE "orden" DROP CONSTRAINT "orden_instrumentoId_fkey"',
      'ALTER TABLE "orden" ADD CONSTRAINT "orden_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE CASCADE ON UPDATE RESTRICT',
    ];
    expect(await guardianTras(romper)).toContain("orden_instrumentoId_fkey");
  });

  it("falla si una FK queda sin validar (NOT VALID)", async () => {
    const romper = [
      'ALTER TABLE "lote" DROP CONSTRAINT "lote_ordenId_fkey"',
      'ALTER TABLE "lote" ADD CONSTRAINT "lote_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "orden"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID',
    ];
    expect(await guardianTras(romper)).toContain("lote_ordenId_fkey");
  });

  it("falla si se borra una llave primaria", async () => {
    expect(await guardianTras(['ALTER TABLE "fila_de_carga" DROP CONSTRAINT "fila_de_carga_pkey"'])).toContain("fila_de_carga_pkey");
  });

  it("falla si los disparadores internos de las FK de una tabla quedan deshabilitados", async () => {
    expect(await guardianTras(['ALTER TABLE "lote" DISABLE TRIGGER ALL'])).toContain("disparadores deshabilitados en lote");
  });

  it("falla si una FK se queda sin índice que empiece por sus columnas (p. ej. si se borra el suyo)", async () => {
    expect(await guardianTras(['DROP INDEX "dividendo_eventoId_idx"'])).toContain("dividendo_eventoId_fkey");
  });
});

describe("guardián del esquema: disparadores exactos (UPDATE OF, WHEN, sobrantes)", () => {
  const recrear = (definicion: string) => ['DROP TRIGGER "orden_solo_insercion" ON "orden"', definicion];

  it("falla si el disparador pasa a UPDATE OF una columna (deja editar las demás)", async () => {
    const romper = recrear('CREATE TRIGGER "orden_solo_insercion" BEFORE UPDATE OF "estado" OR DELETE ON "orden" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"()');
    expect(await guardianTras(romper)).toContain("orden_solo_insercion");
  });

  it("falla si el disparador gana un WHEN que nunca se cumple", async () => {
    const romper = recrear(
      'CREATE TRIGGER "orden_solo_insercion" BEFORE UPDATE OR DELETE ON "orden" FOR EACH ROW WHEN (OLD."estado" IS NULL) EXECUTE FUNCTION "inv_solo_insercion"()',
    );
    expect(await guardianTras(romper)).toContain("orden_solo_insercion");
  });

  it("falla si aparece un disparador que no está en la lista", async () => {
    const romper = ['CREATE TRIGGER "intruso" BEFORE UPDATE ON "usuario" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"()'];
    expect(await guardianTras(romper)).toContain("intruso");
  });

  it("falla si falta el disparador de transiciones de usuario (D2)", async () => {
    expect(await guardianTras(['DROP TRIGGER "usuario_transiciones" ON "usuario"'])).toContain("usuario_transiciones");
  });
});

describe("guardián del esquema: CHECK nuevos con NOT VALID", () => {
  const nuevos: ReadonlyArray<readonly [string, string]> = [
    ["evento_corporativo", "evento_corporativo_origen_destino_chk"],
    ["evento_corporativo", "evento_corporativo_razon_chk"],
    ["dividendo", "dividendo_retencion_chk"],
    ["dividendo", "dividendo_tasa_retencion_chk"],
    ["orden", "orden_fechas_chk"],
  ];

  it("pasa con los CHECK nuevos sin validar (como quedan sobre datos existentes) y también ya validados", async () => {
    expect(await guardianTras([])).toBeNull();
    expect(await guardianTras(nuevos.map(([tabla, chk]) => `ALTER TABLE "${tabla}" VALIDATE CONSTRAINT "${chk}"`))).toBeNull();
  });

  it("falla si un CHECK nuevo cambia de definición", async () => {
    const romper = ['ALTER TABLE "orden" DROP CONSTRAINT "orden_fechas_chk"', 'ALTER TABLE "orden" ADD CONSTRAINT "orden_fechas_chk" CHECK (true) NOT VALID'];
    expect(await guardianTras(romper)).toContain("orden_fechas_chk");
  });

  it("sigue exigiendo validados los CHECK de antes", async () => {
    const romper = [
      'ALTER TABLE "orden" DROP CONSTRAINT "orden_montos_chk"',
      'ALTER TABLE "orden" ADD CONSTRAINT "orden_montos_chk" CHECK ("precioUnitario" >= 0 AND "totalInvertido" >= 0 AND "comision" >= 0 AND "totalEstimado" >= 0) NOT VALID',
    ];
    expect(await guardianTras(romper)).toContain("orden_montos_chk");
  });
});

// Integridad de los precios frente a inv_precios (migración *_precios_integridad): los 4 disparadores y sus 3
// funciones. Una función que pase a SECURITY DEFINER eximiría a todos (dentro, current_user sería el dueño), y el md5
// del código no lo ve: el guardián mira también prosecdef y proconfig, y que haya una sola función con cada nombre.
describe("guardián del esquema: integridad de los precios", () => {
  const disparadores: ReadonlyArray<readonly [string, string]> = [
    ["precio_cierre", "precio_cierre_insercion"],
    ["precio_cierre", "precio_cierre_retiro"],
    ["valor_unidad_fondo", "valor_unidad_fondo_insercion"],
    ["valor_unidad_fondo", "valor_unidad_fondo_retiro"],
  ];

  it.each(disparadores)("falla si falta %s.%s", async (tabla, disparador) => {
    expect(await guardianTras([`DROP TRIGGER "${disparador}" ON "${tabla}"`])).toContain(disparador);
  });

  it.each(disparadores)("falla si %s.%s queda deshabilitado o solo para réplica", async (tabla, disparador) => {
    expect(await guardianTras([`ALTER TABLE "${tabla}" DISABLE TRIGGER "${disparador}"`])).toContain(disparador);
    expect(await guardianTras([`ALTER TABLE "${tabla}" ENABLE REPLICA TRIGGER "${disparador}"`])).toContain(disparador);
  });

  it("falla si el retiro pasa a UPDATE OF una columna (dejaría reabrir con las demás)", async () => {
    const romper = [
      'DROP TRIGGER "precio_cierre_retiro" ON "precio_cierre"',
      'CREATE TRIGGER "precio_cierre_retiro" BEFORE UPDATE OF "precio" OR DELETE ON "precio_cierre" FOR EACH ROW EXECUTE FUNCTION "inv_retiro_vigente"()',
    ];
    expect(await guardianTras(romper)).toContain("precio_cierre_retiro");
  });

  it("falla si a valor_unidad_fondo le sobra un disparador", async () => {
    const romper = ['CREATE TRIGGER "intruso_fondo" BEFORE INSERT ON "valor_unidad_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_valor_unidad_fondo_insercion"()'];
    expect(await guardianTras(romper)).toContain("intruso_fondo");
  });

  it("falla si cambia el código de una función (deja pasar todo)", async () => {
    const romper = [
      `CREATE OR REPLACE FUNCTION "inv_precio_cierre_insercion"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RETURN NEW; END; $$`,
    ];
    expect(await guardianTras(romper)).toContain("inv_precio_cierre_insercion");
  });

  it.each(["inv_precio_cierre_insercion", "inv_valor_unidad_fondo_insercion", "inv_retiro_vigente"])(
    "falla si %s pasa a SECURITY DEFINER (eximiría a todos) o cambia su search_path",
    async (funcion) => {
      expect(await guardianTras([`ALTER FUNCTION "${funcion}"() SECURITY DEFINER`])).toContain(funcion);
      expect(await guardianTras([`ALTER FUNCTION "${funcion}"() SET search_path = public, pg_catalog, pg_temp`])).toContain(funcion);
      expect(await guardianTras([`ALTER FUNCTION "${funcion}"() SET search_path = pg_catalog, public`])).toContain(funcion);
      expect(await guardianTras([`ALTER FUNCTION "${funcion}"() RESET search_path`])).toContain(funcion);
    },
  );

  it("falla si una función de antes gana un SET o pasa a SECURITY DEFINER", async () => {
    expect(await guardianTras(['ALTER FUNCTION "inv_solo_insercion"() SECURITY DEFINER'])).toContain("inv_solo_insercion");
    expect(await guardianTras(['ALTER FUNCTION "inv_solo_insercion"() SET search_path = public'])).toContain("inv_solo_insercion");
  });

  // La sobrecarga trae el mismo SET y un md5 que ordena DESPUÉS del de la función real: así ni el min(md5) ni el
  // min(proconfig) la delatan, y solo la cuenta por nombre la frena (lo mostró una mutación que quitaba esa cuenta).
  it("falla si aparece otra función con el mismo nombre (una sobrecarga), aunque traiga el mismo SET", async () => {
    const cuerpo = " SELECT x + 0 ";
    const [orden] = await db.$queryRawUnsafe<Array<{ despues: boolean }>>(
      `SELECT md5('${cuerpo}') > (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'inv_retiro_vigente') AS despues`,
    );
    expect(orden).toEqual({ despues: true });
    const romper = [`CREATE FUNCTION "inv_retiro_vigente"(x int) RETURNS int LANGUAGE sql SET search_path = pg_catalog, public, pg_temp AS $$${cuerpo}$$`];
    expect(await guardianTras(romper)).toContain("inv_retiro_vigente");
  });
});

// Datos oficiales (fase C, C1, migración *_datos_oficiales): las series y los decretos son de solo inserción y retiro
// para TODOS los roles (inv_solo_retiro, sin exención del dueño); sin sus disparadores, su función, su exclusión o sus
// claves vigentes, la historia se podría reescribir o duplicar sin que nada lo frene.
describe("guardián del esquema: datos oficiales", () => {
  const disparadores: ReadonlyArray<readonly [string, string]> = [
    ["valor_serie_oficial", "valor_serie_oficial_retiro"],
    ["dividendo_decretado", "dividendo_decretado_retiro"],
  ];

  it.each(disparadores)("falla si falta %s.%s o queda deshabilitado", async (tabla, disparador) => {
    expect(await guardianTras([`DROP TRIGGER "${disparador}" ON "${tabla}"`])).toContain(disparador);
    expect(await guardianTras([`ALTER TABLE "${tabla}" DISABLE TRIGGER "${disparador}"`])).toContain(disparador);
  });

  it("falla si inv_solo_retiro cambia de código, pasa a SECURITY DEFINER o cambia su search_path", async () => {
    expect(await guardianTras([`CREATE OR REPLACE FUNCTION "inv_solo_retiro"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$ BEGIN RETURN COALESCE(NEW, OLD); END; $$`])).toContain("inv_solo_retiro");
    expect(await guardianTras(['ALTER FUNCTION "inv_solo_retiro"() SECURITY DEFINER'])).toContain("inv_solo_retiro");
    expect(await guardianTras(['ALTER FUNCTION "inv_solo_retiro"() SET search_path = public, pg_catalog'])).toContain("inv_solo_retiro");
    expect(await guardianTras(['ALTER FUNCTION "inv_solo_retiro"() RESET search_path'])).toContain("inv_solo_retiro");
  });

  it("falla si el disparador deja de pasarle la columna de la hora del registro", async () => {
    const romper = [
      'DROP TRIGGER "valor_serie_oficial_retiro" ON "valor_serie_oficial"',
      'CREATE TRIGGER "valor_serie_oficial_retiro" BEFORE INSERT OR UPDATE OR DELETE ON "valor_serie_oficial" FOR EACH ROW EXECUTE FUNCTION "inv_solo_retiro"(\'otra\')',
    ];
    expect(await guardianTras(romper)).toContain("valor_serie_oficial_retiro");
  });

  it.each([
    ['ALTER TABLE "valor_serie_oficial" DROP CONSTRAINT "valor_serie_oficial_sin_solape_excl"', "valor_serie_oficial_sin_solape_excl"],
    ['DROP INDEX "valor_serie_oficial_vigente_key"', "valor_serie_oficial_vigente_key"],
    ['DROP INDEX "dividendo_decretado_vigente_key"', "dividendo_decretado_vigente_key"],
    ['DROP INDEX "dividendo_decretado_version_key"', "dividendo_decretado_version_key"],
    ['ALTER TABLE "dividendo_decretado" DROP CONSTRAINT "dividendo_decretado_referencia_chk"', "dividendo_decretado_referencia_chk"],
  ])("falla si se quita una regla (%s)", async (romper, nombre) => {
    expect(await guardianTras([romper])).toContain(nombre);
  });

  it("falla si dividendo_viejas_nulas_chk queda sin validar (no está en la lista de los que nacen NOT VALID)", async () => {
    const romper = [
      'ALTER TABLE "dividendo" DROP CONSTRAINT "dividendo_viejas_nulas_chk"',
      'ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_viejas_nulas_chk" CHECK ("montoBruto" IS NULL AND "retencion" IS NULL AND "tasaRetencion" IS NULL AND "decretadoId" IS NULL) NOT VALID',
    ];
    expect(await guardianTras(romper)).toContain("dividendo_viejas_nulas_chk");
  });

  it("falla si la FK de la fila cruda del decreto deja de ser RESTRICT", async () => {
    const romper = [
      'ALTER TABLE "dividendo_decretado" DROP CONSTRAINT "dividendo_decretado_filaFuenteId_fkey"',
      'ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE CASCADE ON UPDATE RESTRICT',
    ];
    expect(await guardianTras(romper)).toContain("dividendo_decretado_filaFuenteId_fkey");
  });
});

// Fase E (E3): resumen_ia. Si una migración o un DROP le quita la unicidad de los PUBLICADO, la solo inserción, la hora
// que pone la base o un CHECK, o si la función del instante cambia, el despliegue se detiene.
describe("guardián del esquema: resumen_ia", () => {
  it.each([
    ["el índice único parcial de los PUBLICADO", ['DROP INDEX "resumen_ia_publicado_key"'], "resumen_ia_publicado_key"],
    ["el disparador de solo inserción", ['DROP TRIGGER "resumen_ia_solo_insercion" ON "resumen_ia"'], "resumen_ia_solo_insercion"],
    ["el disparador del instante", ['DROP TRIGGER "resumen_ia_instante" ON "resumen_ia"'], "resumen_ia_instante"],
    ["el CHECK del texto y el estado", ['ALTER TABLE "resumen_ia" DROP CONSTRAINT "resumen_ia_estado_chk"'], "resumen_ia_estado_chk"],
    ["el CHECK de la puerta de VISTA_NO_CIEGA", ['ALTER TABLE "resumen_ia" DROP CONSTRAINT "resumen_ia_puerta_chk"'], "resumen_ia_puerta_chk"],
    ["la llave primaria", ['ALTER TABLE "resumen_ia" DROP CONSTRAINT "resumen_ia_pkey"'], "resumen_ia_pkey"],
  ])("falla si se borra %s", async (_n, romper, nombre) => {
    expect(await guardianTras(romper)).toContain(nombre);
  });

  // Sin depender de las filas que dejaron otras pruebas: el índice cambia de predicado o deja de ser único.
  it.each([
    ["cambia de predicado", 'CREATE UNIQUE INDEX "resumen_ia_publicado_key" ON "resumen_ia" ("tipo", "fechaNegocio", "hechosHash", "promptHash", "modeloDigest") WHERE false'],
    ["deja de ser único", 'CREATE INDEX "resumen_ia_publicado_key" ON "resumen_ia" ("tipo", "fechaNegocio", "hechosHash", "promptHash", "modeloDigest") WHERE "estado" = \'PUBLICADO\''],
  ])("falla si el índice de los PUBLICADO %s", async (_n, recrear) => {
    expect(await guardianTras(['DROP INDEX "resumen_ia_publicado_key"', recrear])).toContain("resumen_ia_publicado_key");
  });

  it("falla si la función del instante cambia de código o pasa a SECURITY DEFINER", async () => {
    const reemplazo = `CREATE OR REPLACE FUNCTION "inv_resumen_ia_instante"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`;
    expect(await guardianTras([reemplazo])).toContain("inv_resumen_ia_instante");
    expect(await guardianTras(['ALTER FUNCTION "inv_resumen_ia_instante"() SECURITY DEFINER'])).toContain("inv_resumen_ia_instante");
  });

  it("falla si el disparador de solo inserción queda deshabilitado", async () => {
    expect(await guardianTras(['ALTER TABLE "resumen_ia" DISABLE TRIGGER "resumen_ia_solo_insercion"'])).toContain("resumen_ia");
  });
});

// Fase E (E8): config_ia. Si una migración o un DROP le quita la solo inserción, la hora que pone la base, la unicidad
// de la versión o una CHECK, o si la función del instante cambia, el despliegue se detiene.
describe("guardián del esquema: config_ia", () => {
  it.each([
    ["el disparador de solo inserción", ['DROP TRIGGER "config_ia_solo_insercion" ON "config_ia"'], "config_ia_solo_insercion"],
    ["el disparador del instante", ['DROP TRIGGER "config_ia_instante" ON "config_ia"'], "config_ia_instante"],
    ["la unicidad de la versión", ['DROP INDEX "config_ia_version_key"'], "config_ia_version_key"],
    ["la CHECK de lo que exige cada modo", ['ALTER TABLE "config_ia" DROP CONSTRAINT "config_ia_usa_chk"'], "config_ia_usa_chk"],
    ["la CHECK del tope", ['ALTER TABLE "config_ia" DROP CONSTRAINT "config_ia_tope_chk"'], "config_ia_tope_chk"],
    ["la CHECK del modelo de la nube", ['ALTER TABLE "config_ia" DROP CONSTRAINT "config_ia_modelo_nube_chk"'], "config_ia_modelo_nube_chk"],
    ["la llave del autor", ['ALTER TABLE "config_ia" DROP CONSTRAINT "config_ia_autorId_fkey"'], "config_ia_autorId_fkey"],
  ])("falla si se borra %s", async (_n, romper, nombre) => {
    expect(await guardianTras(romper)).toContain(nombre);
  });

  it("falla si la CHECK del tope se afloja (otro techo)", async () => {
    const otra = 'ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_tope_chk" CHECK ("topeMensualUsd" IS NULL OR "topeMensualUsd" >= 0)';
    expect(await guardianTras(['ALTER TABLE "config_ia" DROP CONSTRAINT "config_ia_tope_chk"', otra])).toContain("config_ia_tope_chk");
  });

  it("falla si la función del instante cambia de código o pasa a SECURITY DEFINER", async () => {
    const reemplazo = `CREATE OR REPLACE FUNCTION "inv_config_ia_instante"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`;
    expect(await guardianTras([reemplazo])).toContain("inv_config_ia_instante");
    expect(await guardianTras(['ALTER FUNCTION "inv_config_ia_instante"() SECURITY DEFINER'])).toContain("inv_config_ia_instante");
  });

  it("falla si el disparador de solo inserción queda deshabilitado", async () => {
    expect(await guardianTras(['ALTER TABLE "config_ia" DISABLE TRIGGER "config_ia_solo_insercion"'])).toContain("config_ia");
  });
});

// Frente B (B5): SIMULACION en config_ia. Las dos CHECK que cambió la migración *_config_ia_simulacion (tareas y usa) están en
// el guardián con la definición nueva, tal como la devuelve pg_get_constraintdef en una base recién migrada. Quien las vuelva
// a la de antes (sin SIMULACION), las afloje (sin el COALESCE que impide que un NULL deje pasar la fila) o las endurezca
// (SIMULACION obligatoria) detiene el despliegue.
describe("guardián del esquema: config_ia con SIMULACION (B5)", () => {
  const leerMigracion = (sufijo: string): string => {
    const dir = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
    const carpeta = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith(sufijo)).map((d) => d.name);
    expect(carpeta, sufijo).toHaveLength(1);
    return readFileSync(`${dir}${carpeta[0]}/migration.sql`, "utf8").replace(/--.*$/gm, "");
  };
  const definicion = (sql: string, nombre: string): string => new RegExp(`ADD CONSTRAINT "${nombre}" CHECK \\(([\\s\\S]*?)\\);\\n`).exec(sql)?.[1] ?? "";
  // Otros archivos de integración dejan filas en config_ia (con y sin SIMULACION) y la nueva CHECK se valida contra ellas: dentro de
  // la transacción que se deshace, se vacía la tabla (la solo inserción se apaga y se vuelve a encender, para que el guardián la vea
  // tal como está). Exige superusuario, como otros casos de este archivo.
  const reemplazar = (nombre: string, check: string): readonly string[] => [
    'ALTER TABLE "config_ia" DISABLE TRIGGER "config_ia_solo_insercion"',
    'DELETE FROM "config_ia"',
    'ALTER TABLE "config_ia" ENABLE TRIGGER "config_ia_solo_insercion"',
    `ALTER TABLE "config_ia" DROP CONSTRAINT "${nombre}"`,
    `ALTER TABLE "config_ia" ADD CONSTRAINT "${nombre}" CHECK (${check})`,
  ];
  const nueva = leerMigracion("_config_ia_simulacion");
  const original = leerMigracion("_config_ia");
  const tareasNueva = definicion(nueva, "config_ia_tareas_chk");
  const usaNueva = definicion(nueva, "config_ia_usa_chk");

  it("control: la definición de M2 sí es la que tiene la base (el guardián pasa) y no es la de la migración original", async () => {
    expect(tareasNueva).toContain("SIMULACION");
    expect(usaNueva).toContain("COALESCE");
    expect(await guardianTras(reemplazar("config_ia_tareas_chk", tareasNueva))).toBeNull();
    expect(await guardianTras(reemplazar("config_ia_usa_chk", usaNueva))).toBeNull();
  });

  it("el guardián trae las dos definiciones nuevas, con SIMULACION y su COALESCE", () => {
    expect(guardian).toMatch(/\['config_ia', 'config_ia_tareas_chk', 'CHECK [^\n]*''SIMULACION''::text[^\n]*\]/);
    expect(guardian).toMatch(/\['config_ia', 'config_ia_usa_chk', 'CHECK [^\n]*COALESCE\(\(\(\(tareas -> ''SIMULACION''::text\) -> ''activo''::text\) = ''true''::jsonb\), false\)[^\n]*\]/);
  });

  it("falla si config_ia_tareas_chk vuelve a la de antes (sin SIMULACION)", async () => {
    const vieja = definicion(original, "config_ia_tareas_chk");
    expect(vieja).not.toBe("");
    expect(vieja).not.toContain("SIMULACION");
    expect(await guardianTras(reemplazar("config_ia_tareas_chk", vieja))).toContain("config_ia_tareas_chk");
  });

  it("falla si config_ia_usa_chk vuelve a la de antes (sin la cláusula de SIMULACION)", async () => {
    const vieja = definicion(original, "config_ia_usa_chk");
    expect(vieja).not.toBe("");
    expect(await guardianTras(reemplazar("config_ia_usa_chk", vieja))).toContain("config_ia_usa_chk");
  });

  it("falla si a config_ia_usa_chk se le quita el COALESCE de SIMULACION (un NULL dejaría pasar la fila)", async () => {
    const sinCoalesce = usaNueva.replace(/COALESCE\((\(\("tareas"->'SIMULACION'\)->'activo' = 'true'::jsonb\)), false\)/, "$1");
    expect(sinCoalesce).not.toBe(usaNueva);
    expect(await guardianTras(reemplazar("config_ia_usa_chk", sinCoalesce))).toContain("config_ia_usa_chk");
  });

  it("falla si a config_ia_tareas_chk se le quita el COALESCE de SIMULACION (una SIMULACION sin «activo» entraría)", async () => {
    const sinCoalesce = tareasNueva.replace(/COALESCE\((jsonb_typeof\(\("tareas"->'SIMULACION'\)->'activo'\) = 'boolean'), false\)/, "$1");
    expect(sinCoalesce).not.toBe(tareasNueva);
    expect(await guardianTras(reemplazar("config_ia_tareas_chk", sinCoalesce))).toContain("config_ia_tareas_chk");
  });

  it("falla si config_ia_tareas_chk pasa a exigir SIMULACION (las filas de antes dejarían de entrar) o a no exigir las tres", async () => {
    const exigeLasCuatro = tareasNueva.replace("?& ARRAY['DIARIO', 'REGLAS', 'ESCENARIOS']", "?& ARRAY['DIARIO', 'REGLAS', 'ESCENARIOS', 'SIMULACION']");
    expect(exigeLasCuatro).not.toBe(tareasNueva);
    expect(await guardianTras(reemplazar("config_ia_tareas_chk", exigeLasCuatro))).toContain("config_ia_tareas_chk");
    const noExigeEscenarios = tareasNueva.replace("?& ARRAY['DIARIO', 'REGLAS', 'ESCENARIOS']", "?& ARRAY['DIARIO', 'REGLAS']");
    expect(noExigeEscenarios).not.toBe(tareasNueva);
    expect(await guardianTras(reemplazar("config_ia_tareas_chk", noExigeEscenarios))).toContain("config_ia_tareas_chk");
  });
});

// Frente B (B5, revisión): el enum TipoResumenIa es parte del esquema: M1 le agrega SIMULACION. Si falta, sobra o cambia de lugar
// una etiqueta, el despliegue se detiene (los valores de un enum no se pueden quitar con un DROP: se vigilan sus etiquetas y su orden).
describe("guardián del esquema: enum TipoResumenIa", () => {
  it("control: en la base recién migrada el guardián pasa con DIARIO, REGLAS, ESCENARIOS y SIMULACION, en ese orden", async () => {
    const etiquetas = await db.$queryRaw<{ e: string }[]>`SELECT e.enumlabel::text AS e FROM pg_enum e WHERE e.enumtypid = to_regtype('"TipoResumenIa"') ORDER BY e.enumsortorder`;
    expect(etiquetas.map((x) => x.e)).toEqual(["DIARIO", "REGLAS", "ESCENARIOS", "SIMULACION"]);
    expect(await guardianTras([])).toBeNull();
  });

  it.each([
    ["falta SIMULACION (se le cambia el nombre)", [`ALTER TYPE "TipoResumenIa" RENAME VALUE 'SIMULACION' TO 'SIMULACION_X'`]],
    ["sobra una etiqueta", [`ALTER TYPE "TipoResumenIa" ADD VALUE 'OTRA'`]],
    ["se cambia el orden de las etiquetas", [
      `ALTER TYPE "TipoResumenIa" RENAME VALUE 'REGLAS' TO 'TMP'`,
      `ALTER TYPE "TipoResumenIa" RENAME VALUE 'SIMULACION' TO 'REGLAS'`,
      `ALTER TYPE "TipoResumenIa" RENAME VALUE 'TMP' TO 'SIMULACION'`,
    ]],
  ])("falla si %s", async (_n, romper) => {
    expect(await guardianTras(romper)).toContain("TipoResumenIa");
  });
});

// Fase E (O5): tarifa_comision. Si una migración o un DROP le quita la solo inserción, la hora que pone la base, la
// unicidad de la versión o una CHECK, o si la función del instante cambia, el despliegue se detiene.
describe("guardián del esquema: tarifa_comision", () => {
  it.each([
    ["el disparador de solo inserción", ['DROP TRIGGER "tarifa_comision_solo_insercion" ON "tarifa_comision"'], "tarifa_comision_solo_insercion"],
    ["el disparador del instante", ['DROP TRIGGER "tarifa_comision_instante" ON "tarifa_comision"'], "tarifa_comision_instante"],
    ["la unicidad de la versión", ['DROP INDEX "tarifa_comision_version_key"'], "tarifa_comision_version_key"],
    ["la CHECK de los cargos", ['ALTER TABLE "tarifa_comision" DROP CONSTRAINT "tarifa_comision_cargos_chk"'], "tarifa_comision_cargos_chk"],
    ["la CHECK del porcentaje", ['ALTER TABLE "tarifa_comision" DROP CONSTRAINT "tarifa_comision_porcentaje_chk"'], "tarifa_comision_porcentaje_chk"],
    ["la llave del autor", ['ALTER TABLE "tarifa_comision" DROP CONSTRAINT "tarifa_comision_autorId_fkey"'], "tarifa_comision_autorId_fkey"],
  ])("falla si se borra %s", async (_n, romper, nombre) => {
    expect(await guardianTras(romper)).toContain(nombre);
  });

  it("falla si la CHECK de los montos se afloja (otro techo)", async () => {
    const otra = 'ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_montos_chk" CHECK ("minimoPorOrden" >= 0 AND "fijoPorOrden" >= 0)';
    expect(await guardianTras(['ALTER TABLE "tarifa_comision" DROP CONSTRAINT "tarifa_comision_montos_chk"', otra])).toContain("tarifa_comision_montos_chk");
  });

  it("falla si la función del instante cambia de código o pasa a SECURITY DEFINER", async () => {
    const reemplazo = `CREATE OR REPLACE FUNCTION "inv_tarifa_comision_instante"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`;
    expect(await guardianTras([reemplazo])).toContain("inv_tarifa_comision_instante");
    expect(await guardianTras(['ALTER FUNCTION "inv_tarifa_comision_instante"() SECURITY DEFINER'])).toContain("inv_tarifa_comision_instante");
  });

  it("falla si el disparador de solo inserción queda deshabilitado", async () => {
    expect(await guardianTras(['ALTER TABLE "tarifa_comision" DISABLE TRIGGER "tarifa_comision_solo_insercion"'])).toContain("tarifa_comision");
  });
});

// Precios cada minuto: precio_intradia. Si una migración o un DROP le quita un disparador, la unicidad, una CHECK, o si
// una de sus funciones cambia o pasa a SECURITY DEFINER, el despliegue se detiene.
describe("guardián del esquema: precio_intradia", () => {
  it.each([
    ["el disparador de la inserción", ['DROP TRIGGER "precio_intradia_insercion" ON "precio_intradia"'], "precio_intradia_insercion"],
    ["el disparador del retiro", ['DROP TRIGGER "precio_intradia_retiro" ON "precio_intradia"'], "precio_intradia_retiro"],
    ["la unicidad (sin duplicados)", ['DROP INDEX "precio_intradia_instrumentoId_instante_fuente_key"'], "precio_intradia_instrumentoId_instante_fuente_key"],
    ["la CHECK del precio", ['ALTER TABLE "precio_intradia" DROP CONSTRAINT "precio_intradia_precio_chk"'], "precio_intradia_precio_chk"],
    ["la CHECK de la fuente", ['ALTER TABLE "precio_intradia" DROP CONSTRAINT "precio_intradia_fuente_chk"'], "precio_intradia_fuente_chk"],
    ["la llave de la especie", ['ALTER TABLE "precio_intradia" DROP CONSTRAINT "precio_intradia_instrumentoId_fkey"'], "precio_intradia_instrumentoId_fkey"],
  ])("falla si se borra %s", async (_n, romper, nombre) => {
    expect(await guardianTras(romper)).toContain(nombre);
  });

  it("falla si la CHECK del precio se afloja", async () => {
    const otra = 'ALTER TABLE "precio_intradia" ADD CONSTRAINT "precio_intradia_precio_chk" CHECK ("precio" > -1)';
    expect(await guardianTras(['ALTER TABLE "precio_intradia" DROP CONSTRAINT "precio_intradia_precio_chk"', otra])).toContain("precio_intradia_precio_chk");
  });

  it("falla si una de sus funciones cambia de código, pierde el search_path o pasa a SECURITY DEFINER", async () => {
    const reemplazo = `CREATE OR REPLACE FUNCTION "inv_precio_intradia_retiro"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RETURN OLD; END; $$`;
    expect(await guardianTras([reemplazo])).toContain("inv_precio_intradia_retiro");
    expect(await guardianTras(['ALTER FUNCTION "inv_precio_intradia_insercion"() SECURITY DEFINER'])).toContain("inv_precio_intradia_insercion");
    expect(await guardianTras(['ALTER FUNCTION "inv_precio_intradia_retiro"() RESET search_path'])).toContain("inv_precio_intradia_retiro");
  });

  it("falla si un disparador queda deshabilitado", async () => {
    expect(await guardianTras(['ALTER TABLE "precio_intradia" DISABLE TRIGGER "precio_intradia_retiro"'])).toContain("precio_intradia");
  });
});

// Alertas: umbral_version, alerta y alerta_vista. Si una migración o un DROP les quita un disparador, un índice de
// deduplicación, una CHECK o una llave, o si una de sus funciones cambia, pierde el search_path o pasa a SECURITY DEFINER,
// el despliegue se detiene (rojo por mutación: cada caso rompe una cosa y el guardián la nombra).
describe("guardián del esquema: alertas", () => {
  it.each([
    ["el disparador de la inserción de alerta", ['DROP TRIGGER "alerta_insercion" ON "alerta"'], "alerta_insercion"],
    ["la solo inserción de alerta", ['DROP TRIGGER "alerta_solo_insercion" ON "alerta"'], "alerta_solo_insercion"],
    ["la solo inserción de alerta_vista", ['DROP TRIGGER "alerta_vista_solo_insercion" ON "alerta_vista"'], "alerta_vista_solo_insercion"],
    ["el disparador del dueño en alerta_vista", ['DROP TRIGGER "alerta_vista_insercion" ON "alerta_vista"'], "alerta_vista_insercion"],
    ["el disparador del instante de umbral_version", ['DROP TRIGGER "umbral_version_instante" ON "umbral_version"'], "umbral_version_instante"],
    ["la solo inserción de umbral_version", ['DROP TRIGGER "umbral_version_solo_insercion" ON "umbral_version"'], "umbral_version_solo_insercion"],
    ["el índice de deduplicación por clave", ['DROP INDEX "alerta_clave_key"'], "alerta_clave_key"],
    ["el índice de una por decreto", ['DROP INDEX "alerta_decreto_key"'], "alerta_decreto_key"],
    ["la unicidad de la vista por alerta", ['DROP INDEX "alerta_vista_alertaId_key"'], "alerta_vista_alertaId_key"],
    ["la unicidad de la versión de umbrales", ['DROP INDEX "umbral_version_version_key"'], "umbral_version_version_key"],
    ["la CHECK de coherencia por tipo", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_coherencia_chk"'], "alerta_coherencia_chk"],
    ["la CHECK de los tipos", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_chk"'], "alerta_tipo_chk"],
    ["la CHECK del rango de cerca", ['ALTER TABLE "umbral_version" DROP CONSTRAINT "umbral_version_cerca_chk"'], "umbral_version_cerca_chk"],
    ["el disparador del autor de umbral_version", ['DROP TRIGGER "umbral_version_autor" ON "umbral_version"'], "umbral_version_autor"],
    ["la CHECK de la referencia", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_referencia_chk"'], "alerta_referencia_chk"],
    ["la CHECK de esFechaEx", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_esfechaex_chk"'], "alerta_esfechaex_chk"],
    ["la CHECK del dato y su hora de traída", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_instante_chk"'], "alerta_instante_chk"],
    ["la llave de la regla", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_reglaId_fkey"'], "alerta_reglaId_fkey"],
    ["la llave del decreto", ['ALTER TABLE "alerta" DROP CONSTRAINT "alerta_decretoId_fkey"'], "alerta_decretoId_fkey"],
    ["la llave del usuario de la vista", ['ALTER TABLE "alerta_vista" DROP CONSTRAINT "alerta_vista_usuarioId_fkey"'], "alerta_vista_usuarioId_fkey"],
  ])("falla si se borra %s", async (_n, romper, nombre) => {
    expect(await guardianTras(romper)).toContain(nombre);
  });

  it("falla si un rango se afloja o el índice de la clave cambia (definición exacta)", async () => {
    const otra = 'ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_cerca_chk" CHECK ("alertaCercaPct" >= 0.5 AND "alertaCercaPct" <= 50)';
    expect(await guardianTras(['ALTER TABLE "umbral_version" DROP CONSTRAINT "umbral_version_cerca_chk"', otra])).toContain("umbral_version_cerca_chk");
    // Con la base en la clave, el índice sería más débil (un cruce en el intradía y otro en el cierre entrarían los dos).
    const conBase = 'CREATE UNIQUE INDEX "alerta_clave_key" ON "alerta"("dia", "tipo", COALESCE("instrumentoId", \'-\'), COALESCE("reglaId", \'-\'), COALESCE("sentido", \'-\'), "base") WHERE "tipo" <> \'FECHA_EX\'';
    expect(await guardianTras(['DROP INDEX "alerta_clave_key"', conBase])).toContain("alerta_clave_key");
  });

  it("falla si una de sus funciones cambia de código, pierde el search_path o pasa a SECURITY DEFINER", async () => {
    const reemplazo = `CREATE OR REPLACE FUNCTION "inv_alerta_insercion"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RETURN NEW; END; $$`;
    expect(await guardianTras([reemplazo])).toContain("inv_alerta_insercion");
    expect(await guardianTras(['ALTER FUNCTION "inv_alerta_insercion"() SECURITY DEFINER'])).toContain("inv_alerta_insercion");
    expect(await guardianTras(['ALTER FUNCTION "inv_alerta_vista_insercion"() RESET search_path'])).toContain("inv_alerta_vista_insercion");
    expect(await guardianTras(['ALTER FUNCTION "inv_alerta_vista_insercion"() SECURITY DEFINER'])).toContain("inv_alerta_vista_insercion");
    expect(await guardianTras(['ALTER FUNCTION "inv_umbral_version_instante"() RESET search_path'])).toContain("inv_umbral_version_instante");
    expect(await guardianTras(['ALTER FUNCTION "inv_umbral_version_autor"() RESET search_path'])).toContain("inv_umbral_version_autor");
    expect(await guardianTras(['ALTER FUNCTION "inv_umbral_version_autor"() SECURITY DEFINER'])).toContain("inv_umbral_version_autor");
  });

  it("falla si un disparador queda deshabilitado", async () => {
    for (const [tabla, disparador] of [["alerta", "alerta_insercion"], ["alerta_vista", "alerta_vista_insercion"], ["umbral_version", "umbral_version_instante"]]) {
      expect(await guardianTras([`ALTER TABLE "${tabla}" DISABLE TRIGGER "${disparador}"`])).toContain(tabla);
    }
  });

  it("falla si inv_alertas (o inv_app) es miembro del dueño de las tablas de las alertas", async () => {
    for (const rol of ["inv_alertas", "inv_app"]) {
      const sql = [
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${rol}') THEN CREATE ROLE ${rol} NOLOGIN; END IF; END $$`,
        `DO $$ BEGIN EXECUTE format('GRANT %I TO ${rol}', (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.alerta'::regclass)); END $$`,
      ];
      const error = await guardianTras(sql);
      expect(error, rol).toMatch(new RegExp(`rol con privilegios del dueño ${rol} en alerta\\b`));
    }
  });
});
