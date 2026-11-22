// scripts/exportar-trm.ts como proceso, sin red: todos los casos terminan ANTES de pedir a la SFC (los errores de uso y
// la terminal salen con 2, sin nada en stdout y sin repetir las fechas pedidas). El flujo con red (CSV, 0, 3 y 1) lo
// prueba exportar-trm.test.ts en proceso, con `buscar` inyectado. El entorno del hijo es mínimo. Fechas fijas y
// anteriores a la TRM (1985): si el cableado de la terminal se rompiera, el único pedido real traería [] y la prueba
// se pondría roja igual (SIN_FILAS en vez de SALIDA_TERMINAL).
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POR_CLI_MS, RAIZ, entornoMinimo } from "../../ayudas/cli";

const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const SCRIPT = join("scripts", "exportar-trm.ts");
const USO = "Uso: npx tsx scripts/exportar-trm.ts --desde AAAA-MM-DD";
const NUNCA = ["1985-03-11", "1985-03-12", "datos.gov.co/resource"];

interface Salida { readonly codigo: number | null; readonly stdout: string; readonly stderr: string }
function correr(args: readonly string[], extra: Record<string, string> = {}): Salida {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd: RAIZ, env: entornoMinimo(extra), encoding: "utf8", timeout: POR_CLI_MS, stdio: ["ignore", "pipe", "pipe"] });
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr };
}
function comprobar(s: Salida, codigo: number, esperado: string): void {
  expect(s.codigo, s.stderr).toBe(codigo);
  expect(s.stderr).toContain(esperado);
  expect(s.stdout, "nada en stdout").toBe("");
  for (const dato of NUNCA) expect(s.stderr, dato).not.toContain(dato);
}

describe("exportar-trm · como proceso, sin red (todos los casos terminan antes de pedir a la SFC)", { timeout: 8 * POR_CLI_MS }, () => {
  it("argumentos inválidos (ninguno, --ayuda, suelto, sin valor, rango al revés, futuro): 2 con su uso y nada en stdout", () => {
    for (const args of [[], ["--ayuda"], ["1985-03-11"], ["--desde"], ["--desde", "1985-03-12", "--hasta", "1985-03-11"], ["--desde", "2099-01-04"]]) {
      comprobar(correr(args), 2, USO);
    }
  });

  it("npm se quedó con --hasta: 2", () => {
    comprobar(correr(["--desde", "1985-03-11"], { npm_config_hasta: "1985-03-12" }), 2, "npm se quedó con --hasta");
  });

  // Una terminal de verdad con script(1): BSD en macOS, util-linux en Linux (CI). Su entrada es /dev/null.
  it("con stdout en una terminal se niega con SALIDA_TERMINAL y 2, sin pedir a la SFC", () => {
    const comando = [TSX, SCRIPT, "--desde", "1985-03-11", "--hasta", "1985-03-12"];
    const args = process.platform === "darwin" ? ["-q", "/dev/null", ...comando] : ["-qec", comando.map((a) => `'${a}'`).join(" "), "/dev/null"];
    const r = spawnSync("script", args, { cwd: RAIZ, env: entornoMinimo({}), encoding: "utf8", timeout: POR_CLI_MS, stdio: ["ignore", "pipe", "pipe"] });
    const texto = `${r.stdout}${r.stderr}`;
    expect(r.status, texto).toBe(2);
    expect(texto).toContain("SALIDA_TERMINAL");
    expect(texto).not.toContain("TRM_");
    expect(texto).not.toContain("SIN_FILAS");
  });
});
