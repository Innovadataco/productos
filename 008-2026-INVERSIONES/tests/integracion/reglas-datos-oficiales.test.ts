// Datos oficiales (fase C, C1: migraciones *_datos_oficiales_tipos y *_datos_oficiales) contra la base de PRUEBAS.
// - valor_serie_oficial: lo que publica la fuente (TRM, TPM, IPC…), una vigencia por fila, versionada y sin solapes.
// - dividendo_decretado reformado: una fila por cuota, con su fila cruda (REGISTRO_DECRETOS), su referencia oficial,
//   versiones (v+1 retira a la v) y la anulación como versión nueva (P10).
// - dividendo: las columnas viejas (bruto, retención, tasa, enlace al decreto) quedan nulas hasta el DROP de contrato.
// - inv_solo_retiro: para TODOS los roles, también el dueño y el superusuario (la vía B carga como dueño), sin salida
//   por inv.reversion: nace vigente, no se borra y solo se marca el retiro, una vez y con la hora de la base.
// - La guardia de la migración: con tablas TEMP que tapan a las de public dentro de una transacción que se deshace (la
//   base de pruebas es compartida y la migración ya corrió: no se puede volver a correr).
// Cada caso corre en una transacción que siempre se deshace: no deja filas. Datos inventados; fechas de 2027 o
// anteriores a 2022.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
let n = 0;
const unico = () => `${corrida}-${(n += 1)}`;

type Tx = Prisma.TransactionClient;
class Deshacer extends Error {}

/** Corre `cuerpo` en una transacción que siempre se deshace; devuelve el error que lanzó o null. */
async function enTransaccionDeshecha(cuerpo: (tx: Tx) => Promise<void>): Promise<string | null> {
  let error: string | null = null;
  try {
    await db.$transaction(
      async (tx) => {
        try {
          await cuerpo(tx);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        throw new Deshacer();
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  return error;
}

interface Base {
  readonly instrumentoId: string;
  /** Una fila cruda nueva del registro de decretos (o de otro tipo). */
  readonly fila: (tipo?: "REGISTRO_DECRETOS" | "TRII_DIVIDENDOS") => Promise<string>;
}

async function base(tx: Tx): Promise<Base> {
  const u = await tx.usuario.create({ data: { email: `datos-oficiales-${unico()}@ejemplo.invalid`, rol: "DUENO" } });
  const cargas = new Map<string, string>();
  const instrumentoId = (await tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `FICT${unico()}`, nombre: "Acción ficticia" } })).id;
  return {
    instrumentoId,
    async fila(tipo = "REGISTRO_DECRETOS") {
      let cargaId = cargas.get(tipo);
      if (!cargaId) {
        cargaId = (await tx.cargaArchivo.create({
          data: { tipoFuente: tipo, nombreArchivo: "decretos.ficticio.csv", sha256: "c".repeat(64), estado: "CARGADO", cargadoPorId: u.id },
        })).id;
        cargas.set(tipo, cargaId);
      }
      const f = await tx.filaFuente.create({
        data: { tipoFuente: tipo, claveNatural: unico().padStart(64, "0"), ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } },
      });
      return f.id;
    },
  };
}

const DECRETO = {
  tipo: "ORDINARIO",
  valor: "37.91",
  anuncio: "2027-03-17",
  cuota: 1,
  ex: "2027-05-12",
  pago: "2027-05-19",
  referencia: "https://www.superfinanciera.gov.co/ficticio/decreto?id=1237",
  version: 1,
  anulada: false,
  nota: null as string | null,
};
type Decreto = typeof DECRETO;

/** Inserta un decreto por SQL crudo (así se prueban 'NaN' y los límites sin pasar por Prisma); devuelve su id. */
async function decreto(tx: Tx, b: Base, cambios: Partial<Decreto> = {}, filaFuenteId?: string, retirado = false): Promise<string> {
  const d = { ...DECRETO, ...cambios };
  const id = `dd-${unico()}`;
  await tx.$executeRawUnsafe(
    `INSERT INTO "dividendo_decretado" ("id", "instrumentoId", "tipo", "valorPorAccion", "fechaPago", "referenciaOficial", "nota",
       "filaFuenteId", "fechaAnuncio", "cuota", "fechaEx", "version", "anulada", "reemplazadoEn")
     VALUES ($1, $2, $3::"TipoDividendo", $4::numeric, $5::date, $6, $7, $8, $9::date, $10::smallint, $11::date, $12::int, $13::boolean,
       CASE WHEN $14::boolean THEN now() END)`,
    id, b.instrumentoId, d.tipo, d.valor, d.pago, d.referencia, d.nota, filaFuenteId ?? (await b.fila()), d.anuncio, d.cuota, d.ex, d.version, d.anulada,
    retirado,
  );
  return id;
}

const SERIE = { serie: "FICTA_TASA", desde: "2027-03-08", hasta: "2027-03-08", valor: "4613.27", fuente: "sfc:32sa-8pi3" };
type Serie = typeof SERIE;

async function serie(tx: Tx, cambios: Partial<Serie> = {}, retirado = false): Promise<string> {
  const s = { ...SERIE, ...cambios };
  const id = `vs-${unico()}`;
  await tx.$executeRawUnsafe(
    `INSERT INTO "valor_serie_oficial" ("id", "serie", "desde", "hasta", "valor", "fuente", "reemplazadoEn")
     VALUES ($1, $2, $3::date, $4::date, $5::numeric, $6, CASE WHEN $7::boolean THEN now() END)`,
    id, s.serie, s.desde, s.hasta, s.valor, s.fuente, retirado,
  );
  return id;
}

/**
 * Violación de un índice único (23505) por sus columnas, como las nombra PostgreSQL: en SQL crudo, Prisma da el detalle
 * («Key (…)=…») y no el nombre del índice. Las columnas distinguen la clave vigente de la de versión.
 */
const duplicado = (columnas: string) => new RegExp(`23505[\\s\\S]*Key \\(${columnas.replace(/"/g, '\\\\?"')}\\)=`);

const retirar = (tabla: string, id: string) => `UPDATE "${tabla}" SET "reemplazadoEn" = now() WHERE "id" = '${id}'`;

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("valor_serie_oficial: lo que entra", () => {
  it("una vigencia válida entra, con traidoEn de la base y vigente", async () => {
    let fila: unknown = null;
    const error = await enTransaccionDeshecha(async (tx) => {
      const id = await serie(tx);
      fila = await tx.$queryRawUnsafe(`SELECT "traidoEn" = now() AS hoy, "reemplazadoEn" IS NULL AS vigente FROM "valor_serie_oficial" WHERE "id" = '${id}'`);
    });
    expect(error).toBeNull();
    expect(fila).toEqual([{ hoy: true, vigente: true }]);
  });

  it("el nombre de la serie: mayúsculas, dígitos y _, de 2 a 40, empezando por letra", async () => {
    const con = (s: string) => enTransaccionDeshecha(async (tx) => void (await serie(tx, { serie: s })));
    expect(await con("AB")).toBeNull();
    expect(await con(`A${"B".repeat(39)}`)).toBeNull();
    expect(await con(`A${"B".repeat(40)}`)).toMatch(/valor_serie_oficial_serie_chk/);
    expect(await con("A")).toMatch(/valor_serie_oficial_serie_chk/);
    expect(await con("trm")).toMatch(/valor_serie_oficial_serie_chk/);
    expect(await con("1TRM")).toMatch(/valor_serie_oficial_serie_chk/);
    expect(await con("TRM-USD")).toMatch(/valor_serie_oficial_serie_chk/);
  });

  it("la vigencia: hasta ≥ desde y a lo sumo 31 días después", async () => {
    const con = (desde: string, hasta: string) => enTransaccionDeshecha(async (tx) => void (await serie(tx, { desde, hasta })));
    expect(await con("2027-01-01", "2027-02-01")).toBeNull();
    expect(await con("2027-01-01", "2027-02-02")).toMatch(/valor_serie_oficial_vigencia_chk/);
    expect(await con("2027-03-09", "2027-03-08")).toMatch(/valor_serie_oficial_vigencia_chk/);
  });

  it("el valor: positivo, sin NaN (que pasa `> 0`) y sin infinito (no cabe en Decimal(20,8))", async () => {
    const con = (valor: string) => enTransaccionDeshecha(async (tx) => void (await serie(tx, { valor })));
    expect(await con("0.00000001")).toBeNull();
    expect(await con("0")).toMatch(/valor_serie_oficial_valor_chk/);
    expect(await con("-3.71")).toMatch(/valor_serie_oficial_valor_chk/);
    expect(await con("NaN")).toMatch(/valor_serie_oficial_valor_chk/);
    expect(await con("Infinity")).toMatch(/numeric field overflow/);
  });

  it("la fuente: sfc, banrep o dane, con su dataset de 1 a 80 caracteres seguros", async () => {
    const con = (fuente: string) => enTransaccionDeshecha(async (tx) => void (await serie(tx, { fuente })));
    expect(await con("banrep:CBR")).toBeNull();
    expect(await con("dane:anex-IPC-Indices.v2")).toBeNull();
    expect(await con(`sfc:${"x".repeat(80)}`)).toBeNull();
    expect(await con(`sfc:${"x".repeat(81)}`)).toMatch(/valor_serie_oficial_fuente_chk/);
    expect(await con("sfc:")).toMatch(/valor_serie_oficial_fuente_chk/);
    expect(await con("yahoo")).toMatch(/valor_serie_oficial_fuente_chk/);
    expect(await con("yahoo:TRM")).toMatch(/valor_serie_oficial_fuente_chk/);
    expect(await con("sfc:a b")).toMatch(/valor_serie_oficial_fuente_chk/);
    expect(await con("sfc:a/../b")).toMatch(/valor_serie_oficial_fuente_chk/);
  });
});

describe("valor_serie_oficial: una sola vigencia vigente por día", () => {
  it("dos vigentes que se solapan no entran (adyacentes, de otra serie o con la anterior retirada, sí)", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      await serie(tx, { desde: "2027-03-01", hasta: "2027-03-05" });
      await serie(tx, { desde: "2027-03-05", hasta: "2027-03-09" });
    })).toMatch(/valor_serie_oficial_sin_solape_excl/);
    expect(await enTransaccionDeshecha(async (tx) => {
      await serie(tx, { desde: "2027-03-01", hasta: "2027-03-04" });
      await serie(tx, { desde: "2027-03-05", hasta: "2027-03-09" });
      await serie(tx, { serie: "FICTA_OTRA", desde: "2027-03-02", hasta: "2027-03-06" });
    })).toBeNull();
    expect(await enTransaccionDeshecha(async (tx) => {
      const vieja = await serie(tx, { desde: "2027-03-01", hasta: "2027-03-05", valor: "4613.29" });
      await tx.$executeRawUnsafe(retirar("valor_serie_oficial", vieja));
      await serie(tx, { desde: "2027-03-01", hasta: "2027-03-05" });
      await serie(tx, { desde: "2027-03-06", hasta: "2027-03-06" });
    })).toBeNull();
  });

  // Las dos reglas cubren el mismo día: cada una se prueba sola (se quita la otra dentro de la transacción). El orden
  // en que la base las revisa sigue el de creación de los índices y cambia al restaurar un respaldo (pg_dump crea las
  // restricciones antes que los índices): el camino de escritura (C2a) debe manejar las dos (P2002 y 23P01).
  it("el índice único parcial (serie, desde) solo, sin la exclusión", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE "valor_serie_oficial" DROP CONSTRAINT "valor_serie_oficial_sin_solape_excl"');
      await serie(tx);
      await serie(tx, { hasta: "2027-03-09" });
    })).toMatch(duplicado("serie, desde"));
  });

  it("la exclusión sola, sin el índice único", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      await tx.$executeRawUnsafe('DROP INDEX "valor_serie_oficial_vigente_key"');
      await serie(tx);
      await serie(tx);
    })).toMatch(/valor_serie_oficial_sin_solape_excl/);
  });
});

describe("dividendo_decretado reformado: lo que entra", () => {
  it("un decreto válido entra con moneda COP, versión 1, vigente y registradoEn de la base", async () => {
    let fila: unknown = null;
    const error = await enTransaccionDeshecha(async (tx) => {
      const id = await decreto(tx, await base(tx));
      fila = await tx.$queryRawUnsafe(
        `SELECT "moneda"::text AS moneda, "version", "anulada", "registradoEn" = now() AS hoy, "reemplazadoEn" IS NULL AS vigente
         FROM "dividendo_decretado" WHERE "id" = '${id}'`,
      );
    });
    expect(error).toBeNull();
    expect(fila).toEqual([{ moneda: "COP", version: 1, anulada: false, hoy: true, vigente: true }]);
  });

  it("la columna fuente pasó a llamarse referenciaOficial, y existe el tipo de fuente REGISTRO_DECRETOS", async () => {
    const columnas = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dividendo_decretado' ORDER BY 1`;
    expect(columnas.map((c) => c.column_name).sort()).toEqual([
      "anulada", "cuota", "fechaAnuncio", "fechaEx", "fechaPago", "filaFuenteId", "id", "instrumentoId", "moneda", "nota",
      "reemplazadoEn", "referenciaOficial", "registradoEn", "tipo", "valorPorAccion", "version",
    ]);
    const tipos = await db.$queryRaw<{ v: string }[]>`SELECT unnest(enum_range(NULL::"TipoFuente"))::text AS v`;
    expect(tipos.map((t) => t.v)).toContain("REGISTRO_DECRETOS");
    expect(tipos.map((t) => t.v)).not.toContain("REGISTRO_RELEVANTE");
  });

  it("la fracción de escisión no es un decreto", async () => {
    const con = (tipo: string) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), { tipo })));
    expect(await con("EXTRAORDINARIO")).toBeNull();
    expect(await con("FRACCION_ESCISION")).toMatch(/dividendo_decretado_tipo_chk/);
  });

  it("las fechas: anuncio ≤ ex ≤ pago (iguales, sí)", async () => {
    const con = (anuncio: string, ex: string, pago: string) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), { anuncio, ex, pago })));
    expect(await con("2027-05-12", "2027-05-12", "2027-05-12")).toBeNull();
    expect(await con("2027-05-13", "2027-05-12", "2027-05-19")).toMatch(/dividendo_decretado_fechas_chk/);
    expect(await con("2027-03-17", "2027-05-20", "2027-05-19")).toMatch(/dividendo_decretado_fechas_chk/);
  });

  it("la cuota va de 1 a 12 y la versión empieza en 1", async () => {
    const con = (c: Partial<Decreto>) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), c)));
    expect(await con({ cuota: 1 })).toBeNull();
    expect(await con({ cuota: 12 })).toBeNull();
    expect(await con({ cuota: 0 })).toMatch(/dividendo_decretado_cuota_chk/);
    expect(await con({ cuota: 13 })).toMatch(/dividendo_decretado_cuota_chk/);
    expect(await con({ version: 0 })).toMatch(/dividendo_decretado_version_chk/);
  });

  it("el valor por acción: positivo y sin NaN", async () => {
    const con = (valor: string) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), { valor })));
    expect(await con("0.000001")).toBeNull();
    expect(await con("0")).toMatch(/dividendo_decretado_valor_chk/);
    expect(await con("NaN")).toMatch(/dividendo_decretado_valor_chk/);
  });

  it("la nota: nula o con texto, hasta 500 caracteres", async () => {
    const con = (nota: string | null) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), { nota })));
    expect(await con(null)).toBeNull();
    expect(await con("x".repeat(500))).toBeNull();
    expect(await con("x".repeat(501))).toMatch(/dividendo_decretado_nota_chk/);
    expect(await con("")).toMatch(/dividendo_decretado_nota_chk/);
    expect(await con("   ")).toMatch(/dividendo_decretado_nota_chk/);
  });

  it("la referencia oficial: https de la SFC o de la BVC con ruta, o sfc:<radicado>; nada más", async () => {
    const con = (referencia: string) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), { referencia })));
    expect(await con("https://www.superfinanciera.gov.co/SIMEV2/informacionrelevantegeneral?id=4613&t=A")).toBeNull();
    expect(await con("https://www.bvc.com.co/emisores/ficticio#cuotas")).toBeNull();
    expect(await con("sfc:2027-1237-01")).toBeNull();
    expect(await con(`sfc:${"7".repeat(60)}`)).toBeNull();
    expect(await con(`https://www.bvc.com.co/${"a".repeat(477)}`)).toBeNull(); // 500 en total
    for (const mala of [
      `https://www.bvc.com.co/${"a".repeat(478)}`, // 501
      `sfc:${"7".repeat(61)}`,
      "sfc:",
      "sfc:12 34",
      "http://www.superfinanciera.gov.co/x",
      "https://www.superfinanciera.gov.co/",
      "https://www.superfinanciera.gov.co.ficticio.example/x",
      "https://www.superfinanciera.gov.co@ficticio.example/x",
      "https://superfinanciera.gov.co/x",
      "https://www.bvc.com.co/a b",
      'https://www.bvc.com.co/a"b',
      "https://www.bvc.com.co/a<b",
      "https://www.bvc.com.co/a\\b",
      "javascript:alert(1)",
      "ficticia",
    ]) {
      expect(await con(mala), mala).toMatch(/dividendo_decretado_referencia_chk/);
    }
  });

  it("anulada (P10): solo desde la versión 2 y con nota", async () => {
    const con = (c: Partial<Decreto>) => enTransaccionDeshecha(async (tx) => void (await decreto(tx, await base(tx), { anulada: true, ...c })));
    expect(await con({ version: 2, nota: "registrado con la cuota equivocada" })).toBeNull();
    expect(await con({ version: 1, nota: "registrado con la cuota equivocada" })).toMatch(/dividendo_decretado_anulada_chk/);
    expect(await con({ version: 2, nota: null })).toMatch(/dividendo_decretado_anulada_chk/);
  });

  it("cada decreto nace de su propia fila cruda, que existe", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      await decreto(tx, b, {}, `no-existe-${unico()}`);
    })).toMatch(/dividendo_decretado_filaFuenteId_fkey/);
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      const fila = await b.fila();
      await decreto(tx, b, { cuota: 1 }, fila);
      await decreto(tx, b, { cuota: 2 }, fila);
    })).toMatch(duplicado('"filaFuenteId"'));
  });
});

describe("dividendo_decretado: una versión vigente por especie, anuncio, tipo y cuota", () => {
  it("dos vigentes de la misma cuota no entran (una v2 sin retirar la v1); otra cuota u otro tipo de la misma asamblea, sí", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      await decreto(tx, b);
      await decreto(tx, b, { valor: "41.37", version: 2 });
    })).toMatch(duplicado('"instrumentoId", "fechaAnuncio", tipo, cuota'));
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      await decreto(tx, b);
      await decreto(tx, b, { cuota: 2, ex: "2027-08-11", pago: "2027-08-18" });
      await decreto(tx, b, { tipo: "EXTRAORDINARIO" });
    })).toBeNull();
  });

  it("la v2 entra cuando la v1 se retira; una segunda v1, no", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      const v1 = await decreto(tx, b);
      await tx.$executeRawUnsafe(retirar("dividendo_decretado", v1));
      const v2 = await decreto(tx, b, { version: 2, valor: "37.93" });
      await tx.$executeRawUnsafe(retirar("dividendo_decretado", v2));
      await decreto(tx, b, { version: 3, anulada: true, nota: "el emisor no lo decretó" });
    })).toBeNull();
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      const v1 = await decreto(tx, b);
      await tx.$executeRawUnsafe(retirar("dividendo_decretado", v1));
      await decreto(tx, b, { valor: "37.93" });
    })).toMatch(duplicado('"instrumentoId", "fechaAnuncio", tipo, cuota, version'));
  });
});

describe("inv_solo_retiro: para todos los roles (aquí, el superusuario), sin salida por inv.reversion", () => {
  const tablas: ReadonlyArray<readonly [string, (tx: Tx, retirado?: boolean) => Promise<string>, string]> = [
    ["valor_serie_oficial", (tx, retirado) => serie(tx, {}, retirado), `"valor" = 4613.29`],
    ["dividendo_decretado", async (tx, retirado) => decreto(tx, await base(tx), {}, undefined, retirado), `"valorPorAccion" = 37.93`],
  ];

  for (const [tabla, crear, otroValor] of tablas) {
    it(`${tabla}: nace vigente (una fila ya retirada no se inserta)`, async () => {
      expect(await enTransaccionDeshecha(async (tx) => void (await crear(tx, false)))).toBeNull();
      expect(await enTransaccionDeshecha(async (tx) => void (await crear(tx, true)))).toMatch(/nace vigente/);
    });

    it(`${tabla}: no se borra, ni con SET LOCAL inv.reversion = 'on'`, async () => {
      expect(await enTransaccionDeshecha(async (tx) => {
        const id = await crear(tx);
        await tx.$executeRawUnsafe(`DELETE FROM "${tabla}" WHERE "id" = '${id}'`);
      })).toMatch(/no se borra/);
      expect(await enTransaccionDeshecha(async (tx) => {
        const id = await crear(tx);
        await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
        await tx.$executeRawUnsafe(`DELETE FROM "${tabla}" WHERE "id" = '${id}'`);
      })).toMatch(/no se borra/);
      expect(await enTransaccionDeshecha(async (tx) => {
        const id = await crear(tx);
        await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
        await tx.$executeRawUnsafe(`UPDATE "${tabla}" SET ${otroValor} WHERE "id" = '${id}'`);
      })).toMatch(/solo se puede marcar el retiro/);
    });

    it(`${tabla}: solo se marca el retiro, con la hora de la base y sin cambiar nada más`, async () => {
      let fila: unknown = null;
      expect(await enTransaccionDeshecha(async (tx) => {
        const id = await crear(tx);
        await tx.$executeRawUnsafe(`UPDATE "${tabla}" SET "reemplazadoEn" = '2019-01-02T00:00:00Z' WHERE "id" = '${id}'`);
        fila = await tx.$queryRawUnsafe(`SELECT "reemplazadoEn" = now() AS hoy FROM "${tabla}" WHERE "id" = '${id}'`);
      })).toBeNull();
      expect(fila).toEqual([{ hoy: true }]);
      expect(await enTransaccionDeshecha(async (tx) => {
        const id = await crear(tx);
        await tx.$executeRawUnsafe(`UPDATE "${tabla}" SET ${otroValor} WHERE "id" = '${id}'`);
      })).toMatch(/solo se puede marcar el retiro/);
      expect(await enTransaccionDeshecha(async (tx) => {
        const id = await crear(tx);
        await tx.$executeRawUnsafe(`UPDATE "${tabla}" SET ${otroValor}, "reemplazadoEn" = now() WHERE "id" = '${id}'`);
      })).toMatch(/al retirar solo cambia reemplazadoEn/);
    });

    it(`${tabla}: lo retirado no se reabre ni se vuelve a fechar`, async () => {
      for (const valor of ["NULL", "now() + interval '1 day'"]) {
        expect(await enTransaccionDeshecha(async (tx) => {
          const id = await crear(tx);
          await tx.$executeRawUnsafe(retirar(tabla, id));
          await tx.$executeRawUnsafe(`UPDATE "${tabla}" SET "reemplazadoEn" = ${valor} WHERE "id" = '${id}'`);
        }), valor).toMatch(/no se reabre ni se vuelve a fechar/);
      }
    });
  }

  it("dividendo_decretado: al retirar no se puede marcar anulada (la anulación es una versión nueva)", async () => {
    expect(await enTransaccionDeshecha(async (tx) => {
      const id = await decreto(tx, await base(tx), { version: 2, nota: "nota ficticia" });
      await tx.$executeRawUnsafe(`UPDATE "dividendo_decretado" SET "anulada" = true, "reemplazadoEn" = now() WHERE "id" = '${id}'`);
    })).toMatch(/al retirar solo cambia reemplazadoEn/);
  });
});

describe("dividendo: las columnas viejas quedan nulas (dividendo_viejas_nulas_chk)", () => {
  async function dividendo(tx: Tx, b: Base, viejas: Record<string, string>) {
    const columnas = Object.keys(viejas).map((c) => `, "${c}"`).join("");
    const valores = Object.values(viejas).map((v) => `, ${v}`).join("");
    await tx.$executeRawUnsafe(
      `INSERT INTO "dividendo" ("id", "filaFuenteId", "fechaPago", "instrumentoId", "montoNeto"${columnas})
       VALUES ('dv-${unico()}', '${await b.fila("TRII_DIVIDENDOS")}', '2027-05-19', '${b.instrumentoId}', 47.93${valores})`,
    );
  }

  it("un dividendo sin columnas viejas entra; con cualquiera de ellas, no (aunque cumpla los CHECK viejos)", async () => {
    expect(await enTransaccionDeshecha(async (tx) => dividendo(tx, await base(tx), {}))).toBeNull();
    const casos: ReadonlyArray<Record<string, string>> = [
      { montoBruto: "47.93", retencion: "0" },
      { montoBruto: "73.71", retencion: "25.78", tasaRetencion: "0.35" },
      { tasaRetencion: "0.1" },
    ];
    for (const viejas of casos) {
      expect(await enTransaccionDeshecha(async (tx) => dividendo(tx, await base(tx), viejas)), JSON.stringify(viejas)).toMatch(/dividendo_viejas_nulas_chk/);
    }
    expect(await enTransaccionDeshecha(async (tx) => {
      const b = await base(tx);
      const d = await decreto(tx, b);
      await dividendo(tx, b, { decretadoId: `'${d}'` });
    })).toMatch(/dividendo_viejas_nulas_chk/);
  });

  it("nace validado (la guardia probó que no hay filas que lo incumplan)", async () => {
    const filas = await db.$queryRaw<{ convalidated: boolean }[]>`SELECT convalidated FROM pg_constraint WHERE conname = 'dividendo_viejas_nulas_chk'`;
    expect(filas).toEqual([{ convalidated: true }]);
  });
});

describe("la guardia de la migración (falla cerrada)", () => {
  /** El bloque de la guardia, tal cual está en la migración (entre sus marcadores). */
  const guardia = (): string => {
    const sql = readFileSync(fileURLToPath(new URL("../../prisma/migrations/20261122030100_datos_oficiales/migration.sql", import.meta.url)), "utf8");
    const m = /-- guardia:inicio\n([\s\S]*?)-- guardia:fin/.exec(sql);
    if (!m?.[1]) throw new Error("la migración no trae la guardia entre sus marcadores");
    return m[1];
  };

  /** Tapa dividendo_decretado y dividendo con tablas TEMP vacías (pg_temp va primero), siembra y corre la guardia. */
  const guardiaCon = (sembrar: readonly string[]) =>
    enTransaccionDeshecha(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "dividendo_decretado" ON COMMIT DROP AS SELECT * FROM public."dividendo_decretado" WITH NO DATA');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "dividendo" ON COMMIT DROP AS SELECT * FROM public."dividendo" WITH NO DATA');
      for (const s of sembrar) await tx.$executeRawUnsafe(s);
      await tx.$executeRawUnsafe(guardia());
    });

  it("pasa con las dos tablas vacías", async () => {
    expect(await guardiaCon([])).toBeNull();
  });

  it("muerde si dividendo_decretado tiene filas (y solo da el conteo)", async () => {
    const error = await guardiaCon([
      `INSERT INTO pg_temp."dividendo_decretado" ("id", "valorPorAccion") VALUES ('x1', 1237.41), ('x2', 4613.27)`,
    ]);
    expect(error).toMatch(/dividendo_decretado/);
    expect(error).toMatch(/\b2\b/);
    expect(error).not.toMatch(/1237|4613/);
  });

  it.each(["montoBruto", "retencion", "tasaRetencion", "decretadoId"])("muerde si algún dividendo trae %s (y solo da el conteo)", async (columna) => {
    const valor = columna === "decretadoId" ? "'dd-ficticio-1237'" : "0.3711";
    const error = await guardiaCon([`INSERT INTO pg_temp."dividendo" ("id", "${columna}") VALUES ('x1', ${valor})`]);
    expect(error).toMatch(new RegExp(`${columna} 1\\b`));
    expect(error).not.toMatch(/3711|1237/);
  });
});
