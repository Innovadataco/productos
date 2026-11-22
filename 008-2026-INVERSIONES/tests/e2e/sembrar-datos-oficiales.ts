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
 * Y los dividendos decretados (frente datos-oficiales-decretos-pantalla, C6b), por el camino único (importarDecretos, con
 * el dueño del e2e), en dos especies nuevas SIN órdenes ni pagos (FICTD y FICTE, creadas aquí) y en FICTI (la incompleta:
 * su tenencia sale negativa). Fechas relativas a hoy (DECRETOS_E2E):
 *   - próximos: FICTD (referencia https de la BVC: enlace), FICTE (radicado de la SFC: texto) y FICTI (no se estima);
 *   - cruce: FICTI con ex pasada → REVISAR por la tenencia negativa; FICTE, un grupo con una ex pasada y otra por venir
 *     (las cargas de Trii, de hoy, no cubren la segunda) → PENDIENTE; FICTD con ex pasada y sin acciones → no esperaba
 *     pago (se cuenta aparte).
 * Sin órdenes ni pagos nuevos: el tablero, la conciliación y el plan no cambian, y las proyecciones solo leen los
 * decretos de las especies vivas (FICTI es incompleta). No toca nada de lo que miran las demás pantallas.
 */
import type { PrismaClient } from "@prisma/client";
import { serieDelCatalogo } from "../../src/datos-oficiales/catalogo";
import { ENCABEZADO_DECRETOS } from "../../src/datos-oficiales/decretos/csv";
import { importarDecretos } from "../../src/datos-oficiales/decretos/importar";
import { canonizarValor, leerCsvSeries } from "../../src/datos-oficiales/series/csv-series";
import { importarSeries } from "../../src/datos-oficiales/series/importar";
import { sumarDias } from "../../src/plan/fechas";
import { DUENO_E2E, hoyDelE2E } from "./base";

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

/** Los decretos del e2e: especie, tipo, cuota, valor, días desde hoy (anuncio, ex, pago) y referencia. */
export const DECRETOS_E2E = [
  { especie: "FICTD", tipo: "ORDINARIO", cuota: 2, valor: "37.91", anuncio: -20, ex: 12, pago: 19, referencia: "https://www.bvc.com.co/ficticio/e2e-c6b-fictd-2" },
  { especie: "FICTD", tipo: "ORDINARIO", cuota: 1, valor: "41.37", anuncio: -60, ex: -40, pago: -33, referencia: "https://www.superfinanciera.gov.co/ficticio/e2e-c6b-fictd-1" },
  { especie: "FICTE", tipo: "ORDINARIO", cuota: 1, valor: "13.71", anuncio: -20, ex: -2, pago: 5, referencia: "sfc:FICTICIO-E2E-4613" },
  { especie: "FICTE", tipo: "EXTRAORDINARIO", cuota: 1, valor: "23.17", anuncio: -20, ex: 2, pago: 5, referencia: "sfc:FICTICIO-E2E-4617" },
  { especie: "FICTI", tipo: "ORDINARIO", cuota: 1, valor: "17.43", anuncio: -50, ex: -30, pago: -23, referencia: "https://www.bvc.com.co/ficticio/e2e-c6b-ficti-1" },
  { especie: "FICTI", tipo: "ORDINARIO", cuota: 2, valor: "19.37", anuncio: -10, ex: 20, pago: 27, referencia: "https://www.bvc.com.co/ficticio/e2e-c6b-ficti-2" },
] as const;

async function sembrarDecretos(db: PrismaClient, hoy: Date): Promise<void> {
  for (const nemotecnico of ["FICTD", "FICTE"]) {
    await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico, nombre: `Especie ficticia ${nemotecnico} (decretos del e2e)` } });
  }
  const filas = DECRETOS_E2E.map((d) =>
    [d.especie, d.tipo, iso(sumarDias(hoy, d.anuncio)), String(d.cuota), d.valor, "COP", "DINERO", iso(sumarDias(hoy, d.ex)), iso(sumarDias(hoy, d.pago)), d.referencia, "", ""].join(","));
  const contenido = new TextEncoder().encode(`${ENCABEZADO_DECRETOS.join(",")}\n${filas.join("\n")}\n`);
  // El reloj de la siembra es el «hoy» de la corrida (al mediodía de Colombia): ningún anuncio queda en el futuro.
  const r = await importarDecretos(db, { contenido, email: DUENO_E2E.email, aplicar: true }, { ahora: new Date(hoy.getTime() + 17 * 3_600_000) });
  if (r.estado !== "APLICADO") throw new Error(`Los decretos del E2E no se registraron: ${r.estado === "RECHAZADO" ? r.hallazgos.map((h) => `${h.linea}:${h.codigo}`).join(", ") : r.estado}`);
}

export async function sembrarDatosOficiales(db: PrismaClient): Promise<void> {
  const hoy = hoyDelE2E();
  const csv = ["serie,desde,hasta,valor,fuente", ...trm(hoy), ...tpm(hoy), ...ibr(hoy), ...ipc(hoy)].join("\n") + "\n";
  const lectura = leerCsvSeries(Buffer.from(csv, "ascii"), hoy);
  if (!lectura.ok) throw new Error(`El CSV de series del E2E no pasó: ${lectura.errores.map((e) => `${e.linea}:${e.codigo}`).join(", ")}`);
  const r = await importarSeries(db, lectura);
  const fallas = r.series.filter((s) => s.fallo !== null).map((s) => s.codigo);
  if (fallas.length > 0) throw new Error(`No se guardaron las series del E2E: ${fallas.join(", ")}`);
  await sembrarDecretos(db, hoy);
}
