// scripts/construir-lotes.ts (D1): lee sus argumentos antes de abrir la base. Ante lo que no reconoce sale con 2
// y su uso; --ayuda imprime el uso y sale con 0. En ningún caso toca la base: aquí DATABASE_URL apunta a un
// puerto cerrado, así que cualquier intento de conectarse terminaría en «❌ No se construyeron» y salida 1.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR_008 = fileURLToPath(new URL("../../../", import.meta.url));

const BASE_INALCANZABLE = "postgresql://nadie:nada@localhost:9/nada_test?connect_timeout=2";

const PLAZO = 30_000; // arranque en frío de tsx en el CI

function correr(args: readonly string[], extra: Record<string, string> = {}) {
  const env: Record<string, string | undefined> = { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: BASE_INALCANZABLE, ...extra };
  const r = spawnSync(path.join(DIR_008, "node_modules/.bin/tsx"), ["scripts/construir-lotes.ts", ...args], {
    cwd: DIR_008, encoding: "utf8", timeout: PLAZO, env: env as NodeJS.ProcessEnv,
  });
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` };
}

describe("construir-lotes · argumentos (D1)", () => {
  it("--ayuda imprime el uso y sale con 0 sin tocar la base", { timeout: PLAZO }, () => {
    const r = correr(["--ayuda"]);
    expect(r.salida).toContain("Uso: npm run lotes:construir");
    expect(r.salida).not.toContain("No se construyeron");
    expect(r.codigo).toBe(0);
  });

  for (const args of [["--xyz"], ["construir"], ["--ensayo", "--ensayo"], ["--ensayo=si"], ["--ayuda", "--xyz"], ["--"]]) {
    it(`«${args.join(" ")}» sale con 2 y el uso, sin tocar la base`, { timeout: PLAZO }, () => {
      const r = correr(args);
      expect(r.salida).toContain("Uso: npm run lotes:construir");
      expect(r.salida).not.toContain("No se construyeron");
      expect(r.codigo).toBe(2);
    });
  }

  // `npm run lotes:construir --ensayo` (sin «--»): npm se queda la opción, el script la recibe vacía y escribiría.
  for (const variable of ["npm_config_ensayo", "npm_config_ayuda", "npm_config_dry_run"]) {
    it(`si npm se quedó con la opción (${variable}), sale con 2 y dice cómo pasarla, sin tocar la base`, { timeout: PLAZO }, () => {
      const r = correr([], { [variable]: "true" });
      expect(r.salida).toContain("npm run lotes:construir -- --");
      expect(r.salida).not.toContain("No se construyeron");
      expect(r.codigo).toBe(2);
    });
  }
});
