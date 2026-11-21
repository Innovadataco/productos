// El bundle de precios (`npm run build:precios`): un solo .mjs con los CLI de `precios:actualizar` y de
// `actualizar-fondo`, para el servicio inv-008-precios con la imagen de la app, sin tsx en producción.
// Se construye con las MISMAS banderas de package.json; solo cambia --outfile, a una carpeta temporal bajo
// node_modules/.cache, para que @prisma/client resuelva como en /app de la imagen. Después corre como proceso
// con un entorno mínimo: sin red y con la base inalcanzable (puerto 1). Datos inventados.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { comprobar, entornoMinimo } from "../../ayudas/cli";
import { DIR_008, leer008, ruta008 } from "./falsos";

// Cada prueba lanza node (y la última, Prisma): con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const SALIDA = ".next/precios/servicio-precios.mjs";
const ENTRADA = "scripts/servicio-precios.ts";
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
/** Lo que nunca debe salir en la consola: la URL de la base, su host y su clave. */
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test"];

type Paquete = { scripts: Record<string, string>; dependencies: Record<string, string>; devDependencies: Record<string, string> };
type Lock = { packages: Record<string, { version?: string; dev?: boolean; devDependencies?: Record<string, string> }> };
type Metafile = {
  inputs: Record<string, unknown>;
  outputs: Record<string, { imports: { path: string; kind: string; external?: boolean }[] }>;
};
type Salida = { codigo: number | null; stdout: string; stderr: string; texto: string };

const paquete = JSON.parse(leer008("package.json")) as Paquete;

/** Corre un proceso sin bloquear el hilo de la prueba, desde la raíz de 008 y con el entorno dado. */
function correr(programa: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<Salida> {
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
  });
}

/** Las banderas de `build:precios`: una sola llamada a esbuild, sin comillas ni operadores de shell. */
function banderas(): string[] {
  const script = paquete.scripts["build:precios"];
  if (!script) throw new Error("package.json no tiene el script build:precios");
  if (/[;&|<>$`'"\\]/.test(script)) throw new Error("build:precios debe ser una sola llamada a esbuild, sin shell");
  const [programa, ...args] = script.trim().split(/\s+/);
  if (programa !== "esbuild") throw new Error(`build:precios debe llamar a esbuild (llama a «${programa}»)`);
  return args;
}

let carpeta = "";
let bundle = "";
let construccion: Salida;
let meta: Metafile;
let texto = "";

/** Corre el bundle con node: sin DATABASE_URL salvo que la prueba la pase, y sin NODE_OPTIONS heredadas. */
const servicio = (args: readonly string[], extra: Readonly<Record<string, string>> = {}): Promise<Salida> =>
  correr(process.execPath, [bundle, ...args], entornoMinimo(extra));

describe("esbuild como devDependency", () => {
  it("fijado con la versión exacta 0.28.2 en package.json y en el lockfile, solo de desarrollo", () => {
    const lock = JSON.parse(leer008("package-lock.json")) as Lock;
    expect(paquete.devDependencies.esbuild).toBe("0.28.2");
    expect(paquete.dependencies.esbuild).toBeUndefined();
    expect(lock.packages[""]?.devDependencies?.esbuild).toBe("0.28.2");
    expect(lock.packages["node_modules/esbuild"]).toMatchObject({ version: "0.28.2", dev: true });
  });
});

describe("build:precios · banderas", () => {
  it("empaqueta la entrada en UN archivo ESM para node22, con @prisma/client (y el engine) fuera", () => {
    const args = banderas();
    expect(args[0]).toBe(ENTRADA);
    for (const b of ["--bundle", "--platform=node", "--format=esm", "--target=node22", "--external:@prisma/client", `--outfile=${SALIDA}`]) {
      expect(args).toContain(b);
    }
    // Un solo archivo y solo Prisma afuera: sin splitting, sin --packages=external y sin otros externos.
    expect(args.filter((a) => a.startsWith("--external:"))).toEqual(["--external:@prisma/client"]);
    expect(args.some((a) => a.startsWith("--splitting") || a.startsWith("--packages") || a.startsWith("--outdir"))).toBe(false);
  });
});

// Lo que sigue necesita el bundle construido (con las banderas de arriba).
describe("bundle construido", () => {
  beforeAll(async () => {
    const cache = ruta008("node_modules/.cache");
    mkdirSync(cache, { recursive: true });
    carpeta = mkdtempSync(path.join(cache, "bundle-precios-"));
    bundle = path.join(carpeta, "servicio-precios.mjs");
    const args = banderas().map((a) => (a.startsWith("--outfile=") ? `--outfile=${bundle}` : a));
    const metafile = `--metafile=${path.join(carpeta, "meta.json")}`;
    construccion = await correr(ruta008("node_modules/.bin/esbuild"), [...args, metafile, "--log-level=warning"], entornoMinimo({}));
    if (construccion.codigo !== 0) throw new Error(`esbuild falló: ${construccion.texto}`);
    meta = JSON.parse(readFileSync(path.join(carpeta, "meta.json"), "utf8")) as Metafile;
    texto = readFileSync(bundle, "utf8");
  });

  afterAll(() => {
    if (carpeta) rmSync(carpeta, { recursive: true, force: true });
  });

  describe("build:precios · contenido", () => {
    it("esbuild no deja advertencias", () => {
      expect(construccion.stderr).toBe("");
    });

    it("trae la entrada y los dos CLI, y nada de node_modules (ni tsx ni esbuild)", () => {
      const entradas = Object.keys(meta.inputs);
      expect(entradas).toEqual(expect.arrayContaining([ENTRADA, "scripts/actualizar-precios.ts", "scripts/actualizar-fondo.ts"]));
      expect(entradas.filter((e) => e.includes("node_modules"))).toEqual([]);
    });

    it("solo importa @prisma/client (estático, para que el humo pruebe que resuelve) y módulos node:", () => {
      const imports = Object.values(meta.outputs).flatMap((o) => o.imports);
      expect(imports.every((i) => i.external === true)).toBe(true);
      expect([...new Set(imports.map((i) => i.path))].filter((p) => p !== "@prisma/client" && !p.startsWith("node:"))).toEqual([]);
      expect(imports).toContainEqual(expect.objectContaining({ path: "@prisma/client", kind: "import-statement", external: true }));
    });

    it("el texto no trae tsx, require dinámico, import() suelto ni rutas absolutas de la máquina que lo construyó", () => {
      expect(texto).not.toMatch(/\btsx\b/);
      expect(texto).not.toMatch(/__require|Dynamic require|\brequire\(/);
      expect(texto).not.toMatch(/\bimport\(/);
      for (const ruta of [DIR_008, homedir(), "/Users/", "/private/", "/var/folders/", "/home/", "file://"]) {
        expect(texto, ruta).not.toContain(ruta);
      }
    });
  });

  describe("servicio-precios.mjs como proceso (sin base ni red)", () => {
    it("--ayuda sale con 0, con el uso de las dos tareas por stdout y nada por stderr", async () => {
      const s = await servicio(["--ayuda"]);
      expect(s.codigo, s.texto).toBe(0);
      expect(s.stdout).toContain("Uso: node servicio-precios.mjs <tarea>");
      expect(s.stdout).toMatch(/^ {2}precios\b/m);
      expect(s.stdout).toMatch(/^ {2}fondo\b/m);
      expect(s.stderr).toBe("");
    });

    // [caso, argumentos, lo que llegó y no se repite en la consola]
    for (const [nombre, args, noRepetir] of [
      ["sin tarea", [], []],
      ["con una tarea desconocida", ["tarea-ficticia"], ["tarea-ficticia"]],
      ["con «toString» (clave del prototipo)", ["toString"], ["toString"]],
      ["con «__proto__»", ["__proto__"], ["__proto__"]],
      ["con «constructor»", ["constructor"], ["constructor"]],
      ["con una opción antes de la tarea", ["--opcion-ficticia", "precios"], ["--opcion-ficticia"]],
    ] as const) {
      it(`${nombre}: sale con 2 y su uso por stderr, sin tocar la base ni repetir lo que llegó`, async () => {
        const s = await servicio(args, { DATABASE_URL: INALCANZABLE });
        comprobar(s, 2, "Uso: node servicio-precios.mjs <tarea>", [...NUNCA, ...noRepetir]);
        expect(s.stdout).toBe("");
        expect(s.texto, "un 2 no debe haber intentado la base").not.toContain("PrismaClient");
      });
    }

    it("precios: le pasa las opciones al CLI de precios:actualizar, que rechaza una opción mala con 2 y su mensaje", async () => {
      const s = await servicio(["precios", "--opcion-mala"], { DATABASE_URL: INALCANZABLE });
      comprobar(s, 2, "Argumentos inválidos. Opciones: --desde AAAA-MM-DD --hasta AAAA-MM-DD", NUNCA);
      expect(s.texto).not.toContain("PrismaClient");
    });

    it("fondo: le pasa las opciones al CLI de actualizar-fondo, que rechaza una opción mala con 2 y su código", async () => {
      const s = await servicio(["fondo", "--opcion-mala"], { DATABASE_URL: INALCANZABLE });
      comprobar(s, 2, "argumentos · ARGUMENTOS_INVALIDOS", NUNCA);
      expect(s.texto).not.toContain("PrismaClient");
    });

    it("--ayuda después de la tarea es una opción de la tarea: la rechaza con 2 (está dicho en el uso)", async () => {
      comprobar(await servicio(["precios", "--ayuda"], { DATABASE_URL: INALCANZABLE }), 2, "Argumentos inválidos", NUNCA);
      comprobar(await servicio(["fondo", "--ayuda"], { DATABASE_URL: INALCANZABLE }), 2, "ARGUMENTOS_INVALIDOS", NUNCA);
    });

    it("precios con la base inalcanzable: el CLI llega a Prisma y sale con SU 1, sin imprimir la URL", async () => {
      const s = await servicio(["precios"], { DATABASE_URL: INALCANZABLE });
      comprobar(s, 1, "No se actualizaron los precios: PrismaClientInitializationError", NUNCA);
    });

    it("fondo con la base inalcanzable: el CLI llega a Prisma y sale con SU 1, sin imprimir la URL", async () => {
      const s = await servicio(["fondo"], { DATABASE_URL: INALCANZABLE });
      comprobar(s, 1, "No se actualizó el fondo: PrismaClientInitializationError", NUNCA);
    });
  });
});
