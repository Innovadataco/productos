/**
 * Qué muestra la tarjeta de resumen (E5). Puro: sin base, sin red y sin reloj. Corre en el servidor (trae el validador);
 * la pantalla recibe solo la vista.
 * 1. Un PUBLICADO del día (`ultimoPublicado` de E3) se vuelve a validar con `validarSalida` sobre su salida y su paquete
 *    guardados: se muestra el texto que arma el validador, nunca el guardado. Si no pasa (o es de otro tipo), no se
 *    muestra y se informa el descarte con códigos.
 * 2. Si no hay uno válido, el resumen sin IA (`resumenSinIa`) del paquete de hoy.
 * 3. Si tampoco, «no disponible», con la nota de su motivo.
 * Vigencia del publicado: AL_DIA si el hash de los hechos de hoy es el suyo, DESACTUALIZADO si cambió, SIN_COMPROBAR si
 * hoy no se pudo armar el paquete (sin turno, sin datos o un fallo).
 */
import type { PaqueteHechos, TipoResumen } from "@/ia/contrato";
import type { ResumenPublicado } from "@/ia/registro/registro";
import { resumenSinIa } from "@/ia/validador/plantilla";
import type { ResumenValidado } from "@/ia/validador/tipos";
import { validarSalida } from "@/ia/validador/validar";
import { horaColombia } from "../fecha-dato/hora";
import { pieConIa, TEXTOS_RESUMEN_IA } from "./textos";
import type { CifraVista, VigenciaResumenIa, VistaResumenIa } from "./tipos";

export interface PaqueteDeHoy {
  /** null si hoy no se pudo armar. */
  readonly paquete: PaqueteHechos | null;
  /** Por qué no hay paquete (un motivo del turno, FALLO o el código del armador); null si lo hay. */
  readonly motivo: string | null;
}

export interface EntradaEleccion {
  readonly tipo: TipoResumen;
  readonly publicado: ResumenPublicado | null;
  readonly hoy: PaqueteDeHoy;
}

export interface Eleccion {
  readonly vista: VistaResumenIa;
  /** Los códigos por los que se descartó el publicado; null si no había o se mostró. */
  readonly descarte: readonly string[] | null;
}

/** Motivos de «en este momento»: el turno de las proyecciones o un fallo; los demás son de falta de datos. */
const MOTIVOS_MOMENTO: ReadonlySet<string> = new Set(["EN_VUELO", "FRECUENCIA", "OCUPADO", "FALLO"]);

const cifras = (r: ResumenValidado): readonly CifraVista[] =>
  Object.freeze(r.cifrasUsadas.map((c) => Object.freeze({
    id: c.id, etiqueta: c.etiqueta, presentacion: c.presentacion, fuente: c.fuente, fecha: c.fecha, fechaPresentada: c.fechaPresentada,
    calidad: TEXTOS_RESUMEN_IA.calidad[c.calidad],
  })));

function vistaDe(tipo: TipoResumen, r: ResumenValidado, extra: Pick<VistaResumenIa, "estado" | "pie" | "vigencia" | "redactadoEn">): VistaResumenIa {
  return Object.freeze({
    tipo, titulo: TEXTOS_RESUMEN_IA.titulos[tipo], frases: Object.freeze(r.frases.map((f) => f.texto)), aviso: r.aviso, cifras: cifras(r), nota: null, ...extra,
  });
}

function noDisponible(tipo: TipoResumen, motivo: string | null): VistaResumenIa {
  return Object.freeze({
    tipo, titulo: TEXTOS_RESUMEN_IA.titulos[tipo], estado: "NO_DISPONIBLE", frases: Object.freeze([]), aviso: null, cifras: Object.freeze([]),
    pie: TEXTOS_RESUMEN_IA.noDisponible, vigencia: null, redactadoEn: null,
    nota: motivo !== null && MOTIVOS_MOMENTO.has(motivo) ? TEXTOS_RESUMEN_IA.notaMomento : TEXTOS_RESUMEN_IA.notaSinDatos,
  });
}

function vigencia(publicado: ResumenPublicado, hoy: PaqueteDeHoy): VigenciaResumenIa {
  if (hoy.paquete === null) return "SIN_COMPROBAR";
  return hoy.paquete.hash === publicado.hechosHash ? "AL_DIA" : "DESACTUALIZADO";
}

/** El publicado revalidado, o los códigos por los que no se muestra. */
function revalidar(tipo: TipoResumen, publicado: ResumenPublicado): { readonly ok: true; readonly resumen: ResumenValidado } | { readonly ok: false; readonly codigos: readonly string[] } {
  if (publicado.tipo !== tipo || publicado.paquete.tipo !== tipo) return { ok: false, codigos: ["TIPO_DISTINTO"] };
  const r = validarSalida(publicado.salidaModelo, publicado.paquete);
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, codigos: r.motivos };
}

export function elegirResumen({ tipo, publicado, hoy }: EntradaEleccion): Eleccion {
  let descarte: readonly string[] | null = null;
  if (publicado !== null) {
    const r = revalidar(tipo, publicado);
    if (r.ok) {
      const vista = vistaDe(tipo, r.resumen, {
        estado: "IA", pie: pieConIa(publicado.puerta, publicado.modelo), vigencia: vigencia(publicado, hoy), redactadoEn: horaColombia(publicado.generadoEn),
      });
      return Object.freeze({ vista, descarte: null });
    }
    descarte = Object.freeze([...r.codigos]);
  }
  if (hoy.paquete === null || hoy.paquete.tipo !== tipo) return Object.freeze({ vista: noDisponible(tipo, hoy.paquete === null ? hoy.motivo : "TIPO_DISTINTO"), descarte });
  const sinIa = resumenSinIa(hoy.paquete);
  if (!sinIa.ok) return Object.freeze({ vista: noDisponible(tipo, "PLANTILLA_RECHAZADA"), descarte });
  return Object.freeze({ vista: vistaDe(tipo, sinIa.resumen, { estado: "SIN_IA", pie: TEXTOS_RESUMEN_IA.sinIa, vigencia: null, redactadoEn: null }), descarte });
}
