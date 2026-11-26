/**
 * Qué muestra la tarjeta de resumen (E5). Puro: sin base, sin red y sin reloj. Corre en el servidor (trae el validador);
 * la pantalla recibe solo la vista.
 * 1. El ÚLTIMO PUBLICADO del tipo, de cualquier día (E3), se vuelve a validar con `validarSalida` sobre su salida y su
 *    paquete guardados: se muestra el texto que arma el validador, nunca el guardado, con su fecha y hora («Análisis de
 *    la IA del 25-nov-2026, 19:05»). Si no pasa (o es de otro tipo), no se muestra y se informa el descarte con códigos.
 * 2. Si no hay uno válido, el resumen sin IA (`resumenSinIa`) del paquete de hoy.
 * 3. Si tampoco, «no disponible», con la nota de su motivo.
 * Vigencia del publicado: AL_DIA si el hash de los hechos de hoy es el suyo, DESACTUALIZADO si cambió (también si es de
 * otro día: el hash incluye el día), SIN_COMPROBAR si hoy no se pudo armar el paquete (sin turno, sin datos o un fallo).
 * Si el último análisis fue RECHAZADO por el validador (y es más nuevo que el último válido), la vista trae el motivo en
 * palabras simples, sin códigos.
 */
import type { PaqueteHechos, TipoResumen } from "@/ia/contrato";
import type { ResumenPublicado } from "@/ia/registro/registro";
import { fecha } from "../../tablero/formato";
import { resumenSinIa } from "@/ia/validador/plantilla";
import type { ResumenValidado } from "@/ia/validador/tipos";
import { validarSalida } from "@/ia/validador/validar";
import { horaColombia } from "../fecha-dato/hora";
import type { ResumenRechazado } from "./publicado";
import { pieConIa, textoRechazo, TEXTOS_RESUMEN_IA } from "./textos";
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
  /** El último análisis rechazado por el validador, si lo hay (solo se muestra si es más nuevo que `publicado`). */
  readonly rechazado?: ResumenRechazado | null;
  /** La configuración de la IA la tiene apagada para este tipo (lo decide leer.ts): sin análisis que mostrar, la vista lo dice. */
  readonly iaApagada?: boolean;
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

type Extra = Pick<VistaResumenIa, "estado" | "pie" | "vigencia" | "redactadoEn" | "analisisDel">;

function vistaDe(tipo: TipoResumen, r: ResumenValidado, extra: Extra): VistaResumenIa {
  return Object.freeze({
    tipo, titulo: TEXTOS_RESUMEN_IA.titulos[tipo], frases: Object.freeze(r.frases.map((f) => f.texto)), aviso: r.aviso, cifras: cifras(r), nota: null,
    rechazo: null, sinIa: null, puedeAnalizar: false, ...extra,
  });
}

/** «25-nov-2026, 19:05» a partir de un instante (hora de Colombia). */
function cuando(instante: Date): string {
  const [dia, hora] = horaColombia(instante).split(" ");
  return `${fecha(dia ?? null)}, ${hora}`;
}

/** La tarjeta sin resumen, con la nota de su motivo. */
export function noDisponible(tipo: TipoResumen, motivo: string | null): VistaResumenIa {
  return Object.freeze({
    tipo, titulo: TEXTOS_RESUMEN_IA.titulos[tipo], estado: "NO_DISPONIBLE", frases: Object.freeze([]), aviso: null, cifras: Object.freeze([]),
    pie: TEXTOS_RESUMEN_IA.noDisponible, vigencia: null, redactadoEn: null, analisisDel: null, rechazo: null, sinIa: null, puedeAnalizar: false,
    nota: motivo !== null && MOTIVOS_MOMENTO.has(motivo) ? TEXTOS_RESUMEN_IA.notaMomento : TEXTOS_RESUMEN_IA.notaSinDatos,
  });
}

function vigencia(publicado: ResumenPublicado, hoy: PaqueteDeHoy): VigenciaResumenIa {
  if (hoy.paquete === null || hoy.paquete.tipo !== publicado.tipo) return "SIN_COMPROBAR";
  return hoy.paquete.hash === publicado.hechosHash ? "AL_DIA" : "DESACTUALIZADO";
}

/** El publicado revalidado, o los códigos por los que no se muestra. */
function revalidar(tipo: TipoResumen, publicado: ResumenPublicado): { readonly ok: true; readonly resumen: ResumenValidado } | { readonly ok: false; readonly codigos: readonly string[] } {
  if (publicado.tipo !== tipo || publicado.paquete.tipo !== tipo) return { ok: false, codigos: ["TIPO_DISTINTO"] };
  const r = validarSalida(publicado.salidaModelo, publicado.paquete);
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, codigos: r.motivos };
}

/** El motivo del último rechazo, solo si es más nuevo que el último análisis válido. */
function rechazoDe(rechazado: ResumenRechazado | null | undefined, publicado: ResumenPublicado | null): string | null {
  if (rechazado === null || rechazado === undefined) return null;
  if (publicado !== null && rechazado.generadoEn.getTime() <= publicado.generadoEn.getTime()) return null;
  return textoRechazo(cuando(rechazado.generadoEn), rechazado.motivos);
}

export function elegirResumen({ tipo, publicado, rechazado, iaApagada, hoy }: EntradaEleccion): Eleccion {
  const rechazo = rechazoDe(rechazado, publicado);
  const conRechazo = (vista: VistaResumenIa): VistaResumenIa => {
    // «IA apagada» solo cuando no se muestra un análisis de la IA.
    const sinIa = iaApagada === true && vista.estado !== "IA" ? TEXTOS_RESUMEN_IA.iaApagada : null;
    return rechazo === null && sinIa === null ? vista : Object.freeze({ ...vista, rechazo, sinIa });
  };
  let descarte: readonly string[] | null = null;
  if (publicado !== null) {
    const r = revalidar(tipo, publicado);
    if (r.ok) {
      const vista = vistaDe(tipo, r.resumen, {
        estado: "IA", pie: pieConIa(publicado.puerta, publicado.modelo), vigencia: vigencia(publicado, hoy), redactadoEn: horaColombia(publicado.generadoEn),
        analisisDel: `${TEXTOS_RESUMEN_IA.analisisDel} ${cuando(publicado.generadoEn)}`,
      });
      return Object.freeze({ vista: conRechazo(vista), descarte: null });
    }
    descarte = Object.freeze([...r.codigos]);
  }
  if (hoy.paquete === null || hoy.paquete.tipo !== tipo) return Object.freeze({ vista: conRechazo(noDisponible(tipo, hoy.paquete === null ? hoy.motivo : "TIPO_DISTINTO")), descarte });
  const sinIa = resumenSinIa(hoy.paquete);
  if (!sinIa.ok) return Object.freeze({ vista: conRechazo(noDisponible(tipo, "PLANTILLA_RECHAZADA")), descarte });
  return Object.freeze({
    vista: conRechazo(vistaDe(tipo, sinIa.resumen, { estado: "SIN_IA", pie: TEXTOS_RESUMEN_IA.sinIa, vigencia: null, redactadoEn: null, analisisDel: null })), descarte,
  });
}
