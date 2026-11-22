/**
 * La puerta local con la lista REAL de modelos (sin mocks), que publica PI en un archivo (src/ia/local/modelos.ts):
 * - sin la lista (sin la variable, como en las pruebas), ningún modelo se puede configurar: MODELO_NO_APROBADO, y PI no
 *   tumba nada más (es la puerta local la que no se arma);
 * - con la lista ficticia cargada, `qwen2.5:14b` se configura y la puerta exige en /api/tags el digest DE LA LISTA.
 * El caso del digest por verificar (null) ya no sale de la lista de PI (allí es obligatorio): lo cubren las pruebas con
 * la lista simulada (`MODELO_PENDIENTE_FICTICIO`, generador.test.ts y sonda.test.ts).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorLocal } from "@/ia/local/errores";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { ARCHIVO_LISTA_PI, VARIABLE_DIR_COMPARTIDA } from "@/ia/local/modelos";
import { crearOllamaFalso, generacionFicticia, guionFeliz, json, tagsCon, vigilarFalsos } from "./apoyo/ollama-falso";
import { MODELO_LOCAL_FICTICIO, ORIGEN_FICTICIO, URL_TAGS, pedidoFicticio } from "./apoyo/red.ficticio";

vigilarFalsos();

const FIXTURE = path.join(__dirname, "..", "..", "..", "fixtures", "ia", "modelos-ia-local-permitidos.ficticio.json");
const DIGEST_QWEN = "4613a27c".repeat(8);
let dir: string | null = null;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (dir !== null) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("puerta local sin la lista de PI (la de las pruebas: sin la variable)", () => {
  it.each(["qwen2.5:14b", "gemma2:27b", "aya-expanse:32b", "ornith:9b", MODELO_LOCAL_FICTICIO])("«%s» no se puede configurar: MODELO_NO_APROBADO, sin red", (modelo) => {
    const falso = crearOllamaFalso(guionFeliz());
    expect(() => crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo }, { fetch: falso.fetch })).toThrow(new ErrorLocal("MODELO_NO_APROBADO"));
    expect(falso.llamadas()).toHaveLength(0);
  });
});

describe("puerta local con la lista ficticia de PI (el módulo se recarga con la variable)", () => {
  async function generadorCon(modelo: string) {
    dir = mkdtempSync(path.join(tmpdir(), "lista-pi-generador-"));
    writeFileSync(path.join(dir, ARCHIVO_LISTA_PI), readFileSync(FIXTURE));
    vi.resetModules();
    vi.stubEnv(VARIABLE_DIR_COMPARTIDA, dir);
    const { crearGeneradorLocal: crear } = await import("@/ia/local/generador");
    return crear;
  }

  it("qwen2.5:14b se configura y genera solo si /api/tags trae el digest de la lista (control positivo)", async () => {
    const crear = await generadorCon("qwen2.5:14b");
    const falso = crearOllamaFalso((_l, i) => json(i === 0 ? tagsCon([{ nombre: "qwen2.5:14b", digest: DIGEST_QWEN }]) : generacionFicticia({ model: "qwen2.5:14b" })));
    const local = crear({ destino: ORIGEN_FICTICIO, modelo: "qwen2.5:14b" }, { fetch: falso.fetch });
    const r = await local.generar(pedidoFicticio().pedido, new AbortController().signal);
    expect(r).toMatchObject({ ok: true, puerta: "local", modelo: "qwen2.5:14b", modeloDigest: DIGEST_QWEN });
    expect(falso.llamadas()[0]?.url).toBe(URL_TAGS);
  });

  it("con otro digest en /api/tags, cierra: MODELO_NO_DISPONIBLE DIGEST_NO_COINCIDE, sin generar", async () => {
    const crear = await generadorCon("qwen2.5:14b");
    const falso = crearOllamaFalso(() => json(tagsCon([{ nombre: "qwen2.5:14b", digest: "37911f47".repeat(8) }])));
    const local = crear({ destino: ORIGEN_FICTICIO, modelo: "qwen2.5:14b" }, { fetch: falso.fetch });
    expect(await local.generar(pedidoFicticio().pedido, new AbortController().signal)).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" });
    expect(falso.llamadas()).toHaveLength(1);
  });

  it.each(["ornith:9b", "qwen2.5:32b", MODELO_LOCAL_FICTICIO])("«%s» no está en la lista: MODELO_NO_APROBADO", async (modelo) => {
    const crear = await generadorCon("qwen2.5:14b");
    const falso = crearOllamaFalso(guionFeliz());
    expect(() => crear({ destino: ORIGEN_FICTICIO, modelo }, { fetch: falso.fetch })).toThrow(expect.objectContaining({ codigo: "MODELO_NO_APROBADO" }));
  });
});
