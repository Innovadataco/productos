// Las series oficiales y los decretos por la vía B (produccion.md §11), en inv-cargar (docker/migrador/cargar.sh) y en
// scripts/cargar-prod.sh (fase C, C3):
// - `importar-series` (el CSV canónico de los exportadores del Mac): sin opciones; el CSV queda en el temporal
//   series.csv y el CLI recibe solo `--archivo <temporal>`;
// - `importar-decretos` (el CSV de decretos del dueño): `--email` obligatoria y `--aplicar` opcional, cada una una vez;
//   sin --aplicar, el CLI hace el ensayo. El CSV queda en decretos.csv (el CLI exige .csv) y el argv sale en orden fijo.
// El código del CLI (0 a 3) pasa tal cual; si inv-cargar se niega, 64 sin correr el CLI, sin temporales y sin repetir
// valores. Los topes del sobre son los de cada CLI (una sola fuente). `importar-relevante` no entra (P2 aplazada).
// Correo, especie, fechas y cifras inventados (no redondos; 2027 o antes de 2022).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { leerArgumentosDecretos } from "@/datos-oficiales/decretos/argumentos";
import { ENCABEZADO_DECRETOS, MAX_BYTES_DECRETOS } from "@/datos-oficiales/decretos/csv";
import { leerArgumentosImportarSeries } from "@/datos-oficiales/series/argumentos";
import { ENCABEZADO_CSV_SERIES, MAX_BYTES_CSV_SERIES } from "@/datos-oficiales/series/csv-series";
import { appCargarFalsa, carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, idArchivo, ruta008, TSX_CARGAR_FALSO, type Entorno } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const CARGAR_PROD = ruta008("scripts/cargar-prod.sh");
const ARMAR_SOBRE = ruta008("scripts/armar-sobre.sh");
const BLOQUE = 4096;
const CORREO = "dueno-decretos@ejemplo.ficticio";
const SERIES = Buffer.from(`${ENCABEZADO_CSV_SERIES}\nTRM,2027-02-03,2027-02-05,4719.38,sfc:32sa-8pi3\n`, "utf8");
const DECRETOS = Buffer.from(
  `${ENCABEZADO_DECRETOS.join(",")}\nFICTA,ORDINARIO,2027-03-17,1,413.27,COP,DINERO,2027-04-19,2027-04-23,sfc:ficticio-4613,NO,\n`,
  "utf8",
);
const CLI_SERIES = "scripts/importar-series.ts";
const CLI_DECRETOS = "scripts/importar-decretos.ts";

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
  const dir = carpetaTemporal("cargar-datos-oficiales");
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
const conCuerpo = (args: readonly string[], cuerpo: Buffer) => sobre([...args, "--bytes", String(cuerpo.length), "--sha256", sha(cuerpo)], cuerpo);

/** armar-sobre.sh real, con una cabecera y un archivo del «Mac». */
async function armar(lineasCabecera: string, archivo: Buffer): Promise<Buffer> {
  const dir = carpetaTemporal("sobre-datos-oficiales");
  const cabecera = path.join(dir, "cabecera.txt");
  writeFileSync(cabecera, lineasCabecera, { mode: 0o600 });
  writeFileSync(path.join(dir, "datos.csv"), archivo);
  const r = await ejecutar("bash", [ARMAR_SOBRE, cabecera, path.join(dir, "datos.csv")], { PATH: process.env.PATH }, Buffer.alloc(0));
  expect(r.status, r.stderr).toBe(0);
  return r.salidaBinaria;
}

/**
 * Comprueba la negativa: 64, sin CLI, sin temporales y sin repetir valores del sobre. Si el comando está en la lista,
 * la negativa tiene que venir de su lista blanca, no de «comando no permitido» (así la prueba no pasa sin el comando).
 */
async function seNiega(comando: string, entrada: Buffer, datos: readonly string[], permitido = true): Promise<string> {
  const p = preparar();
  const r = await p.carga(comando, entrada);
  expect(r.status, r.stderr).toBe(64);
  if (permitido) expect(r.stderr).not.toContain("comando no permitido");
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

describe("inv-cargar · importar-series: el CSV en un temporal 600 y --archivo, sin opciones", () => {
  it("el CLI recibe solo --archivo <temporal series.csv>, con el sha del Mac, y el temporal se borra", async () => {
    const p = preparar();
    const r = await p.carga("importar-series", conCuerpo([], SERIES));
    expect(r.status, r.stderr).toBe(0);
    const argv = p.argv()!;
    expect(argv.slice(0, 2)).toEqual([CLI_SERIES, "--archivo"]);
    expect(argv[2]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/series\.csv$/);
    expect(argv).toHaveLength(3);
    expect(p.llamadas().find((l) => l[0] === "archivo")!.slice(1)).toEqual(["-rw-------", "drwx------"]);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(SERIES));
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("el argv es el que acepta el lector de argumentos real del CLI (leerArgumentosImportarSeries)", async () => {
    const p = preparar();
    expect((await p.carga("importar-series", conCuerpo([], SERIES))).status).toBe(0);
    const argv = p.argv()!;
    expect(leerArgumentosImportarSeries(argv.slice(1), {})).toEqual({ archivo: argv[2] });
  });

  it("con el sobre de armar-sobre.sh (cabecera vacía) entra entero", async () => {
    const p = preparar();
    const r = await p.carga("importar-series", await armar("", SERIES));
    expect(r.status, r.stderr).toBe(0);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(SERIES));
  });

  it(`un CSV de exactamente ${MAX_BYTES_CSV_SERIES} bytes pasa (el tope es del CLI)`, async () => {
    const p = preparar();
    const grande = Buffer.alloc(MAX_BYTES_CSV_SERIES, "\n");
    const r = await p.carga("importar-series", conCuerpo([], grande));
    expect(r.status, r.stderr).toBe(0);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(grande));
  });

  for (const rc of ["1", "2", "3"]) {
    it(`devuelve el código del CLI (${rc}) tal cual y borra el temporal igual`, async () => {
      const p = preparar();
      expect((await p.carga("importar-series", conCuerpo([], SERIES), { FALSO_TSX_RC: rc })).status).toBe(Number(rc));
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }
});

describe("inv-cargar · importar-series se niega con 64 sin correr el CLI", () => {
  for (const [nombre, entrada] of [
    ["con --email (no lleva opciones)", () => conCuerpo(["--email", CORREO], SERIES)],
    ["con --archivo (lo pone el contenedor)", () => conCuerpo(["--archivo", "/proc/1/environ"], SERIES)],
    ["con --aplicar (no es de este comando)", () => conCuerpo(["--aplicar"], SERIES)],
    ["con --crear-dueno", () => conCuerpo(["--crear-dueno"], SERIES)],
    ["con una posicional", () => conCuerpo(["/proc/1/environ"], SERIES)],
    ["sin --bytes ni --sha256", () => sobre([], SERIES)],
    ["con un archivo vacío", () => sobre(["--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    ["con un cuerpo truncado (corte de SSH)", () => sobre(["--bytes", String(SERIES.length), "--sha256", sha(SERIES)], SERIES.subarray(0, 23))],
    ["con un sha256 que no cuadra", () => sobre(["--bytes", String(SERIES.length), "--sha256", sha(Buffer.from("otro ficticio"))], SERIES)],
    [`con más de ${MAX_BYTES_CSV_SERIES} bytes (sin leer el cuerpo)`, () => sobre(["--bytes", String(MAX_BYTES_CSV_SERIES + 1), "--sha256", sha(SERIES)])],
  ] as const) {
    it(nombre, async () => {
      await seNiega("importar-series", entrada(), [CORREO]);
    });
  }

  it("con --email: dice que no lleva opciones", async () => {
    expect(await seNiega("importar-series", conCuerpo(["--email", CORREO], SERIES), [CORREO])).toContain("importar-series no lleva opciones");
  });
});

describe("inv-cargar · importar-decretos: el CSV en decretos.csv, --email y, si viene, --aplicar (orden fijo)", () => {
  for (const [nombre, cabecera, aplicar] of [
    ["ensayo (sin --aplicar)", ["--email", CORREO], false],
    ["con --aplicar", ["--email", CORREO, "--aplicar"], true],
    ["en otro orden (el argv sale en orden fijo)", ["--aplicar", "--email", CORREO], true],
  ] as const) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.carga("importar-decretos", conCuerpo(cabecera, DECRETOS));
      expect(r.status, r.stderr).toBe(0);
      const argv = p.argv()!;
      expect(argv.slice(0, 2)).toEqual([CLI_DECRETOS, "--archivo"]);
      expect(argv[2]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/decretos\.csv$/);
      expect(argv.slice(3)).toEqual(aplicar ? ["--email", CORREO, "--aplicar"] : ["--email", CORREO]);
      expect(p.llamadas().find((l) => l[0] === "archivo")!.slice(1)).toEqual(["-rw-------", "drwx------"]);
      expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(DECRETOS));
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }

  for (const aplicar of [false, true]) {
    it(`el argv es el que acepta el lector de argumentos real del CLI (leerArgumentosDecretos, aplicar: ${aplicar})`, async () => {
      const p = preparar();
      const cabecera = aplicar ? ["--email", CORREO, "--aplicar"] : ["--email", CORREO];
      expect((await p.carga("importar-decretos", conCuerpo(cabecera, DECRETOS))).status).toBe(0);
      const argv = p.argv()!;
      expect(leerArgumentosDecretos(argv.slice(1))).toEqual({ ok: true, archivo: argv[2], email: CORREO, aplicar });
    });
  }

  it("con el sobre de armar-sobre.sh (cabecera con --email) entra entero", async () => {
    const p = preparar();
    const r = await p.carga("importar-decretos", await armar(`--email\n${CORREO}\n`, DECRETOS));
    expect(r.status, r.stderr).toBe(0);
    expect(p.argv()!.slice(3)).toEqual(["--email", CORREO]);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(DECRETOS));
  });

  it(`un CSV de exactamente ${MAX_BYTES_DECRETOS} bytes pasa (el tope es del CLI)`, async () => {
    const p = preparar();
    const grande = Buffer.alloc(MAX_BYTES_DECRETOS, "\n");
    const r = await p.carga("importar-decretos", conCuerpo(["--email", CORREO], grande));
    expect(r.status, r.stderr).toBe(0);
    expect(p.llamadas().find((l) => l[0] === "sha")![1]).toBe(sha(grande));
  });

  for (const rc of ["1", "2", "3"]) {
    it(`devuelve el código del CLI (${rc}) tal cual y borra el temporal igual`, async () => {
      const p = preparar();
      expect((await p.carga("importar-decretos", conCuerpo(["--email", CORREO, "--aplicar"], DECRETOS), { FALSO_TSX_RC: rc })).status).toBe(Number(rc));
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }
});

describe("inv-cargar · importar-decretos se niega con 64 sin correr el CLI ni repetir valores", () => {
  const OTRO = "otro-dueno@ejemplo.ficticio";
  const casos: Array<[string, () => Buffer]> = [
    ["sin argumentos (falta --email)", () => conCuerpo([], DECRETOS)],
    ["solo --aplicar (falta --email)", () => conCuerpo(["--aplicar"], DECRETOS)],
    ["--email sin valor (al final)", () => conCuerpo(["--aplicar", "--email"], DECRETOS)],
    ["--email seguido de una opción", () => conCuerpo(["--email", "--aplicar"], DECRETOS)],
    ["un correo sin arroba", () => conCuerpo(["--email", "dueno-sin-arroba.ficticio"], DECRETOS)],
    ["un correo con dos arrobas", () => conCuerpo(["--email", "dueno@@ejemplo.ficticio"], DECRETOS)],
    ["un correo con un espacio", () => conCuerpo(["--email", "dueno decretos@ejemplo.ficticio"], DECRETOS)],
    ["--email repetido", () => conCuerpo(["--email", CORREO, "--email", OTRO], DECRETOS)],
    ["--aplicar repetido", () => conCuerpo(["--email", CORREO, "--aplicar", "--aplicar"], DECRETOS)],
    ["--archivo (lo pone el contenedor)", () => conCuerpo(["--email", CORREO, "--archivo", "/proc/1/environ"], DECRETOS)],
    ["una posicional (una ruta del contenedor)", () => conCuerpo(["--email", CORREO, "/proc/1/environ"], DECRETOS)],
    ["«--» (fin de opciones)", () => conCuerpo(["--email", CORREO, "--"], DECRETOS)],
    ["--email=valor en un solo argumento", () => conCuerpo([`--email=${CORREO}`], DECRETOS)],
    ["--aplicar=1", () => conCuerpo(["--email", CORREO, "--aplicar=1"], DECRETOS)],
    ["una opción ajena (--fecha-corte)", () => conCuerpo(["--email", CORREO, "--fecha-corte", "2027-03-17"], DECRETOS)],
    ["una opción ajena (--fondo)", () => conCuerpo(["--email", CORREO, "--fondo", "4613927"], DECRETOS)],
    ["--crear-dueno", () => conCuerpo(["--email", CORREO, "--crear-dueno"], DECRETOS)],
    ["sin --bytes ni --sha256", () => sobre(["--email", CORREO], DECRETOS)],
    ["un archivo vacío", () => sobre(["--email", CORREO, "--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    ["un cuerpo truncado (corte de SSH)", () => sobre(["--email", CORREO, "--bytes", String(DECRETOS.length), "--sha256", sha(DECRETOS)], DECRETOS.subarray(0, 31))],
    ["un sha256 que no cuadra", () => sobre(["--email", CORREO, "--bytes", String(DECRETOS.length), "--sha256", sha(Buffer.from("otro ficticio"))], DECRETOS)],
    [`más de ${MAX_BYTES_DECRETOS} bytes (sin leer el cuerpo)`, () => sobre(["--email", CORREO, "--bytes", String(MAX_BYTES_DECRETOS + 1), "--sha256", sha(DECRETOS)])],
  ];
  for (const [nombre, entrada] of casos) {
    it(nombre, async () => {
      await seNiega("importar-decretos", entrada(), [CORREO, OTRO, "dueno-sin-arroba.ficticio", "FICTA", "4613927"]);
    });
  }

  it("una opción ajena: el mensaje dice que importar-decretos admite --aplicar", async () => {
    expect(await seNiega("importar-decretos", conCuerpo(["--email", CORREO, "--fondo", "4613927"], DECRETOS), [CORREO])).toContain(
      "en importar-plan e importar-decretos, --aplicar",
    );
  });

  it("sin --email: dice que falta el correo", async () => {
    expect(await seNiega("importar-decretos", conCuerpo(["--aplicar"], DECRETOS), [])).toContain("falta --email");
  });
});

describe("inv-cargar · los topes del sobre son los de cada CLI (una sola fuente: la constante del CLI)", () => {
  const contenedor = readFileSync(CARGAR, "utf8");
  const tope = (nombre: string) => Number(new RegExp(`^${nombre}=(\\d+)$`, "m").exec(contenedor)?.[1]);

  it("TOPE_SERIES = MAX_BYTES_CSV_SERIES (src/datos-oficiales/series/csv-series.ts) y TOPE_DECRETOS = MAX_BYTES_DECRETOS (src/datos-oficiales/decretos/csv.ts)", () => {
    expect(tope("TOPE_SERIES")).toBe(MAX_BYTES_CSV_SERIES);
    expect(tope("TOPE_DECRETOS")).toBe(MAX_BYTES_DECRETOS);
  });

  it("cada comando usa su propio tope y su temporal (no el de otro que valga lo mismo)", () => {
    expect(contenedor).toMatch(/^ {2}importar-series\) cli=scripts\/importar-series\.ts archivo=series\.csv tope=\$TOPE_SERIES ;;$/m);
    expect(contenedor).toMatch(/^ {2}importar-decretos\) cli=scripts\/importar-decretos\.ts archivo=decretos\.csv tope=\$TOPE_DECRETOS ;;$/m);
  });
});

describe("cargar-prod.sh · importar-series e importar-decretos están en la lista cerrada y su sobre pasa intacto", () => {
  const SHA = "6".repeat(40);

  function preparado() {
    const base = carpetaTemporal("cargar-prod-datos-oficiales");
    envProduccionFicticio(base);
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${SHA}\n`);
    const falsos = crearFalsos(base);
    const recibido = path.join(carpetaTemporal("cargar-datos-oficiales-recibido"), "stdin.bin");
    const env = entorno(falsos, {
      INV_PROYECTO: "inv-008-prueba",
      INV_BASE: base,
      FALSO_RUN_STDIN: recibido,
      FALSO_RUN_TAGS: path.join(carpetaTemporal("cargar-datos-oficiales-tags"), "runs.txt"),
    });
    return { falsos, recibido, env };
  }

  for (const [comando, entrada] of [
    ["importar-series", () => conCuerpo([], SERIES)],
    ["importar-decretos", () => conCuerpo(["--email", CORREO, "--aplicar"], DECRETOS)],
  ] as const) {
    it(`${comando}: run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar ${comando}, con el sobre por stdin y sin valores en la consola`, async () => {
      const { falsos, recibido, env } = preparado();
      const SOBRE = entrada().toString("latin1");
      const r = await correr(CARGAR_PROD, [comando], env, SOBRE);
      expect(r.status, r.stderr).toBe(0);
      const run = falsos.llamadas().filter((l) => l[0] === "docker");
      expect(run).toHaveLength(1);
      expect(run[0]!.slice(run[0]!.indexOf("run"))).toEqual(["run", "--rm", "-T", "--no-deps", "inv-008-migrador", "/usr/local/bin/inv-cargar", comando]);
      expect(sha(readFileSync(recibido))).toBe(sha(Buffer.from(SOBRE, "latin1")));
      for (const dato of [CORREO, "FICTA", "4719.38", "413.27"]) expect(r.stdout + r.stderr).not.toContain(dato);
    });
  }

  it("el uso de cargar-prod.sh nombra los dos comandos entre los permitidos", async () => {
    const { env } = preparado();
    const r = await correr(CARGAR_PROD, [], env, "");
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("importar-series");
    expect(r.stdout + r.stderr).toContain("importar-decretos");
  });

  it("importar-relevante no entra (P2 aplazada): cargar-prod.sh lo rechaza con 1 sin llamar a Docker, e inv-cargar con 64", async () => {
    const { falsos, env } = preparado();
    const r = await correr(CARGAR_PROD, ["importar-relevante"], env, "");
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("comando no permitido");
    expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
    expect(await seNiega("importar-relevante", conCuerpo([], SERIES), [], false)).toContain("comando no permitido");
  });

  it("las dos listas (host y contenedor) traen los dos comandos y no importar-relevante", () => {
    const prod = readFileSync(CARGAR_PROD, "utf8");
    const delHost = [
      ...(/^COMANDOS_CARGA=\(([^)]*)\)$/m.exec(prod)?.[1] ?? "").split(/\s+/),
      ...[...prod.matchAll(/^COMANDOS_CARGA\+=\(([^)]*)\)$/gm)].flatMap((m) => m[1]!.split(/\s+/)),
    ].filter(Boolean);
    const contenedor = readFileSync(CARGAR, "utf8");
    const delContenedor = [...contenedor.slice(contenedor.indexOf('case "$comando" in')).matchAll(/^ {2}([a-z-]+)\) cli=/gm)].map((m) => m[1]!);
    for (const lista of [delHost, delContenedor]) {
      expect(lista).toEqual(expect.arrayContaining(["importar-series", "importar-decretos"]));
      expect(lista).not.toContain("importar-relevante");
    }
  });
});
