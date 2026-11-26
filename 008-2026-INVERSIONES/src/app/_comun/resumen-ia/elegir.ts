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
 * Si el último análisis fue RECHAZADO por el validador, o el último intento FALLÓ (y es más nuevo que el último válido),
 * la vista trae el motivo en palabras simples, sin códigos (el más reciente de los dos).
 */
import type { PaqueteHechos, TipoDiario } from "@/ia/contrato";
import type { ResumenPublicado } from "@/ia/registro/registro";
import { fecha } from "../../tablero/formato";
import { resumenSinIa } from "@/ia/validador/plantilla";
import type { ResumenValidado } from "@/ia/validador/tipos";
import { validarSalida } from "@/ia/validador/validar";
import { horaColombia } from "../fecha-dato/hora";
import type { ResumenFallido, ResumenRechazado } from "./publicado";
import { pieConIa, textoRechazo, TEXTOS_RESUMEN_IA } from "./textos";
import type { CifraVista, VigenciaResumenIa, VistaResumenIa } from "./tipos";

export interface PaqueteDeHoy {
  /** null si hoy no se pudo armar. */
  readonly paquete: PaqueteHechos | null;
  /** Por qué no hay paquete (un motivo del turno, FALLO o el código del armador); null si lo hay. */
  readonly motivo: string | null;
}

export interface EntradaEleccion {
  readonly tipo: TipoDiario;
  readonly publicado: ResumenPublicado | null;
  /** El último análisis rechazado por el validador, si lo hay (solo se muestra si es más nuevo que `publicado`). */
  readonly rechazado?: ResumenRechazado | null;
  /** El último intento FALLIDO (sin salida del modelo), si lo hay (solo se dice si es más nuevo que `publicado` y que `rechazado`). */
  readonly fallido?: ResumenFallido | null;
  /** Por qué la configuración no deja que haya análisis de la IA (lo decide leer.ts: «IA apagada» o «demanda apagada»): sin análisis que mostrar, la vista lo dice. */
  readonly motivoSinIa?: string | null;
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

function vistaDe(tipo: TipoDiario, r: ResumenValidado, extra: Extra): VistaResumenIa {
  return Object.freeze({
    tipo, titulo: TEXTOS_RESUMEN_IA.titulos[tipo], frases: Object.freeze(r.frases.map((f) => f.texto)), aviso: r.aviso, cifras: cifras(r), nota: null,
    rechazo: null, sinIa: null, fallo: null, descartado: null, puedeAnalizar: false, ...extra,
  });
}

/** «25-nov-2026, 19:05» a partir de un instante (hora de Colombia). */
function cuando(instante: Date): string {
  const [dia, hora] = horaColombia(instante).split(" ");
  return `${fecha(dia ?? null)}, ${hora}`;
}

/** La tarjeta sin resumen, con la nota de su motivo. */
export function noDisponible(tipo: TipoDiario, motivo: string | null): VistaResumenIa {
  return Object.freeze({
    tipo, titulo: TEXTOS_RESUMEN_IA.titulos[tipo], estado: "NO_DISPONIBLE", frases: Object.freeze([]), aviso: null, cifras: Object.freeze([]),
    pie: TEXTOS_RESUMEN_IA.noDisponible, vigencia: null, redactadoEn: null, analisisDel: null, rechazo: null, sinIa: null, fallo: null, descartado: null, puedeAnalizar: false,
    nota: motivo !== null && MOTIVOS_MOMENTO.has(motivo) ? TEXTOS_RESUMEN_IA.notaMomento : TEXTOS_RESUMEN_IA.notaSinDatos,
  });
}

function vigencia(publicado: ResumenPublicado, hoy: PaqueteDeHoy): VigenciaResumenIa {
  if (hoy.paquete === null || hoy.paquete.tipo !== publicado.tipo) return "SIN_COMPROBAR";
  return hoy.paquete.hash === publicado.hechosHash ? "AL_DIA" : "DESACTUALIZADO";
}

/** El publicado revalidado, o los códigos por los que no se muestra. */
function revalidar(tipo: TipoDiario, publicado: ResumenPublicado): { readonly ok: true; readonly resumen: ResumenValidado } | { readonly ok: false; readonly codigos: readonly string[] } {
  if (publicado.tipo !== tipo || publicado.paquete.tipo !== tipo) return { ok: false, codigos: ["TIPO_DISTINTO"] };
  const r = validarSalida(publicado.salidaModelo, publicado.paquete);
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, codigos: r.motivos };
}

const esMasNuevo = (instante: Date, publicado: ResumenPublicado | null): boolean => publicado === null || instante.getTime() > publicado.generadoEn.getTime();

/** El aviso de un intento fallido, según lo que la tarjeta muestre. */
function textoFallo(estado: VistaResumenIa["estado"], instante: Date): string {
  const t = TEXTOS_RESUMEN_IA.fallo;
  const plantilla = estado === "IA" ? t.conAnterior : estado === "SIN_IA" ? t.conSinIa : t.sinResumen;
  return plantilla.replace("{cuando}", cuando(instante));
}

/**
 * Lo último que pasó con un intento de análisis, si es más nuevo que el último válido: un rechazo del validador (su
 * motivo) o un fallo (no hubo salida). Si hay los dos, el más reciente; el otro ya es historia.
 */
function intentoReciente(rechazado: ResumenRechazado | null | undefined, fallido: ResumenFallido | null | undefined, publicado: ResumenPublicado | null): { readonly rechazo: ResumenRechazado | null; readonly fallo: ResumenFallido | null } {
  const rechazo = rechazado !== null && rechazado !== undefined && esMasNuevo(rechazado.generadoEn, publicado) ? rechazado : null;
  const fallo = fallido !== null && fallido !== undefined && esMasNuevo(fallido.generadoEn, publicado) ? fallido : null;
  if (rechazo !== null && fallo !== null) return fallo.generadoEn.getTime() > rechazo.generadoEn.getTime() ? { rechazo: null, fallo } : { rechazo, fallo: null };
  return { rechazo, fallo };
}

export function elegirResumen({ tipo, publicado, rechazado, fallido, motivoSinIa, hoy }: EntradaEleccion): Eleccion {
  const { vista, descarte } = elegirSinNotas({ tipo, publicado, rechazado, fallido, motivoSinIa, hoy });
  // Un publicado que ya no pasa la revisión no se muestra: la nota lo dice (sin el contenido de lo guardado ni los códigos).
  if (descarte === null) return Object.freeze({ vista, descarte });
  const t = TEXTOS_RESUMEN_IA.descartado;
  return Object.freeze({ vista: Object.freeze({ ...vista, descartado: vista.estado === "SIN_IA" ? t.conSinIa : t.sinResumen }), descarte });
}

function elegirSinNotas({ tipo, publicado, rechazado, fallido, motivoSinIa, hoy }: EntradaEleccion): Eleccion {
  const intento = intentoReciente(rechazado, fallido, publicado);
  const conRechazo = (vista: VistaResumenIa): VistaResumenIa => {
    const rechazo = intento.rechazo === null ? null : textoRechazo(cuando(intento.rechazo.generadoEn), intento.rechazo.motivos);
    const fallo = intento.fallo === null ? null : textoFallo(vista.estado, intento.fallo.generadoEn);
    // «IA apagada» solo cuando no se muestra un análisis de la IA.
    const sinIa = vista.estado !== "IA" ? motivoSinIa ?? null : null;
    return rechazo === null && fallo === null && sinIa === null ? vista : Object.freeze({ ...vista, rechazo, fallo, sinIa });
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
