// El fondo por la vía B (produccion.md §11), en inv-cargar (docker/migrador/cargar.sh) y en scripts/cargar-prod.sh:
// - `registrar-fondo` (sin archivo): lista blanca propia; arma el argv de `scripts/actualizar-fondo.ts --registrar` y
//   nunca deja pasar el modo con red (--desde, --hasta), una opción repetida ni un argumento suelto;
// - `importar-valores-fondo` (el CSV de fondo:exportar): sin opciones; el CSV queda en el temporal valores-fondo.csv.
// Se niega con 64 sin correr el CLI, sin temporales y sin repetir valores. Códigos, clases y nombres inventados.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_BYTES_CSV_FONDO } from "@/fondo/csv-valores";
import { appCargarFalsa, carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, idArchivo, ruta008, TSX_CARGAR_FALSO, type Entorno } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const CARGAR_PROD = ruta008("scripts/cargar-prod.sh");
const BLOQUE = 4096;
const CODIGO = "9990001";
const NOMBRE = "Fondo ficticio uno";
const VALORES = Buffer.from("codigo_fic,participacion,fecha,valor_unidad,valor_fondo\n9990001,907,2024-03-11,10000.5,\n", "utf8");

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
  const dir = carpetaTemporal("cargar-fondo");
  const app = appCargarFalsa(dir);
  const tmp = path.join(dir, "tmp");
  mkdirSync(tmp);
  const registro = path.join(dir, "tsx.txt");
  const swap = path.join(dir, "memory.swap.max");
  writeFileSync(swap, "0\n");
  const env: Entorno = { PATH: process.env.PATH, INV_CARGAR_APP: app, INV_CARGAR_TMP: tmp, INV_CARGAR_SWAP: swap, FALSO_TSX_REGISTRO: registro };
  const llamadas = () => (existsSync(registro) ? readFileSync(registro, "utf8").trim().split("\n").map((l) => l.split("\t")) : []);
  const argv = () => llamadas().find((l) => l[0] === "argv")?.slice(1) ?? null;
  const carga = (comando: string, sobre: Buffer, extra: Entorno = {}) => ejecutar("sh", [CARGAR, comando], { ...env, ...extra }, sobre);
  return { app, tmp, llamadas, argv, carga };
}

/** Sobre armado a mano: cabecera de 4096 bytes (los argumentos, una línea vacía y relleno) y el cuerpo. */
function sobre(lineas: readonly string[], cuerpo?: Buffer): Buffer {
  const cabecera = Buffer.from(`${lineas.map((l) => `${l}\n`).join("")}\n`, "utf8");
  return Buffer.concat([cabecera, Buffer.alloc(Math.max(0, BLOQUE - cabecera.length), "\n"), cuerpo ?? Buffer.alloc(0)]);
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const conCuerpo =(args: readonly string[], cuerpo: Buffer) => sobre([...args, "--bytes", String(cuerpo.length), "--sha256", sha(cuerpo)], cuerpo);

describe("inv-cargar · el tsx falso del /app", () => {
  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo. Por eso el tsx es un archivo fijo del repo
  // (falsos-cargar/tsx), el mismo en todas las pruebas; el /app sí es propio de cada una.
  it("el tsx del /app es el versionado, el mismo archivo en todas las pruebas: no se crea uno nuevo", () => {
    for (const p of [preparar(), preparar()]) expect(idArchivo(path.join(p.app, "node_modules", ".bin", "tsx"))).toBe(idArchivo(TSX_CARGAR_FALSO));
  });
});

describe("inv-cargar · registrar-fondo arma el argv de actualizar-fondo --registrar (sin red)", () => {
  for (const [nombre, cabecera, esperado] of [
    ["código y nombre", ["--codigo", CODIGO, "--nombre", NOMBRE], ["--registrar", "--codigo", CODIGO, "--nombre", NOMBRE]],
    ["con la clase, en cualquier orden (el argv sale en orden fijo)", ["--nombre", NOMBRE, "--participacion", "800", "--codigo", CODIGO], ["--registrar", "--codigo", CODIGO, "--participacion", "800", "--nombre", NOMBRE]],
    ["un nombre con tildes y espacios", ["--codigo", "1", "--nombre", "Fondo ficticio ñandú · inmobiliario"], ["--registrar", "--codigo", "1", "--nombre", "Fondo ficticio ñandú · inmobiliario"]],
    ["12 dígitos y una clase de 6", ["--codigo", "123456789012", "--participacion", "123456", "--nombre", NOMBRE], ["--registrar", "--codigo", "123456789012", "--participacion", "123456", "--nombre", NOMBRE]],
    ["un nombre de 200 bytes (el tope del sobre)", ["--codigo", CODIGO, "--nombre", "x".repeat(200)], ["--registrar", "--codigo", CODIGO, "--nombre", "x".repeat(200)]],
    // El tope del sobre es grueso: el CLI (validarRegistroFondo) manda y rechaza más de 120 caracteres con NOMBRE_FORMATO.
    ["un nombre de 121 caracteres llega al CLI, que decide", ["--codigo", CODIGO, "--nombre", "x".repeat(121)], ["--registrar", "--codigo", CODIGO, "--nombre", "x".repeat(121)]],
  ] as const) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.carga("registrar-fondo", sobre(cabecera));
      expect(r.status, r.stderr).toBe(0);
      expect(p.argv()).toEqual(["scripts/actualizar-fondo.ts", ...esperado]);
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }

  it("devuelve el código del CLI (1: el registro se rechazó, p. ej. CLASE_DISTINTA)", async () => {
    const p = preparar();
    expect((await p.carga("registrar-fondo", sobre(["--codigo", CODIGO, "--nombre", NOMBRE]), { FALSO_TSX_RC: "1" })).status).toBe(1);
  });
});

describe("inv-cargar · registrar-fondo se niega con 64 sin correr el CLI ni repetir valores", () => {
  const casos: Array<[string, readonly string[]]> = [
    ["sin argumentos", []],
    ["sin --codigo", ["--nombre", NOMBRE]],
    ["sin --nombre", ["--codigo", CODIGO]],
    ["--codigo sin valor", ["--nombre", NOMBRE, "--codigo"]],
    ["--nombre sin valor", ["--codigo", CODIGO, "--nombre"]],
    ["--participacion sin valor", ["--codigo", CODIGO, "--nombre", NOMBRE, "--participacion"]],
    ["un código que no es numérico", ["--codigo", "99-01", "--nombre", NOMBRE]],
    ["un código de 13 dígitos", ["--codigo", "1234567890123", "--nombre", NOMBRE]],
    ["un código que es una opción", ["--codigo", "--nombre", NOMBRE]],
    ["una clase con letras", ["--codigo", CODIGO, "--participacion", "80a", "--nombre", NOMBRE]],
    ["una clase de 7 dígitos", ["--codigo", CODIGO, "--participacion", "1234567", "--nombre", NOMBRE]],
    ["un nombre que empieza por «-» (el CLI lo tomaría por opción)", ["--codigo", CODIGO, "--nombre", "--desde"]],
    ["un nombre de 201 bytes", ["--codigo", CODIGO, "--nombre", "x".repeat(201)]],
    ["un nombre de 101 «ñ» (202 bytes: se cuentan bytes, no caracteres)", ["--codigo", CODIGO, "--nombre", "ñ".repeat(101)]],
    ["--codigo repetido", ["--codigo", CODIGO, "--codigo", "9990002", "--nombre", NOMBRE]],
    ["--participacion repetida", ["--codigo", CODIGO, "--participacion", "800", "--participacion", "801", "--nombre", NOMBRE]],
    ["--nombre repetido", ["--codigo", CODIGO, "--nombre", NOMBRE, "--nombre", "Otro ficticio"]],
    ["--registrar (lo pone el contenedor)", ["--registrar", "--codigo", CODIGO, "--nombre", NOMBRE]],
    ["--desde (el modo con red no pasa)", ["--codigo", CODIGO, "--nombre", NOMBRE, "--desde", "2024-03-01"]],
    ["--hasta (el modo con red no pasa)", ["--hasta", "2024-03-12"]],
    ["--email (no es de este comando)", ["--codigo", CODIGO, "--nombre", NOMBRE, "--email", "dueno@ejemplo.ficticio"]],
    ["un argumento suelto (una ruta del contenedor)", ["--codigo", CODIGO, "--nombre", NOMBRE, "/proc/1/environ"]],
    ["--codigo=valor en un solo argumento", [`--codigo=${CODIGO}`, "--nombre", NOMBRE]],
  ];
  for (const [nombre, cabecera] of casos) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.carga("registrar-fondo", sobre(cabecera));
      expect(r.status, r.stderr).toBe(64);
      expect(p.llamadas()).toEqual([]);
      expect(readdirSync(p.tmp)).toEqual([]);
      for (const dato of [CODIGO, NOMBRE, "dueno@ejemplo.ficticio"]) expect(r.stdout + r.stderr).not.toContain(dato);
    });
  }

  it("con --bytes y --sha256 (no lleva archivo)", async () => {
    const p = preparar();
    const r = await p.carga("registrar-fondo", conCuerpo(["--codigo", CODIGO, "--nombre", NOMBRE], Buffer.from("x\n")));
    expect(r.status).toBe(64);
    expect(r.stderr).toContain("no lleva archivo");
    expect(p.llamadas()).toEqual([]);
  });
});

describe("inv-cargar · importar-valores-fondo: el CSV en un temporal 600 y --archivo, sin opciones", () => {
  it("el CLI recibe solo --archivo <temporal valores-fondo.csv>, con el sha del Mac, y el temporal se borra", async () => {
    const p = preparar();
    const r = await p.carga("importar-valores-fondo", conCuerpo([], VALORES));
    expect(r.status, r.stderr).toBe(0);
    const argv = p.argv()!;
    expect(argv.slice(0, 2)).toEqual(["scripts/importar-valores-fondo.ts", "--archivo"]);
    expect(argv[2]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/valores-fondo\.csv$/);
    expect(argv).toHaveLength(3);
    expect(p.llamadas().find((l) => l[0] === "archivo")!.slice(1)).toEqual(["-rw-------", "drwx------"]);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(VALORES));
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("devuelve el código del CLI (3: algún fondo sin registrar) y borra el temporal igual", async () => {
    const p = preparar();
    expect((await p.carga("importar-valores-fondo", conCuerpo([], VALORES), { FALSO_TSX_RC: "3" })).status).toBe(3);
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  for (const [nombre, entrada] of [
    ["con --email (no lleva opciones)", () => conCuerpo(["--email", "dueno@ejemplo.ficticio"], VALORES)],
    ["con --archivo (lo pone el contenedor)", () => conCuerpo(["--archivo", "/proc/1/environ"], VALORES)],
    ["con una posicional", () => conCuerpo(["/proc/1/environ"], VALORES)],
    ["sin --bytes ni --sha256", () => sobre([], VALORES)],
    ["con un cuerpo truncado (corte de SSH)", () => sobre(["--bytes", String(VALORES.length), "--sha256", sha(VALORES)], VALORES.subarray(0, 20))],
    ["con un sha256 que no cuadra", () => sobre(["--bytes", String(VALORES.length), "--sha256", sha(Buffer.from("otro"))], VALORES)],
    [`con más de ${MAX_BYTES_CSV_FONDO} bytes (sin leer el cuerpo)`, () => sobre(["--bytes", String(MAX_BYTES_CSV_FONDO + 1), "--sha256", sha(VALORES)])],
  ] as const) {
    it(`se niega ${nombre}: 64 sin correr el CLI`, async () => {
      const p = preparar();
      const r = await p.carga("importar-valores-fondo", entrada());
      expect(r.status, r.stderr).toBe(64);
      expect(p.llamadas()).toEqual([]);
      expect(readdirSync(p.tmp)).toEqual([]);
      expect(r.stdout + r.stderr).not.toContain("dueno@ejemplo.ficticio");
    });
  }

  it("el tope del sobre es el del CLI (una sola fuente: MAX_BYTES_CSV_FONDO de src/fondo/csv-valores.ts)", () => {
    const tope = Number(/^TOPE_VALORES_FONDO=(\d+)$/m.exec(readFileSync(CARGAR, "utf8"))?.[1]);
    expect(tope).toBe(MAX_BYTES_CSV_FONDO);
  });
});

describe("cargar-prod.sh · los comandos del fondo están en la lista cerrada y su sobre pasa intacto", () => {
  const SHA = "6".repeat(40);
  const SOBRE = sobre(["--codigo", CODIGO, "--nombre", NOMBRE]).toString("latin1");

  for (const comando of ["registrar-fondo", "importar-valores-fondo"]) {
    it(`${comando}: run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar ${comando}, con el sobre por stdin`, async () => {
      const base = carpetaTemporal("cargar-prod-fondo");
      envProduccionFicticio(base);
      mkdirSync(path.join(base, "estado"), { recursive: true });
      writeFileSync(path.join(base, "estado", "sha-actual"), `${SHA}\n`);
      const falsos = crearFalsos(base);
      const recibido = path.join(carpetaTemporal("cargar-fondo-recibido"), "stdin.bin");
      const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RUN_STDIN: recibido, FALSO_RUN_TAGS: path.join(carpetaTemporal("cargar-fondo-tags"), "runs.txt") });
      const r = await correr(CARGAR_PROD, [comando], env, SOBRE);
      expect(r.status, r.stderr).toBe(0);
      const run = falsos.llamadas().filter((l) => l[0] === "docker");
      expect(run).toHaveLength(1);
      expect(run[0]!.slice(run[0]!.indexOf("run"))).toEqual(["run", "--rm", "-T", "--no-deps", "inv-008-migrador", "/usr/local/bin/inv-cargar", comando]);
      expect(sha(readFileSync(recibido))).toBe(sha(Buffer.from(SOBRE, "latin1")));
      expect(r.stdout + r.stderr).not.toContain(NOMBRE);
    });
  }
});
