import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const BASE_DIR = join(__dirname, "..");

/**
 * Resolución de configuración del banco (ADR_004 / constitución §0.7).
 *
 * Precedencia, de mayor a menor:
 *   1. Argumentos CLI      (--corpus-path=..., --models=a,b)
 *   2. Variables de entorno (EVAL_CORPUS_PATH, OLLAMA_BASEURL, ...)
 *   3. config.local.json    (no versionado; equivalente local de "BD/UI")
 *   4. config.default.json  (defaults documentados, versionados)
 *
 * En la aplicación la precedencia es BD/UI > env > default; aquí no hay BD, así
 * que su lugar lo ocupan los argumentos y el config local. Lo que no cambia es
 * la regla de fondo: ningún valor operativo se cambia editando código.
 */

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (arg.startsWith("--")) args[arg.slice(2)] = "true";
  }
  return args;
}

function leerJson(ruta) {
  if (!existsSync(ruta)) return {};
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (err) {
    throw new Error(`Config inválida en ${ruta}: ${err.message}`);
  }
}

/** Elimina las claves de documentación (las que empiezan por "_"). */
function limpiar(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const salida = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("_")) continue;
    salida[k] = limpiar(v);
  }
  return salida;
}

export function cargarConfig(argv = process.argv) {
  const args = parseArgs(argv);
  const defaults = limpiar(leerJson(join(BASE_DIR, "config.default.json")));
  const local = limpiar(leerJson(join(BASE_DIR, "config.local.json")));

  const cfg = {
    ...defaults,
    ...local,
    chunk: { ...defaults.chunk, ...(local.chunk || {}) },
    projection: { ...defaults.projection, ...(local.projection || {}) },
  };

  // 2) entorno
  if (process.env.EVAL_CORPUS_PATH) cfg.corpusPath = process.env.EVAL_CORPUS_PATH;
  if (process.env.EVAL_MODELS) cfg.models = process.env.EVAL_MODELS.split(",").map((s) => s.trim());
  if (process.env.EVAL_TOP_K) cfg.topK = Number(process.env.EVAL_TOP_K);

  // 1) argumentos CLI
  if (args["corpus-path"]) cfg.corpusPath = args["corpus-path"];
  if (args.models) cfg.models = args.models.split(",").map((s) => s.trim());
  if (args["top-k"]) cfg.topK = Number(args["top-k"]);
  if (args["max-chars"]) cfg.chunk.maxChars = Number(args["max-chars"]);
  if (args["overlap-chars"]) cfg.chunk.overlapChars = Number(args["overlap-chars"]);
  if (args["chunk-strategy"]) cfg.chunk.strategy = args["chunk-strategy"];
  if (args["ollama-base-url"]) cfg.ollamaBaseUrl = args["ollama-base-url"];
  if (args["output-dir"]) cfg.outputDir = args["output-dir"];

  // Ollama: misma precedencia que la app (D-008)
  cfg.ollamaBaseUrl = (cfg.ollamaBaseUrl || process.env.OLLAMA_BASEURL || "http://localhost:11434")
    .replace(/\/$/, "");

  if (!cfg.corpusPath) {
    throw new Error(
      "corpusPath no configurado. Defínelo con --corpus-path=<ruta>, la variable " +
        "EVAL_CORPUS_PATH o config.local.json. No hay ruta por defecto a propósito: " +
        "el corpus es externo al repositorio (ADR_004).",
    );
  }

  return cfg;
}
