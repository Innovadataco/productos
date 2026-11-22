// Los rendimientos del fondo por la vía B (produccion.md §11), en inv-cargar (docker/migrador/cargar.sh) y en
// scripts/cargar-prod.sh (frente fondo-rendimientos, T5): `registrar-rendimientos-fondo` (el CSV del dueño con los
// rendimientos y su retención) lleva `--email` y `--fondo` obligatorias y `--aplicar` opcional, cada una una vez; sin
// --aplicar, el CLI hace el ensayo. El CSV queda en el temporal rendimientos-fondo.csv (el CLI exige .csv) y el argv
// sale en orden fijo. El código del CLI (0 a 3) pasa tal cual; si inv-cargar se niega, 64 sin correr el CLI, sin
// temporales y sin repetir valores. El tope del sobre es el del CLI (una sola fuente).
// Correo, código del fondo, fechas y cifras inventados (no redondos; 2027).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { leerArgumentosRendimientos } from "@/fondo/rendimientos/argumentos";
import { MAX_BYTES_RENDIMIENTOS } from "@/fondo/rendimientos/csv";
import { appCargarFalsa, carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, idArchivo, ruta008, TSX_CARGAR_FALSO, type Entorno } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const CARGAR_PROD = ruta008("scripts/cargar-prod.sh");
const ARMAR_SOBRE = ruta008("scripts/armar-sobre.sh");
const COMANDO = "registrar-rendimientos-fondo";
const CLI = "scripts/registrar-rendimientos-fondo.ts";
const BLOQUE = 4096;
const CORREO = "dueno-rendimientos@ejemplo.ficticio";
const FONDO = "4613927";
const CSV = Buffer.from("fecha,tipo,valor\n2027-03-17,RENDIMIENTO,48213.3719\n2027-03-17,RETENCION,1748.6233\n", "utf8");
const DATOS = [CORREO, FONDO, "48213.3719", "1748.6233", "2027-03-17"];
const BASE = ["--email", CORREO, "--fondo", FONDO];

type Salida = { status: number | null; stdout: string; stderr: string; salidaBinaria: Buffer };

function ejecutar(programa: string, args: string[], env: Entorno, entrada: Buffer): Promise<Salida> {
  return new Promise((ok) => {
    const hijo = spawn(programa, args, { env: env as NodeJS.ProcessEnv });
    const partes: Buffer[] = [];
    let stderr = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 30_000);
    hijo.stdout.on("data", (c: Buffer) => partes.push(c));
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.stdin.on("error", () => undefined);
    hijo.stdin.end(entrada);
    hijo.on("close", (status: number | null) => {
      clearTimeout(reloj);
      const salidaBinaria = Buffer.concat(partes);
      ok({ status, stdout: salidaBinaria.toString("utf8"), stderr, salidaBinaria });
    });
  });
}

/** Un /app falso propio de la prueba, con el tsx versionado (falsos-cargar/tsx), que registra su argv, el cwd, los permisos y el sha del temporal. */
function preparar() {
  const dir = carpetaTemporal("cargar-rendimientos-fondo");
  const app = appCargarFalsa(dir);
  const tmp = path.join(dir, "tmp");
  mkdirSync(tmp);
  const registro = path.join(dir, "tsx.txt");
  const swap = path.join(dir, "memory.swap.max");
  writeFileSync(swap, "0\n");
  const env: Entorno = { PATH: process.env.PATH, INV_CARGAR_APP: app, INV_CARGAR_TMP: tmp, INV_CARGAR_SWAP: swap, FALSO_TSX_REGISTRO: registro };
  const llamadas = () => (existsSync(registro) ? readFileSync(registro, "utf8").trim().split("\n").map((l) => l.split("\t")) : []);
  const argv = () => llamadas().find((l) => l[0] === "argv")?.slice(1) ?? null;
  const carga = (comando: string, sobreDe: Buffer, extra: Entorno = {}) => ejecutar("sh", [CARGAR, comando], { ...env, ...extra }, sobreDe);
  return { app, tmp, llamadas, argv, carga };
}

/** Sobre armado a mano: cabecera de 4096 bytes (los argumentos, una línea vacía y relleno) y el cuerpo. */
function sobre(lineas: readonly string[], cuerpo?: Buffer): Buffer {
  const cabecera = Buffer.from(`${lineas.map((l) => `${l}\n`).join("")}\n`, "utf8");
  return Buffer.concat([cabecera, Buffer.alloc(Math.max(0, BLOQUE - cabecera.length), "\n"), cuerpo ?? Buffer.alloc(0)]);
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const conCuerpo = (args: readonly string[], cuerpo: Buffer = CSV) => sobre([...args, "--bytes", String(cuerpo.length), "--sha256", sha(cuerpo)], cuerpo);

/** armar-sobre.sh real, con una cabecera y un archivo del «Mac». */
async function armar(lineasCabecera: string, archivo: Buffer): Promise<Buffer> {
  const dir = carpetaTemporal("sobre-rendimientos-fondo");
  const cabecera = path.join(dir, "cabecera.txt");
  writeFileSync(cabecera, lineasCabecera, { mode: 0o600 });
  writeFileSync(path.join(dir, "rendimientos.csv"), archivo);
  const r = await ejecutar("bash", [ARMAR_SOBRE, cabecera, path.join(dir, "rendimientos.csv")], { PATH: process.env.PATH }, Buffer.alloc(0));
  expect(r.status, r.stderr).toBe(0);
  return r.salidaBinaria;
}

/** La negativa: 64, sin CLI, sin temporales, sin «comando no permitido» y sin repetir valores del sobre. */
async function seNiega(entrada: Buffer, datos: readonly string[] = DATOS, comando = COMANDO): Promise<string> {
  const p = preparar();
  const r = await p.carga(comando, entrada);
  expect(r.status, r.stderr).toBe(64);
  expect(r.stderr).not.toContain("comando no permitido");
  expect(p.llamadas()).toEqual([]);
  expect(readdirSync(p.tmp)).toEqual([]);
  for (const dato of datos) expect(r.stdout + r.stderr).not.toContain(dato);
  return r.stderr;
}

describe("inv-cargar · el tsx falso del /app", () => {
  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo. Por eso el tsx es un archivo fijo del repo
  // (falsos-cargar/tsx), el mismo en todas las pruebas; el /app sí es propio de cada una.
  it("el tsx del /app es el versionado, el mismo archivo en todas las pruebas: no se crea uno nuevo", () => {
    for (const p of [preparar(), preparar()]) expect(idArchivo(path.join(p.app, "node_modules", ".bin", "tsx"))).toBe(idArchivo(TSX_CARGAR_FALSO));
  });
});

describe("inv-cargar · registrar-rendimientos-fondo: el CSV en rendimientos-fondo.csv, --email, --fondo y, si viene, --aplicar (orden fijo)", () => {
  for (const [nombre, cabecera, aplicar] of [
    ["ensayo (sin --aplicar)", BASE, false],
    ["con --aplicar", [...BASE, "--aplicar"], true],
    ["en otro orden (el argv sale en orden fijo)", ["--aplicar", "--fondo", FONDO, "--email", CORREO], true],
  ] as const) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.carga(COMANDO, conCuerpo(cabecera));
      expect(r.status, r.stderr).toBe(0);
      const argv = p.argv()!;
      expect(argv.slice(0, 2)).toEqual([CLI, "--archivo"]);
      expect(argv[2]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/rendimientos-fondo\.csv$/);
      expect(argv.slice(3)).toEqual(aplicar ? [...BASE, "--aplicar"] : BASE);
      expect(p.llamadas().find((l) => l[0] === "archivo")!.slice(1)).toEqual(["-rw-------", "drwx------"]);
      expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(CSV));
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }

  for (const aplicar of [false, true]) {
    it(`el argv es el que acepta el lector de argumentos real del CLI (leerArgumentosRendimientos, aplicar: ${aplicar})`, async () => {
      const p = preparar();
      expect((await p.carga(COMANDO, conCuerpo(aplicar ? [...BASE, "--aplicar"] : BASE))).status).toBe(0);
      const argv = p.argv()!;
      expect(leerArgumentosRendimientos(argv.slice(1))).toEqual({ ok: true, archivo: argv[2], email: CORREO, codigoFic: FONDO, aplicar });
    });
  }

  it("con el sobre de armar-sobre.sh (cabecera con --email y --fondo) entra entero", async () => {
    const p = preparar();
    const r = await p.carga(COMANDO, await armar(`--email\n${CORREO}\n--fondo\n${FONDO}\n`, CSV));
    expect(r.status, r.stderr).toBe(0);
    expect(p.argv()!.slice(3)).toEqual(BASE);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(CSV));
  });

  it(`un CSV de exactamente ${MAX_BYTES_RENDIMIENTOS} bytes pasa (el tope es del CLI)`, async () => {
    const p = preparar();
    const grande = Buffer.alloc(MAX_BYTES_RENDIMIENTOS, "\n");
    const r = await p.carga(COMANDO, conCuerpo(BASE, grande));
    expect(r.status, r.stderr).toBe(0);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(grande));
  });

  for (const rc of ["1", "2", "3"]) {
    it(`devuelve el código del CLI (${rc}) tal cual y borra el temporal igual`, async () => {
      const p = preparar();
      expect((await p.carga(COMANDO, conCuerpo([...BASE, "--aplicar"]), { FALSO_TSX_RC: rc })).status).toBe(Number(rc));
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }
});

describe("inv-cargar · registrar-rendimientos-fondo se niega con 64 sin correr el CLI ni repetir valores", () => {
  const OTRO = "otro-dueno@ejemplo.ficticio";
  const casos: Array<[string, () => Buffer]> = [
    ["sin argumentos", () => conCuerpo([])],
    ["sin --email", () => conCuerpo(["--fondo", FONDO])],
    ["sin --fondo", () => conCuerpo(["--email", CORREO, "--aplicar"])],
    ["--fondo sin valor (al final)", () => conCuerpo(["--email", CORREO, "--fondo"])],
    ["--fondo seguido de una opción", () => conCuerpo(["--email", CORREO, "--fondo", "--aplicar"])],
    ["un código de fondo con letras", () => conCuerpo(["--email", CORREO, "--fondo", "46A3927"])],
    ["un código de fondo de 13 dígitos", () => conCuerpo(["--email", CORREO, "--fondo", "4613927461392"])],
    ["un correo sin arroba", () => conCuerpo(["--email", "dueno-sin-arroba.ficticio", "--fondo", FONDO])],
    ["--email repetido", () => conCuerpo([...BASE, "--email", OTRO])],
    ["--fondo repetido", () => conCuerpo([...BASE, "--fondo", "4613928"])],
    ["--aplicar repetido", () => conCuerpo([...BASE, "--aplicar", "--aplicar"])],
    ["--archivo (lo pone el contenedor)", () => conCuerpo([...BASE, "--archivo", "/proc/1/environ"])],
    ["una posicional (una ruta del contenedor)", () => conCuerpo([...BASE, "/proc/1/environ"])],
    ["«--» (fin de opciones)", () => conCuerpo([...BASE, "--"])],
    ["--fondo=valor en un solo argumento", () => conCuerpo(["--email", CORREO, `--fondo=${FONDO}`])],
    ["una opción ajena (--fecha-corte)", () => conCuerpo([...BASE, "--fecha-corte", "2027-03-17"])],
    ["--crear-dueno", () => conCuerpo([...BASE, "--crear-dueno"])],
    ["sin --bytes ni --sha256", () => sobre(BASE, CSV)],
    ["un archivo vacío", () => sobre([...BASE, "--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    ["un cuerpo truncado (corte de SSH)", () => sobre([...BASE, "--bytes", String(CSV.length), "--sha256", sha(CSV)], CSV.subarray(0, 29))],
    ["un sha256 que no cuadra", () => sobre([...BASE, "--bytes", String(CSV.length), "--sha256", sha(Buffer.from("otro ficticio"))], CSV)],
    [`más de ${MAX_BYTES_RENDIMIENTOS} bytes (sin leer el cuerpo)`, () => sobre([...BASE, "--bytes", String(MAX_BYTES_RENDIMIENTOS + 1), "--sha256", sha(CSV)])],
  ];
  for (const [nombre, entrada] of casos) {
    it(nombre, async () => {
      await seNiega(entrada(), [...DATOS, OTRO, "dueno-sin-arroba.ficticio", "46A3927", "4613928"]);
    });
  }

  it("sin --fondo: dice que falta el código del fondo; una opción ajena: dice qué admite", async () => {
    expect(await seNiega(conCuerpo(["--email", CORREO]))).toContain("falta --fondo");
    expect(await seNiega(conCuerpo([...BASE, "--fecha-corte", "2027-03-17"]))).toContain("en registrar-rendimientos-fondo, --fondo y --aplicar");
  });

  it("los demás comandos con archivo no ganan --fondo ni --aplicar por esto", async () => {
    const DECRETOS = Buffer.from("especie,tipo\n", "utf8");
    expect(await seNiega(conCuerpo(["--email", CORREO, "--fondo", FONDO], DECRETOS), [CORREO, FONDO], "importar-decretos")).toContain("opción no permitida para importar-decretos");
    expect(await seNiega(conCuerpo(["--email", CORREO, "--aplicar"], DECRETOS), [CORREO], "importar-trii")).toContain("--aplicar no es una opción de importar-trii");
  });
});

describe("inv-cargar · el tope del sobre es el del CLI (una sola fuente: la constante del CLI)", () => {
  const contenedor = readFileSync(CARGAR, "utf8");

  it("TOPE_RENDIMIENTOS_FONDO = MAX_BYTES_RENDIMIENTOS (src/fondo/rendimientos/csv.ts), con su línea de comando y su temporal", () => {
    expect(Number(/^TOPE_RENDIMIENTOS_FONDO=(\d+)$/m.exec(contenedor)?.[1])).toBe(MAX_BYTES_RENDIMIENTOS);
    expect(contenedor).toMatch(
      /^ {2}registrar-rendimientos-fondo\) cli=scripts\/registrar-rendimientos-fondo\.ts archivo=rendimientos-fondo\.csv tope=\$TOPE_RENDIMIENTOS_FONDO ;;$/m,
    );
  });
});

describe("cargar-prod.sh · registrar-rendimientos-fondo está en la lista cerrada y su sobre pasa intacto", () => {
  const SHA = "6".repeat(40);

  function preparado() {
    const base = carpetaTemporal("cargar-prod-rendimientos");
    envProduccionFicticio(base);
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${SHA}\n`);
    const falsos = crearFalsos(base);
    const recibido = path.join(carpetaTemporal("cargar-rendimientos-recibido"), "stdin.bin");
    const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RUN_STDIN: recibido, FALSO_RUN_TAGS: path.join(carpetaTemporal("cargar-rendimientos-tags"), "runs.txt") });
    return { falsos, recibido, env };
  }

  it(`run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar ${COMANDO}, con el sobre por stdin y sin valores en la consola`, async () => {
    const { falsos, recibido, env } = preparado();
    const SOBRE = conCuerpo([...BASE, "--aplicar"]).toString("latin1");
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
});
