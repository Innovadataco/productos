// Candado de scripts/integracion.mjs: reenvía a vitest SOLO los flags de la cobertura unida (lista blanca) y
// rechaza cualquier otro ANTES de tocar la base (`prisma migrate reset`). Con prisma y vitest falsos en un
// directorio temporal: la prueba nunca toca una base de verdad.
import { spawn } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../../../scripts/integracion.mjs", import.meta.url));
const URL_PRUEBA = "postgresql://ficticio:ficticio@localhost:5438/inversiones_ficticio_test?schema=public";
const BLOB = "node_modules/.cache/cobertura-blobs/integracion.json";
const FLAGS_UNIDA = ["--coverage", "--reporter=default", "--reporter=blob", `--outputFile.blob=${BLOB}`];

type Resultado = { status: number | null; stderr: string; llamadas: string[][] };

const temporales: string[] = [];
afterAll(() => {
  for (const dir of temporales) rmSync(dir, { recursive: true, force: true });
});

/** Copia el script a un directorio temporal con `node_modules/.bin/{prisma,vitest}` falsos que registran cada llamada. */
function preparar(): { dir: string; registro: string } {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "inv-008-integracion-")));
  temporales.push(dir);
  const bin = path.join(dir, "node_modules", ".bin");
  mkdirSync(bin, { recursive: true });
  mkdirSync(path.join(dir, "scripts"));
  copyFileSync(SCRIPT, path.join(dir, "scripts", "integracion.mjs"));
  const registro = path.join(dir, "registro.txt");
  writeFileSync(registro, "");
  for (const nombre of ["prisma", "vitest"]) {
    const falso = path.join(bin, nombre);
    writeFileSync(falso, `#!/usr/bin/env bash\n(IFS=$'\\t'; printf '%s\\n' "${nombre}"$'\\t'"$*") >> "$FALSO_REGISTRO"\n`);
    chmodSync(falso, 0o755);
  }
  return { dir, registro };
}

/** Corre el script sin bloquear el worker de vitest (spawn, no spawnSync). */
function correr(args: string[], url = URL_PRUEBA): Promise<Resultado> {
  const { dir, registro } = preparar();
  // Entorno mínimo (sin DATABASE_URL ni INV_* heredados). El cast: Next exige NODE_ENV en ProcessEnv.
  const env = { PATH: process.env.PATH ?? "", FALSO_REGISTRO: registro, DATABASE_URL_TEST: url } as unknown as NodeJS.ProcessEnv;
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, ["scripts/integracion.mjs", ...args], { cwd: dir, env });
    let stderr = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 30_000);
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.on("close", (status: number | null) => {
      clearTimeout(reloj);
      const llamadas = readFileSync(registro, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split("\t"));
      ok({ status, stderr, llamadas });
    });
  });
}

const RESET = ["prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"];
const VITEST = ["vitest", "run", "--config", "vitest.integracion.config.ts"];

/** Identidad del archivo que se ejecuta (sigue los enlaces): dispositivo e inodo. */
const idArchivo = (ruta: string) => {
  const s = statSync(ruta);
  return `${s.dev}:${s.ino}`;
};

describe("scripts/integracion.mjs · los falsos", () => {
  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila
  // para todo el Mac: con la máquina cargada son segundos por archivo, y un caso con dos falsos nuevos se
  // pasaba del tope de 5 s. Por eso los falsos son un archivo fijo del repo, el mismo en todos los casos.
  it("prisma y vitest son el mismo ejecutable en todos los casos: no se crea uno nuevo por caso", () => {
    const [a, b] = [preparar(), preparar()];
    for (const nombre of ["prisma", "vitest"]) {
      expect(idArchivo(path.join(b.dir, "node_modules", ".bin", nombre)), nombre).toBe(idArchivo(path.join(a.dir, "node_modules", ".bin", nombre)));
    }
  });
});

describe("scripts/integracion.mjs · argumentos", () => {
  it("sin argumentos: reinicia la base de pruebas y corre la integración igual que siempre", async () => {
    const r = await correr([]);
    expect(r.status).toBe(0);
    expect(r.llamadas).toEqual([RESET, VITEST]);
  });

  it("con los flags de la cobertura unida: los reenvía tal cual a vitest, y a prisma no", async () => {
    const r = await correr(FLAGS_UNIDA);
    expect(r.status).toBe(0);
    expect(r.llamadas).toEqual([RESET, [...VITEST, ...FLAGS_UNIDA]]);
  });

  it.each([
    ["--config", ["--config", "vitest.config.ts"]],
    ["--config=", ["--config=vitest.config.ts"]],
    ["--root", ["--root=/"]],
    ["--dir", ["--dir", "tests"]],
    ["un filtro de archivos", ["tests/integracion/plan.test.ts"]],
    ["sub-opciones de coverage (pisos, include, enabled)", ["--coverage.thresholds.lines=0"]],
    ["--coverage=false", ["--coverage=false"]],
    ["un reporter propio (ruta a un módulo)", ["--reporter=./propio.js"]],
    ["otro reporter con nombre", ["--reporter=json"]],
    ["--outputFile sin .blob", ["--outputFile=x.json"]],
    ["un blob fuera del directorio (..)", ["--outputFile.blob=../fuera.json"]],
    ["un blob que sale del directorio de blobs con ..", ["--outputFile.blob=node_modules/.cache/cobertura-blobs/../x.json"]],
    ["un blob con ruta absoluta", ["--outputFile.blob=/tmp/x.json"]],
    ["un blob que no es .json", ["--outputFile.blob=node_modules/.cache/cobertura-blobs/x.txt"]],
    ["un blob .JSON en mayúsculas", ["--outputFile.blob=node_modules/.cache/cobertura-blobs/x.JSON"]],
    ["un blob sobre un archivo del proyecto (package.json)", ["--outputFile.blob=package.json"]],
    ["un blob en otro directorio de caché", ["--outputFile.blob=node_modules/.cache/x.json"]],
    ["un blob con ./ delante", ["--outputFile.blob=./node_modules/.cache/cobertura-blobs/x.json"]],
    ["un blob con un segmento vacío (//)", ["--outputFile.blob=node_modules/.cache/cobertura-blobs//x.json"]],
    ["un blob con un segmento .", ["--outputFile.blob=node_modules/.cache/cobertura-blobs/./x.json"]],
    ["un blob con espacios", ["--outputFile.blob=node_modules/.cache/cobertura-blobs/a b.json"]],
    ["un blob vacío", ["--outputFile.blob="]],
    ["un permitido junto a uno no permitido", ["--coverage", "--root=/"]],
  ])("rechaza %s con exit 1 antes de tocar la base (ni prisma ni vitest)", async (_caso, args) => {
    const r = await correr(args);
    expect(r.status).toBe(1);
    expect(r.llamadas).toEqual([]);
    expect(r.stderr).toMatch(/no permitid/i);
  });

  it("el candado de la base sigue mandando con los flags permitidos: una base que no termina en _test no se toca", async () => {
    const r = await correr(FLAGS_UNIDA, "postgresql://ficticio:ficticio@localhost:5438/inversiones?schema=public");
    expect(r.status).toBe(1);
    expect(r.llamadas).toEqual([]);
  });

  it("y una base que no es local tampoco", async () => {
    const r = await correr(FLAGS_UNIDA, "postgresql://ficticio:ficticio@remoto.ejemplo.invalid:5432/inversiones_test");
    expect(r.status).toBe(1);
    expect(r.llamadas).toEqual([]);
  });
});
