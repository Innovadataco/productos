/**
 * `fondo:exportar` (vía B del runbook): en el Mac del dueño, que sí tiene red, pide a la SFC (datos.gov.co,
 * qhpu-8ixx) los valores de unidad de los fondos de su lista y arma el CSV que `importar-valores-fondo` carga en
 * producción (que no tiene red). Sin base de datos.
 * - Usa `obtenerValores` (el mismo de `actualizar-fondo`): sin redirecciones, con plazo y tope de bytes; una respuesta
 *   rara se rechaza entera; un valor de unidad inválido de la clase propia se descarta y se cuenta.
 * - Pide en serie, con una pausa entre pedidos (uso moderado del servicio público).
 * - Un fondo con fallo de la SFC queda fuera entero y se informa por su línea de la lista: el CSV de los demás sale
 *   igual (código 3 en el CLI). Uno sin valores en el rango no es error (la SFC publica con T−2).
 * El CSV se entrega entero al final: nunca uno a medias por un error de la mitad.
 */
import { escribirCsvValoresFondo, type EscrituraCsvFondo } from "./csv-valores";
import type { FondoDeLista } from "./lista-fondos";
import { obtenerValores, type BuscarSfc, type ValorDia } from "./sfc";
import { fechaEnBogota } from "../precios/horario";

export const PAUSA_ENTRE_PEDIDOS_FONDO_MS = 250;

export interface OpcionesExportacionFondo {
  readonly lista: readonly FondoDeLista[];
  readonly desde: Date;
  readonly hasta: Date;
  readonly ahora: Date;
  readonly buscar: BuscarSfc;
  readonly esperar?: (ms: number) => Promise<void>;
}

export interface FalloExportacionFondo {
  readonly linea: number;
  readonly codigo: string;
}

/** Lo que trajo cada fondo de la lista que no falló, por su línea (sin nombrarlo). */
export interface ValoresDeLinea {
  readonly linea: number;
  readonly valores: number;
  readonly ultimaFecha: Date | null;
  readonly descartados: number;
}

export interface ResultadoExportacionFondo {
  readonly csv: string | null;
  readonly fondos: number;
  readonly conValores: number;
  readonly filas: number;
  readonly descartados: number;
  readonly porLinea: readonly ValoresDeLinea[];
  readonly fallidos: readonly FalloExportacionFondo[];
  readonly codigoCsv: Extract<EscrituraCsvFondo, { ok: false }>["codigo"] | null;
}

const dormir = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

export async function exportarValoresFondo(o: OpcionesExportacionFondo): Promise<ResultadoExportacionFondo> {
  const esperar = o.esperar ?? dormir;
  const fondos: { codigoFic: string; participacion: string | null; valores: readonly ValorDia[] }[] = [];
  const porLinea: ValoresDeLinea[] = [];
  const fallidos: FalloExportacionFondo[] = [];
  for (const [i, f] of o.lista.entries()) {
    if (i > 0) await esperar(PAUSA_ENTRE_PEDIDOS_FONDO_MS);
    const r = await obtenerValores({ codigo: f.codigo, participacion: f.participacion, desde: o.desde, hasta: o.hasta }, o.buscar);
    if (!r.ok) {
      fallidos.push({ linea: f.linea, codigo: r.codigo });
      continue;
    }
    porLinea.push({ linea: f.linea, valores: r.valores.length, ultimaFecha: r.valores.at(-1)?.fecha ?? null, descartados: r.descartados });
    if (r.valores.length > 0) fondos.push({ codigoFic: f.codigo, participacion: f.participacion, valores: r.valores });
  }
  const escrito = escribirCsvValoresFondo(fondos, fechaEnBogota(o.ahora));
  return {
    csv: escrito.ok ? escrito.texto : null,
    fondos: o.lista.length,
    conValores: fondos.length,
    filas: fondos.reduce((n, f) => n + f.valores.length, 0),
    descartados: porLinea.reduce((n, l) => n + l.descartados, 0),
    porLinea,
    fallidos,
    codigoCsv: escrito.ok ? null : escrito.codigo,
  };
}
