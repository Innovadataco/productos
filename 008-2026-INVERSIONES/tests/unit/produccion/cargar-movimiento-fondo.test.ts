// La constitución del fondo por la vía B (produccion.md §11), en inv-cargar (docker/migrador/cargar.sh) y en
// scripts/cargar-prod.sh: `registrar-movimiento-fondo` (sin archivo) tiene su lista blanca y arma el argv de
// `scripts/registrar-movimiento-fondo.ts` en orden fijo. El sobre solo mira la forma (el CLI manda en la precisión, el
// rango y la fecha) y se niega con 64 sin correr el CLI, sin temporales y sin repetir valores. El código del CLI pasa
// tal cual. Correo, código, fecha y cifras inventados (no redondos; 2027).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appCargarFalsa, carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, idArchivo, ruta008, TSX_CARGAR_FALSO, type Entorno } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const CARGAR_PROD = ruta008("scripts/cargar-prod.sh");
const COMANDO = "registrar-movimiento-fondo";
const BLOQUE = 4096;
const CORREO = "dueno-fondo@ejemplo.ficticio";
const CODIGO = "4613927";
const FECHA = "2027-03-17";
const UNIDADES = "1237.48215";
const MONTO = "5713946.2817";
const DATOS = [CORREO, CODIGO, FECHA, UNIDADES, MONTO, "1237", "5713946"];
const BASE = ["--email", CORREO, "--fondo", CODIGO, "--fecha", FECHA, "--unidades", UNIDADES, "--monto", MONTO];
const CLI = "scripts/registrar-movimiento-fondo.ts";

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

/** Un /app falso propio de la prueba, con el tsx versionado (falsos-cargar/tsx), que registra su argv, el cwd, los permisos y el sha del temporal. */
function preparar() {
  const dir = carpetaTemporal("cargar-movimiento-fondo");
  const app = appCargarFalsa(dir);
  const tmp = path.join(dir, "tmp");
  mkdirSync(tmp);
  const registro = path.join(dir, "tsx.txt");
  const swap = path.join(dir, "memory.swap.max");
  writeFileSync(swap, "0\n");
  const env: Entorno = { PATH: process.env.PATH, INV_CARGAR_APP: app, INV_CARGAR_TMP: tmp, INV_CARGAR_SWAP: swap, FALSO_TSX_REGISTRO: registro };
  const llamadas = () => (existsSync(registro) ? readFileSync(registro, "utf8").trim().split("\n").map((l) => l.split("\t")) : []);
  const argv = () => llamadas().find((l) => l[0] === "argv")?.slice(1) ?? null;
  const carga = (sobreDe: Buffer, extra: Entorno = {}) => ejecutar("sh", [CARGAR, COMANDO], { ...env, ...extra }, sobreDe);
  return { app, tmp, llamadas, argv, carga };
}

/** Sobre armado a mano: cabecera de 4096 bytes (los argumentos, una línea vacía y relleno) y el cuerpo. */
function sobre(lineas: readonly string[], cuerpo?: Buffer): Buffer {
  const cabecera = Buffer.from(`${lineas.map((l) => `${l}\n`).join("")}\n`, "utf8");
  return Buffer.concat([cabecera, Buffer.alloc(Math.max(0, BLOQUE - cabecera.length), "\n"), cuerpo ?? Buffer.alloc(0)]);
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** BASE con una opción cambiada (o quitada con `null`). */
function con(opcion: string, valor: string | null): string[] {
  const i = BASE.indexOf(opcion);
  return valor === null ? [...BASE.slice(0, i), ...BASE.slice(i + 2)] : [...BASE.slice(0, i + 1), valor, ...BASE.slice(i + 2)];
}

describe("inv-cargar · el tsx falso del /app", () => {
  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo. Por eso el tsx es un archivo fijo del repo
  // (falsos-cargar/tsx), el mismo en todas las pruebas; el /app sí es propio de cada una.
  it("el tsx del /app es el versionado, el mismo archivo en todas las pruebas: no se crea uno nuevo", () => {
    for (const p of [preparar(), preparar()]) expect(idArchivo(path.join(p.app, "node_modules", ".bin", "tsx"))).toBe(idArchivo(TSX_CARGAR_FALSO));
  });
});

describe("inv-cargar · registrar-movimiento-fondo arma el argv del CLI en orden fijo", () => {
  for (const [nombre, cabecera, esperado] of [
    ["ensayo (sin --aplicar)", BASE, BASE],
    ["con --aplicar", [...BASE, "--aplicar"], [...BASE, "--aplicar"]],
    ["en otro orden (el argv sale en orden fijo)", ["--aplicar", "--monto", MONTO, "--unidades", UNIDADES, "--fecha", FECHA, "--fondo", CODIGO, "--email", CORREO], [...BASE, "--aplicar"]],
    // El sobre solo mira la forma: la precisión (ceros finales), el rango y el signo los decide el CLI.
    ["unidades con ceros finales de más (el CLI los quita)", con("--unidades", "1237.482150000"), con("--unidades", "1237.482150000")],
    ["unidades 0.0 llegan al CLI, que las rechaza (DEBE_SER_POSITIVO)", con("--unidades", "0.0"), con("--unidades", "0.0")],
    ["un monto sin decimales", con("--monto", "5713946"), con("--monto", "5713946")],
    ["un número de 40 caracteres (el tope del sobre)", con("--monto", `${"7".repeat(20)}.${"3".repeat(19)}`), con("--monto", `${"7".repeat(20)}.${"3".repeat(19)}`)],
  ] as const) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.carga(sobre(cabecera));
      expect(r.status, r.stderr).toBe(0);
      expect(p.argv()).toEqual([CLI, ...esperado]);
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }

  for (const rc of ["1", "2", "3"]) {
    it(`devuelve el código del CLI (${rc}) tal cual`, async () => {
      const p = preparar();
      expect((await p.carga(sobre(BASE), { FALSO_TSX_RC: rc })).status).toBe(Number(rc));
    });
  }
});

describe("inv-cargar · registrar-movimiento-fondo se niega con 64 sin correr el CLI ni repetir valores", () => {
  const casos: Array<[string, readonly string[]]> = [
    ["sin argumentos", []],
    ...(["--email", "--fondo", "--fecha", "--unidades", "--monto"].map((o) => [`sin ${o}`, con(o, null)]) as Array<[string, string[]]>),
    ...(["--email", "--fondo", "--fecha", "--unidades", "--monto"].map((o) => [`${o} sin valor (al final)`, [...con(o, null), o]]) as Array<[string, string[]]>),
    ["un valor que es una opción", ["--email", "--fondo", CODIGO, "--fecha", FECHA, "--unidades", UNIDADES, "--monto", MONTO]],
    ["un correo inválido", con("--email", "dueno-sin-arroba.ficticio")],
    ["un código de fondo con letras", con("--fondo", "46A3927")],
    ["un código de fondo de 13 dígitos", con("--fondo", "4613927461392")],
    ["una fecha con otra forma", con("--fecha", "17/03/2027")],
    ["unidades con coma", con("--unidades", "1237,48215")],
    ["unidades sin parte entera", con("--unidades", ".48215")],
    ["unidades sin decimales tras el punto", con("--unidades", "1237.")],
    ["unidades negativas", con("--unidades", "-1237.48215")],
    ["unidades con exponente", con("--unidades", "1.23748215e3")],
    ["unidades con dos puntos", con("--unidades", "1.237.48215")],
    ["un monto con separador de miles", con("--monto", "5,713,946.2817")],
    ["un monto con signo de pesos", con("--monto", "$5713946.2817")],
    ["un monto de 41 caracteres", con("--monto", `${"7".repeat(20)}.${"3".repeat(20)}`)],
    ["--email repetido", [...BASE, "--email", "otro-dueno@ejemplo.ficticio"]],
    ["--monto repetido", [...BASE, "--monto", "5713946.2818"]],
    ["--aplicar repetido", [...BASE, "--aplicar", "--aplicar"]],
    ["una opción ajena (--tipo)", [...BASE, "--tipo", "APORTE"]],
    ["una opción ajena (--evidencia)", [...BASE, "--evidencia", "extracto"]],
    ["un argumento suelto (una ruta del contenedor)", [...BASE, "/proc/1/environ"]],
    ["--monto=valor en un solo argumento", [...con("--monto", null), `--monto=${MONTO}`]],
  ];
  for (const [nombre, cabecera] of casos) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.carga(sobre(cabecera));
      expect(r.status, r.stderr).toBe(64);
      expect(p.llamadas()).toEqual([]);
      expect(readdirSync(p.tmp)).toEqual([]);
      for (const dato of [...DATOS, "otro-dueno@ejemplo.ficticio", "5713946.2818"]) expect(r.stdout + r.stderr).not.toContain(dato);
    });
  }

  it("con --bytes y --sha256 (no lleva archivo)", async () => {
    const p = preparar();
    const cuerpo = Buffer.from("x\n");
    const r = await p.carga(sobre([...BASE, "--bytes", String(cuerpo.length), "--sha256", sha(cuerpo)], cuerpo));
    expect(r.status).toBe(64);
    expect(r.stderr).toContain("no lleva archivo");
    expect(p.llamadas()).toEqual([]);
  });
});

describe("cargar-prod.sh · registrar-movimiento-fondo está en la lista cerrada y su sobre pasa intacto", () => {
  const SHA = "6".repeat(40);
  const SOBRE = sobre([...BASE, "--aplicar"]).toString("latin1");

  function preparado() {
    const base = carpetaTemporal("cargar-prod-movimiento");
    envProduccionFicticio(base);
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${SHA}\n`);
    const falsos = crearFalsos(base);
    const recibido = path.join(carpetaTemporal("cargar-movimiento-recibido"), "stdin.bin");
    const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RUN_STDIN: recibido, FALSO_RUN_TAGS: path.join(carpetaTemporal("cargar-movimiento-tags"), "runs.txt") });
    return { falsos, recibido, env };
  }

  it(`run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar ${COMANDO}, con el sobre por stdin y sin valores en la consola`, async () => {
    const { falsos, recibido, env } = preparado();
    const r = await correr(CARGAR_PROD, [COMANDO], env, SOBRE);
    expect(r.status, r.stderr).toBe(0);
    const run = falsos.llamadas().filter((l) => l[0] === "docker");
    expect(run).toHaveLength(1);
    expect(run[0]!.slice(run[0]!.indexOf("run"))).toEqual(["run", "--rm", "-T", "--no-deps", "inv-008-migrador", "/usr/local/bin/inv-cargar", COMANDO]);
    expect(sha(readFileSync(recibido))).toBe(sha(Buffer.from(SOBRE, "latin1")));
    for (const dato of DATOS) expect(r.stdout + r.stderr).not.toContain(dato);
  });

  it("el uso de cargar-prod.sh nombra el comando entre los permitidos", async () => {
    const { env } = preparado();
    const r = await correr(CARGAR_PROD, [], env, "");
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain(COMANDO);
  });

  it("los comandos del host son los del contenedor (ninguno sobra ni falta)", () => {
    const prod = readFileSync(CARGAR_PROD, "utf8");
    const delHost = [
      ...(/^COMANDOS_CARGA=\(([^)]*)\)$/m.exec(prod)?.[1] ?? "").split(/\s+/),
      ...[...prod.matchAll(/^COMANDOS_CARGA\+=\(([^)]*)\)$/gm)].flatMap((m) => m[1]!.split(/\s+/)),
    ].filter(Boolean);
    const contenedor = readFileSync(CARGAR, "utf8");
    const delContenedor = [...contenedor.slice(contenedor.indexOf('case "$comando" in')).matchAll(/^ {2}([a-z-]+)\) cli=/gm)].map((m) => m[1]!);
    expect([...delHost].sort()).toEqual([...delContenedor].sort());
    expect(delHost).toContain(COMANDO);
  });
});
