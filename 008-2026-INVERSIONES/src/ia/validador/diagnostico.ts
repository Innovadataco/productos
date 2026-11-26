/**
 * Diagnóstico de un rechazo (solo lectura, puro): re-corre el validador ACTUAL sobre la salida guardada de una fila y
 * dice, por hallazgo, el código, el patrón, el número de frase, la parte que la escribió (CODIGO o MODELO) y la frase
 * con las citas como «{Hnn}» y los dígitos como «#»: nunca una cifra del modelo ni del paquete. No escribe ni llama a
 * nadie. Las frases se cuentan como las compone el validador: primero las que escribió el código (los obligatorios del
 * DIARIO que el modelo no citó) y después las del modelo.
 */
import type { PaqueteHechos } from "../contrato";
import { VERSION_VALIDADOR, type CodigoValidador } from "./codigos";
import { leerSalida } from "./leer";
import { esNumeroFundido } from "./numeros";
import { plegarTildes } from "./patron";
import { PATRONES_CIFRA_EN_PALABRAS } from "./patrones-lengua";
import { componerConObligatorias } from "./obligatorias";
import { validarSalida } from "./validar";

export type ParteDeLaSalida = "CODIGO" | "MODELO";

export interface HallazgoDiagnosticado {
  readonly codigo: CodigoValidador;
  readonly patron: string;
  /** Índice de la frase (desde 0), o null si el hallazgo es de la salida entera. */
  readonly frase: number | null;
  readonly parte: ParteDeLaSalida | null;
  /** La frase con las citas y los dígitos enmascarados; null si el hallazgo no es de una frase. */
  readonly texto: string | null;
}

export interface FilaDiagnosticada {
  readonly id: string;
  readonly tipo: string;
  readonly validadorVersion: string;
  readonly motivos: readonly string[];
}

const CITA = /\{H[0-9]{2}\}/gu;

/** ¿La palabra es un número escrito en palabras (un numeral, un ordinal, un mes, un día, un número fundido…)? */
function esNumeroEnPalabras(palabra: string): boolean {
  const plegada = plegarTildes(palabra.toLowerCase());
  return esNumeroFundido(plegada) || PATRONES_CIFRA_EN_PALABRAS.some((p) => p.patron.test(plegada));
}

/**
 * Las citas quedan como «{Hnn}»; cada carácter numérico (dígitos de cualquier escritura, y también «²», «½» y los romanos
 * de un carácter) y cada número escrito en palabras («dos mil», «veintiuno», «marzo»), como «#».
 */
export function enmascarar(texto: string): string {
  return texto
    .replace(CITA, "{Hnn}")
    .replace(/\p{N}/gu, "#")
    .replace(/\p{L}+/gu, (palabra) => (esNumeroEnPalabras(palabra) ? "#" : palabra));
}

/** La parte que escribió la frase de ese índice, dado cuántas del comienzo escribió el código. */
export const parteDeLaFrase = (indice: number, frasesDelCodigo: number): ParteDeLaSalida => (indice < frasesDelCodigo ? "CODIGO" : "MODELO");

export function diagnosticarSalida(salidaCruda: unknown, paquete: PaqueteHechos): readonly HallazgoDiagnosticado[] {
  const resultado = validarSalida(salidaCruda, paquete);
  if (resultado.ok) return [];
  const leida = leerSalida(salidaCruda);
  const { frases, delCodigo } = leida === null ? { frases: [], delCodigo: 0 } : componerConObligatorias(paquete, leida);
  return resultado.hallazgos.map((h) => {
    const texto = h.frase === null ? undefined : frases[h.frase]?.texto;
    return {
      codigo: h.codigo,
      patron: h.patron,
      frase: h.frase,
      parte: h.frase === null ? null : parteDeLaFrase(h.frase, delCodigo),
      texto: texto === undefined ? null : enmascarar(texto),
    };
  });
}

export function lineaDeHallazgo(h: HallazgoDiagnosticado): string {
  if (h.frase === null) return `${h.codigo} · ${h.patron} · salida entera`;
  const frase = `${h.codigo} · ${h.patron} · frase ${h.frase} · ${h.parte ?? "MODELO"}`;
  return h.texto === null ? frase : `${frase} · «${h.texto}»`;
}

/** El informe de una fila: su cabecera (con las dos versiones del validador) y una línea por hallazgo. */
export function informeDeFila(fila: FilaDiagnosticada, salidaCruda: string | null, paquete: PaqueteHechos): readonly string[] {
  const cabecera =
    `fila ${fila.id} · ${fila.tipo} · validador de la fila ${fila.validadorVersion} · validador actual ${VERSION_VALIDADOR}` +
    ` · motivos guardados: ${fila.motivos.length > 0 ? fila.motivos.join(",") : "ninguno"}`;
  if (salidaCruda === null) return [cabecera, "SIN_SALIDA · la fila no guardó la salida del modelo"];
  const hallazgos = diagnosticarSalida(salidaCruda, paquete);
  if (hallazgos.length === 0) return [cabecera, "SIN_RECHAZO · el validador actual acepta esta salida"];
  return [cabecera, ...hallazgos.map(lineaDeHallazgo)];
}
