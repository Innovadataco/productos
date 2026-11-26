/**
 * Lo que imprime el CLI de los precios intradía y su código de salida. Solo conteos, códigos y el id interno de la especie
 * fallida: nunca nemotécnicos, precios ni cantidades del portafolio. Salida: 0 bien · 3 alguna especie falló · 4 día no
 * hábil · 7 Yahoo limitó (429), los de `ciclo.ts`.
 */
import type { ResultadoCicloIntradia } from "./ciclo";

export interface Reporte {
  readonly lineas: string[];
  readonly codigoSalida: number;
}

export function reporteCiclo(r: ResultadoCicloIntradia): Reporte {
  if (r.codigo === 4) return { lineas: ["Intradía: hoy no hay rueda en la BVC (fin de semana o festivo): no se pide nada a Yahoo."], codigoSalida: 4 };
  const lineas = [`Intradía: ${r.especies} especies, ${r.peticiones} peticiones, ${r.barrasNuevas} barras nuevas.`];
  if (r.sinCalendario) lineas.push("Aviso: calendario_bvc no cubre este año: se trató el día entre semana como hábil.");
  for (const f of r.fallidas) lineas.push(`Falló la especie ${f.instrumentoId}: ${f.codigo}.`);
  if (r.codigo === 7) lineas.push("Yahoo limitó las peticiones (429): el ciclo se detuvo y el servicio espera más antes del siguiente.");
  return { lineas, codigoSalida: r.codigo };
}

export function reporteDepuracion(borradas: number): Reporte {
  return { lineas: [`Intradía: ${borradas} barras depuradas (de más de la retención).`], codigoSalida: 0 };
}
