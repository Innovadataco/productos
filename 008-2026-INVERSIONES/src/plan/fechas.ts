/** Fechas de negocio del plan: `Date` a medianoche UTC, como las columnas `@db.Date` de Prisma. */
export const MS_POR_DIA = 86_400_000;

export function esFechaDeNegocio(valor: unknown): valor is Date {
  return valor instanceof Date && !Number.isNaN(valor.getTime()) && valor.getTime() % MS_POR_DIA === 0;
}

/** Días calendario (UTC no tiene horario de verano, así que la suma es exacta). */
export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_POR_DIA);
}
