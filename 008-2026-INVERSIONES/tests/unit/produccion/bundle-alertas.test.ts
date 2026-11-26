// El bundle del servicio de las alertas: la entrada scripts/servicio-alertas.ts empaquetada con esbuild con las MISMAS banderas
// del Dockerfile (solo cambia --outfile, a una carpeta temporal bajo node_modules/.cache, para que @prisma/client resuelva como
// en /app de la imagen). Corre como proceso con un entorno mínimo: sin red y sin base. Sin credencial queda EN ESPERA (con
// latido) y sale con 0 al recibir SIGTERM. Datos inventados.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { entornoMinimo } from "../../ayudas/cli";
import { DIR_008, leer008, ruta008 } from "./falsos";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

type Salida = { codigo: number | null; stdout: string; stderr: string; texto: string };

let carpeta = "";
let bundle = "";

function correr(programa: string, args: readonly string[], env: NodeJS.ProcessEnv, alIniciar?: (hijo: ReturnType<typeof spawn>) => void): Promise<Salida> {
  return new Promise((ok, mal) => {
    const hijo = spawn(programa, [...args], { cwd: DIR_008, env });
    let stdout = "";
    let stderr = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 50_000);
    hijo.stdout.on("data", (c: Buffer) => (stdout += c));
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.on("error", mal);
    hijo.on("close", (codigo: number | null) => {
      clearTimeout(reloj);
      ok({ codigo, stdout, stderr, texto: `${stdout}${stderr}` });
    });
    alIniciar?.(hijo);
  });
}

/** Las banderas con que el Dockerfile arma el bundle: la línea de esbuild de su RUN. */
function banderasDelDockerfile(): string[] {
  const linea = /npx esbuild (scripts\/servicio-alertas\.ts [^\n]*)/.exec(leer008("Dockerfile"));
  if (!linea) throw new Error("el Dockerfile no arma el bundle de las alertas");
  return linea[1]!.trim().split(/\s+/);
}

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const cache = ruta008("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  carpeta = mkdtempSync(path.join(cache, "bundle-alertas-"));
  bundle = path.join(carpeta, "servicio-alertas.mjs");
  const args = banderasDelDockerfile().map((a) => (a.startsWith("--outfile=") ? `--outfile=${bundle}` : a));
  const r = await correr(ruta008("node_modules/.bin/esbuild"), [...args, "--log-level=warning"], entornoMinimo({}));
  if (r.codigo !== 0) throw new Error(`esbuild falló: ${r.texto}`);
});

afterAll(() => {
  if (carpeta) rmSync(carpeta, { recursive: true, force: true });
});

const servicio = (args: readonly string[], extra: Readonly<Record<string, string>> = {}, alIniciar?: (h: ReturnType<typeof spawn>) => void): Promise<Salida> =>
  correr(process.execPath, [bundle, ...args], entornoMinimo(extra), alIniciar);

describe("servicio-alertas.mjs como proceso (sin base ni red)", () => {
  it("el bundle no trae tsx ni rutas de la máquina que lo construyó", () => {
    const texto = readFileSync(bundle, "utf8");
    expect(texto).not.toMatch(/\btsx\b/);
    expect(texto).not.toContain(DIR_008);
    expect(texto).not.toContain("/Users/");
  });

  it("--ayuda sale con 0 y su uso por stdout", async () => {
    const s = await servicio(["--ayuda"]);
    expect(s.codigo, s.texto).toBe(0);
    expect(s.stdout).toContain("Uso: node servicio-alertas.mjs");
    expect(s.stdout).toMatch(/^ {2}ahora\b/m);
    expect(s.stderr).toBe("");
  });

  it.each([
    ["sin modo", []],
    ["con un modo desconocido", ["modo-ficticio"]],
    ["con argumentos de más", ["bucle", "otro"]],
  ])("%s: sale con 2 y su uso, sin repetir lo que llegó", async (_n, args) => {
    const s = await servicio(args, { DATABASE_URL: "postgresql://x:clave-ficticia-5120@127.0.0.1:1/x" });
    expect(s.codigo, s.texto).toBe(2);
    expect(s.stderr).toContain("Uso: node servicio-alertas.mjs");
    expect(s.texto).not.toContain("modo-ficticio");
    expect(s.texto).not.toContain("clave-ficticia-5120");
  });

  it("ahora sin la credencial: sale con 1 y lo dice, sin tocar la base ni repetir la URL", async () => {
    const s = await servicio(["ahora"], { DATABASE_URL: "" });
    expect(s.codigo, s.texto).toBe(1);
    expect(s.stdout).toContain("sin INV_ALERTAS_DATABASE_URL");
  });

  it("ahora con la base inalcanzable: sale con 1 (no 0), con «no se evaluó» y el código, sin la URL ni la clave", async () => {
    const s = await servicio(["ahora"], { DATABASE_URL: "postgresql://inv_alertas:clave-ficticia-5120@inv-008-db:5432/inversiones?connection_limit=2&connect_timeout=2" });
    expect(s.codigo, s.texto).toBe(1);
    expect(s.stdout).toContain("no se evaluó");
    expect(s.texto).not.toContain("clave-ficticia-5120");
    expect(s.texto).not.toContain("postgresql://");
  });

  it("ahora con argumentos de más: sale con 2", async () => {
    const s = await servicio(["ahora", "otro"]);
    expect(s.codigo, s.texto).toBe(2);
  });

  it("bucle sin la credencial: queda EN ESPERA (latido SIN_SECRETO), no se cae y sale con 0 con SIGTERM", async () => {
    const estado = mkdtempSync(path.join(carpeta, "estado-"));
    let enviada = false;
    const s = await servicio(["bucle"], { ALERTAS_ESTADO_DIR: estado, DATABASE_URL: "" }, (hijo) => {
      void (async () => {
        for (let i = 0; i < 100 && !existsSync(path.join(estado, "bucle")); i += 1) await esperar(100);
        enviada = true;
        hijo.kill("SIGTERM");
      })();
    });
    expect(enviada).toBe(true);
    expect(s.codigo, s.texto).toBe(0);
    expect(s.stdout).toContain("[alertas]");
    expect(s.stdout).toContain("sin INV_ALERTAS_DATABASE_URL");
    expect(s.stdout).toContain("detenido por SIGTERM");
    expect(readFileSync(path.join(estado, "bucle"), "utf8")).toMatch(/^formato=1\nestado=(SIN_SECRETO|DETENIDO)\n/);
  });

  it("bucle con una credencial ajena: SECRETO_INVALIDO, sin imprimir la URL ni la clave", async () => {
    const estado = mkdtempSync(path.join(carpeta, "estado-"));
    const s = await servicio(["bucle"], { ALERTAS_ESTADO_DIR: estado, DATABASE_URL: "postgresql://inv_app:clave-ficticia-5120@inv-008-db:5432/inversiones?connection_limit=2" }, (hijo) => {
      void (async () => {
        for (let i = 0; i < 100 && !existsSync(path.join(estado, "bucle")); i += 1) await esperar(100);
        hijo.kill("SIGTERM");
      })();
    });
    expect(s.codigo, s.texto).toBe(0);
    expect(s.stdout).toContain("INV_ALERTAS_DATABASE_URL");
    expect(s.texto).not.toContain("clave-ficticia-5120");
    expect(s.texto).not.toContain("postgresql://");
  });
});
