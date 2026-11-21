// Ayudas de las pruebas del tablero: entradas y resúmenes inventados (nemotécnicos FICT*). No es una prueba.
import { Prisma } from "@prisma/client";
import { calcularTablero, type EntradaEspecie } from "@/tablero/calculo";
import type { Resumen } from "@/tablero/datos";
import { calcularMovimiento } from "@/tablero/movimiento";

export const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
/** Columna DATE: medianoche UTC del día. */
export const dia = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
export const punto = (iso: string, precio: number) => ({ fecha: dia(iso), precio: D(precio) });

export const especie = (o: Partial<EntradaEspecie> & { nemotecnico: string }): EntradaEspecie => ({
  instrumentoId: o.nemotecnico, cantidad: 0n, costoVivo: D(0), cierre: null, realizada: D(0), dividendos: D(0), comisiones: D(0), lotesVivos: 1, serie: [], ...o,
});

interface OpcionesResumen {
  readonly incompletas?: readonly string[];
  readonly ultimaCarga?: Date | null;
  /** Días no hábiles del calendario de la BVC (AAAA-MM-DD); por defecto, ninguno. */
  readonly noHabiles?: ReadonlySet<string>;
  /** Años sembrados en el calendario; por defecto, 2022-2027 (como las migraciones). */
  readonly anios?: readonly number[];
}

/** El resumen que arma datos.ts, con las entradas ya leídas. */
export function resumenDe(entradas: readonly EntradaEspecie[], o: OpcionesResumen = {}): Resumen {
  const tablero = calcularTablero(entradas);
  return {
    tablero,
    movimiento: calcularMovimiento(tablero.filas, tablero.fechaReferencia, {
      noHabiles: o.noHabiles ?? new Set(), anios: new Set(o.anios ?? [2022, 2023, 2024, 2025, 2026, 2027]),
    }),
    ultimaCarga: o.ultimaCarga === undefined ? new Date("2026-11-20T15:00:00Z") : o.ultimaCarga,
    incompletas: o.incompletas ?? [],
  };
}
