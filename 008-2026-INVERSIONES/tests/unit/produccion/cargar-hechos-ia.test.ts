// El export de hechos de la IA por la vía B (E7): `exportar-hechos-ia` en inv-cargar (docker/migrador/cargar.sh) y en
// scripts/cargar-prod.sh. Sin archivo y sin opciones (ni --aplicar): el CLI corre con `--conditions=react-server`
// (sus lectores importan "server-only") y su JSON sale por stdout, que ni inv-cargar ni cargar-prod.sh ensucian (sus
// mensajes van a stderr). Los demás comandos corren igual que antes, sin esa condición. Se niega con 64 sin correr el
// CLI. Datos inventados.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appCargarFalsa, carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, ruta008, type Entorno } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const CARGAR_PROD = ruta008("scripts/cargar-prod.sh");
const COMANDO = "exportar-hechos-ia";
const BLOQUE = 4096;

type Salida = { status: number | null; stdout: string; stderr: string };

function ejecutar(programa: string, args: string[], env: Entorno, entrada: Buffer): Promise<Salida> {
  return new Promise((ok) => {
    const hijo = spawn(programa, args, { env: env as NodeJS.ProcessEnv });
    let [stdout, stderr] = ["", ""];
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 30_000);
    hijo.stdout.on("data", (c: Buffer) => (stdout += c));
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.stdin.on("error", () => undefined);
    hijo.stdin.end(entrada);
    hijo.on("close", (status: number | null) => {
      clearTimeout(reloj);
      ok({ status, stdout, stderr });
    });
  });
}

function preparar() {
  const dir = carpetaTemporal("cargar-hechos-ia");
  const app = appCargarFalsa(dir);
  const tmp = path.join(dir, "tmp");
  mkdirSync(tmp);
  const registro = path.join(dir, "tsx.txt");
  const swap = path.join(dir, "memory.swap.max");
  writeFileSync(swap, "0\n");
  const env: Entorno = { PATH: process.env.PATH, INV_CARGAR_APP: app, INV_CARGAR_TMP: tmp, INV_CARGAR_SWAP: swap, FALSO_TSX_REGISTRO: registro };
  const argv = () => (existsSync(registro) ? readFileSync(registro, "utf8").trim().split("\n").map((l) => l.split("\t")).find((l) => l[0] === "argv")?.slice(1) ?? null : null);
  const carga = (comando: string, sobre: Buffer) => ejecutar("sh", [CARGAR, comando], env, sobre);
  return { tmp, argv, carga };
}

function sobre(lineas: readonly string[], cuerpo?: Buffer): Buffer {
  const cabecera = Buffer.from(`${lineas.map((l) => `${l}\n`).join("")}\n`, "utf8");
  return Buffer.concat([cabecera, Buffer.alloc(Math.max(0, BLOQUE - cabecera.length), "\n"), cuerpo ?? Buffer.alloc(0)]);
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("inv-cargar · exportar-hechos-ia", () => {
  it("con el sobre vacío corre el CLI con --conditions=react-server y nada más, y no escribe en stdout", async () => {
    const p = preparar();
    const r = await p.carga(COMANDO, sobre([]));
    expect(r.status, r.stderr).toBe(0);
    expect(p.argv()).toEqual(["--conditions=react-server", "scripts/exportar-hechos-ia.ts"]);
    expect(r.stdout).toBe("");
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  for (const [nombre, lineas, esperado] of [
    ["--aplicar", ["--aplicar"], "exportar-hechos-ia no lleva opciones"],
    ["--email", ["--email", "dueno@ejemplo.ficticio"], "exportar-hechos-ia no lleva opciones"],
    ["un argumento suelto", ["DIARIO"], "exportar-hechos-ia no lleva opciones"],
  ] as const) {
    it(`se niega con 64 a ${nombre}, sin correr el CLI ni repetir valores`, async () => {
      const p = preparar();
      const r = await p.carga(COMANDO, sobre(lineas));
      expect(r.status).toBe(64);
      expect(r.stderr).toContain(esperado);
      expect(r.stderr).not.toContain("dueno@ejemplo.ficticio");
      expect(p.argv()).toBeNull();
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }

  it("se niega con 64 a un archivo (sobran --bytes y --sha256)", async () => {
    const p = preparar();
    const cuerpo = Buffer.from("{}\n");
    const r = await p.carga(COMANDO, sobre(["--bytes", String(cuerpo.length), "--sha256", sha(cuerpo)], cuerpo));
    expect(r.status).toBe(64);
    expect(r.stderr).toContain("no lleva archivo");
    expect(p.argv()).toBeNull();
  });

  it("los demás comandos corren como antes, sin la condición", async () => {
    const p = preparar();
    const r = await p.carga("construir-lotes", sobre(["--ensayo"]));
    expect(r.status, r.stderr).toBe(0);
    expect(p.argv()).toEqual(["scripts/construir-lotes.ts", "--ensayo"]);
  });
});

describe("cargar-prod.sh · exportar-hechos-ia", () => {
  it("está en la lista cerrada, va al migrador por stdin y no ensucia stdout (el JSON es lo único que sale)", async () => {
    const base = carpetaTemporal("cargar-prod-hechos-ia");
    envProduccionFicticio(base);
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${"7".repeat(40)}\n`);
    const falsos = crearFalsos(base);
    const recibido = path.join(carpetaTemporal("cargar-hechos-ia-recibido"), "stdin.bin");
    const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RUN_STDIN: recibido, FALSO_RUN_TAGS: path.join(carpetaTemporal("cargar-hechos-ia-tags"), "runs.txt") });
    const s = sobre([]).toString("latin1");
    const r = await correr(CARGAR_PROD, [COMANDO], env, s);
    expect(r.status, r.stderr).toBe(0);
    const run = falsos.llamadas().filter((l) => l[0] === "docker");
    expect(run).toHaveLength(1);
    expect(run[0]!.slice(run[0]!.indexOf("run"))).toEqual(["run", "--rm", "-T", "--no-deps", "inv-008-migrador", "/usr/local/bin/inv-cargar", COMANDO]);
    expect(sha(readFileSync(recibido))).toBe(sha(Buffer.from(s, "latin1")));
    expect(r.stdout).toBe("");
  });

  it("las listas del host y del contenedor traen el comando", () => {
    const prod = readFileSync(CARGAR_PROD, "utf8");
    const delHost = [...prod.matchAll(/^COMANDOS_CARGA\+?=\(([^)]*)\)$/gm)].flatMap((m) => m[1]!.split(/\s+/));
    const contenedor = readFileSync(CARGAR, "utf8");
    const delContenedor = [...contenedor.slice(contenedor.indexOf('case "$comando" in')).matchAll(/^ {2}([a-z-]+)\) cli=/gm)].map((m) => m[1]!);
    expect(delHost).toContain(COMANDO);
    expect(delContenedor).toContain(COMANDO);
    expect(prod).toContain(`#   registrar-rendimientos-fondo · ${COMANDO}`);
  });
});
