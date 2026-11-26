/**
 * El calendario de la BVC que siembra el E2E (frente fuente-retraso). Los cierres sembrados son de 2024 y el E2E espera el
 * aviso exacto «dato de hace N días hábiles»; si el calendario no cubriera el año del reloj, el aviso sería el
 * aproximado. Por eso la siembra completa el calendario hasta el año del reloj más uno (el año de Colombia). Solo agrega
 * festivos fijos (1-ene y 25-dic): basta para que el año cuente como cubierto. Datos inventados; sin red ni base aquí.
 */
const ANIOS_ADELANTE = 1;
const ANIO_BOGOTA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" });

export interface FilaDeCalendario { readonly dia: Date; readonly esHabil: false; readonly nota: string }

const anioDeColombia = (ahora: Date): number => Number(ANIO_BOGOTA.format(ahora));

/** Los años del reloj y el siguiente que `aniosCubiertos` (los de la base) no trae, en orden. */
export function aniosPorSembrar(aniosCubiertos: ReadonlySet<number>, ahora: Date): number[] {
  const desde = anioDeColombia(ahora);
  return Array.from({ length: ANIOS_ADELANTE + 1 }, (_, k) => desde + k).filter((a) => !aniosCubiertos.has(a));
}

/** Las filas que faltan para que el calendario cubra el año del reloj y el siguiente. */
export function filasDeCalendarioFaltantes(aniosCubiertos: ReadonlySet<number>, ahora: Date): FilaDeCalendario[] {
  return aniosPorSembrar(aniosCubiertos, ahora).flatMap((a) => [
    { dia: new Date(Date.UTC(a, 0, 1)), esHabil: false as const, nota: "Año Nuevo (siembra del E2E)" },
    { dia: new Date(Date.UTC(a, 11, 25)), esHabil: false as const, nota: "Navidad (siembra del E2E)" },
  ]);
}
