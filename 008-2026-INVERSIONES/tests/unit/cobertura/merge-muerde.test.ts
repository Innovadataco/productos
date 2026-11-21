// Los pisos de vitest.cobertura.config.ts MUERDEN en un merge de verdad (vitest --merge-reports), no solo
// están escritos: si una versión de vitest dejara de aplicar thresholds al unir, o el config dejara de medir,
// esta prueba cae. Barata y sin base: un blob con cobertura casi nula (una prueba que no importa src/) y dos
// merges sobre ESE mismo blob, uno con los pisos del config y otro con los pisos en 0 por línea de comandos.
// Cada corrida hija escribe solo en un temporal (nunca en los reportsDirectory que usa una corrida en curso).
import { spawn } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR_008 = fileURLToPath(new URL("../../../", import.meta.url));
const VITEST = path.join(DIR_008, "node_modules", ".bin", "vitest");
const PRUEBA_SIN_SRC = "tests/unit/infraestructura.test.ts";

type Salida = { status: number | null; salida: string };

/** Corre vitest como proceso hijo sin bloquear el worker (spawn, no spawnSync). */
function vitest(args: string[]): Promise<Salida> {
  // Sin las variables que la corrida padre de vitest deja en el entorno (VITEST_*, el pool, el color).
  const heredadas = Object.entries(process.env).filter(([k]) => !k.startsWith("VITEST") && k !== "TEST" && k !== "FORCE_COLOR");
  // El cast: Next exige NODE_ENV en ProcessEnv.
  const env = { ...Object.fromEntries(heredadas), NO_COLOR: "1" } as unknown as NodeJS.ProcessEnv;
  return new Promise((ok) => {
    const hijo = spawn(VITEST, ["run", ...args], { cwd: DIR_008, env });
    let salida = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 90_000);
    hijo.stdout.on("data", (c: Buffer) => (salida += c));
    hijo.stderr.on("data", (c: Buffer) => (salida += c));
    hijo.on("close", (status: number | null) => {
      clearTimeout(reloj);
      // Sin secuencias de color, por si alguna herramienta las fuerza igual.
      ok({ status, salida: salida.replace(/\u001b\[[0-9;]*m/g, "") });
    });
  });
}

describe("vitest.cobertura.config.ts · los pisos muerden en un merge real", () => {
  let dir = "";
  const blobs = () => path.join(dir, "blobs");

  beforeAll(async () => {
    dir = realpathSync(mkdtempSync(path.join(tmpdir(), "inv-008-merge-")));
    const r = await vitest([
      "--config",
      "vitest.config.ts",
      PRUEBA_SIN_SRC,
      "--coverage",
      `--coverage.reportsDirectory=${path.join(dir, "rep")}`,
      "--reporter=blob",
      `--outputFile.blob=${path.join(blobs(), "casi-nula.json")}`,
    ]);
    if (r.status !== 0) throw new Error(`No se pudo generar el blob de prueba:\n${r.salida}`);
  }, 120_000);

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("con los pisos del config, el merge de una cobertura bajo el piso sale con exit 1 y lo dice", async () => {
    const r = await vitest([
      "--config",
      "vitest.cobertura.config.ts",
      `--merge-reports=${blobs()}`,
      `--coverage.reportsDirectory=${path.join(dir, "unida")}`,
    ]);
    expect(r.salida).toMatch(/Coverage report from v8/);
    expect(r.salida).toMatch(/ERROR: Coverage for lines \(\d+(\.\d+)?%\) does not meet global threshold \(\d+%\)/);
    expect(r.status).toBe(1);
  }, 120_000);

  it("con los MISMOS blobs y los pisos en 0, el merge sale con exit 0: el exit 1 de arriba es de los pisos", async () => {
    const r = await vitest([
      "--config",
      "vitest.cobertura.config.ts",
      `--merge-reports=${blobs()}`,
      `--coverage.reportsDirectory=${path.join(dir, "unida-cero")}`,
      ...["statements", "branches", "functions", "lines"].map((m) => `--coverage.thresholds.${m}=0`),
    ]);
    expect(r.salida).toMatch(/Coverage report from v8/);
    expect(r.salida).not.toMatch(/does not meet global threshold/);
    expect(r.status).toBe(0);
  }, 120_000);
});
