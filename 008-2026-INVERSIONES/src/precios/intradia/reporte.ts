/**
 * Lo que imprime el CLI de los precios intradía y su código de salida. Solo conteos, códigos y el id interno de la especie
 * fallida: nunca nemotécnicos, precios ni cantidades del portafolio. Salida: 0 bien · 3 alguna especie falló · 4 día no
 * hábil · 5 tope diario de peticiones · 6 sin barras sin calendario · 7 bloqueo de Yahoo · 8 fallo de datos, los de `ciclo.ts`.
 */
import type { ResultadoCicloIntradia } from "./ciclo";

export interface Reporte {
  readonly lineas: string[];
  readonly codigoSalida: number;
}

export function reporteCiclo(r: ResultadoCicloIntradia): Reporte {
  if (r.codigo === 4 && r.peticiones === 0) return { lineas: ["Intradía: hoy no hay rueda en la BVC (fin de semana o festivo): no se pide nada a Yahoo."], codigoSalida: 4 };
  const lineas = [`Intradía: ${r.especies} especies, ${r.peticiones} peticiones, ${r.barrasNuevas} barras nuevas.`];
  if (r.sinCalendario) lineas.push("Aviso: calendario_bvc no cubre este año: se trató el día entre semana como hábil.");
  for (const aviso of r.avisos) lineas.push(`Aviso: ${aviso}.`);
  for (const f of r.fallidas) lineas.push(`Falló la especie ${f.instrumentoId}: ${f.codigo}.`);
  if (r.codigo === 7) lineas.push("Bloqueo (429/403/red): el ciclo se detuvo y el servicio espera más antes del siguiente.");
  if (r.codigo === 8) lineas.push("Fallo de datos: todas las peticiones fallaron sin ser un bloqueo (símbolo o respuesta); el servicio espera más, sin contarlo como bloqueo.");
  if (r.codigo === 6) lineas.push("Sin barras de hoy y sin calendario del año: posible día no hábil; el servicio lo confirma con otro ciclo.");
  if (r.codigo === 5) lineas.push("Tope diario de peticiones alcanzado: no se pide más hoy.");
  return { lineas, codigoSalida: r.codigo };
}

export function reporteDepuracion(borradas: number): Reporte {
  return { lineas: [`Intradía: ${borradas} barras depuradas (de más de la retención).`], codigoSalida: 0 };
}
