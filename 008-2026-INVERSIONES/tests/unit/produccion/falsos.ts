// Apoyo de las pruebas de producción: ejecutables falsos en PATH (docker, curl, flock, df, ps, npm, sleep)
// que registran cada llamada, y repos git temporales. No es una prueba (no termina en .test.ts).
import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Carpeta 008-2026-INVERSIONES de este clon. */
export const DIR_008 = fileURLToPath(new URL("../../../", import.meta.url));
export const ruta008 = (relativa: string) => path.join(DIR_008, relativa);
export const leer008 = (relativa: string) => readFileSync(ruta008(relativa), "utf8");

/** Carpeta temporal con ruta física (en macOS /var es un enlace a /private/var). */
export function carpetaTemporal(prefijo: string): string {
  return realpathSync(mkdtempSync(path.join(tmpdir(), `inv-008-${prefijo}-`)));
}

// Los ejecutables falsos viven en ./falsos/ (bash): registran cada llamada y responden según variables FALSO_*.
const DIR_FALSOS = fileURLToPath(new URL("./falsos/", import.meta.url));

export type Llamada = string[];
/** Variables de entorno para los scripts (sin las que Next exige en ProcessEnv). */
export type Entorno = Record<string, string | undefined>;
export type Falsos = { bin: string; registro: string; llamadas: () => Llamada[] };

/** Crea los ejecutables falsos en `dir/bin`. Cada llamada queda en el registro: nombre y argumentos separados por tabulador. */
export function crearFalsos(dir: string): Falsos {
  const bin = path.join(dir, "bin");
  const registro = path.join(dir, "registro.txt");
  mkdirSync(bin, { recursive: true });
  writeFileSync(registro, "");
  for (const nombre of readdirSync(DIR_FALSOS)) {
    copyFileSync(path.join(DIR_FALSOS, nombre), path.join(bin, nombre));
    chmodSync(path.join(bin, nombre), 0o755);
  }
  return {
    bin,
    registro,
    llamadas: () =>
      readFileSync(registro, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split("\t")),
  };
}

/** Entorno limpio: sin variables INV_* ni FALSO_* heredadas, con los falsos primero en PATH. */
export function entorno(falsos: Falsos, extra: Record<string, string> = {}): Entorno {
  const limpio = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("INV_") && !k.startsWith("FALSO_") && k !== "DATABASE_URL"),
  );
  return { ...limpio, PATH: `${falsos.bin}:${process.env.PATH}`, FALSO_REGISTRO: falsos.registro, ...extra };
}

export type Resultado = { status: number | null; stdout: string; stderr: string };

/**
 * Corre un script con bash sin bloquear el hilo de la prueba (spawn, no spawnSync): con decenas de scripts
 * seguidos, un spawnSync deja al worker de vitest sin responder y su RPC vence («Timeout calling onTaskUpdate»).
 */
export function correr(script: string, args: string[], env: Entorno, input?: string): Promise<Resultado> {
  return new Promise((ok) => {
    const hijo = spawn("bash", [script, ...args], { env: env as NodeJS.ProcessEnv });
    let stdout = "";
    let stderr = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 60_000);
    hijo.stdout.on("data", (c: Buffer) => (stdout += c));
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.stdin.end(input ?? "");
    hijo.on("close", (status: number | null) => {
      clearTimeout(reloj);
      ok({ status, stdout, stderr });
    });
  });
}

/** Corre una función de un script cargado con `source` (los scripts no ejecutan main al cargarse). */
export function funcion(script: string, codigo: string, env: Entorno = process.env, input?: string): SpawnSyncReturns<string> {
  return spawnSync("bash", ["-c", `set -euo pipefail; source "$1"; ${codigo}`, "bash", script], { env: env as NodeJS.ProcessEnv, input, encoding: "utf8" });
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
export function git(dir: string, args: string[]): string {
  const r = spawnSync("git", ["-c", "user.name=prueba", "-c", "user.email=prueba@ejemplo.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd: dir,
    env: { ...process.env, ...GIT_ENV },
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** Repo git temporal con archivos bajo 008-2026-INVERSIONES/. `copiar` toma archivos reales de este clon. */
export function crearRepo(copiar: string[], archivos: Record<string, string> = {}): { dir: string; dir008: string; sha: string } {
  const dir = carpetaTemporal("repo");
  const dir008 = path.join(dir, "008-2026-INVERSIONES");
  for (const relativa of copiar) {
    mkdirSync(path.dirname(path.join(dir008, relativa)), { recursive: true });
    copyFileSync(ruta008(relativa), path.join(dir008, relativa));
  }
  for (const [relativa, contenido] of Object.entries(archivos)) {
    mkdirSync(path.dirname(path.join(dir008, relativa)), { recursive: true });
    writeFileSync(path.join(dir008, relativa), contenido);
  }
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "prueba"]);
  return { dir, dir008, sha: git(dir, ["rev-parse", "HEAD"]) };
}

/** Archivo de producción ficticio (`.env.inversiones.production`) para el proyecto de prueba. */
export function envProduccionFicticio(base: string, cambios: Record<string, string> = {}): string {
  const valores: Record<string, string> = {
    INV_POSTGRES_CLAVE: "a".repeat(64),
    INV_DUENO_DATABASE_URL: `postgresql://inv_dueno:${"b".repeat(64)}@inv-008-db:5432/inversiones?schema=public&connection_limit=3`,
    INV_APP_DATABASE_URL: `postgresql://inv_app:${"c".repeat(64)}@inv-008-db:5432/inversiones?schema=public&connection_limit=5`,
    INV_AUTH_SECRET: "ZmljdGljaW8tZmljdGljaW8tZmljdGljaW8tZmljdGljaW8=",
    INV_CIFRADO_CLAVE: "ZmljdGljaW8tZmljdGljaW8tZmljdGljaW8tMzI=",
    INV_AGE_PUBLICA: `age1${"q".repeat(58)}`,
    APP_ORIGEN: "https://inversiones.innovadataco.com",
    INV_RESPALDO_GID: "10008",
    INV_TELEGRAM_BOT_TOKEN: "000000:ficticio",
    INV_TELEGRAM_CHAT_ID: "-1",
    ...cambios,
  };
  const archivo = path.join(base, ".env.inversiones.production");
  writeFileSync(
    archivo,
    Object.entries(valores)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  return archivo;
}
