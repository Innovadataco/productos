// El servicio de precios como proceso, con el bundle real (`npm run build:precios`, mismas banderas; solo cambia
// --outfile): el modo `bucle` sin el secreto NO se cae (queda en espera con latido y sale limpio con SIGTERM), `--ahora`
// con sus salidas, las tareas como procesos hijos del mismo bundle y el buscador fijo instalado como fetch antes de
// cargar cada CLI. Sin red: la base no existe (inv-008-db no resuelve fuera de Docker) y los CLI fallan en Prisma antes
// de pedir nada. Datos inventados.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { comprobar, entornoMinimo } from "../../ayudas/cli";
import { leerClaveValor } from "../../../src/servicio-precios/estado";
import { DIR_008, carpetaTemporal, leer008, ruta008 } from "./falsos";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 });

const CLAVE = "clave-ficticia-4613";
const URL_PRECIOS = `postgresql://inv_precios:${CLAVE}@inv-008-db:5432/inversiones_ficticia_test?connection_limit=2&connect_timeout=3`;
const URL_AJENA = `postgresql://inv_app:${CLAVE}@inv-008-db:5432/inversiones_ficticia_test`;
/** Lo que nunca debe salir en la consola: la URL, su clave y la base. */
const NUNCA = [CLAVE, "postgresql://", "inversiones_ficticia_test"];
// Avisa por stderr cada vez que alguien instala un fetch, con el nombre de la función (buscarFijo o buscarRechazado).
const ESPIA_FETCH = `data:text/javascript,${encodeURIComponent(
  'let actual = globalThis.fetch; Object.defineProperty(globalThis, "fetch", { configurable: true, get() { return actual; }, set(v) { process.stderr.write("FETCH " + (v && v.name) + "\\n"); actual = v; } });',
)}`;

type Salida = { codigo: number | null; senal: NodeJS.Signals | null; stdout: string; stderr: string; texto: string };

let carpeta = "";
let bundle = "";

function lanzar(args: readonly string[], env: NodeJS.ProcessEnv, banderas: readonly string[] = []): { hijo: ChildProcess; fin: Promise<Salida>; salida: () => string } {
  const hijo = spawn(process.execPath, [...banderas, bundle, ...args], { cwd: DIR_008, env });
  let stdout = "";
  let stderr = "";
  hijo.stdout!.on("data", (c: Buffer) => (stdout += c));
  hijo.stderr!.on("data", (c: Buffer) => (stderr += c));
  const reloj = setTimeout(() => hijo.kill("SIGKILL"), 80_000);
  const fin = new Promise<Salida>((ok, mal) => {
    hijo.on("error", mal);
    hijo.on("close", (codigo, senal) => {
      clearTimeout(reloj);
      ok({ codigo, senal, stdout, stderr, texto: `${stdout}${stderr}` });
    });
  });
  return { hijo, fin, salida: () => `${stdout}${stderr}` };
}

const correr = (args: readonly string[], extra: Readonly<Record<string, string>> = {}, banderas: readonly string[] = []): Promise<Salida> =>
  lanzar(args, entornoMinimo(extra), banderas).fin;

beforeAll(async () => {
  const cache = ruta008("node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  carpeta = mkdtempSync(path.join(cache, "servicio-precios-"));
  bundle = path.join(carpeta, "servicio-precios.mjs");
  const script = (JSON.parse(leer008("package.json")) as { scripts: Record<string, string> }).scripts["build:precios"]!;
  const args = script.trim().split(/\s+/).slice(1).map((a) => (a.startsWith("--outfile=") ? `--outfile=${bundle}` : a));
  const r = await new Promise<Salida>((ok) => {
    const h = spawn(ruta008("node_modules/.bin/esbuild"), [...args, "--log-level=warning"], { cwd: DIR_008, env: entornoMinimo({}) });
    let texto = "";
    h.stdout.on("data", (c: Buffer) => (texto += c));
    h.stderr.on("data", (c: Buffer) => (texto += c));
    h.on("close", (codigo) => ok({ codigo, senal: null, stdout: texto, stderr: "", texto }));
  });
  if (r.codigo !== 0) throw new Error(`esbuild falló: ${r.texto}`);
});

afterAll(() => {
  if (carpeta) rmSync(carpeta, { recursive: true, force: true });
});

describe("el uso nombra los modos nuevos", () => {
  it("--ayuda trae bucle y --ahora [--desde AAAA-MM-DD], además de las dos tareas", async () => {
    const s = await correr(["--ayuda"]);
    expect(s.codigo, s.texto).toBe(0);
    expect(s.stdout).toMatch(/^ {2}bucle\b/m);
    expect(s.stdout).toMatch(/^ {2}--ahora \[--desde AAAA-MM-DD\]/m);
    expect(s.stdout).toMatch(/^ {2}precios\b/m);
    expect(s.stdout).toMatch(/^ {2}fondo\b/m);
    expect(s.stdout).toMatch(/^ {2}intradia\b/m);
  });

  it("bucle no lleva argumentos: con uno, sale con 2 y el uso", async () => {
    const s = await correr(["bucle", "--opcion-ficticia"]);
    comprobar({ codigo: s.codigo, texto: s.texto }, 2, "Uso: node servicio-precios.mjs <tarea>", ["--opcion-ficticia"]);
  });
});

describe("--ahora como proceso", () => {
  it("sin el secreto: 64, lo dice y no corre nada (no deja huella de corrida)", async () => {
    const dir = carpetaTemporal("ahora-sin-secreto");
    const s = await correr(["--ahora"], { PRECIOS_ESTADO_DIR: dir });
    comprobar({ codigo: s.codigo, texto: s.texto }, 64, "sin INV_PRECIOS_DATABASE_URL", NUNCA);
    expect(existsSync(path.join(dir, "ultima-corrida"))).toBe(false);
  });

  it("con una credencial ajena (inv_app): 64, sin imprimir la URL ni la clave", async () => {
    const s = await correr(["--ahora"], { PRECIOS_ESTADO_DIR: carpetaTemporal("ahora-ajena"), DATABASE_URL: URL_AJENA });
    comprobar({ codigo: s.codigo, texto: s.texto }, 64, "no es la de inv_precios", NUNCA);
  });

  it("--desde mala: 2 y el uso de --ahora, sin repetirla", async () => {
    const s = await correr(["--ahora", "--desde", "2019-02-30"], { PRECIOS_ESTADO_DIR: carpetaTemporal("ahora-uso"), DATABASE_URL: URL_PRECIOS });
    comprobar({ codigo: s.codigo, texto: s.texto }, 2, "--ahora [--desde AAAA-MM-DD]", [...NUNCA, "2019-02-30"]);
  });

  it("con la credencial de inv_precios y la base inalcanzable: corre precios y fondo como hijos del bundle, cada CLI sale con SU 1, y la huella queda en FALLO", async () => {
    const dir = carpetaTemporal("ahora-fallo");
    const s = await correr(["--ahora", "--desde", "2019-08-23"], { PRECIOS_ESTADO_DIR: dir, DATABASE_URL: URL_PRECIOS });
    comprobar({ codigo: s.codigo, texto: s.texto }, 1, "No se actualizaron los precios: PrismaClientInitializationError", NUNCA);
    expect(s.texto).toContain("No se actualizó el fondo: PrismaClientInitializationError");
    expect(s.texto).toContain("corrida (ahora) terminó: precios → 1 · fondo → 1 · FALLO");
    expect(leerClaveValor(readFileSync(path.join(dir, "ultima-corrida"), "utf8"))).toMatchObject({ formato: "1", modo: "ahora", desde: "2019-08-23", resultado: "FALLO", precios: "1", fondo: "1" });
    expect(existsSync(path.join(dir, "corrida.candado"))).toBe(false);
  });
});

describe("el buscador instalado como fetch", () => {
  it("en las tareas (los hijos): buscarFijo, ANTES de cargar el CLI", async () => {
    const s = await correr(["precios", "--opcion-mala"], { DATABASE_URL: URL_PRECIOS }, ["--import", ESPIA_FETCH]);
    expect(s.codigo, s.texto).toBe(2);
    expect(s.stderr.indexOf("FETCH buscarFijo")).toBeGreaterThanOrEqual(0);
    expect(s.stderr.indexOf("FETCH buscarFijo")).toBeLessThan(s.stderr.indexOf("Argumentos inválidos"));
  });

  it("en el proceso del bucle y de --ahora: buscarRechazado (el padre nunca sale a la red)", async () => {
    const s = await correr(["--ahora"], { PRECIOS_ESTADO_DIR: carpetaTemporal("ahora-fetch") }, ["--import", ESPIA_FETCH]);
    expect(s.codigo, s.texto).toBe(64);
    expect(s.stderr).toContain("FETCH buscarRechazado");
    expect(s.stderr).not.toContain("FETCH buscarFijo");
  });
});

describe("bucle como proceso, sin el secreto", () => {
  it("NO se cae: queda en espera con latido (SIN_SECRETO) y con SIGTERM sale con 0 y deja DETENIDO", async () => {
    const dir = carpetaTemporal("bucle-sin-secreto");
    const p = lanzar(["bucle"], entornoMinimo({ PRECIOS_ESTADO_DIR: dir }));
    const latido = path.join(dir, "bucle");
    await expect.poll(() => (existsSync(latido) ? leerClaveValor(readFileSync(latido, "utf8")).estado : ""), { timeout: 20_000 }).toBe("SIN_SECRETO");
    await new Promise((ok) => setTimeout(ok, 1_237));
    expect(p.hijo.exitCode).toBeNull();
    expect(p.salida()).toContain("sin INV_PRECIOS_DATABASE_URL");
    expect(p.salida()).toContain("la próxima:");
    p.hijo.kill("SIGTERM");
    const s = await p.fin;
    expect(s.codigo, s.texto).toBe(0);
    expect(s.texto).toContain("detenido por SIGTERM");
    expect(leerClaveValor(readFileSync(latido, "utf8"))).toMatchObject({ formato: "1", estado: "DETENIDO" });
  });
});

describe("la tarea intradia (precios cada minuto) como proceso hijo del mismo bundle", () => {
  it("una opción mala sale con 2, sin tocar la base, con el buscador fijo ya instalado", async () => {
    const s = await correr(["intradia", "--opcion-mala"], { DATABASE_URL: URL_PRECIOS }, ["--import", ESPIA_FETCH]);
    expect(s.codigo, s.texto).toBe(2);
    expect(s.stderr).toContain("FETCH buscarFijo");
    expect(s.stderr).toContain("Argumentos inválidos");
  });

  it("con la base inalcanzable el ciclo sale con 1 y dice solo el nombre del error (nunca la URL, la clave ni la base)", async () => {
    const s = await correr(["intradia"], { DATABASE_URL: URL_PRECIOS });
    expect(s.codigo, s.texto).toBe(1);
    expect(s.texto).toContain("No se trajeron los precios intradía: PrismaClientInitializationError");
    for (const dato of NUNCA) expect(s.texto).not.toContain(dato);
  });

  it("--depurar con la base inalcanzable también sale con 1", async () => {
    const s = await correr(["intradia", "--depurar"], { DATABASE_URL: URL_PRECIOS });
    expect(s.codigo, s.texto).toBe(1);
    expect(s.texto).toContain("No se trajeron los precios intradía");
  });

  it("una URL de Yahoo inválida en el entorno no abre nada: la tarea usa la de por omisión (el host de la configuración solo se suma si es válida)", async () => {
    const s = await correr(["intradia", "--opcion-mala"], { DATABASE_URL: URL_PRECIOS, INV_INTRADIA_URL_YAHOO: "http://no-es-https.invalid" });
    expect(s.codigo, s.texto).toBe(2);
  });
});
