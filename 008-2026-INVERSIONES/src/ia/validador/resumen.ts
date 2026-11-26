/**
 * Lo que pone el código alrededor de las frases: el aviso fijo del tipo y las «Cifras usadas» (fuente, fecha es-CO,
 * calidad y «fuente · fecha»), armadas solo desde el paquete. El aviso va aparte del texto (el de ESCENARIOS es el AVISO
 * de las proyecciones, que nombra la recomendación para negarla).
 */
import { fecha as fechaEsCo } from "../../app/tablero/formato";
import { AVISO } from "../../proyecciones/tipos";
import type { IdHecho, PaqueteHechos, TipoResumen } from "../contrato";
import { VERSION_VALIDADOR } from "./codigos";
import { esNombre, hechosPorId } from "./hechos";
import type { CifraUsada, FraseResumen, ResumenValidado } from "./tipos";

const AVISO_GENERAL = "Resumen informativo con cifras calculadas por el sistema; no es una recomendación de compra ni de venta.";

export const AVISOS: Readonly<Record<TipoResumen, string>> = Object.freeze({
  DIARIO: AVISO_GENERAL,
  REGLAS: AVISO_GENERAL,
  ESCENARIOS: AVISO,
  SIMULACION: "Descripción informativa del portafolio simulado, con cifras calculadas por el sistema; no es una recomendación de compra ni de venta.",
});

function cifrasUsadas(citados: readonly IdHecho[], paquete: PaqueteHechos): readonly CifraUsada[] {
  const porId = hechosPorId(paquete);
  return Object.freeze(citados.flatMap((id) => {
    const h = porId.get(id);
    if (h === undefined || esNombre(h)) return [];
    const fechaPresentada = fechaEsCo(h.fecha);
    return [Object.freeze({
      id: h.id, etiqueta: h.etiqueta, presentacion: h.presentacion, fuente: h.fuente, fecha: h.fecha,
      fechaPresentada, calidad: h.calidad, fuenteFecha: `${h.fuente} · ${fechaPresentada}`,
    })];
  }));
}

/** El resumen publicado, congelado: las frases ya renderizadas y validadas, con lo que pone el código. */
export function armarResumen<T extends TipoResumen>(paquete: PaqueteHechos<T>, frases: readonly FraseResumen[], revisar: readonly FraseResumen[] = []): ResumenValidado<T> {
  const citados = Object.freeze([...new Set([...frases, ...revisar].flatMap((f) => f.citados))]);
  const cifras = cifrasUsadas(citados, paquete);
  return Object.freeze({
    tipo: paquete.tipo,
    frases: Object.freeze(frases.map((f) => Object.freeze({ texto: f.texto, citados: Object.freeze([...f.citados]) }))),
    revisar: Object.freeze(revisar.map((f) => Object.freeze({ texto: f.texto, citados: Object.freeze([...f.citados]) }))),
    texto: frases.map((f) => f.texto).join(" "),
    citados,
    aviso: AVISOS[paquete.tipo],
    cifrasUsadas: cifras,
    fuentes: Object.freeze([...new Set(cifras.map((c) => c.fuenteFecha))]),
    hechosHash: paquete.hash,
    validadorVersion: VERSION_VALIDADOR,
  });
}
