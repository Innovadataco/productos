// La carga sin copias en el VPS, del lado del Mac (scripts/armar-sobre.sh) y del contenedor del migrador
// (docker/migrador/cargar.sh → /usr/local/bin/inv-cargar). El sobre llega por stdin:
//   - una cabecera de EXACTAMENTE 4096 bytes: un argumento por línea, una línea vacía y relleno de líneas vacías;
//     lleva --bytes N y --sha256 H del cuerpo (los consume inv-cargar, no pasan al CLI);
//   - el cuerpo (solo importar-trii e importar-plan).
// inv-cargar comprueba que el contenedor no use swap, deja el cuerpo en un temporal 600 dentro de una carpeta
// 700 del tmpfs, corre el CLI y lo borra siempre (también si el CLI falla o llega una señal). En el argv solo va
// el nombre del comando: los parámetros nunca pasan por la línea de comandos del host.
// Todos los datos son inventados.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, ruta008 } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("docker/migrador/cargar.sh");
const SOBRE = ruta008("scripts/armar-sobre.sh");
const BLOQUE = 4096;
const CORREO = "dueno@ejemplo.ficticio";
const CSV = Buffer.from("Fecha,Especie,Cantidad\n2026-01-02,FICTICIA,10\n", "utf8");

type Salida = { status: number | null; stdout: string; stderr: string };

function ejecutar(programa: string, args: string[], env: NodeJS.ProcessEnv, entrada?: Buffer, alArrancar?: (pid: number) => void): Promise<Salida & { salidaBinaria: Buffer }> {
  return new Promise((ok) => {
    const hijo = spawn(programa, args, { env });
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

/** Un /app falso con un tsx que registra su argv, los permisos del temporal y su sha256, y sale con FALSO_TSX_RC. */
function preparar(opciones: { swap?: string | null } = {}) {
  const dir = carpetaTemporal("cargar");
  const app = path.join(dir, "app");
  const tmp = path.join(dir, "tmp");
  mkdirSync(path.join(app, "node_modules", ".bin"), { recursive: true });
  mkdirSync(tmp);
  const registro = path.join(dir, "tsx.txt");
  const tsx = path.join(app, "node_modules", ".bin", "tsx");
  writeFileSync(
    tsx,
    [
      "#!/usr/bin/env bash",
      'printf "argv" >>"$FALSO_TSX_REGISTRO"; for a in "$@"; do printf "\\t%s" "$a" >>"$FALSO_TSX_REGISTRO"; done; printf "\\n" >>"$FALSO_TSX_REGISTRO"',
      'printf "cwd\\t%s\\n" "$PWD" >>"$FALSO_TSX_REGISTRO"',
      'printf "stdin\\t%s\\n" "$(wc -c | tr -d " ")" >>"$FALSO_TSX_REGISTRO"',
      'for a in "$@"; do case "$a" in */inv-carga.*/*)',
      '  printf "archivo\\t%s\\t%s\\n" "$(ls -l "$a" | cut -c1-10)" "$(ls -ld "$(dirname "$a")" | cut -c1-10)" >>"$FALSO_TSX_REGISTRO"',
      '  if command -v sha256sum >/dev/null 2>&1; then h="$(sha256sum "$a")"; else h="$(shasum -a 256 "$a")"; fi',
      '  printf "sha\\t%s\\n" "${h%% *}" >>"$FALSO_TSX_REGISTRO" ;;',
      "esac; done",
      '[ -z "${FALSO_TSX_DORMIR:-}" ] || { printf "dormido\\n" >>"$FALSO_TSX_REGISTRO"; sleep "$FALSO_TSX_DORMIR"; }',
      'exit "${FALSO_TSX_RC:-0}"',
      "",
    ].join("\n"),
  );
  chmodSync(tsx, 0o755);
  const swap = path.join(dir, "memory.swap.max");
  if (opciones.swap !== null) writeFileSync(swap, `${opciones.swap ?? "0"}\n`);
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    INV_CARGAR_APP: app,
    INV_CARGAR_TMP: tmp,
    INV_CARGAR_SWAP: swap,
    FALSO_TSX_REGISTRO: registro,
  };
  const tsxLlamadas = () => (existsSync(registro) ? readFileSync(registro, "utf8").trim().split("\n").map((l) => l.split("\t")) : []);
  const correrCarga = (comando: string[], sobre: Buffer, extra: NodeJS.ProcessEnv = {}, alArrancar?: (pid: number) => void) =>
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
    ["un archivo vacío", ""],
  ] as const) {
    it(`rechaza una cabecera con ${nombre}, sin escribir nada y sin repetir sus valores`, async () => {
      const r = await armar(cabecera, CSV);
      expect(r.status).not.toBe(0);
      expect(r.salidaBinaria.length).toBe(0);
      expect(r.stderr).not.toContain(CORREO);
    });
  }

  it("se niega a escribir el sobre en una terminal (los datos se verían en pantalla)", () => {
    expect(readFileSync(SOBRE, "utf8")).toMatch(/\[ -t 1 \]/);
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

  it("con TERM a mitad del CLI: reenvía la señal, borra el temporal y sale con 143", async () => {
    const p = preparar();
    let pid = 0;
    const promesa = p.correrCarga(["importar-trii"], conCuerpo(["--email", CORREO], CSV), { FALSO_TSX_DORMIR: "20" }, (n) => (pid = n));
    const inicio = Date.now();
    while (!(existsSync(path.join(p.dir, "tsx.txt")) && readFileSync(path.join(p.dir, "tsx.txt"), "utf8").includes("dormido"))) {
      if (Date.now() - inicio > 15_000) throw new Error("el CLI falso no arrancó");
      await new Promise((ok) => setTimeout(ok, 50));
    }
    process.kill(pid, "SIGTERM");
    const r = await promesa;
    expect(r.status).toBe(143);
    expect(readdirSync(p.tmp)).toEqual([]);
    expect(Date.now() - inicio).toBeLessThan(15_000);
  });
});

describe("inv-cargar · los comandos sin archivo pasan sus argumentos tal cual (los CLI ya son estrictos)", () => {
  for (const [comando, args, cli] of [
    ["registrar-escision", ["--origen", "FICTA", "--destino", "FICTB", "--fecha", "2026-01-02", "--razon", "0.5", "--nota", "por confirmar ñ"], "scripts/registrar-escision.ts"],
    ["lote-escision", ["--destino", "FICTB", "--fecha-evento", "2026-01-02", "--cantidad", "7", "--costo-unitario", "1.5"], "scripts/lote-escision.ts"],
    ["construir-lotes", ["--ensayo"], "scripts/construir-lotes.ts"],
    ["construir-lotes", [], "scripts/construir-lotes.ts"],
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

describe("inv-cargar · se niega sin tocar nada (sale con 2, sin correr el CLI, sin dejar temporales ni repetir valores)", () => {
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
    ["--bytes en un comando sin archivo", ["construir-lotes"], () => sobreManual(["--bytes", "0", "--sha256", sha(Buffer.alloc(0))])],
    ["una cabecera truncada (menos de 4096 bytes)", ["construir-lotes"], () => sobreManual(["--ensayo"], undefined, 100)],
    ["una cabecera sin la línea vacía final", ["construir-lotes"], () => Buffer.alloc(BLOQUE, "x")],
    ["relleno que no es solo líneas vacías", ["construir-lotes"], () => {
      const b = sobreManual(["--ensayo"]);
      b.write("oculto", BLOQUE - 8);
      return b;
    }],
    ["un tabulador en la cabecera", ["registrar-escision"], () => sobreManual(["--nota", "a\tb"])],
    ["una línea de la cabecera de más de 512 caracteres", ["registrar-escision"], () => sobreManual(["--nota", "x".repeat(513)])],
    ["más de 32 líneas de cabecera", ["construir-lotes"], () => sobreManual(Array.from({ length: 33 }, () => "--ensayo"))],
  ];
  for (const [nombre, comando, sobre] of casos) {
    it(nombre, async () => {
      const p = preparar();
      const r = await p.correrCarga(comando, sobre());
      expect(r.status).toBe(2);
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
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/swap/);
      expect(p.tsxLlamadas()).toEqual([]);
      expect(readdirSync(p.tmp)).toEqual([]);
    });
  }
});

describe("inv-cargar · forma del script", () => {
  const texto = readFileSync(CARGAR, "utf8");
  it("sin eval, sin set -x, sin volcados de memoria y sin exec del CLI (el trap tiene que correr)", () => {
    expect(texto).not.toMatch(/\beval\b|set -x|set -o xtrace/);
    expect(texto).toMatch(/^ulimit -c 0$/m);
    expect(texto).not.toMatch(/exec node_modules/);
  });
});
