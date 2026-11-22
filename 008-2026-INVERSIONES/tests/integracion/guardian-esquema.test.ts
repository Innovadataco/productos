// Guardián del esquema (scripts/verificar-esquema.sql) contra la base de PRUEBAS, en el Mac y en el CI.
// Cada caso rompe algo DENTRO de una transacción, corre el guardián en esa misma transacción y la deshace
// siempre: la base queda como estaba. Solo toca el catálogo (sin datos). Dos casos (UPDATE pg_index y
// DISABLE TRIGGER ALL) exigen que el usuario de DATABASE_URL_TEST sea superusuario, como en el compose y en el CI.
// Escenario que cierra (database-reviewer, D1): un DROP INDEX o una migración futura que quite un índice
// único, una FK o le cambie el ON DELETE, y el guardián pasaba igual (la reimportación duplicaría filas).
import { readFileSync } from "node:fs";
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
