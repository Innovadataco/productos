/**
 * scripts/ia-evaluar.ts como proceso, SIN red: todos los casos terminan antes de tocar la red (uso, sin variable de
 * destino, destino mal formado o fuera de la tailnet, carpeta de salida dentro del repo, archivo de paquetes ilegible).
 * Nunca se prueba aquí un destino con forma válida: en el Mac, una IP inventada de la tailnet podría existir.
 * El hijo corre con un entorno mínimo (tests/ayudas/cli.ts).
 */
import { copyFileSync, chmodSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { comprobar, correr, entornoMinimo, POR_CLI_MS, RAIZ } from "../../../ayudas/cli";
import { ip } from "../local/apoyo/red.ficticio";

const SCRIPT = "ia-evaluar.ts";
const salidaNueva = (): string => path.join(mkdtempSync(path.join(tmpdir(), "e7-cli-")), "r");
const FICTICIO = path.join(RAIZ, "tests", "fixtures", "ia", "evaluacion", "paquetes.ficticio.json");
/** El archivo ficticio copiado 0600 a una carpeta temporal propia (como debe quedar el export real). */
function privado(): string {
  const destino = path.join(mkdtempSync(path.join(tmpdir(), "e7-cli-paquetes-")), "hechos.json");
  copyFileSync(FICTICIO, destino);
  chmodSync(destino, 0o600);
  return destino;
}

describe("ia-evaluar · como proceso, sin red", { timeout: 10 * POR_CLI_MS }, () => {
  it("la línea de conteos por tipo es EXACTA: solo los tres de hoy, sin SIMULACION", () => {
    const salida = correr(SCRIPT, ["casos", "--casos", "DIARIO-16,DIARIO-17"], entornoMinimo({}));
    expect(salida.codigo, salida.texto).toBe(0);
    expect(salida.texto.split("\n")).toContain("✅ 2 casos (INVENTADOS): DIARIO 2 · REGLAS 0 · ESCENARIOS 0");
    expect(salida.texto).not.toContain("SIMULACION");
  });

  it("sin argumentos: 2 con el uso", () => {
    comprobar(correr(SCRIPT, [], entornoMinimo({})), 2, "Uso: npm run ia:evaluar", []);
  });

  it("casos: 0 y los conteos de los 42 casos inventados, sin red ni variable", () => {
    comprobar(correr(SCRIPT, ["casos"], entornoMinimo({})), 0, "DIARIO 17", ["FICTICIA"]);
  });

  it("casos --casos: 0 y los conteos de los elegidos; un id desconocido: 2 CASO_DESCONOCIDO, sin repetirlo", () => {
    comprobar(correr(SCRIPT, ["casos", "--casos", "DIARIO-16,DIARIO-17"], entornoMinimo({})), 0, "2 casos (INVENTADOS): DIARIO 2 · REGLAS 0 · ESCENARIOS 0", ["FICTICIA"]);
    comprobar(correr(SCRIPT, ["casos", "--casos", "DIARIO-98"], entornoMinimo({})), 2, "CASO_DESCONOCIDO", ["DIARIO-98"]);
  });

  it("casos con el archivo exportado (.ficticio.json, copiado 0600): 0, tres casos revalidados con su hash, sin nombres ni cifras", () => {
    comprobar(correr(SCRIPT, ["casos", "--paquetes", privado()], entornoMinimo({})), 0, "3 casos (PAQUETES): DIARIO 1 · REGLAS 1 · ESCENARIOS 1", ["FICTICIA", "37.911"]);
  });

  it("revisión: un archivo de paquetes legible por otros se rechaza (PAQUETES_ABIERTO), sin leerlo", () => {
    comprobar(correr(SCRIPT, ["casos", "--paquetes", FICTICIO], entornoMinimo({})), 2, "PAQUETES_ABIERTO", ["FICTICIA"]);
  });

  it("revisión: con un proxy de entorno activo para el fetch, se niega (el tráfico a la tailnet no sale por un proxy)", () => {
    comprobar(correr(SCRIPT, ["correr", "--modelo", "qwen2.5:14b", "--salida", salidaNueva()], entornoMinimo({ NODE_USE_ENV_PROXY: "1", INV_IA_LOCAL_DESTINO: "no-es-un-destino" })), 2, "PROXY_DE_ENTORNO", []);
  });

  it("correr con el portafolio y la salida en el temporal: 2 EN_CARPETA_PROHIBIDA, sin crearla", () => {
    const salida = salidaNueva();
    comprobar(correr(SCRIPT, ["correr", "--modelo", "qwen2.5:14b", "--salida", salida, "--paquetes", privado()], entornoMinimo({ INV_IA_LOCAL_DESTINO: "no-es-un-destino" })), 2, "EN_CARPETA_PROHIBIDA", []);
    expect(existsSync(salida)).toBe(false);
  });

  it("correr sin la variable del destino: 2 DESTINO_AUSENTE y no crea la carpeta", () => {
    const salida = salidaNueva();
    comprobar(correr(SCRIPT, ["correr", "--modelo", "qwen2.5:14b", "--salida", salida], entornoMinimo({})), 2, "DESTINO_AUSENTE", []);
    expect(existsSync(salida)).toBe(false);
  });

  it("correr con un destino mal formado o fuera de la tailnet: 2, sin repetirlo", () => {
    for (const [destino, codigo] of [["no-es-un-destino", "DESTINO_INVALIDO"], [`http://${ip(192, 0, 2, 13)}:47213`, "DESTINO_FUERA_DE_RANGO"]] as const) {
      const salida = salidaNueva();
      comprobar(correr(SCRIPT, ["correr", "--modelo", "qwen2.5:14b", "--salida", salida], entornoMinimo({ INV_IA_LOCAL_DESTINO: destino })), 2, codigo, [destino]);
      expect(existsSync(salida)).toBe(false);
    }
  });

  it("correr con la salida dentro del repo: 2 DENTRO_DE_UN_REPO, sin crearla", () => {
    const salida = path.join(RAIZ, "resultados-e7-no-debe-existir");
    comprobar(correr(SCRIPT, ["correr", "--modelo", "qwen2.5:14b", "--salida", salida], entornoMinimo({ INV_IA_LOCAL_DESTINO: "no-es-un-destino" })), 2, "DENTRO_DE_UN_REPO", []);
    expect(existsSync(salida)).toBe(false);
  });

  it("correr con un archivo de paquetes que no existe: 2, sin repetir la ruta", () => {
    const ruta = path.join(tmpdir(), "e7-no-existe-hechos.json");
    comprobar(correr(SCRIPT, ["correr", "--modelo", "qwen2.5:14b", "--salida", salidaNueva(), "--paquetes", ruta], entornoMinimo({})), 2, "PAQUETES_ILEGIBLE", [ruta]);
  });

  it("informe sobre una carpeta que no existe: 2", () => {
    comprobar(correr(SCRIPT, ["informe", "--salida", salidaNueva(), "--fuentes", "qwen2.5:14b,plantilla"], entornoMinimo({})), 2, "SALIDA_INEXISTENTE", []);
  });
});
