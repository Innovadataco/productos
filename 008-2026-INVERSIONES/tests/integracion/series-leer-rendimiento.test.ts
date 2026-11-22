// Rendimiento de serieEnRango (src/datos-oficiales/series/leer.ts) con un volumen inventado grande, contra la base de
// PRUEBAS. Un tope de tiempo fijo depende de la máquina (el CI corre con la cobertura v8 instrumentada); por eso se
// mide cómo ESCALA, en la misma máquina y en el mismo momento, y con lo que la base hace (no solo con el reloj):
// - Estructura: la consulta real (la que arma Prisma, no una copia a mano) corre dentro de una transacción y se mide lo
//   que sumó a los contadores de la transacción (pg_stat_get_xact_*): ningún recorrido secuencial de
//   valor_serie_oficial y el índice único parcial (serie, desde) de los vigentes usado.
// - Bloques (deterministas, no dependen del reloj): la misma consulta de 31 días lee a lo sumo el doble de bloques
//   (más 4) con la tabla 8 veces más grande (un recorrido secuencial crece con la tabla), y 31 días al final de una
//   serie de 12 000 leen a lo sumo el doble que 31 días al principio (sin el piso desde − 31 el índice se recorrería
//   desde el comienzo de la serie). Y siempre menos de una décima de las páginas de la tabla.
// - Tiempo: 16 veces las filas que entrega (12 000 contra 750 días) tarda menos de 32 veces (el doble de lo lineal): la
//   más rápida de tres corridas grandes contra la más lenta de tres chicas, para que la carga de otros procesos no la
//   vuelva inestable. Atrapa lo que hace con las filas un costo claramente más que lineal (los bloques ya cubren la
//   base). Su alcance, medido por mutación en el PR: recorrer todas las filas por cada fila da unas 55 veces y muerde;
//   una búsqueda que corta a la mitad (findIndex) da unas 20 y NO muerde a este tamaño, porque el costo fijo de cada
//   fila (Prisma) pesa más. Un tope absoluto de 60 s atrapa además una caída catastrófica. Con SERIES_MEDIR=1 imprime
//   las medidas (así se miden para el PR).
// Volumen: la serie (12 000 días seguidos desde 1931) y el ruido (otras series iguales, hasta que la tabla crezca 8
// veces) se siembran con un INSERT … SELECT generate_series: el camino único (guardar.ts) tardaría minutos con este
// volumen y no es lo que se mide (lo prueba tests/integracion/series-importar.test.ts). Las filas nacen vigentes
// (inv_solo_retiro pone traidoEn) y pasan los CHECK de la tabla; nada se puede borrar, así que el volumen queda para los
// archivos que corren después (cada uno lee sus propias series, por índice). Fechas anteriores a 1965; cifras inventadas.
import { type Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serieDelCatalogo, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { MAX_DIAS_RANGO_SERIES, serieEnRango } from "@/datos-oficiales/series/leer";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase();
const SERIE = `FICTR_${corrida}`;
/** Una serie intercalada día a día con el ruido (el peor caso de dispersión en el heap; database-reviewer, MEDIO). */
const SERIE_DISPERSA = `FICTD_${corrida}`;
const ficticia = (codigo: string): SerieCatalogo => ({ ...serieDelCatalogo("TPM")!, codigo, unidad: "unidad ficticia", fuente: "sfc:ficticia" });
const CATALOGO_PRUEBA: readonly SerieCatalogo[] = [ficticia(SERIE), ficticia(SERIE_DISPERSA)];
const INICIO_MS = Date.UTC(1931, 0, 5);
const DIA_MS = 86_400_000;
const DIAS_SERIE = 12_000;
const RANGO_CHICO = 750;
const VECES_RANGO = 16;
const RANGO_GRANDE = VECES_RANGO * RANGO_CHICO;
const CRECIMIENTO_MINIMO = 8;
const MARGEN_BLOQUES = 4;
/** Páginas de índice que puede leer una consulta acotada (altura del árbol y las hojas del tramo), además de las del heap. */
const MARGEN_INDICE = 8;
/** El doble de lo lineal. */
const ESCALA_MAXIMA = 2 * VECES_RANGO;
const CORRIDAS = 3;
const TOPE_CATASTROFICO_MS = 60_000;
/**
 * El ruido es 7 veces la tabla de antes: con la base recién reiniciada (scripts/integracion.mjs hace migrate reset)
 * antes hay la serie y lo poco que dejan los demás archivos. Una base sin reiniciar lo haría crecer sin tope.
 */
const MAX_TABLA_ANTES = 60_000;
const medir = process.env["SERIES_MEDIR"] === "1";

const diaN = (n: number) => new Date(INICIO_MS + n * DIA_MS);

interface Medida {
  readonly filas: number;
  readonly secuenciales: number;
  readonly scansIndiceVigente: number;
  readonly bloques: number;
}

interface Contadores {
  readonly seq: bigint;
  readonly idx: bigint;
  readonly bt: bigint;
  readonly bi: bigint | null;
}

const contadores = async (tx: Prisma.TransactionClient): Promise<Contadores> => {
  const [c] = await tx.$queryRaw<Contadores[]>`
    SELECT pg_stat_get_xact_numscans('valor_serie_oficial'::regclass) AS seq,
           pg_stat_get_xact_numscans('valor_serie_oficial_vigente_key'::regclass) AS idx,
           pg_stat_get_xact_blocks_fetched('valor_serie_oficial'::regclass) AS bt,
           (SELECT sum(pg_stat_get_xact_blocks_fetched(indexrelid))::bigint FROM pg_index WHERE indrelid = 'valor_serie_oficial'::regclass) AS bi`;
  return c!;
};

/**
 * serieEnRango dentro de una transacción y lo que ESA consulta sumó a los contadores. Se resta lo de antes, en la misma
 * transacción: PostgreSQL vacía los contadores pendientes de una conexión a lo sumo una vez por segundo y solo fuera de
 * una transacción, así que al empezar pueden traer lo de sentencias anteriores (el count(*) y el ANALYZE de la siembra);
 * dentro de la transacción no se vacían, y la diferencia es exacta.
 */
async function medirConsulta(desde: number, hasta: number, serie = SERIE): Promise<Medida> {
  return db.$transaction(async (tx) => {
    const c0 = await contadores(tx);
    const filas = await serieEnRango(tx, serie, diaN(desde), diaN(hasta), CATALOGO_PRUEBA);
    const c1 = await contadores(tx);
    const bloques = (c: Contadores) => Number(c.bt) + Number(c.bi ?? 0n);
    return { filas: filas.length, secuenciales: Number(c1.seq - c0.seq), scansIndiceVigente: Number(c1.idx - c0.idx), bloques: bloques(c1) - bloques(c0) };
  });
}

/** ESQUEMA DEL ROJO (security-reviewer, MEDIO): solo se siembra en una base de pruebas que llega casi vacía. */
function exigirBaseDescartable(nombreBase: string, filasPrevias: number): void {
  void nombreBase;
  void filasPrevias;
}

async function contar(): Promise<number> {
  const [f] = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "valor_serie_oficial"`;
  return Number(f!.n);
}

async function paginasDeLaTabla(): Promise<number> {
  const [f] = await db.$queryRaw<{ n: bigint }[]>`SELECT (pg_relation_size('valor_serie_oficial') / current_setting('block_size')::int)::bigint AS n`;
  return Number(f!.n);
}

/** `cuantas` series de DIAS_SERIE días seguidos (de un día cada vigencia), con códigos `<prefijo>` o `<prefijo>_R<k>`. */
async function sembrar(prefijo: string, cuantas: number | null): Promise<void> {
  const ultimo = DIAS_SERIE - 1;
  if (cuantas === null) {
    await db.$executeRaw`
      INSERT INTO "valor_serie_oficial" ("id", "serie", "desde", "hasta", "valor", "fuente")
      SELECT ${prefijo} || '-' || g, ${prefijo}, DATE '1931-01-05' + g, DATE '1931-01-05' + g, round((7.13 + (g % 97) * 0.0371)::numeric, 4), 'sfc:ficticia'
      FROM generate_series(0, ${ultimo}::int) AS g`;
  } else {
    await db.$executeRaw`
      INSERT INTO "valor_serie_oficial" ("id", "serie", "desde", "hasta", "valor", "fuente")
      SELECT ${prefijo} || '_R' || k || '-' || g, ${prefijo} || '_R' || k, DATE '1931-01-05' + g, DATE '1931-01-05' + g, round((3.71 + (g % 89) * 0.0413)::numeric, 4), 'sfc:ficticia'
      FROM generate_series(0, ${ultimo}::int) AS g, generate_series(1, ${cuantas}::int) AS k`;
  }
  await db.$executeRawUnsafe('ANALYZE "valor_serie_oficial"');
}

function msDe(desde: number, hasta: number): Promise<number> {
  const inicio = performance.now();
  return serieEnRango(db, SERIE, diaN(desde), diaN(hasta), CATALOGO_PRUEBA).then((r) => {
    expect(r).toHaveLength(hasta - desde + 1);
    return performance.now() - inicio;
  });
}

const MEDIO = DIAS_SERIE / 2;
let tamanoAntes = 0;
let tamanoDespues = 0;
let paginas = 0;
let antes: { medio: Medida; principio: Medida; final: Medida };
let despues: Medida;
let dispersa: Medida;

beforeAll(async () => {
  await sembrar(SERIE, null);
  tamanoAntes = await contar();
  if (tamanoAntes > MAX_TABLA_ANTES) throw new Error(`valor_serie_oficial ya trae ${tamanoAntes} filas: corra la integración por scripts/integracion.mjs (reinicia la base)`);
  antes = {
    medio: await medirConsulta(MEDIO, MEDIO + 30),
    principio: await medirConsulta(0, 30),
    final: await medirConsulta(DIAS_SERIE - 31, DIAS_SERIE - 1),
  };
  await sembrar(SERIE, Math.ceil(((CRECIMIENTO_MINIMO - 1) * tamanoAntes + 1) / DIAS_SERIE));
  tamanoDespues = await contar();
  despues = await medirConsulta(MEDIO, MEDIO + 30);
  dispersa = await medirConsulta(MEDIO, MEDIO + 30, SERIE_DISPERSA);
  paginas = await paginasDeLaTabla();
  if (medir) {
    process.stdout.write(`[series] tabla ${tamanoAntes} → ${tamanoDespues} filas (${paginas} páginas); bloques de 31 días: medio ${antes.medio.bloques} → ${despues.bloques}, principio ${antes.principio.bloques}, final ${antes.final.bloques}\n`);
  }
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("serieEnRango · rendimiento con volumen inventado (candado de escalamiento, no de tiempo fijo)", () => {
  it("solo siembra en una base de pruebas (nombre terminado en _test) que llega casi vacía (security-reviewer, MEDIO)", () => {
    const filasDe = (f: () => void): string | null => {
      try {
        f();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(filasDe(() => exigirBaseDescartable("inversiones", 0))).toMatch(/_test/);
    expect(filasDe(() => exigirBaseDescartable("inversiones_test_copia", 0))).toMatch(/_test/);
    expect(filasDe(() => exigirBaseDescartable("inversiones_series_lectura_test", MAX_TABLA_ANTES - DIAS_SERIE + 1))).toMatch(/integracion\.mjs/);
    expect(filasDe(() => exigirBaseDescartable("inversiones_series_lectura_test", MAX_TABLA_ANTES - DIAS_SERIE))).toBeNull();
    expect(filasDe(() => exigirBaseDescartable("inversiones_test", 0))).toBeNull();
  });

  it(`con las series intercaladas día a día (peor caso de dispersión), 31 días leen a lo sumo una página por fila más ${MARGEN_INDICE} de índice (database-reviewer, MEDIO)`, () => {
    expect(dispersa.filas).toBe(31);
    expect(dispersa.secuenciales).toBe(0);
    expect(dispersa.scansIndiceVigente).toBeGreaterThanOrEqual(1);
    expect(dispersa.bloques).toBeLessThanOrEqual(dispersa.filas + MARGEN_INDICE);
    expect(dispersa.bloques * 10).toBeLessThan(paginas);
  });

  it("usa el índice único parcial (serie, desde) de los vigentes y nunca recorre la tabla", () => {
    for (const m of [antes.medio, antes.principio, antes.final, despues]) {
      expect(m.filas).toBe(31);
      expect(m.secuenciales).toBe(0);
      expect(m.scansIndiceVigente).toBeGreaterThanOrEqual(1);
    }
  });

  it(`lee según el rango, no según la tabla: con ${CRECIMIENTO_MINIMO} veces más filas, a lo sumo el doble de bloques`, () => {
    expect(tamanoDespues).toBeGreaterThanOrEqual(CRECIMIENTO_MINIMO * tamanoAntes);
    expect(despues.bloques).toBeLessThanOrEqual(2 * antes.medio.bloques + MARGEN_BLOQUES);
    expect(despues.bloques * 10).toBeLessThan(paginas);
  });

  it("ni según la historia de la serie: 31 días al final leen lo mismo que al principio (el piso desde − 31)", () => {
    expect(antes.final.bloques).toBeLessThanOrEqual(2 * antes.principio.bloques + MARGEN_BLOQUES);
  });

  it(`el tiempo escala lineal con lo que entrega: ${RANGO_GRANDE} días tardan menos de ${ESCALA_MAXIMA} veces ${RANGO_CHICO} (y nunca ${TOPE_CATASTROFICO_MS / 1000} s)`, async () => {
    expect(RANGO_GRANDE).toBeLessThanOrEqual(Math.min(DIAS_SERIE, MAX_DIAS_RANGO_SERIES));
    const inicio = 1_237;
    const chica = () => msDe(inicio, inicio + RANGO_CHICO - 1);
    const grande = () => msDe(0, RANGO_GRANDE - 1);
    await chica();
    await grande();
    const chicas: number[] = [];
    const grandes: number[] = [];
    for (let i = 0; i < CORRIDAS; i += 1) {
      chicas.push(await chica());
      grandes.push(await grande());
    }
    const referencia = Math.max(...chicas);
    const masRapida = Math.min(...grandes);
    if (medir) {
      process.stdout.write(`[series] ${RANGO_CHICO} días: ${chicas.map((t) => t.toFixed(1)).join(", ")} ms; ${RANGO_GRANDE} días: ${grandes.map((t) => t.toFixed(1)).join(", ")} ms; ${(masRapida / referencia).toFixed(1)} veces\n`);
    }
    expect(masRapida).toBeLessThan(ESCALA_MAXIMA * referencia);
    expect(Math.max(...grandes)).toBeLessThan(TOPE_CATASTROFICO_MS);
  }, 180_000);
});
