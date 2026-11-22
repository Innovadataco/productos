/**
 * Exportar una serie de BanRep al CSV canónico de series (fase C, C2c; vía B): en el Mac del dueño, por la red
 * (pedirSdmxBanrep) o desde el --archivo que él bajó en su navegador, con el MISMO lector (leerSdmxBanrep). Sin base de
 * datos. El CSV lo arma escribirCsvSeries, que lo vuelve a leer: nunca sale uno que importar-series rechazaría.
 * Además de los descartes del lector, avisa lo que perdería datos sin decirlo:
 * - INICIO_TARDIO: el primer valor llega más de `umbralFrescuraDias` (catálogo) después de --desde (un --archivo bajado
 *   con un startPeriod posterior, o BanRep que no tiene esos días).
 * - ATRASADA: el último valor queda más de `umbralFrescuraDias` antes de --hasta (BanRep no ha publicado).
 * - Días faltantes entre el primero y el último, solo en una serie diaria de calendario (la TPM); la IBR es de días
 *   hábiles y sus huecos no se pueden juzgar sin el calendario bancario. Días sueltos son lo que BanRep publicó (en la
 *   descarga pública de la TPM de 2026 falta uno): se informan. Un hueco de más de `umbralFrescuraDias` días seguidos
 *   hace pensar en una descarga incompleta: se avisa.
 * El CSV se entrega entero al final (el script lo escribe con escribirCompleto): nunca uno a medias.
 */
import type { BuscarHttp } from "../../lib/http-acotado";
import { escribirCsvSeries, type EscrituraCsvSeries, type ValorSerie } from "../series/csv-series";
import { pedirSdmxBanrep } from "./banrep-pedido";
import { leerSdmxBanrep, type ConteosBanrep } from "./banrep-sdmx";
import { urlBanrep, type FalloBanrep, type SerieBanrep } from "./banrep-series";

const DIA_MS = 86_400_000;

export type OrigenBanrep = { readonly tipo: "RED"; readonly buscar: BuscarHttp } | { readonly tipo: "ARCHIVO"; readonly bytes: Uint8Array };

export interface OpcionesExportarBanrep {
  readonly serie: SerieBanrep;
  readonly desde: Date;
  readonly hasta: Date;
  /** La fecha de negocio en Colombia: el tope del adelanto del CSV. */
  readonly hoy: Date;
  readonly origen: OrigenBanrep;
}

export interface ResultadoExportarBanrep {
  readonly serie: string;
  readonly origen: OrigenBanrep["tipo"];
  /** La URL pública de la descarga: la que el dueño abre en su navegador si BanRep bloquea. */
  readonly url: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly umbralFrescuraDias: number;
  readonly csv: string | null;
  readonly filas: number;
  readonly fallo: FalloBanrep | null;
  readonly conteos: ConteosBanrep | null;
  readonly primerDia: Date | null;
  readonly ultimoDia: Date | null;
  readonly diasFaltantes: number;
  /** El hueco más largo (días seguidos sin valor) entre el primero y el último; 0 si no aplica. */
  readonly huecoMayor: number;
  readonly inicioTardio: boolean;
  readonly atrasada: boolean;
  readonly codigoCsv: Extract<EscrituraCsvSeries, { ok: false }>["codigo"] | null;
}

async function bytesDe(o: OpcionesExportarBanrep): Promise<{ readonly ok: true; readonly bytes: Uint8Array } | FalloBanrep> {
  return o.origen.tipo === "ARCHIVO" ? { ok: true, bytes: o.origen.bytes } : pedirSdmxBanrep(o.serie, o.desde, o.origen.buscar);
}

const diasEntre = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DIA_MS);

/** Los días que faltan entre el primero y el último y el hueco más largo, en una serie diaria de calendario. */
function huecos(valores: readonly ValorSerie[]): { readonly diasFaltantes: number; readonly huecoMayor: number } {
  let [diasFaltantes, huecoMayor] = [0, 0];
  for (let i = 1; i < valores.length; i += 1) {
    const hueco = diasEntre(valores[i - 1]!.hasta, valores[i]!.desde) - 1;
    diasFaltantes += hueco;
    huecoMayor = Math.max(huecoMayor, hueco);
  }
  return { diasFaltantes, huecoMayor };
}

export async function exportarBanrep(o: OpcionesExportarBanrep): Promise<ResultadoExportarBanrep> {
  const base = {
    serie: o.serie.codigo, origen: o.origen.tipo, url: urlBanrep(o.serie, o.desde), desde: o.desde, hasta: o.hasta, umbralFrescuraDias: o.serie.catalogo.umbralFrescuraDias,
  };
  const vacio = { csv: null, filas: 0, conteos: null, primerDia: null, ultimoDia: null, diasFaltantes: 0, huecoMayor: 0, inicioTardio: false, atrasada: false, codigoCsv: null };
  const bytes = await bytesDe(o);
  if (!bytes.ok) return { ...base, ...vacio, fallo: bytes };
  const leido = leerSdmxBanrep(bytes.bytes, o.serie, o.desde, o.hasta);
  if (!leido.ok) return { ...base, ...vacio, fallo: leido };
  const [primero, ultimo] = [leido.valores[0]?.desde ?? null, leido.valores.at(-1)?.hasta ?? null];
  const deCalendario = o.serie.catalogo.cadencia === "DIARIA_CALENDARIO";
  const umbral = o.serie.catalogo.umbralFrescuraDias;
  const cobertura = {
    primerDia: primero,
    ultimoDia: ultimo,
    ...(deCalendario ? huecos(leido.valores) : { diasFaltantes: 0, huecoMayor: 0 }),
    inicioTardio: primero !== null && diasEntre(o.desde, primero) > umbral,
    atrasada: ultimo !== null && diasEntre(ultimo, o.hasta) > umbral,
  };
  const escrito = escribirCsvSeries([{ codigo: o.serie.codigo, valores: leido.valores }], o.hoy);
  return {
    ...base, ...cobertura, fallo: null, conteos: leido.conteos,
    csv: escrito.ok ? escrito.texto : null, filas: escrito.ok ? escrito.filas : 0, codigoCsv: escrito.ok ? null : escrito.codigo,
  };
}
