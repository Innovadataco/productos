/**
 * `precios:exportar` (vía B del runbook): en el Mac del dueño, que sí tiene red, pide a Yahoo los cierres diarios de
 * los nemotécnicos de su lista y arma el CSV de cierres públicos que `precios:importar` carga en producción (que no
 * tiene red). Sin base de datos: el símbolo es siempre `<NEMO>.CL` (el importador se niega si la especie tiene
 * otro símbolo de Yahoo registrado, SIMBOLO_DISTINTO).
 * - Pide en serie, con una pausa entre pedidos (uso personal y moderado del endpoint no oficial de Yahoo).
 * - Nunca deja en el CSV una barra que aún no es definitiva AL EXPORTAR (la de hoy antes de la hora, un fin de
 *   semana de hoy o una fecha futura): importada más tarde pasaría como el cierre de su día. Festivos y días sin
 *   negociación los decide el importador con calendario_bvc, igual que con Yahoo directo.
 * - Las barras fuera de [desde, hasta] se descartan (Yahoo puede traer el día siguiente).
 * - Una especie con fallo de Yahoo, o con un volumen que no cabe en el CSV, queda fuera entera y se informa por su
 *   línea de la lista: el CSV de las demás sale igual (código 3 en el CLI).
 * El CSV se entrega entero al final (`escribirCompleto`): nunca uno a medias por un error de la mitad.
 */
import { escribirCsvCierres, volumenExportable, type ResultadoEscritura } from "./csv-cierres";
import { barraDefinitiva } from "./horario";
import type { NemoDeLista } from "./lista-nemos";
import { obtenerCierres, type Buscar, type Cierre } from "./yahoo";

export const PAUSA_ENTRE_PEDIDOS_MS = 250;
/** Sin calendario en el Mac: solo el fin de semana y la hora deciden si la barra de hoy ya es definitiva. */
const SIN_FESTIVOS: ReadonlySet<string> = new Set();

export interface OpcionesExportacion {
  readonly lista: readonly NemoDeLista[];
  readonly desde: Date;
  readonly hasta: Date;
  readonly ahora: Date;
  readonly buscar: Buscar;
  readonly esperar?: (ms: number) => Promise<void>;
}

export interface FalloExportacion {
  readonly linea: number;
  readonly codigo: string;
}

export interface ResultadoExportacion {
  readonly csv: string | null;
  readonly especies: number;
  readonly conCierres: number;
  readonly filas: number;
  readonly descartadas: number;
  readonly fallidas: readonly FalloExportacion[];
  readonly codigoCsv: Extract<ResultadoEscritura, { ok: false }>["codigo"] | null;
}

const dormir = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

type Especie = { readonly ok: true; readonly cierres: readonly Cierre[]; readonly descartadas: number } | { readonly ok: false; readonly codigo: string };

/** Los cierres exportables de una especie, o el código por el que queda fuera. */
async function especie(nemotecnico: string, o: OpcionesExportacion): Promise<Especie> {
  const r = await obtenerCierres(`${nemotecnico}.CL`, o.desde, o.hasta, o.buscar);
  if (!r.ok) return r;
  if (!r.cierres.every((c) => volumenExportable(c.volumen))) return { ok: false, codigo: "VOLUMEN_NO_ENTERO" };
  const enRango = (c: Cierre) => c.fecha >= o.desde && c.fecha <= o.hasta && barraDefinitiva(c.fecha, o.ahora, SIN_FESTIVOS);
  const cierres = r.cierres.filter(enRango);
  return { ok: true, cierres, descartadas: r.cierres.length - cierres.length };
}

export async function exportarPrecios(o: OpcionesExportacion): Promise<ResultadoExportacion> {
  const esperar = o.esperar ?? dormir;
  const especies: { nemotecnico: string; cierres: readonly Cierre[] }[] = [];
  const fallidas: FalloExportacion[] = [];
  let descartadas = 0;
  for (const [i, { nemotecnico, linea }] of o.lista.entries()) {
    if (i > 0) await esperar(PAUSA_ENTRE_PEDIDOS_MS);
    const r = await especie(nemotecnico, o);
    if (!r.ok) {
      fallidas.push({ linea, codigo: r.codigo });
      continue;
    }
    descartadas += r.descartadas;
    if (r.cierres.length > 0) especies.push({ nemotecnico, cierres: r.cierres });
  }
  const escrito = escribirCsvCierres(especies);
  const filas = especies.reduce((n, e) => n + e.cierres.length, 0);
  return {
    csv: escrito.ok ? escrito.texto : null, especies: o.lista.length, conCierres: especies.length, filas, descartadas, fallidas, codigoCsv: escrito.ok ? null : escrito.codigo,
  };
}

/** Escribe todo el texto y resuelve cuando la salida lo aceptó; rechaza si falla (EPIPE: el lector cerró el tubo). */
export function escribirCompleto(salida: NodeJS.WritableStream, texto: string): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const alFallar = (e: Error) => rechazar(e);
    salida.once("error", alFallar);
    salida.write(texto, (e) => {
      salida.removeListener("error", alFallar);
      if (e) rechazar(e);
      else resolver();
    });
  });
}
