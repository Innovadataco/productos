// Reglas de resumen_ia en la base de PRUEBAS (Mac y CI): cada CHECK muerde, a lo sumo un PUBLICADO por clave (los
// RECHAZADO y FALLIDO se repiten), nada se edita ni se borra, y la hora del registro la pone la base para todo rol que no
// sea el dueño. Cada caso corre en UNA transacción que siempre se deshace; el que no es dueño es pg_write_all_data (escribe
// en todo, también "generadoEn": es inv_ia con el permiso de columna dado por error). No crea ni cambia roles (son
// globales del clúster y el del Mac tiene la base de trabajo). Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirPaquete } from "@/ia/paquete";
import { sha256Hex } from "@/ia/hash";
import { filaDeResumen, type FilaResumen } from "@/ia/registro/fila";
import { ENTRADAS_FICTICIAS } from "../../unit/ia/apoyo/hechos.ficticio";

const db = new PrismaClient();
const NO_DUENO = "pg_write_all_data";
const ANTEDATADO = new Date("2019-02-11T10:37:00.000Z");
type Tx = Prisma.TransactionClient;
class Deshacer extends Error {}

const paquete = construirPaquete({ ...ENTRADAS_FICTICIAS.DIARIO(), avisos: ["AVISO_FICTICIO_REGLAS"] });
const exito = { ok: true, puerta: "local", salidaCruda: '{"frases":[]}', modelo: "ornith:9b", modeloDigest: "sha256:ficticio3719", latenciaMs: 2917, tokensEntrada: 1237, tokensSalida: 211 } as const;
const comun = { paquete, prompt: { version: "resumen-diario-v1", hash: sha256Hex("prompt ficticio de las reglas") }, opciones: { temperature: 0, seed: 42 }, validadorVersion: "validador-v1" } as const;
const PUBLICADO = filaDeResumen({ ...comun, estado: "PUBLICADO", exito, texto: "Resumen ficticio." });
const RECHAZADO = filaDeResumen({ ...comun, estado: "RECHAZADO", exito, motivos: ["CIFRA_SUELTA"] });
const FALLIDO = filaDeResumen({ ...comun, estado: "FALLIDO", puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalles: ["CONEXION_RECHAZADA"] });

/**
 * Frente B (B4): la misma fila, como de SIMULACION con `hechos-v2` (el contrato v2 de A todavía no existe en esta rama: lo que
 * la base mira son SOLO el tipo, la versión, el hash y el día del paquete guardado, y se arman a mano, inventados).
 */
const HASH_SIMULACION = sha256Hex("paquete ficticio de la simulación");
const comoSimulacion = (f: FilaResumen, cambios: { readonly hechos?: Record<string, unknown>; readonly hechosVersion?: string } = {}): FilaResumen =>
  ({
    ...f,
    tipo: "SIMULACION",
    hechosHash: HASH_SIMULACION,
    hechosVersion: cambios.hechosVersion ?? "hechos-v2",
    hechos: { ...(f.hechos as Record<string, unknown>), tipo: "SIMULACION", version: "hechos-v2", hash: HASH_SIMULACION, ...cambios.hechos },
    promptVersion: "resumen-simulacion-v1",
  }) as unknown as FilaResumen;
const SIM_PUBLICADO = comoSimulacion(PUBLICADO);
const SIM_RECHAZADO = comoSimulacion(RECHAZADO);
const SIM_FALLIDO = comoSimulacion(FALLIDO);

type Fila = Omit<FilaResumen, "motivos"> & { readonly motivos: readonly (string | null)[]; readonly generadoEn?: Date };
let corrida = 0;

/** INSERT crudo (sin RETURNING: pg_write_all_data no lee), con un id nuevo y las columnas de la fila. */
async function insertar(tx: Tx, f: Fila): Promise<void> {
  corrida += 1;
  const columnas = [
    Prisma.sql`${`reglas-${Date.now().toString(36)}-${corrida}`}`, Prisma.sql`${f.tipo}::"TipoResumenIa"`, Prisma.sql`${f.fechaNegocio.toISOString().slice(0, 10)}::date`,
    Prisma.sql`${f.estado}::"EstadoResumenIa"`, Prisma.sql`${f.puerta}::"PuertaIa"`, Prisma.sql`${f.texto}`, Prisma.sql`${f.salidaModelo}`,
    Prisma.sql`${JSON.stringify(f.hechos)}::jsonb`, Prisma.sql`${f.hechosHash}`, Prisma.sql`${f.hechosVersion}`, Prisma.sql`${f.modelo}`,
    Prisma.sql`${f.modeloDigest}`, Prisma.sql`${JSON.stringify(f.opciones)}::jsonb`, Prisma.sql`${f.promptVersion}`, Prisma.sql`${f.promptHash}`,
    Prisma.sql`${f.validadorVersion}`, Prisma.sql`${f.motivos}::text[]`, Prisma.sql`${f.latenciaMs}::int`, Prisma.sql`${f.tokensEntrada}::int`,
    Prisma.sql`${f.tokensSalida}::int`,
  ];
  const nombres = Prisma.raw(
    '"id", "tipo", "fechaNegocio", "estado", "puerta", "texto", "salidaModelo", "hechos", "hechosHash", "hechosVersion", "modelo", "modeloDigest", "opciones", "promptVersion", "promptHash", "validadorVersion", "motivos", "latenciaMs", "tokensEntrada", "tokensSalida"',
  );
  if (f.generadoEn === undefined) {
    await tx.$executeRaw`INSERT INTO "resumen_ia" (${nombres}) VALUES (${Prisma.join(columnas)})`;
  } else {
    await tx.$executeRaw`INSERT INTO "resumen_ia" (${nombres}, "generadoEn") VALUES (${Prisma.join(columnas)}, ${f.generadoEn}::timestamptz)`;
  }
}

/** Corre `cuerpo` en una transacción que siempre se deshace; devuelve el mensaje de su error (o null) y lo que devolvió. */
async function enTransaccion<T>(cuerpo: (tx: Tx) => Promise<T>): Promise<{ error: string | null; valor: T | undefined }> {
  let valor: T | undefined;
  let error: string | null = null;
  try {
    await db.$transaction(
      async (tx) => {
        try {
          valor = await cuerpo(tx);
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
  return { error, valor };
}

const errorAlInsertar = async (...filas: Fila[]) => (await enTransaccion(async (tx) => { for (const f of filas) await insertar(tx, f); })).error;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("resumen_ia: control positivo", () => {
  it("las tres formas válidas entran (también VISTA_NO_CIEGA sin puerta)", async () => {
    const vista = filaDeResumen({ ...comun, estado: "FALLIDO", puerta: null, motivo: "VISTA_NO_CIEGA", detalles: ["VALOR_DEL_PAQUETE"] });
    expect(await errorAlInsertar(PUBLICADO, RECHAZADO, FALLIDO, vista)).toBeNull();
  });
});

describe("resumen_ia: cada CHECK muerde", () => {
  it.each<[string, Fila, string]>([
    ["PUBLICADO sin texto", { ...PUBLICADO, texto: null }, "resumen_ia_estado_chk"],
    ["RECHAZADO con texto", { ...RECHAZADO, texto: "Texto ficticio." }, "resumen_ia_estado_chk"],
    ["FALLIDO con salida del modelo", { ...FALLIDO, salidaModelo: "{}" }, "resumen_ia_estado_chk"],
    ["PUBLICADO sin salida del modelo", { ...PUBLICADO, salidaModelo: null }, "resumen_ia_estado_chk"],
    ["PUBLICADO sin digest del modelo", { ...PUBLICADO, modeloDigest: null }, "resumen_ia_estado_chk"],
    ["FALLIDO con tokens", { ...FALLIDO, tokensEntrada: 17 }, "resumen_ia_estado_chk"],
    ["PUBLICADO con motivos", { ...PUBLICADO, motivos: ["LONGITUD"] }, "resumen_ia_motivos_chk"],
    ["RECHAZADO sin motivos", { ...RECHAZADO, motivos: [] }, "resumen_ia_motivos_chk"],
    ["un motivo en minúsculas", { ...RECHAZADO, motivos: ["longitud"] }, "resumen_ia_motivos_chk"],
    ["un motivo con dígitos", { ...RECHAZADO, motivos: ["CIFRA_4613"] }, "resumen_ia_motivos_chk"],
    ["un motivo nulo dentro de la lista", { ...RECHAZADO, motivos: ["LONGITUD", null] }, "resumen_ia_motivos_chk"],
    ["un motivo vacío (revisión de base, B1)", { ...RECHAZADO, motivos: [""] }, "resumen_ia_motivos_chk"],
    ["un motivo con coma que esconde un motivo de fallo", { ...RECHAZADO, motivos: ["LONGITUD,TIEMPO_AGOTADO"] }, "resumen_ia_motivos_chk"],
    ["FALLIDO que no empieza por un motivo de fallo", { ...FALLIDO, motivos: ["CIFRA_SUELTA"] }, "resumen_ia_motivos_chk"],
    ["RECHAZADO con un motivo de fallo", { ...RECHAZADO, motivos: ["LONGITUD", "TIEMPO_AGOTADO"] }, "resumen_ia_motivos_chk"],
    ["VISTA_NO_CIEGA con puerta", { ...FALLIDO, motivos: ["VISTA_NO_CIEGA"] }, "resumen_ia_puerta_chk"],
    ["un fallo de generador sin puerta", { ...FALLIDO, puerta: null }, "resumen_ia_puerta_chk"],
    ["VISTA_NO_CIEGA que no va primero", { ...FALLIDO, puerta: null, motivos: ["TIEMPO_AGOTADO", "VISTA_NO_CIEGA"] }, "resumen_ia_puerta_chk"],
    ["PUBLICADO sin puerta", { ...PUBLICADO, puerta: null }, "resumen_ia_puerta_chk"],
    ["el hash de la columna distinto del de los hechos", { ...PUBLICADO, hechosHash: "a".repeat(64) }, "resumen_ia_hechos_chk"],
    ["la versión de la columna distinta de la de los hechos", { ...PUBLICADO, hechosVersion: "hechos-v7" }, "resumen_ia_hechos_chk"],
    ["el tipo de la columna distinto del de los hechos", { ...PUBLICADO, tipo: "REGLAS" }, "resumen_ia_hechos_chk"],
    ["la fecha de negocio distinta del hoy de los hechos", { ...PUBLICADO, fechaNegocio: new Date("2027-03-18T00:00:00.000Z") }, "resumen_ia_hechos_chk"],
    ["hechos que no son un objeto", { ...PUBLICADO, hechos: [] as never }, "resumen_ia_hechos_chk"],
    ["hechos sin ninguna de las claves (un NULL no pasa: revisión de base, A1)", { ...PUBLICADO, hechos: {} }, "resumen_ia_hechos_chk"],
    ["hechos sin el hash", { ...PUBLICADO, hechos: { ...(PUBLICADO.hechos as object), hash: undefined } as never }, "resumen_ia_hechos_chk"],
    ["hechos con el hash nulo", { ...PUBLICADO, hechos: { ...(PUBLICADO.hechos as object), hash: null } as never }, "resumen_ia_hechos_chk"],
    ["hechos sin el hoy", { ...PUBLICADO, hechos: { ...(PUBLICADO.hechos as object), hoy: undefined } as never }, "resumen_ia_hechos_chk"],
    ["un hash del prompt corto", { ...PUBLICADO, promptHash: "abc" }, "resumen_ia_formas_chk"],
    ["una versión del validador mal formada", { ...PUBLICADO, validadorVersion: "Validador 1" }, "resumen_ia_formas_chk"],
    ["un modelo con espacios", { ...PUBLICADO, modelo: "ornith 9b" }, "resumen_ia_formas_chk"],
    ["opciones que no son un objeto", { ...PUBLICADO, opciones: [] as never }, "resumen_ia_formas_chk"],
    ["un texto de solo espacios", { ...PUBLICADO, texto: "  \n " }, "resumen_ia_textos_chk"],
    ["una salida del modelo sobre el tope", { ...RECHAZADO, salidaModelo: "x".repeat(65_537) }, "resumen_ia_textos_chk"],
    ["tokens negativos", { ...PUBLICADO, tokensSalida: -1 }, "resumen_ia_conteos_chk"],
    ["una latencia negativa", { ...RECHAZADO, latenciaMs: -3 }, "resumen_ia_conteos_chk"],
  ])("%s", async (_nombre, fila, restriccion) => {
    expect(await errorAlInsertar(fila)).toMatch(new RegExp(`violates check constraint \\\\?"${restriccion}\\\\?"`));
  });
});

// Frente B (B4): SIMULACION con hechos-v2. Aplican las CHECK de siempre de resumen_ia (estado, motivos, puerta, hechos, formas,
// textos y conteos, revisadas en la migración 20261122175656_resumen_ia): ninguna menciona la lista de tipos ni exige hechos-v1
// (formas pide ^hechos-v[1-9][0-9]*$), así que no hay CHECK que cambiar; esto lo prueba.
describe("resumen_ia: SIMULACION con hechos-v2", () => {
  it("control positivo: PUBLICADO, RECHAZADO y FALLIDO de SIMULACION con hechos-v2 entran (y se leen de vuelta con su tipo)", async () => {
    const { error, valor } = await enTransaccion(async (tx) => {
      for (const f of [SIM_PUBLICADO, SIM_RECHAZADO, SIM_FALLIDO]) await insertar(tx, f);
      return tx.$queryRaw<{ estado: string; tipo: string; v: string }[]>`SELECT "estado"::text AS estado, "tipo"::text AS tipo, "hechosVersion" AS v FROM "resumen_ia" WHERE "hechosHash" = ${HASH_SIMULACION} ORDER BY "estado"`;
    });
    expect(error).toBeNull();
    expect(valor).toEqual([
      { estado: "FALLIDO", tipo: "SIMULACION", v: "hechos-v2" },
      { estado: "PUBLICADO", tipo: "SIMULACION", v: "hechos-v2" },
      { estado: "RECHAZADO", tipo: "SIMULACION", v: "hechos-v2" },
    ]);
  });

  it("los tres de hoy siguen con hechos-v1 y entran en el mismo registro (DIARIO no cambió)", async () => {
    expect(PUBLICADO.hechosVersion).toBe("hechos-v1");
    expect(await errorAlInsertar(PUBLICADO, SIM_PUBLICADO)).toBeNull();
  });

  it.each<[string, Fila, string]>([
    ["la versión de la columna distinta de la de los hechos (v1 contra v2)", comoSimulacion(PUBLICADO, { hechosVersion: "hechos-v1" }), "resumen_ia_hechos_chk"],
    ["el tipo de los hechos distinto del de la columna", comoSimulacion(PUBLICADO, { hechos: { tipo: "DIARIO" } }), "resumen_ia_hechos_chk"],
    ["el hash de los hechos distinto del de la columna", comoSimulacion(PUBLICADO, { hechos: { hash: "b".repeat(64) } }), "resumen_ia_hechos_chk"],
    ["una versión que no es hechos-vN", comoSimulacion(PUBLICADO, { hechosVersion: "hechos-v0", hechos: { version: "hechos-v0" } }), "resumen_ia_formas_chk"],
    ["PUBLICADO sin texto", { ...SIM_PUBLICADO, texto: null }, "resumen_ia_estado_chk"],
    ["RECHAZADO con texto", { ...SIM_RECHAZADO, texto: "Texto ficticio." }, "resumen_ia_estado_chk"],
    ["FALLIDO con salida del modelo", { ...SIM_FALLIDO, salidaModelo: "{}" }, "resumen_ia_estado_chk"],
    ["PUBLICADO con motivos", { ...SIM_PUBLICADO, motivos: ["LONGITUD"] }, "resumen_ia_motivos_chk"],
    ["FALLIDO sin motivo de fallo", { ...SIM_FALLIDO, motivos: ["CIFRA_SUELTA"] }, "resumen_ia_motivos_chk"],
  ])("sigue mordiendo con SIMULACION: %s", async (_nombre, fila, restriccion) => {
    expect(await errorAlInsertar(fila)).toMatch(new RegExp(`violates check constraint \\\\?"${restriccion}\\\\?"`));
  });

  it("resumen_ia_publicado_key muerde: dos PUBLICADO de SIMULACION con la misma clave chocan (23505), y RECHAZADO y FALLIDO se repiten", async () => {
    expect(await errorAlInsertar(SIM_PUBLICADO, SIM_PUBLICADO)).toMatch(/23505[\s\S]*Key \(tipo, \\?"fechaNegocio\\?", \\?"hechosHash\\?", \\?"promptHash\\?", \\?"modeloDigest\\?"\)/);
    expect(await errorAlInsertar(SIM_RECHAZADO, SIM_RECHAZADO, SIM_FALLIDO, SIM_FALLIDO, SIM_PUBLICADO)).toBeNull();
  });

  it("la clave incluye el tipo: un PUBLICADO de SIMULACION y otro de otro tipo con el mismo hash, prompt y digest no chocan", async () => {
    const otroTipo = { ...SIM_PUBLICADO, tipo: "REGLAS", hechos: { ...(SIM_PUBLICADO.hechos as object), tipo: "REGLAS" } } as unknown as FilaResumen;
    expect(await errorAlInsertar(SIM_PUBLICADO, otroTipo)).toBeNull();
  });
});

describe("resumen_ia: a lo sumo un PUBLICADO por clave", () => {
  it("dos PUBLICADO con la misma clave chocan (23505, la clave de resumen_ia_publicado_key)", async () => {
    // PostgreSQL nombra las columnas del índice (no su nombre): son las de resumen_ia_publicado_key, y es el único único.
    expect(await errorAlInsertar(PUBLICADO, PUBLICADO)).toMatch(/23505[\s\S]*Key \(tipo, \\?"fechaNegocio\\?", \\?"hechosHash\\?", \\?"promptHash\\?", \\?"modeloDigest\\?"\)/);
  });

  it("los RECHAZADO y los FALLIDO se repiten, y un PUBLICADO con otro prompt u otro digest es otra clave", async () => {
    const otroPrompt = { ...PUBLICADO, promptHash: sha256Hex("otro prompt ficticio") };
    const otroDigest = { ...PUBLICADO, modeloDigest: "sha256:otro-ficticio" };
    expect(await errorAlInsertar(RECHAZADO, RECHAZADO, FALLIDO, FALLIDO, PUBLICADO, otroPrompt, otroDigest)).toBeNull();
  });
});

describe("resumen_ia: de solo inserción", () => {
  it.each([
    ["UPDATE", `UPDATE "resumen_ia" SET "texto" = 'cambiado' WHERE "estado" = 'PUBLICADO'`],
    ["DELETE", `DELETE FROM "resumen_ia"`],
  ])("%s falla con restrict_violation (también para el superusuario)", async (_n, sentencia) => {
    const { error } = await enTransaccion(async (tx) => {
      await insertar(tx, PUBLICADO);
      await tx.$executeRawUnsafe(sentencia);
    });
    expect(error).toMatch(/solo inserción/);
  });
});

describe("resumen_ia: la hora del registro la pone la base", () => {
  const leerHora = async (tx: Tx) => (await tx.$queryRaw<{ g: Date; ahora: Date }[]>`SELECT "generadoEn" AS g, clock_timestamp() AS ahora FROM "resumen_ia" WHERE "hechosHash" = ${paquete.hash} ORDER BY "generadoEn" DESC LIMIT 1`)[0]!;

  it("quien no es el dueño no la puede antedatar: la base la pisa con clock_timestamp()", async () => {
    const { error, valor } = await enTransaccion(async (tx) => {
      const antes = (await tx.$queryRaw<{ t: Date }[]>`SELECT clock_timestamp() AS t`)[0]!.t;
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${NO_DUENO}`);
      await insertar(tx, { ...PUBLICADO, generadoEn: ANTEDATADO });
      await tx.$executeRawUnsafe("RESET ROLE");
      return { antes, ...(await leerHora(tx)) };
    });
    expect(error).toBeNull();
    expect(valor!.g.getTime()).toBeGreaterThanOrEqual(valor!.antes.getTime());
    expect(valor!.g.getTime()).toBeLessThanOrEqual(valor!.ahora.getTime());
  });

  it("el dueño la conserva (restauración de solo datos), y si no la manda, la pone el DEFAULT", async () => {
    const conservada = await enTransaccion(async (tx) => {
      await insertar(tx, { ...PUBLICADO, generadoEn: ANTEDATADO });
      return leerHora(tx);
    });
    expect(conservada.error).toBeNull();
    expect(conservada.valor!.g.toISOString()).toBe(ANTEDATADO.toISOString());
    const porDefecto = await enTransaccion(async (tx) => {
      await insertar(tx, PUBLICADO);
      return leerHora(tx);
    });
    expect(porDefecto.error).toBeNull();
    expect(porDefecto.valor!.g.getFullYear()).toBeGreaterThan(2025);
  });

  it("es la hora de la fila, no la de la transacción: una transacción sostenida no fecha en el pasado", async () => {
    const { error, valor } = await enTransaccion(async (tx) => {
      const inicio = (await tx.$queryRaw<{ t: Date }[]>`SELECT now() AS t`)[0]!.t;
      await tx.$executeRawUnsafe("SELECT pg_sleep(0.05)");
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${NO_DUENO}`);
      await insertar(tx, PUBLICADO);
      await tx.$executeRawUnsafe("RESET ROLE");
      return { inicio, ...(await leerHora(tx)) };
    });
    expect(error).toBeNull();
    expect(valor!.g.getTime()).toBeGreaterThan(valor!.inicio.getTime());
  });
});
