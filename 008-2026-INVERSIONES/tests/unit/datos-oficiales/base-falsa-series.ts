// Base falsa (sin PostgreSQL) de valor_serie_oficial para el camino único de las series (src/datos-oficiales/series/
// guardar.ts). Imita lo que la base exige: el índice único parcial (serie, desde) entre vigentes (P2002) y la exclusión
// de vigencias solapadas (23P01, que Prisma entrega sin código), y `$transaction` deshace lo que hizo su función si esta
// lanza (lo de «otra corrida», que escribe entre la lectura y el retiro, queda: ya estaba confirmado). Se le pueden
// inyectar fallos de createMany. Cifras inventadas.
import { Prisma, type PrismaClient } from "@prisma/client";

export interface FilaSerieFalsa {
  id: string;
  serie: string;
  desde: Date;
  hasta: Date;
  valor: Prisma.Decimal;
  fuente: string;
  reemplazadoEn: Date | null;
}

export interface PreviaSerie {
  readonly serie: string;
  readonly desde: string;
  readonly hasta: string;
  readonly valor: string;
  readonly fuente?: string;
  readonly retirada?: boolean;
}

export interface OpcionesBaseFalsaSeries {
  readonly previas?: readonly PreviaSerie[];
  /** Lo que lanza cada createMany, en orden (undefined: no lanza; después de la lista, ninguno lanza). */
  readonly fallosCrear?: readonly (Error | undefined)[];
  /** Lo que lanza siempre createMany de esta serie (un fallo que no se reintenta o que se agota). */
  readonly falloSiempre?: { readonly serie: string; readonly error: () => Error };
  /** Lo que lanza cada updateMany (el retiro), en orden, después de retirar (la transacción lo deshace). */
  readonly fallosRetirar?: readonly (Error | undefined)[];
  /** «Otra corrida» que escribe entre la lectura y el retiro, en el retiro número `n` (desde 0). */
  readonly antesDeRetirar?: (filas: FilaSerieFalsa[], n: number) => void;
  /** findFirst (último vigente) lanza esto. */
  readonly errorUltimo?: Error;
}

const VERSION = "5.22.0";

export const errorP2002 = (): Error =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`serie`,`desde`)", { code: "P2002", clientVersion: VERSION, meta: { target: ["serie", "desde"] } });

/** Como lo entrega Prisma 5.22 (verificado en tests/integracion/series-importar.test.ts): sin código, el SQLSTATE en el mensaje, con la clave en el detalle. */
export const error23P01 = (): Error =>
  new Prisma.PrismaClientUnknownRequestError(
    'Invalid `prisma.valorSerieOficial.createMany()` invocation:\n\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \\"valor_serie_oficial_sin_solape_excl\\"", severity: "ERROR", detail: Some("Key (serie, daterange(desde, hasta, \'[]\'::text))=(FICTA, [2027-03-05,2027-03-08)) conflicts with existing key (serie, daterange(desde, hasta, \'[]\'::text))=(FICTA, [2027-03-05,2027-03-06))."), column: None, hint: None }), transient: false })',
    { clientVersion: VERSION },
  );

export const errorConocido = (code: string): Error => new Prisma.PrismaClientKnownRequestError(`fallo ficticio ${code} con 4613.27`, { code, clientVersion: VERSION });

type Donde = {
  serie?: string;
  reemplazadoEn?: null;
  id?: { in: string[] };
  desde?: { gte?: Date; lte?: Date };
  hasta?: { gte?: Date };
};

const cumple = (w: Donde) => (f: FilaSerieFalsa): boolean =>
  (w.serie === undefined || f.serie === w.serie) &&
  (!("reemplazadoEn" in w) || f.reemplazadoEn === null) &&
  (w.id === undefined || w.id.in.includes(f.id)) &&
  (w.desde?.gte === undefined || f.desde >= w.desde.gte) &&
  (w.desde?.lte === undefined || f.desde <= w.desde.lte) &&
  (w.hasta?.gte === undefined || f.hasta >= w.hasta.gte);

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const seSolapan = (a: { desde: Date; hasta: Date }, b: { desde: Date; hasta: Date }) => a.desde <= b.hasta && b.desde <= a.hasta;

interface DatoNuevo { serie: string; desde: Date; hasta: Date; valor: Prisma.Decimal; fuente: string }

export function baseFalsaSeries(o: OpcionesBaseFalsaSeries = {}) {
  let n = 0;
  const nuevoId = () => `f${String((n += 1)).padStart(5, "0")}`;
  const filas: FilaSerieFalsa[] = (o.previas ?? []).map((p) => ({
    id: nuevoId(), serie: p.serie, desde: dia(p.desde), hasta: dia(p.hasta), valor: new Prisma.Decimal(p.valor), fuente: p.fuente ?? "sfc:x",
    reemplazadoEn: p.retirada ? new Date("2021-01-04T00:00:00Z") : null,
  }));
  const llamadas = {
    transacciones: 0,
    opcionesTx: [] as unknown[],
    lecturas: [] as Donde[],
    creadas: [] as DatoNuevo[][],
    retiros: [] as { where: Donde; data: unknown }[],
    intentosCrear: 0,
    /** Las claves de pg_advisory_xact_lock que tomó cada transacción, en orden. */
    candados: [] as unknown[],
    /** El orden de lo que hace cada transacción: candado, leer, retirar, crear. */
    orden: [] as string[],
  };
  let retiros = 0;
  /** Lo que deshace la transacción en curso si su función lanza, en orden inverso. */
  let deshacer: (() => void)[] = [];

  const insertar = (datos: readonly DatoNuevo[]) => {
    llamadas.intentosCrear += 1;
    const inyectado = o.fallosCrear?.[llamadas.intentosCrear - 1];
    if (inyectado) throw inyectado;
    if (o.falloSiempre && datos.some((d) => d.serie === o.falloSiempre!.serie)) throw o.falloSiempre.error();
    const vigentes = () => filas.filter((f) => f.reemplazadoEn === null);
    for (const d of datos) {
      if (vigentes().some((f) => f.serie === d.serie && f.desde.getTime() === d.desde.getTime())) throw errorP2002();
      if (vigentes().some((f) => f.serie === d.serie && seSolapan(f, d))) throw error23P01();
      const nueva: FilaSerieFalsa = { id: nuevoId(), ...d, reemplazadoEn: null };
      filas.push(nueva);
      deshacer.push(() => void filas.splice(filas.indexOf(nueva), 1));
    }
    llamadas.creadas.push([...datos]);
    return { count: datos.length };
  };

  const valorSerieOficial = {
    async findMany(a: { where: Donde; select?: object; orderBy?: object }) {
      llamadas.lecturas.push(a.where);
      llamadas.orden.push("leer");
      return filas.filter(cumple(a.where)).sort((x, y) => x.desde.getTime() - y.desde.getTime()).map((f) => ({ id: f.id, desde: f.desde, hasta: f.hasta, valor: f.valor }));
    },
    async updateMany(a: { where: Donde; data: { reemplazadoEn: Date } }) {
      o.antesDeRetirar?.(filas, retiros);
      retiros += 1;
      llamadas.orden.push("retirar");
      llamadas.retiros.push({ where: a.where, data: a.data });
      const retiradas = filas.filter(cumple(a.where));
      for (const f of retiradas) {
        f.reemplazadoEn = a.data.reemplazadoEn;
        deshacer.push(() => void (f.reemplazadoEn = null));
      }
      const inyectado = o.fallosRetirar?.[retiros - 1];
      if (inyectado) throw inyectado;
      return { count: retiradas.length };
    },
    async createMany(a: { data: DatoNuevo[] }) {
      llamadas.orden.push("crear");
      return insertar(a.data);
    },
    async findFirst(a: { where: Donde; orderBy: { desde: "desc" }; select: { hasta: true } }) {
      if (o.errorUltimo) throw o.errorUltimo;
      const ultima = filas.filter(cumple(a.where)).sort((x, y) => y.desde.getTime() - x.desde.getTime())[0];
      return ultima ? { hasta: ultima.hasta } : null;
    },
  };

  const db = {
    valorSerieOficial,
    async $transaction<T>(fn: (tx: unknown) => Promise<T>, opciones?: unknown): Promise<T> {
      llamadas.transacciones += 1;
      llamadas.opcionesTx.push(opciones);
      deshacer = [];
      const $queryRaw = async (partes: TemplateStringsArray, ...valores: unknown[]) => {
        if (!partes.join("?").includes("pg_advisory_xact_lock(hashtext(?))")) throw new Error("SQL crudo inesperado en la base falsa");
        llamadas.candados.push(valores[0]);
        llamadas.orden.push("candado");
        return [{ ok: 1 }];
      };
      try {
        return await fn({ valorSerieOficial, $queryRaw });
      } catch (e) {
        for (const paso of deshacer.reverse()) paso();
        throw e;
      } finally {
        deshacer = [];
      }
    },
  };

  return {
    db: db as unknown as PrismaClient,
    llamadas,
    /** Las filas como quedaron, para comparar: [serie, desde, hasta, valor, vigente]. */
    filas: () => filas.map((f) => [f.serie, f.desde.toISOString().slice(0, 10), f.hasta.toISOString().slice(0, 10), f.valor.toString(), f.reemplazadoEn === null] as const),
    crudas: () => filas,
  };
}
