/**
 * Siembra de /datos-oficiales para el E2E (frente datos-oficiales-pantalla, C6a). La llama tests/e2e/sembrar.ts al final.
 * Por el camino de la vía B: un CSV canónico armado aquí, leído con las reglas del catálogo (leerCsvSeries: fuente,
 * escala, rango, forma de la vigencia, adelanto y mes terminado) y guardado por el camino único (importarSeries). Las
 * fechas son RELATIVAS al «hoy» de la corrida (hoyDelE2E): en el código no hay ninguna fecha fija. Cifras inventadas:
 *   - TRM: un valor por día hasta hoy − 2 y el último, un tramo de hoy − 1 a hoy + 1 (aguanta una corrida que cruza la
 *     medianoche): al día y «vale hoy»;
 *   - TPM: un valor por día hasta ayer: al día, pero no es la cifra de hoy;
 *   - IBR 3M: de lunes a viernes, y el último hace 10 días: atrasada (el umbral es 7);
 *   - IPC: 26 meses hasta el mes anterior: al día, con la variación en 12 meses calculada (ESPERADO).
 * No toca nada de lo que miran las demás pantallas (solo valor_serie_oficial).
 */
import type { PrismaClient } from "@prisma/client";
import { serieDelCatalogo } from "../../src/datos-oficiales/catalogo";
import { canonizarValor, leerCsvSeries } from "../../src/datos-oficiales/series/csv-series";
import { importarSeries } from "../../src/datos-oficiales/series/importar";
import { sumarDias } from "../../src/plan/fechas";
import { hoyDelE2E } from "./base";

/** Lo que la pantalla debe mostrar, ya con su formato. */
export const ESPERADO = {
  trm: "3.931,29",
  tpm: "4,37",
  ibr: "3,917",
  ipc: "152,12",
  variacionIpc: "+3,51",
  diasIbr: 10,
} as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Una fila del CSV; el valor, en su forma canónica (sin ceros sobrantes: «4.30» va como «4.3»). */
const linea = (codigo: string, desde: Date, hasta: Date, valor: string) => `${codigo},${iso(desde)},${iso(hasta)},${canonizarValor(valor) ?? valor},${serieDelCatalogo(codigo)!.fuente}`;

function trm(hoy: Date): string[] {
  const dias = Array.from({ length: 41 }, (_, k) => sumarDias(hoy, -(42 - k)));
  return [
    ...dias.map((d, k) => linea("TRM", d, d, (3907.13 + ((k * 37) % 23) * 0.61).toFixed(2))),
    linea("TRM", sumarDias(hoy, -1), sumarDias(hoy, 1), "3931.29"),
  ];
}

function tpm(hoy: Date): string[] {
  const dias = Array.from({ length: 89 }, (_, k) => sumarDias(hoy, -(90 - k)));
  return [...dias.map((d, k) => linea("TPM", d, d, (4.13 + (k % 7) * 0.04).toFixed(2))), linea("TPM", sumarDias(hoy, -1), sumarDias(hoy, -1), "4.37")];
}

function ibr(hoy: Date): string[] {
  const ultimo = sumarDias(hoy, -ESPERADO.diasIbr);
  const dias = Array.from({ length: 110 }, (_, k) => sumarDias(ultimo, -(110 - k))).filter((d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6);
  return [...dias.map((d, k) => linea("IBR_3M_EA", d, d, (3.887 + (k % 11) * 0.007).toFixed(3))), linea("IBR_3M_EA", ultimo, ultimo, "3.917")];
}

/** j = meses antes del mes anterior a hoy (0 = el mes anterior). El de hace 12 es la base de la variación. */
function ipc(hoy: Date): string[] {
  return Array.from({ length: 26 }, (_, k) => 25 - k).map((j) => {
    const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1 - j, 1));
    const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - j, 0));
    return linea("IPC_INDICE", desde, hasta, (141.37 + (25 - j) * 0.43).toFixed(2));
  });
}

export async function sembrarDatosOficiales(db: PrismaClient): Promise<void> {
  const hoy = hoyDelE2E();
  const csv = ["serie,desde,hasta,valor,fuente", ...trm(hoy), ...tpm(hoy), ...ibr(hoy), ...ipc(hoy)].join("\n") + "\n";
  const lectura = leerCsvSeries(Buffer.from(csv, "ascii"), hoy);
  if (!lectura.ok) throw new Error(`El CSV de series del E2E no pasó: ${lectura.errores.map((e) => `${e.linea}:${e.codigo}`).join(", ")}`);
  const r = await importarSeries(db, lectura);
  const fallas = r.series.filter((s) => s.fallo !== null).map((s) => s.codigo);
  if (fallas.length > 0) throw new Error(`No se guardaron las series del E2E: ${fallas.join(", ")}`);
}
