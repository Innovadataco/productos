/** Esqueleto (rojo): los prompts versionados por tipo. */
import type { TipoResumen } from "../contrato";
import type { PromptConHash } from "../generador";

const SIN: PromptConHash = Object.freeze({ texto: "SIN_IMPLEMENTAR", version: "resumen-sin-v1", hash: "" });
export const VERSIONES_PROMPT: Readonly<Record<TipoResumen, string>> = Object.freeze({ DIARIO: "", REGLAS: "", ESCENARIOS: "" });
export const PROMPTS: Readonly<Record<TipoResumen, PromptConHash>> = Object.freeze({ DIARIO: SIN, REGLAS: SIN, ESCENARIOS: SIN });
export function promptDe(_tipo: TipoResumen): PromptConHash {
  throw new Error("SIN_IMPLEMENTAR");
}
