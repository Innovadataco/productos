// Apoyo de las pruebas de producción: ejecutables falsos en PATH (docker, curl, flock, df, ps, npm, sleep)
// que registran cada llamada, y repos git temporales. No es una prueba (no termina en .test.ts).
import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
// Se usan en su sitio, sin copiarlos: en macOS la primera ejecución de cada ejecutable NUEVO pasa por la revisión del
// sistema, en una sola fila para todo el Mac (con la máquina cargada, segundos por archivo). Candado: falsos.test.ts.
const DIR_FALSOS = fileURLToPath(new URL("./falsos", import.meta.url));
/** El tsx falso del /app de inv-cargar (cargar-*.test.ts): versionado, como los de ./falsos/. */
export const TSX_CARGAR_FALSO = fileURLToPath(new URL("./falsos-cargar/tsx", import.meta.url));

/**
 * /app falso de inv-cargar en `<dir>/app`, propio de la prueba, con `node_modules/.bin/tsx` como enlace simbólico al
 * tsx versionado: corre el archivo del repo, nunca uno nuevo. `symlinkSync` no sobrescribe (falla si ya existe), y
 * ninguna prueba debe escribir por ese enlace: pisaría el del repo. Candado: el inodo, en cada cargar-*.test.ts.
 */
export function appCargarFalsa(dir: string): string {
  const app = path.join(dir, "app");
  const bin = path.join(app, "node_modules", ".bin");
  mkdirSync(bin, { recursive: true });
  symlinkSync(TSX_CARGAR_FALSO, path.join(bin, "tsx"));
  return app;
}

/** Identidad del archivo que se ejecuta (sigue los enlaces): dispositivo e inodo. */
export function idArchivo(ruta: string): string {
  const s = statSync(ruta);
  return `${s.dev}:${s.ino}`;
}

export type Llamada = string[];
/** Variables de entorno para los scripts (sin las que Next exige en ProcessEnv). */
export type Entorno = Record<string, string | undefined>;
/**
 * `bin`: carpeta propia de la prueba, vacía, primera en el PATH; un falso propio que se escriba ahí tapa al de `fijos`.
 * `fijos`: los falsos versionados (./falsos/), detrás en el PATH. Solo lectura: nunca se escribe ahí.
 */
export type Falsos = { bin: string; fijos: string; registro: string; llamadas: () => Llamada[] };

/** Prepara los falsos de una prueba en `dir`. Cada llamada queda en el registro: nombre y argumentos separados por tabulador. */
export function crearFalsos(dir: string): Falsos {
  const bin = path.join(dir, "bin");
  const registro = path.join(dir, "registro.txt");
  mkdirSync(bin, { recursive: true });
  writeFileSync(registro, "");
  return {
    bin,
    fijos: DIR_FALSOS,
    registro,
    llamadas: () =>
      readFileSync(registro, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split("\t")),
  };
}

/** Entorno limpio: sin variables INV_* ni FALSO_* heredadas, con los falsos primero en PATH (los propios, luego los fijos). */
export function entorno(falsos: Falsos, extra: Record<string, string> = {}): Entorno {
  const limpio = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("INV_") && !k.startsWith("FALSO_") && k !== "DATABASE_URL"),
  );
  return { ...limpio, PATH: `${falsos.bin}:${falsos.fijos}:${process.env.PATH}`, FALSO_REGISTRO: falsos.registro, ...extra };
}

/** Ruta que bash ejecutaría para `nombre` con el PATH de `env` («» si no lo encuentra). */
export function rutaEnPath(env: Entorno, nombre: string): string {
  const r = spawnSync("bash", ["-c", 'command -v "$1"', "bash", nombre], { env: env as NodeJS.ProcessEnv, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
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

/**
 * Configuración no secreta ficticia (`<base>/inv-008.conf`): una sola línea con la carpeta de respaldos, que por
 * defecto queda dentro de la base de prueba (la carpeta se crea). `contenido` reemplaza el archivo entero.
 */
export function confFicticia(base: string, respaldos = path.join(base, "respaldos"), contenido?: string): string {
  mkdirSync(respaldos, { recursive: true });
  const archivo = path.join(base, "inv-008.conf");
  writeFileSync(archivo, contenido ?? `INV_RESPALDOS_DIR=${respaldos}\n`, { mode: 0o644 });
  return archivo;
}

/**
 * Árbol de producción falso: `<raíz>/<clon>/008-2026-INVERSIONES/` con copias de los scripts pedidos (siempre
 * produccion-comun.sh) y, salvo `sinEnv`, el archivo de producción y la configuración ficticios en la raíz.
 * La raíz de producción se deriva de la ubicación del script: así se prueba sin rutas reales.
 */
export function arbolProduccionFalso(opciones: { clon?: string; sinEnv?: boolean; copiar?: string[] } = {}) {
  const raiz = carpetaTemporal("raiz-prod");
  const dir008 = path.join(raiz, opciones.clon ?? "repo", "008-2026-INVERSIONES");
  for (const relativa of ["scripts/produccion-comun.sh", ...(opciones.copiar ?? [])]) {
    mkdirSync(path.dirname(path.join(dir008, relativa)), { recursive: true });
    copyFileSync(ruta008(relativa), path.join(dir008, relativa));
  }
  if (!opciones.sinEnv) envProduccionFicticio(raiz);
  return { raiz, dir008, comun: path.join(dir008, "scripts", "produccion-comun.sh") };
}

/** Archivo de producción ficticio (`.env.inversiones.production`) para el proyecto de prueba, con su configuración. */
export function envProduccionFicticio(base: string, cambios: Record<string, string> = {}, opciones: { sinConf?: boolean } = {}): string {
  const valores: Record<string, string> = {
    INV_POSTGRES_CLAVE: "a".repeat(64),
    INV_DUENO_DATABASE_URL: `postgresql://inv_dueno:${"b".repeat(64)}@inv-008-db:5432/inversiones?schema=public&connection_limit=3`,
    INV_APP_DATABASE_URL: `postgresql://inv_app:${"c".repeat(64)}@inv-008-db:5432/inversiones?schema=public&connection_limit=5`,
    INV_AUTH_SECRET: "ZmljdGljaW8tZmljdGljaW8tZmljdGljaW8tZmljdGljaW8=",
    INV_CIFRADO_CLAVE_ACTIVA: "v1",
    INV_CIFRADO_CLAVE_V1: "ZmljdGljaW8tZmljdGljaW8tZmljdGljaW8tMzI=",
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
  if (!opciones.sinConf) confFicticia(base);
  return archivo;
}
