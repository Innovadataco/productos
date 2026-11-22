/**
 * De la lectura de /datos-oficiales (Date, CifraOficial; src/app/datos-oficiales/datos.ts) a la vista de la pantalla
 * (texto) (frente datos-oficiales-pantalla, C6a). Cálculo puro: solo importa tipos.
 * - Las columnas DATE son el día UTC; la hora de la carga va en Colombia (UTC−5 fijo: Colombia no tiene horario de
 *   verano), como en la conciliación.
 * - «vale hoy» (valeHoy) es cubreHoy de la lectura: nada más lo enciende.
 * - Sin datos o con error, la vista lleva solo lo del catálogo: ninguna cifra. Una frescura incoherente con un último
 *   (frescura.ts no la da) también sale ERROR: no se inventa un número de días.
 */
import type { SerieCatalogo } from "@/datos-oficiales/catalogo";
import type { CifraOficial } from "@/datos-oficiales/series/consulta";
import type { Frescura } from "@/datos-oficiales/series/frescura";
import type { DiaIso, PuntoVista, SerieBase, SerieVista, VariacionVista, Ventana, VistaDatosOficiales } from "./tipos";

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;

/** La variación de una serie índice, como la dejó la lectura. */
export type LecturaVariacion =
  | { readonly estado: "CALCULADA"; readonly cifra: CifraOficial; readonly mesBase: Date; readonly mesFinal: Date }
  | { readonly estado: "SIN_BASE"; readonly mesBase: Date }
  | { readonly estado: "NO_SE_PUDO" };

interface LecturaComun {
  readonly serie: SerieCatalogo;
  readonly ventana: Ventana;
}

/** Lo que leyó datos.ts de una serie, con un mismo hoy y en la misma transacción. */
export type LecturaSerie =
  | (LecturaComun & {
    readonly estado: "CON_DATOS";
    readonly ultimo: CifraOficial;
    readonly frescura: Frescura;
    readonly historia: readonly CifraOficial[];
    readonly variacion: LecturaVariacion | null;
  })
  | (LecturaComun & { readonly estado: "SIN_DATOS" | "ERROR" });

/** El día de una columna DATE (UTC). */
export const dia = (d: Date): DiaIso => d.toISOString().slice(0, 10);

/** El instante en Colombia: «AAAA-MM-DD HH:MM». */
export const horaColombia = (d: Date): string => new Date(d.getTime() - DESFASE_COLOMBIA_MS).toISOString().slice(0, 16).replace("T", " ");

function base(s: SerieCatalogo, ventana: Ventana): SerieBase {
  return {
    codigo: s.codigo, nombre: s.nombre, unidad: s.unidad, origen: s.origen, fuente: s.fuente, escala: s.escala,
    vigencia: s.vigencia.tipo, entrada: s.entrada, umbralDias: s.umbralFrescuraDias, ventana,
  };
}

const punto = (c: CifraOficial): PuntoVista => ({ desde: dia(c.desde), hasta: dia(c.hasta), valor: c.valor });

function variacion(v: LecturaVariacion): VariacionVista {
  if (v.estado === "CALCULADA") return { estado: "CALCULADA", valor: v.cifra.valor, unidad: v.cifra.unidad, mesBase: dia(v.mesBase), mesFinal: dia(v.mesFinal) };
  if (v.estado === "SIN_BASE") return { estado: "SIN_BASE", mesBase: dia(v.mesBase) };
  return { estado: "NO_SE_PUDO" };
}

export function aSerieVista(l: LecturaSerie): SerieVista {
  const comun = base(l.serie, l.ventana);
  if (l.estado !== "CON_DATOS") return { ...comun, estado: l.estado };
  const { estado, dias, umbralDias, cubreHoy } = l.frescura;
  if (estado === "SIN_DATOS" || dias === null) return { ...comun, estado: "ERROR" };
  return {
    ...comun,
    estado: "CON_DATOS",
    ultimo: { ...punto(l.ultimo), fuente: l.ultimo.fuente, traidoEn: horaColombia(l.ultimo.traidoEn) },
    frescura: { estado, dias: dias ?? umbralDias, umbralDias, valeHoy: cubreHoy },
    historia: l.historia.map(punto),
    variacion: l.variacion === null ? null : variacion(l.variacion),
  };
}

export const aDatosOficiales = (hoy: Date, lecturas: readonly LecturaSerie[]): VistaDatosOficiales => ({ hoy: dia(hoy), series: lecturas.map(aSerieVista) });
