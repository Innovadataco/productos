// La carga sin copias en el VPS, del lado del Mac (scripts/armar-sobre.sh) y del contenedor del migrador
// (docker/migrador/cargar.sh → /usr/local/bin/inv-cargar). El sobre llega por stdin:
//   - una cabecera de EXACTAMENTE 4096 bytes: un argumento por línea, una línea vacía y relleno de líneas vacías;
//     lleva --bytes N y --sha256 H del cuerpo (los consume inv-cargar, no pasan al CLI);
//   - el cuerpo: importar-trii, importar-plan, importar-certificacion, corregir-corte-certificacion, importar-precios,
//     importar-valores-fondo, importar-series e importar-decretos (cada uno con su tope; docker/migrador/cargar.sh).
// inv-cargar comprueba que el contenedor no use swap, deja el cuerpo en un temporal 600 dentro de una carpeta
// 700 del tmpfs, corre el CLI y lo borra siempre (también si el CLI falla o llega una señal). En el argv solo va
// el nombre del comando: los parámetros nunca pasan por la línea de comandos del host.
// Todos los datos son inventados.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_BYTES as MAX_BYTES_PDF } from "@/importacion/av/pdf/documento";
import { MAX_BYTES_CSV } from "@/precios/csv-cierres";
import { appCargarFalsa, carpetaTemporal, idArchivo, ruta008, TSX_CARGAR_FALSO, type Entorno } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const SOBRE = ruta008("scripts/armar-sobre.sh");
const BLOQUE = 4096;
const CORREO = "dueno@ejemplo.ficticio";
const CSV = Buffer.from("Fecha,Especie,Cantidad\n2026-01-02,FICTICIA,10\n", "utf8");
const CIERRES = Buffer.from("nemotecnico,fecha,cierre,volumen\nFICTA,2024-03-11,1000.5,10\n", "utf8");
const PDF = Buffer.from("%PDF-1.4\n% certificación ficticia\n%%EOF\n", "utf8");

type Salida = { status: number | null; stdout: string; stderr: string };

function ejecutar(programa: string, args: string[], env: Entorno, entrada?: Buffer, alArrancar?: (pid: number) => void): Promise<Salida & { salidaBinaria: Buffer }> {
  return new Promise((ok) => {
    const hijo = spawn(programa, args, { env: env as NodeJS.ProcessEnv });
    const partes: Buffer[] = [];
    let stderr = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), 30_000);
    hijo.stdout.on("data", (c: Buffer) => partes.push(c));
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.stdin.on("error", () => undefined);
    if (alArrancar && hijo.pid) alArrancar(hijo.pid);
    hijo.stdin.end(entrada ?? Buffer.alloc(0));
    hijo.on("close", (status: number | null) => {
      clearTimeout(reloj);
      const salidaBinaria = Buffer.concat(partes);
      ok({ status, stdout: salidaBinaria.toString("utf8"), stderr, salidaBinaria });
    });
  });
}

/** Un /app falso propio de la prueba, con el tsx versionado (falsos-cargar/tsx), que registra su argv, el cwd, los permisos y el sha del temporal. */
function preparar(opciones: { swap?: string | null } = {}) {
  const dir = carpetaTemporal("cargar");
  const app = appCargarFalsa(dir);
  const tmp = path.join(dir, "tmp");
  mkdirSync(tmp);
  const registro = path.join(dir, "tsx.txt");
  const swap = path.join(dir, "memory.swap.max");
  if (opciones.swap !== null) writeFileSync(swap, `${opciones.swap ?? "0"}\n`);
  const env: Entorno = {
    PATH: process.env.PATH,
    INV_CARGAR_APP: app,
    INV_CARGAR_TMP: tmp,
    INV_CARGAR_SWAP: swap,
    FALSO_TSX_REGISTRO: registro,
  };
  const tsxLlamadas = () => (existsSync(registro) ? readFileSync(registro, "utf8").trim().split("\n").map((l) => l.split("\t")) : []);
  const correrCarga = (comando: string[], sobre: Buffer, extra: Entorno = {}, alArrancar?: (pid: number) => void) =>
    ejecutar("sh", [CARGAR, ...comando], { ...env, ...extra }, sobre, alArrancar);
  return { dir, app, tmp, env, tsxLlamadas, correrCarga };
}

/** Sobre armado a mano (para los casos malformados): cabecera rellenada a `largo` bytes y cuerpo. */
function sobreManual(lineas: string[], cuerpo?: Buffer, largo = BLOQUE): Buffer {
  const cabecera = Buffer.from(`${lineas.map((l) => `${l}\n`).join("")}\n`, "utf8");
  const relleno = Buffer.alloc(Math.max(0, largo - cabecera.length), "\n");
  return Buffer.concat([cabecera, relleno, cuerpo ?? Buffer.alloc(0)]);
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const conCuerpo = (args: string[], cuerpo: Buffer, extra: string[] = []) =>
  sobreManual([...args, "--bytes", String(cuerpo.length), "--sha256", sha(cuerpo), ...extra], cuerpo);

/** armar-sobre.sh con una cabecera y (opcional) un archivo del «Mac». */
async function armar(lineasCabecera: string, archivo?: Buffer) {
  const dir = carpetaTemporal("sobre");
  const cabecera = path.join(dir, "cabecera.txt");
  writeFileSync(cabecera, lineasCabecera, { mode: 0o600 });
  const args = [SOBRE, cabecera];
  if (archivo) {
    writeFileSync(path.join(dir, "datos.csv"), archivo);
    args.push(path.join(dir, "datos.csv"));
  }
  return ejecutar("bash", args, { PATH: process.env.PATH });
}

describe("inv-cargar · el tsx falso del /app", () => {
  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo. Por eso el tsx es un archivo fijo del repo
  // (falsos-cargar/tsx), el mismo en todas las pruebas; el /app sí es propio de cada una.
  it("el tsx del /app es el versionado, el mismo archivo en todas las pruebas: no se crea uno nuevo", () => {
    for (const p of [preparar(), preparar()]) expect(idArchivo(path.join(p.app, "node_modules", ".bin", "tsx"))).toBe(idArchivo(TSX_CARGAR_FALSO));
  });
});

describe("armar-sobre.sh · el sobre se arma en el Mac desde un archivo privado", () => {
  it("cabecera de 4096 bytes exactos con los argumentos, --bytes y --sha256, y después el cuerpo tal cual", async () => {
    const r = await armar(`--email\n${CORREO}\n`, CSV);
    expect(r.status, r.stderr).toBe(0);
    expect(r.salidaBinaria.length).toBe(BLOQUE + CSV.length);
    const cabecera = r.salidaBinaria.subarray(0, BLOQUE).toString("utf8");
    expect(cabecera.split("\n\n")[0]!.split("\n")).toEqual(["--email", CORREO, "--bytes", String(CSV.length), "--sha256", sha(CSV)]);
    expect(cabecera.slice(cabecera.indexOf("\n\n") + 2)).toMatch(/^\n*$/);
    expect(r.salidaBinaria.subarray(BLOQUE).equals(CSV)).toBe(true);
  });

  it("sin archivo: solo la cabecera, sin --bytes ni --sha256", async () => {
    const r = await armar("--ensayo\n");
    expect(r.status, r.stderr).toBe(0);
    expect(r.salidaBinaria.length).toBe(BLOQUE);
    expect(r.salidaBinaria.toString("utf8").split("\n\n")[0]).toBe("--ensayo");
  });

  for (const [nombre, cabecera] of [
    ["una línea vacía en medio", `--email\n\n${CORREO}\n`],
    ["un tabulador", `--nota\npor\tconfirmar\n`],
    ["un retorno de carro", `--email\r\n${CORREO}\r\n`],
    ["--bytes (reservado)", "--bytes\n10\n"],
    ["--sha256 (reservado)", `--sha256\n${"a".repeat(64)}\n`],
    ["más de 30 líneas", Array.from({ length: 31 }, () => "--ensayo\n").join("")],
    ["una línea de más de 512 caracteres", `--nota\n${"x".repeat(513)}\n`],
  ] as const) {
    it(`rechaza una cabecera con ${nombre}, sin escribir nada y sin repetir sus valores`, async () => {
      const r = await armar(cabecera, CSV);
      expect(r.status).not.toBe(0);
      expect(r.salidaBinaria.length).toBe(0);
      expect(r.stderr).not.toContain(CORREO);
    });
  }

  it("una cabecera vacía es un comando sin argumentos (construir-lotes)", async () => {
    const r = await armar("");
    expect(r.status, r.stderr).toBe(0);
    expect(r.salidaBinaria.equals(Buffer.alloc(BLOQUE, "\n"))).toBe(true);
  });

  it("se niega a escribir el sobre en una terminal (los datos se verían en pantalla)", () => {
    expect(readFileSync(SOBRE, "utf8")).toMatch(/\[ ! -t 1 \] \|\| morir/);
  });
});

describe("inv-cargar · los comandos con archivo", () => {
  it("importar-trii: el CSV queda en un temporal 600 de una carpeta 700, el CLI recibe --email y la ruta, y el temporal se borra", async () => {
    const p = preparar();
    // Bytes de más al final: el CLI nunca recibe la entrada del sobre (su stdin es /dev/null).
    const r = await p.correrCarga(["importar-trii"], Buffer.concat([conCuerpo(["--email", CORREO], CSV), Buffer.from("COLA\n")]));
    expect(r.status, r.stderr).toBe(0);
    const ll = p.tsxLlamadas();
    const argv = ll.find((l) => l[0] === "argv")!;
    expect(argv.slice(1, 4)).toEqual(["scripts/importar-trii.ts", "--email", CORREO]);
    expect(argv[4]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/trii\.csv$/);
    expect(argv).toHaveLength(5);
    expect(ll.find((l) => l[0] === "archivo")!.slice(1)).toEqual(["-rw-------", "drwx------"]);
    expect(ll.find((l) => l[0] === "sha")![1]).toBe(sha(CSV));
    expect(ll.find((l) => l[0] === "cwd")![1]).toBe(p.app);
    expect(ll.find((l) => l[0] === "stdin")![1]).toBe("0");
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("importar-plan: la ficha va con --ficha <temporal>, más --email y --aplicar", async () => {
    const p = preparar();
    const ficha = Buffer.from("# Ficha ficticia\n- nada real\n", "utf8");
    const r = await p.correrCarga(["importar-plan"], conCuerpo(["--email", CORREO, "--aplicar"], ficha));
    expect(r.status, r.stderr).toBe(0);
    const argv = p.tsxLlamadas().find((l) => l[0] === "argv")!;
    expect(argv[1]).toBe("scripts/importar-plan.ts");
    expect(argv[2]).toBe("--ficha");
    expect(argv[3]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/ficha\.md$/);
    expect(argv.slice(4)).toEqual(["--email", CORREO, "--aplicar"]);
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("importar-plan sin --aplicar (el ensayo) también pasa", async () => {
    const p = preparar();
    const ficha = Buffer.from("# Ficha ficticia\n", "utf8");
    const r = await p.correrCarga(["importar-plan"], conCuerpo(["--email", CORREO], ficha));
    expect(r.status, r.stderr).toBe(0);
    expect(p.tsxLlamadas().find((l) => l[0] === "argv")!.slice(4)).toEqual(["--email", CORREO]);
  });

  it("importar-precios: el CSV de cierres va con --archivo <temporal precios.csv> y nada más (no lleva opciones)", async () => {
    const p = preparar();
    const r = await p.correrCarga(["importar-precios"], conCuerpo([], CIERRES));
    expect(r.status, r.stderr).toBe(0);
    const ll = p.tsxLlamadas();
    const argv = ll.find((l) => l[0] === "argv")!;
    expect(argv.slice(1, 3)).toEqual(["scripts/importar-precios.ts", "--archivo"]);
    expect(argv[3]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/precios\.csv$/);
    expect(argv).toHaveLength(4);
    expect(ll.find((l) => l[0] === "archivo")!.slice(1)).toEqual(["-rw-------", "drwx------"]);
    expect(ll.find((l) => l[0] === "sha")![1]).toBe(sha(CIERRES));
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("importar-precios con el sobre de armar-sobre.sh (cabecera vacía, /dev/null) entra entero", async () => {
    const p = preparar();
    const sobre = await armar("", CIERRES);
    const r = await p.correrCarga(["importar-precios"], sobre.salidaBinaria);
    expect(r.status, r.stderr).toBe(0);
    expect(p.tsxLlamadas().find((l) => l[0] === "sha")![1]).toBe(sha(CIERRES));
  });

  it("importar-certificacion: --email, --fecha-corte y el PDF en el temporal certificacion.pdf (al final, como pide el CLI)", async () => {
    const p = preparar();
    const r = await p.correrCarga(["importar-certificacion"], conCuerpo(["--fecha-corte", "2024-03-12", "--email", CORREO], PDF));
    expect(r.status, r.stderr).toBe(0);
    const ll = p.tsxLlamadas();
    const argv = ll.find((l) => l[0] === "argv")!;
    expect(argv.slice(1, 6)).toEqual(["scripts/importar-certificacion.ts", "--email", CORREO, "--fecha-corte", "2024-03-12"]);
    expect(argv[6]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/certificacion\.pdf$/);
    expect(argv).toHaveLength(7);
    expect(ll.find((l) => l[0] === "sha")![1]).toBe(sha(PDF));
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("importar-certificacion con --fondo (la primera vez, para vincular el fondo)", async () => {
    const p = preparar();
    const r = await p.correrCarga(["importar-certificacion"], conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "--fondo", "5550001"], PDF));
    expect(r.status, r.stderr).toBe(0);
    const argv = p.tsxLlamadas().find((l) => l[0] === "argv")!;
    expect(argv.slice(1, 8)).toEqual(["scripts/importar-certificacion.ts", "--email", CORREO, "--fecha-corte", "2024-03-12", "--fondo", "5550001"]);
    expect(argv[8]).toMatch(/\/certificacion\.pdf$/);
  });

  // Frente certificacion-corte-real: corregir el corte de una certificación ya cargada, con el MISMO PDF en el sobre.
  it("corregir-corte-certificacion: --email, --fecha-corte, --nueva-fecha-corte y el PDF en certificacion.pdf (al final)", async () => {
    const p = preparar();
    const r = await p.correrCarga(["corregir-corte-certificacion"], conCuerpo(["--nueva-fecha-corte", "2027-07-12", "--email", CORREO, "--fecha-corte", "2027-07-13"], PDF));
    expect(r.status, r.stderr).toBe(0);
    const ll = p.tsxLlamadas();
    const argv = ll.find((l) => l[0] === "argv")!;
    expect(argv.slice(1, 8)).toEqual(["scripts/corregir-corte-certificacion.ts", "--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12"]);
    expect(argv[8]).toMatch(/\/inv-carga\.[A-Za-z0-9]+\/certificacion\.pdf$/);
    expect(argv).toHaveLength(9);
    expect(ll.find((l) => l[0] === "sha")![1]).toBe(sha(PDF));
    expect(readdirSync(p.tmp)).toEqual([]);
  });

  it("el sobre de armar-sobre.sh entra entero (Mac → contenedor)", async () => {
    const p = preparar();
    const sobre = await armar(`--email\n${CORREO}\n`, CSV);
    const r = await p.correrCarga(["importar-trii"], sobre.salidaBinaria);
    expect(r.status, r.stderr).toBe(0);
    expect(p.tsxLlamadas().find((l) => l[0] === "sha")![1]).toBe(sha(CSV));
  });

  for (const rc of ["1", "3"]) {
    it(`devuelve el código del CLI (${rc}) y borra el temporal igual`, async () => {
      const p = preparar();
      const r = await p.correrCarga(["importar-trii"], conCuerpo(["--email", CORREO], CSV), { FALSO_TSX_RC: rc });
      expect(r.status).toBe(Number(rc));
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }

  // INT importa aparte: en un sh sin control de trabajos, el hijo en segundo plano nace con INT ignorado, así que
  // reenviarle INT no lo detiene. Al hijo siempre se le manda TERM.
  for (const [senal, codigo] of [["SIGTERM", 143], ["SIGINT", 130], ["SIGHUP", 129]] as const) {
    it(`con ${senal} a mitad del CLI: detiene el CLI, borra el temporal y sale con ${codigo}, sin esperar al CLI`, async () => {
      const p = preparar();
      let pid = 0;
      const promesa = p.correrCarga(["importar-trii"], conCuerpo(["--email", CORREO], CSV), { FALSO_TSX_DORMIR: "20" }, (n) => (pid = n));
      const inicio = Date.now();
      while (!(existsSync(path.join(p.dir, "tsx.txt")) && readFileSync(path.join(p.dir, "tsx.txt"), "utf8").includes("dormido"))) {
        if (Date.now() - inicio > 15_000) throw new Error("el CLI falso no arrancó");
        await new Promise((ok) => setTimeout(ok, 50));
      }
      process.kill(pid, senal);
      const r = await promesa;
      expect(r.status).toBe(codigo);
      expect(readdirSync(p.tmp)).toEqual([]);
      expect(Date.now() - inicio).toBeLessThan(10_000);
    });
  }
});

describe("inv-cargar · los comandos sin archivo pasan sus argumentos tal cual (los CLI ya son estrictos)", () => {
  for (const [comando, args, cli] of [
    ["registrar-escision", ["--origen", "FICTA", "--destino", "FICTB", "--fecha", "2026-01-02", "--razon", "0.5", "--nota", "por confirmar ñ"], "scripts/registrar-escision.ts"],
    ["lote-escision", ["--destino", "FICTB", "--fecha-evento", "2026-01-02", "--cantidad", "7", "--costo-unitario", "1.5"], "scripts/lote-escision.ts"],
    ["construir-lotes", ["--ensayo"], "scripts/construir-lotes.ts"],
    ["construir-lotes", [], "scripts/construir-lotes.ts"],
    ["conciliar-certificacion", ["--fecha-corte", "2024-03-12"], "scripts/conciliar-certificacion.ts"],
  ] as const) {
    it(`${comando} ${args.join(" ") || "(sin argumentos)"}`, async () => {
      const p = preparar();
      const r = await p.correrCarga([comando], sobreManual([...args]));
      expect(r.status, r.stderr).toBe(0);
      expect(p.tsxLlamadas().find((l) => l[0] === "argv")!.slice(1)).toEqual([cli, ...args]);
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }
});

describe("inv-cargar · el borde de la cabecera", () => {
  it("30 argumentos (el tope) pasan; el 31 no", async () => {
    const p = preparar();
    const treinta = Array.from({ length: 30 }, () => "--ensayo");
    expect((await p.correrCarga(["construir-lotes"], sobreManual(treinta))).status).toBe(0);
    expect(p.tsxLlamadas().find((l) => l[0] === "argv")!.slice(1)).toHaveLength(31);
    expect((await preparar().correrCarga(["construir-lotes"], sobreManual([...treinta, "--ensayo"]))).status).toBe(64);
  });

  it("armar-sobre.sh: 30 líneas pasan y entran enteras en inv-cargar", async () => {
    const sobre = await armar(Array.from({ length: 30 }, () => "--ensayo\n").join(""));
    expect(sobre.status, sobre.stderr).toBe(0);
    const p = preparar();
    expect((await p.correrCarga(["construir-lotes"], sobre.salidaBinaria)).status).toBe(0);
  });
});

// 64 (EX_USAGE): distinto de los códigos de los CLI (0 a 3), para que se sepa quién se negó.
describe("inv-cargar · se niega sin tocar nada (sale con 64, sin correr el CLI, sin dejar temporales ni repetir valores)", () => {
  const casos: Array<[string, string[], () => Buffer]> = [
    ["un comando fuera de la lista", ["importar-av"], () => sobreManual([])],
    ["sin comando", [], () => sobreManual([])],
    ["dos argumentos", ["importar-trii", "--email"], () => conCuerpo(["--email", CORREO], CSV)],
    ["importar-trii con --crear-dueno (el dueño lo crea crear-acceso-inicial)", ["importar-trii"], () => conCuerpo(["--email", CORREO, "--crear-dueno"], CSV)],
    ["importar-trii con una posicional (una ruta del contenedor)", ["importar-trii"], () => conCuerpo(["--email", CORREO, "/proc/1/environ"], CSV)],
    ["importar-trii con --email repetido", ["importar-trii"], () => conCuerpo(["--email", CORREO, "--email", CORREO], CSV)],
    ["importar-trii sin --email", ["importar-trii"], () => conCuerpo([], CSV)],
    ["importar-trii con un correo que es una opción", ["importar-trii"], () => conCuerpo(["--email", "--crear-dueno"], CSV)],
    ["importar-trii con un correo sin arroba", ["importar-trii"], () => conCuerpo(["--email", "sin-arroba.ficticio"], CSV)],
    ["importar-trii con un correo con espacio", ["importar-trii"], () => conCuerpo(["--email", "a b@ejemplo.ficticio"], CSV)],
    ["importar-plan con --ficha (la pone el contenedor)", ["importar-plan"], () => conCuerpo(["--email", CORREO, "--ficha", "/x"], CSV)],
    ["importar-plan con --aplicar repetido", ["importar-plan"], () => conCuerpo(["--email", CORREO, "--aplicar", "--aplicar"], CSV)],
    ["un cuerpo sin --bytes ni --sha256", ["importar-trii"], () => sobreManual(["--email", CORREO], CSV)],
    ["un sha256 que no cuadra", ["importar-trii"], () => sobreManual(["--email", CORREO, "--bytes", String(CSV.length), "--sha256", sha(Buffer.from("otro"))], CSV)],
    ["un cuerpo truncado (corte de SSH)", ["importar-trii"], () => sobreManual(["--email", CORREO, "--bytes", String(CSV.length), "--sha256", sha(CSV)], CSV.subarray(0, 10))],
    ["un cuerpo vacío", ["importar-trii"], () => sobreManual(["--email", CORREO, "--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    ["--bytes que no es un entero", ["importar-trii"], () => sobreManual(["--email", CORREO, "--bytes", "1e3", "--sha256", sha(CSV)], CSV)],
    ["un CSV de más de 5 MiB", ["importar-trii"], () => {
      const grande = Buffer.alloc(5 * 1024 * 1024 + 1, "a");
      return sobreManual(["--email", CORREO, "--bytes", String(grande.length), "--sha256", sha(grande)], grande);
    }],
    ["una ficha de más de 256 KiB", ["importar-plan"], () => {
      const grande = Buffer.alloc(256 * 1024 + 1, "a");
      return sobreManual(["--email", CORREO, "--bytes", String(grande.length), "--sha256", sha(grande)], grande);
    }],
    ["un sha256 mal formado", ["importar-trii"], () => sobreManual(["--email", CORREO, "--bytes", String(CSV.length), "--sha256", "zz"], CSV)],
    ["importar-precios con --email (no lleva opciones)", ["importar-precios"], () => conCuerpo(["--email", CORREO], CIERRES)],
    ["importar-precios con --archivo (lo pone el contenedor)", ["importar-precios"], () => conCuerpo(["--archivo", "/proc/1/environ"], CIERRES)],
    ["importar-precios con una posicional", ["importar-precios"], () => conCuerpo(["/proc/1/environ"], CIERRES)],
    ["importar-precios sin --bytes ni --sha256", ["importar-precios"], () => sobreManual([], CIERRES)],
    ["importar-precios con un cuerpo truncado", ["importar-precios"], () => sobreManual(["--bytes", String(CIERRES.length), "--sha256", sha(CIERRES)], CIERRES.subarray(0, 20))],
    [`un CSV de cierres de más de ${MAX_BYTES_CSV} bytes (sin leer el cuerpo)`, ["importar-precios"], () => sobreManual(["--bytes", String(MAX_BYTES_CSV + 1), "--sha256", sha(CIERRES)])],
    ["importar-certificacion sin --email", ["importar-certificacion"], () => conCuerpo(["--fecha-corte", "2024-03-12"], PDF)],
    ["importar-certificacion sin --fecha-corte", ["importar-certificacion"], () => conCuerpo(["--email", CORREO], PDF)],
    ["importar-certificacion con --fecha-corte que no es AAAA-MM-DD", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "12/03/2024"], PDF)],
    ["importar-certificacion con --fecha-corte repetida", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "--fecha-corte", "2024-03-13"], PDF)],
    ["importar-certificacion con una opción como fecha", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "--fondo"], PDF)],
    ["importar-certificacion con un --fondo que no es numérico", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "--fondo", "--x"], PDF)],
    ["importar-certificacion con un --fondo de más de 12 dígitos", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "--fondo", "1234567890123"], PDF)],
    ["importar-certificacion con --fondo repetido", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "--fondo", "1", "--fondo", "2"], PDF)],
    ["importar-certificacion con --aplicar", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "--aplicar"], PDF)],
    ["importar-certificacion con una posicional (una ruta del contenedor)", ["importar-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2024-03-12", "/proc/1/environ"], PDF)],
    [`un PDF de más de ${MAX_BYTES_PDF} bytes (sin leer el cuerpo)`, ["importar-certificacion"], () => sobreManual(["--email", CORREO, "--fecha-corte", "2024-03-12", "--bytes", String(MAX_BYTES_PDF + 1), "--sha256", sha(PDF)])],
    ["corregir-corte-certificacion sin --email", ["corregir-corte-certificacion"], () => conCuerpo(["--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12"], PDF)],
    ["corregir-corte-certificacion sin --fecha-corte", ["corregir-corte-certificacion"], () => conCuerpo(["--email", CORREO, "--nueva-fecha-corte", "2027-07-12"], PDF)],
    ["corregir-corte-certificacion sin --nueva-fecha-corte", ["corregir-corte-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2027-07-13"], PDF)],
    ["corregir-corte-certificacion con una --nueva-fecha-corte que no es AAAA-MM-DD", ["corregir-corte-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "12/07/2027"], PDF)],
    ["corregir-corte-certificacion con --nueva-fecha-corte repetida", ["corregir-corte-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12", "--nueva-fecha-corte", "2027-07-09"], PDF)],
    ["corregir-corte-certificacion con --fondo (el fondo ya está vinculado)", ["corregir-corte-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12", "--fondo", "4613707"], PDF)],
    ["corregir-corte-certificacion con una posicional (una ruta del contenedor)", ["corregir-corte-certificacion"], () => conCuerpo(["--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12", "/proc/1/environ"], PDF)],
    ["corregir-corte-certificacion sin --bytes ni --sha256", ["corregir-corte-certificacion"], () => sobreManual(["--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12"], PDF)],
    [`corregir-corte-certificacion con un PDF de más de ${MAX_BYTES_PDF} bytes`, ["corregir-corte-certificacion"], () => sobreManual(["--email", CORREO, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12", "--bytes", String(MAX_BYTES_PDF + 1), "--sha256", sha(PDF)])],
    ["--bytes en conciliar-certificacion (no lleva archivo)", ["conciliar-certificacion"], () => sobreManual(["--fecha-corte", "2024-03-12", "--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    // security-reviewer BAJO: lista blanca también en el sh (defensa en profundidad; hoy lo frena el CLI).
    ["conciliar-certificacion con otra opción", ["conciliar-certificacion"], () => sobreManual(["--fecha-corte", "2024-03-12", "--archivo", "/proc/1/environ"])],
    ["conciliar-certificacion con una posicional", ["conciliar-certificacion"], () => sobreManual(["--fecha-corte", "2024-03-12", "/proc/1/environ"])],
    ["conciliar-certificacion sin --fecha-corte", ["conciliar-certificacion"], () => sobreManual([])],
    ["conciliar-certificacion con una fecha que no es AAAA-MM-DD", ["conciliar-certificacion"], () => sobreManual(["--fecha-corte", "--email"])],
    ["conciliar-certificacion con --fecha-corte repetida", ["conciliar-certificacion"], () => sobreManual(["--fecha-corte", "2024-03-12", "--fecha-corte", "2024-03-13"])],
    ["--bytes en un comando sin archivo", ["construir-lotes"], () => sobreManual(["--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    ["una cabecera truncada (menos de 4096 bytes)", ["construir-lotes"], () => sobreManual(["--ensayo"], undefined, 100)],
    // Líneas cortas (no caen en el tope de largo): solo falta la línea vacía que cierra la cabecera.
    ["una cabecera sin la línea vacía final", ["construir-lotes"], () => Buffer.from(`${Array.from({ length: 10 }, () => `${"x".repeat(399)}\n`).join("")}${"x".repeat(BLOQUE - 4000)}`)],
    ["relleno que no es solo líneas vacías", ["construir-lotes"], () => {
      const b = sobreManual(["--ensayo"]);
      b.write("oculto", BLOQUE - 8);
      return b;
    }],
    ["un tabulador en la cabecera", ["registrar-escision"], () => sobreManual(["--nota", "a\tb"])],
    ["una línea de la cabecera de más de 512 caracteres", ["registrar-escision"], () => sobreManual(["--nota", "x".repeat(513)])],
    ["más de 30 argumentos en la cabecera", ["construir-lotes"], () => sobreManual(Array.from({ length: 33 }, () => "--ensayo"))],
  ];
  for (const [nombre, comando, sobre] of casos) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.correrCarga(comando, sobre());
      expect(r.status).toBe(64);
      expect(p.tsxLlamadas()).toEqual([]);
      expect(readdirSync(p.tmp)).toEqual([]);
      expect(r.stdout + r.stderr).not.toContain(CORREO);
    });
  }

  for (const [nombre, swap] of [
    ["el contenedor puede usar swap (memory.swap.max ≠ 0)", "max"],
    ["no se puede leer memory.swap.max", null],
  ] as const) {
    it(`${nombre}: no lee la entrada`, async () => {
      const p = preparar({ swap });
      const r = await p.correrCarga(["importar-trii"], conCuerpo(["--email", CORREO], CSV));
      expect(r.status).toBe(64);
      expect(r.stderr).toMatch(/swap/);
      expect(p.tsxLlamadas()).toEqual([]);
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }
});

describe("inv-cargar · un --bytes de más de 10 dígitos (security-reviewer BAJO)", () => {
  it("se niega con «--bytes fuera de rango», sin el ruido de test ni el engañoso «archivo vacío»", async () => {
    const p = preparar();
    const r = await p.correrCarga(["importar-precios"], sobreManual(["--bytes", "1".repeat(23), "--sha256", sha(CIERRES)]));
    expect(r.status).toBe(64);
    expect(r.stderr).toContain("--bytes fuera de rango");
    expect(r.stderr).not.toMatch(/integer|vacío/);
    expect(p.tsxLlamadas()).toEqual([]);
  });
});

describe("inv-cargar · los topes del cuerpo son los de cada CLI (una sola fuente: la constante del CLI)", () => {
  const texto = readFileSync(CARGAR, "utf8");
  const tope = (nombre: string) => Number(new RegExp(`^${nombre}=(\\d+)$`, "m").exec(texto)?.[1]);
  it("TOPE_PRECIOS = MAX_BYTES_CSV (src/precios/csv-cierres.ts) y TOPE_CERTIFICACION = MAX_BYTES del PDF (src/importacion/av)", () => {
    expect(tope("TOPE_PRECIOS")).toBe(MAX_BYTES_CSV);
    expect(tope("TOPE_CERTIFICACION")).toBe(MAX_BYTES_PDF);
  });
});

describe("inv-cargar · forma del script", () => {
  const texto = readFileSync(CARGAR, "utf8");
  it("sin eval, sin set -x, sin volcados de memoria y sin exec del CLI (el trap tiene que correr)", () => {
    expect(texto).not.toMatch(/\beval\b|set -x|set -o xtrace/);
    expect(texto).toMatch(/^ulimit -c 0$/m);
    expect(texto).not.toMatch(/exec node_modules/);
  });
});
