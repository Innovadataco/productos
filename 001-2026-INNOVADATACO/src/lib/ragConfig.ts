/**
 * Resolución de la configuración del pipeline RAG (spec 003, US2 + FR-023/FR-024).
 *
 * Dos responsabilidades, separadas para poder probar la lógica pura sin BD:
 *   1. `resolverModeloEmbeddings(prisma)` — lee el modelo configurado en
 *      `ModuleSetting` (`base_oficial / embedding_model`) → `AiModel`, corrigiendo
 *      la violación viva del ADR_004 (hoy el worker usa `findFirst({active})`,
 *      FR-023). Sin modelo configurado: falla explícito, no adivina (FR-006).
 *   2. `mezclarParametros(...)` — puro: fusiona los parámetros del RAG (tamaño,
 *      solape, top-k, umbral, pesos RRF, enriquecimiento) con la precedencia de
 *      §0.7 (config del modelo en BD/UI > entorno > default documentado).
 *
 * Los parámetros del RAG viven en `AiModel.config` (JSON, ya editable desde la
 * UI): así son configurables sin tocar código ni migrar (FR-024). El default de
 * **solape 200 NO está medido** (D-029): se documenta como tal, no como decisión.
 */

import { resolveOllamaBaseUrl } from "@/lib/modelClients";
import {
  ENRIQUECIMIENTO_APAGADO,
  huellaEnriquecimiento,
  type ConfigEnriquecimiento,
} from "@/lib/enrich";
import type { EstrategiaTroceado } from "@/lib/chunker";

export interface ParametrosRag {
  strategy: EstrategiaTroceado;
  maxChars: number;
  overlapChars: number;
  minChars: number;
  topK: number;
  umbralSimilitud: number;
  pesoFts: number;
  pesoVectorial: number;
  rrfK: number;
  enriquecimiento: ConfigEnriquecimiento;
}

/**
 * Defaults documentados (§0.7, punto 3). Estructural y 1800 están MEDIDOS por el
 * barrido (research §1, D-029). El **solape 200 NO está medido**: es un default
 * declarado sin evidencia, nunca presentado como justificado.
 */
export const PARAMETROS_RAG_DEFAULT: ParametrosRag = {
  strategy: "estructural", // medido (D-029)
  maxChars: 1800, // medido (D-029)
  overlapChars: 200, // NO MEDIDO (D-029): default declarado sin justificar
  minChars: 120,
  topK: 5,
  umbralSimilitud: 0.0, // sin umbral por defecto; se afina con datos reales (TP-4)
  pesoFts: 1.0,
  pesoVectorial: 1.0,
  rrfK: 60, // constante habitual de RRF
  enriquecimiento: ENRIQUECIMIENTO_APAGADO, // apagado por defecto (D-031)
};

function numero(valor: unknown, porDefecto: number): number {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return typeof n === "number" && Number.isFinite(n) ? n : porDefecto;
}

/** Interpreta la config de enriquecimiento venida del JSON, sin confiar en su forma. */
function leerEnriquecimiento(valor: unknown): ConfigEnriquecimiento {
  if (typeof valor !== "object" || valor === null) return ENRIQUECIMIENTO_APAGADO;
  const v = valor as { aplicar?: unknown; campos?: unknown };
  if (v.aplicar !== true) return ENRIQUECIMIENTO_APAGADO;
  const campos = Array.isArray(v.campos)
    ? v.campos.filter((c): c is string => typeof c === "string")
    : [];
  return { aplicar: true, campos: campos as ConfigEnriquecimiento["campos"] };
}

/**
 * Fusiona los parámetros del RAG. Precedencia §0.7: valores del `config` del
 * modelo (BD/UI) por encima de los defaults documentados. Puro y testeable.
 */
export function mezclarParametros(configModelo: unknown): ParametrosRag {
  const cfg =
    typeof configModelo === "object" && configModelo !== null
      ? (configModelo as Record<string, unknown>)
      : {};
  const rag = (typeof cfg.rag === "object" && cfg.rag !== null ? cfg.rag : cfg) as Record<
    string,
    unknown
  >;

  const d = PARAMETROS_RAG_DEFAULT;
  const strategy = rag.strategy === "tamano" ? "tamano" : d.strategy;

  return {
    strategy,
    maxChars: numero(rag.maxChars, d.maxChars),
    overlapChars: numero(rag.overlapChars, d.overlapChars),
    minChars: numero(rag.minChars, d.minChars),
    topK: numero(rag.topK, d.topK),
    umbralSimilitud: numero(rag.umbralSimilitud, d.umbralSimilitud),
    pesoFts: numero(rag.pesoFts, d.pesoFts),
    pesoVectorial: numero(rag.pesoVectorial, d.pesoVectorial),
    rrfK: numero(rag.rrfK, d.rrfK),
    enriquecimiento: leerEnriquecimiento(rag.enriquecimiento),
  };
}

/** Parsea `AiModel.config` (string JSON) sin lanzar ante JSON inválido. */
export function parseConfigModelo(config: string | null | undefined): unknown {
  if (!config) return {};
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

export interface ModeloEmbeddingsResuelto {
  id: string;
  modelPath: string;
  baseUrl: string;
  parametros: ParametrosRag;
  /** Huella del espacio vectorial: modelo + enriquecimiento (FR-021/FR-026). */
  enrichConfigHuella: string;
}

/** Forma mínima de Prisma que necesita este resolver (facilita el mock en tests). */
interface PrismaRag {
  moduleSetting: {
    findUnique: (args: unknown) => Promise<{ aiModelId: string } | null>;
  };
  aiModel: {
    findUnique: (
      args: unknown,
    ) => Promise<{ id: string; modelPath: string; baseUrl: string | null; config: string } | null>;
  };
}

/** Error explícito y trazable cuando falta el modelo de embeddings (FR-006). */
export class ModeloEmbeddingsNoConfigurado extends Error {
  constructor(motivo: string) {
    super(`No hay modelo de embeddings configurado: ${motivo}`);
    this.name = "ModeloEmbeddingsNoConfigurado";
  }
}

/**
 * Resuelve el modelo de embeddings desde `ModuleSetting` (base_oficial /
 * embedding_model) → `AiModel`, con la URL por la precedencia de §0.7. Lanza
 * `ModeloEmbeddingsNoConfigurado` si no hay setting o el modelo no existe: NUNCA
 * adivina un modelo (FR-006).
 */
export async function resolverModeloEmbeddings(
  prisma: PrismaRag,
): Promise<ModeloEmbeddingsResuelto> {
  const setting = await prisma.moduleSetting.findUnique({
    where: { module_settingKey: { module: "base_oficial", settingKey: "embedding_model" } },
  });
  if (!setting) {
    throw new ModeloEmbeddingsNoConfigurado(
      "falta el ajuste base_oficial/embedding_model en ModuleSetting",
    );
  }

  const modelo = await prisma.aiModel.findUnique({ where: { id: setting.aiModelId } });
  if (!modelo) {
    throw new ModeloEmbeddingsNoConfigurado(
      `el ajuste apunta a un AiModel inexistente (${setting.aiModelId})`,
    );
  }

  const parametros = mezclarParametros(parseConfigModelo(modelo.config));

  return {
    id: modelo.id,
    modelPath: modelo.modelPath,
    baseUrl: resolveOllamaBaseUrl(modelo.baseUrl),
    parametros,
    enrichConfigHuella: huellaEnriquecimiento(parametros.enriquecimiento),
  };
}
