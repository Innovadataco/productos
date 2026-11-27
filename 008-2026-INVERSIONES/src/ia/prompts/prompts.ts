/**
 * Los prompts versionados por tipo de resumen, con su hash (sha256 del texto, como lo calcula `armarPedido`). La
 * versión y el hash van al registro (`resumen_ia.prompt_version` y `prompt_hash`). Una versión nueva se agrega a la
 * historia de `tests/unit/ia/validador/prompts.test.ts`; una versión vieja nunca cambia de texto.
 */
import { TIPOS_RESUMEN, type TipoResumen } from "../contrato";
import { esDe } from "../formas";
import type { PromptConHash } from "../generador";
import { sha256Hex } from "../hash";
import { TEXTO_PROMPT_DIARIO, TEXTO_PROMPT_ESCENARIOS, TEXTO_PROMPT_REGLAS } from "./textos";

export const VERSIONES_PROMPT = Object.freeze({
  DIARIO: "resumen-diario-v7",
  REGLAS: "resumen-reglas-v3",
  ESCENARIOS: "resumen-escenarios-v3",
} as const satisfies Record<TipoResumen, string>);

const conHash = (texto: string, version: string): PromptConHash => Object.freeze({ texto, version, hash: sha256Hex(texto) });

export const PROMPTS: Readonly<Record<TipoResumen, PromptConHash>> = Object.freeze({
  DIARIO: conHash(TEXTO_PROMPT_DIARIO, VERSIONES_PROMPT.DIARIO),
  REGLAS: conHash(TEXTO_PROMPT_REGLAS, VERSIONES_PROMPT.REGLAS),
  ESCENARIOS: conHash(TEXTO_PROMPT_ESCENARIOS, VERSIONES_PROMPT.ESCENARIOS),
});

/** El prompt del tipo; un tipo que no existe lanza RangeError (cierra en fallo, sin repetir lo recibido). */
export function promptDe(tipo: TipoResumen): PromptConHash {
  if (!esDe(TIPOS_RESUMEN, tipo)) throw new RangeError("Tipo de resumen sin prompt.");
  return PROMPTS[tipo];
}
