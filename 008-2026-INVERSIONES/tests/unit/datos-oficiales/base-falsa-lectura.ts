// Base falsa (sin PostgreSQL) de valor_serie_oficial para la LECTURA de las series (src/datos-oficiales/series/leer.ts).
// Solo findFirst y findMany, con lo que leer.ts les pide (serie, reemplazadoEn: null, desde gte/lte, hasta gte, orden
// por desde, take y select); guarda cada llamada para comprobar la consulta exacta. Se le puede forzar lo que devuelve
// findMany (p. ej. más filas de las posibles, que la base no deja). Cifras inventadas.
import { Prisma } from "@prisma/client";
import type { LectorSeries } from "@/datos-oficiales/series/leer";

export interface FilaLecturaFalsa {
  readonly serie: string;
  readonly desde: string;
  readonly hasta: string;
  /** Texto decimal, o un objeto con toFixed() para simular un valor que la base no debería tener. */
  readonly valor: string | { toFixed(): string };
  readonly fuente?: string;
  readonly traidoEn?: string;
  readonly retirada?: boolean;
}

interface FilaInterna {
  readonly serie: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly valor: { toFixed(): string };
  readonly fuente: string;
  readonly traidoEn: Date;
  readonly reemplazadoEn: Date | null;
}

interface Donde {
  readonly serie?: string;
  readonly reemplazadoEn?: null;
  readonly desde?: { readonly gte?: Date; readonly lte?: Date };
  readonly hasta?: { readonly gte?: Date };
}

interface Argumentos {
  readonly where: Donde;
  readonly orderBy: { readonly desde: "asc" | "desc" };
  readonly select: Readonly<Record<string, boolean>>;
  readonly take?: number;
}

export interface LlamadaLectura {
  readonly metodo: "findFirst" | "findMany";
  readonly args: Argumentos;
}

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

const cumple = (w: Donde) => (f: FilaInterna): boolean =>
  (w.serie === undefined || f.serie === w.serie) &&
  (!("reemplazadoEn" in w) || f.reemplazadoEn === null) &&
  (w.desde?.gte === undefined || f.desde >= w.desde.gte) &&
  (w.desde?.lte === undefined || f.desde <= w.desde.lte) &&
  (w.hasta?.gte === undefined || f.hasta >= w.hasta.gte);

function seleccionar(f: FilaInterna, select: Readonly<Record<string, boolean>>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, f[k as keyof FilaInterna]]));
}

export function baseFalsaLectura(filas: readonly FilaLecturaFalsa[], o: { readonly forzarMany?: readonly FilaLecturaFalsa[] } = {}) {
  const internas = (lista: readonly FilaLecturaFalsa[]): FilaInterna[] => lista.map((f) => ({
    serie: f.serie, desde: dia(f.desde), hasta: dia(f.hasta),
    valor: typeof f.valor === "string" ? new Prisma.Decimal(f.valor) : f.valor,
    fuente: f.fuente ?? "sfc:ficticia", traidoEn: new Date(f.traidoEn ?? "2027-03-04T15:13:07Z"),
    reemplazadoEn: f.retirada ? new Date("2027-03-05T16:21:43Z") : null,
  }));
  const datos = internas(filas);
  const llamadas: LlamadaLectura[] = [];
  const ordenar = (lista: FilaInterna[], orden: "asc" | "desc") =>
    [...lista].sort((a, b) => (orden === "asc" ? 1 : -1) * (a.desde.getTime() - b.desde.getTime()));

  const valorSerieOficial = {
    async findFirst(args: Argumentos) {
      llamadas.push({ metodo: "findFirst", args });
      const [primera] = ordenar(datos.filter(cumple(args.where)), args.orderBy.desde);
      return primera === undefined ? null : seleccionar(primera, args.select);
    },
    async findMany(args: Argumentos) {
      llamadas.push({ metodo: "findMany", args });
      const fuente = o.forzarMany ? internas(o.forzarMany) : ordenar(datos.filter(cumple(args.where)), args.orderBy.desde);
      return fuente.slice(0, args.take ?? fuente.length).map((f) => seleccionar(f, args.select));
    },
  };
  return { db: { valorSerieOficial } as unknown as LectorSeries, llamadas };
}
