// Base falsa (sin PostgreSQL) con lo que usa el camino de escritura de los cierres (src/precios/guardar.ts):
// precio_cierre (vigente, reemplazo con guarda, inserción, conteo de verificados), calendario_bvc,
// simbolo_precio, certificacion_posicion e instrumento. `$transaction` corre la función sobre la misma base,
// sin deshacer. Especies, precios y fechas inventados.
import { Prisma, type PrismaClient } from "@prisma/client";

export interface FilaFalsa {
  id: string; instrumentoId: string; fecha: Date; precio: Prisma.Decimal; fuente: string; reemplazadoEn: Date | null;
  estado: "VERIFICADO" | "NO_VERIFICADO"; fuenteReferencia: string | null; precioReferencia: Prisma.Decimal | null; desviacionPct: Prisma.Decimal | null;
}

/** Posición ficticia de una certificación: especie, fecha de corte y precio de valoración. */
export interface ReferenciaFalsa { readonly instrumentoId: string; readonly fechaCorte: Date; readonly precioValoracion: string }

export interface EspecieFalsa {
  readonly id: string;
  readonly nemotecnico: string;
  readonly tipo?: "ACCION" | "FIC";
  readonly activo?: boolean;
  readonly conLotes?: boolean;
  /** Símbolo de Yahoo vigente registrado (simbolo_precio); sin él, `<NEMO>.CL`. */
  readonly simbolo?: string;
}

export interface OpcionesBaseFalsa {
  readonly previas?: readonly FilaFalsa[];
  readonly especies?: readonly EspecieFalsa[];
  readonly referencias?: readonly ReferenciaFalsa[];
  /** Filas de calendario_bvc (por defecto, una de 2024: ese año queda cubierto). */
  readonly calendario?: readonly { dia: Date; esHabil: boolean }[];
  /** Si se da, simbolo_precio lanza este error (la base falla al buscar el símbolo). */
  readonly errorSimbolo?: Error;
}

type FechaDonde = Date | { in: Date[] } | { gte: Date; lte: Date };
type Donde = { id?: string; instrumentoId?: string; fecha?: FechaDonde; fuente?: string; reemplazadoEn?: null; estado?: string };

const enFecha = (f: Date, w: FechaDonde): boolean => {
  if (w instanceof Date) return f.getTime() === w.getTime();
  if ("in" in w) return w.in.some((d) => d.getTime() === f.getTime());
  return f.getTime() >= w.gte.getTime() && f.getTime() <= w.lte.getTime();
};

const cumple = (w: Donde) => (f: FilaFalsa): boolean =>
  (w.id === undefined || f.id === w.id) && (w.instrumentoId === undefined || f.instrumentoId === w.instrumentoId) &&
  (w.fecha === undefined || enFecha(f.fecha, w.fecha)) && (w.fuente === undefined || f.fuente === w.fuente) &&
  (w.estado === undefined || f.estado === w.estado) && (!("reemplazadoEn" in w) || f.reemplazadoEn === null);

interface DondeInstrumento { tipo?: string; activo?: boolean; id?: { in: string[] }; nemotecnico?: { in?: string[]; not?: null }; lotes?: { some: object } }

const instrumentoCumple = (w: DondeInstrumento) => (e: EspecieFalsa): boolean =>
  (w.tipo === undefined || (e.tipo ?? "ACCION") === w.tipo) && (w.activo === undefined || (e.activo ?? true) === w.activo) &&
  (w.id === undefined || w.id.in.includes(e.id)) && (w.nemotecnico?.in === undefined || w.nemotecnico.in.includes(e.nemotecnico)) &&
  (w.lotes === undefined || (e.conLotes ?? true));

export function baseFalsa(o: OpcionesBaseFalsa = {}) {
  const filas: FilaFalsa[] = (o.previas ?? []).map((f) => ({ ...f }));
  const especies = o.especies ?? [];
  const llamadas = { calendario: 0, crear: 0, conteos: [] as Donde[], opcionesTx: [] as unknown[], simbolos: [] as { instrumentoId: string; vigenteDesde?: { lte: Date } }[] };
  const precioCierre = {
    findFirst: async ({ where }: { where: Donde }) => filas.find(cumple(where)) ?? null,
    findMany: async ({ where }: { where: Donde }) => filas.filter(cumple(where)),
    updateMany: async ({ where, data }: { where: Donde; data: { reemplazadoEn: Date } }) => {
      const blanco = filas.filter(cumple(where));
      for (const f of blanco) f.reemplazadoEn = data.reemplazadoEn;
      return { count: blanco.length };
    },
    create: async ({ data }: { data: Omit<FilaFalsa, "id" | "reemplazadoEn"> }) => {
      llamadas.crear += 1;
      const fila: FilaFalsa = { ...data, precio: new Prisma.Decimal(data.precio), id: `p${filas.length + 1}`, reemplazadoEn: null };
      filas.push(fila);
      return fila;
    },
    count: async ({ where }: { where: Donde }) => {
      llamadas.conteos.push(where);
      return filas.filter(cumple(where)).length;
    },
  };
  const db = {
    instrumento: {
      findMany: async ({ where }: { where: DondeInstrumento }) => especies.filter(instrumentoCumple(where)).map((e) => ({ id: e.id, nemotecnico: e.nemotecnico })),
    },
    calendarioBvc: {
      findMany: async () => {
        llamadas.calendario += 1;
        return o.calendario ?? [{ dia: new Date("2024-01-01T00:00:00Z"), esHabil: false }];
      },
    },
    simboloPrecio: {
      findFirst: async ({ where }: { where: { instrumentoId: string; vigenteDesde?: { lte: Date } } }) => {
        llamadas.simbolos.push(where);
        if (o.errorSimbolo) throw o.errorSimbolo;
        const simbolo = especies.find((e) => e.id === where.instrumentoId)?.simbolo;
        return simbolo ? { simbolo } : null;
      },
    },
    certificacionPosicion: {
      findFirst: async ({ where }: { where: { instrumentoId: string; certificacion: { fechaCorte: Date } } }) => {
        const ref = (o.referencias ?? []).find((r) => r.instrumentoId === where.instrumentoId && r.fechaCorte.getTime() === where.certificacion.fechaCorte.getTime());
        return ref ? { precioValoracion: new Prisma.Decimal(ref.precioValoracion), certificacion: { fechaCorte: ref.fechaCorte } } : null;
      },
    },
    precioCierre,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>, opciones?: unknown) => {
      llamadas.opcionesTx.push(opciones);
      return fn(db);
    },
  };
  return { db: db as unknown as PrismaClient, filas, llamadas };
}

const SIN_VERIFICAR = { estado: "NO_VERIFICADO" as const, fuenteReferencia: null, precioReferencia: null, desviacionPct: null };

/** Un cierre vigente (o reemplazado) de Yahoo, sin verificar, de una especie ficticia. */
export const filaFalsa = (id: string, instrumentoId: string, fechaIso: string, precio: string): FilaFalsa => ({
  id, instrumentoId, fecha: new Date(`${fechaIso}T00:00:00Z`), precio: new Prisma.Decimal(precio), fuente: "yahoo", reemplazadoEn: null, ...SIN_VERIFICAR,
});

/** Lo comparable de las filas (sin ids ni instantes): fecha, precio, fuente, si sigue vigente y su verificación. */
export const resumenFilas = (filas: readonly FilaFalsa[]) =>
  filas.map((f) => [f.instrumentoId, f.fecha.toISOString().slice(0, 10), f.precio.toString(), f.fuente, f.reemplazadoEn === null, f.estado, f.fuenteReferencia, f.precioReferencia?.toString() ?? null, f.desviacionPct?.toString() ?? null]);
