// scripts/cargar-prod.sh (en el host): recibe el sobre por stdin y se lo pasa INTACTO al migrador
// (`run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar <comando>`), sin escribir nada en el disco
// del VPS. En argv solo va el comando, de una lista cerrada. Toma los dos candados, respeta la pausa y a PI, y
// usa el sha de estado/sha-actual (nunca el INV_TAG del entorno). Datos inventados.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, leer008, ruta008, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const CARGAR = ruta008("scripts/cargar-prod.sh");
const SHA = "6".repeat(40);
const SOBRE = Buffer.concat([Buffer.from("--email\ndueno@ejemplo.ficticio\n--bytes\n12\n--sha256\nx\n\n"), Buffer.alloc(4000, "\n"), Buffer.from("a,b,c\n1,2,3\n")]).toString("latin1");
const docker = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker");

function preparar(extra: Record<string, string> = {}, opciones: { sinSha?: boolean } = {}) {
  const base = carpetaTemporal("cargar-prod");
  envProduccionFicticio(base);
  mkdirSync(path.join(base, "estado"), { recursive: true });
  if (!opciones.sinSha) writeFileSync(path.join(base, "estado", "sha-actual"), `${SHA}\n`);
  const falsos = crearFalsos(base);
  const recibido = path.join(carpetaTemporal("cargar-recibido"), "stdin.bin");
  const env = entorno(falsos, {
    INV_PROYECTO: "inv-008-prueba",
    INV_BASE: base,
    FALSO_RUN_STDIN: recibido,
    FALSO_RUN_TAGS: path.join(carpetaTemporal("cargar-tags"), "runs.txt"),
    ...extra,
  });
  return { base, falsos, env, recibido };
}

/** Todos los archivos bajo la raíz, con su tamaño (para ver que el host no escribió nada). */
function inventario(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath, e.name))
    .filter((f) => !f.includes(`${path.sep}bin${path.sep}`) && !f.endsWith("registro.txt"))
    .map((f) => `${path.relative(dir, f)}:${statSync(f).size}`)
    .sort();
}

describe("cargar-prod.sh · el sobre pasa intacto al migrador, sin copias en el host", () => {
  for (const comando of ["importar-trii", "importar-plan", "registrar-escision", "lote-escision", "construir-lotes", "importar-certificacion", "importar-precios", "conciliar-certificacion"]) {
    it(`${comando}: run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar ${comando}, con el sobre por stdin`, async () => {
      const { falsos, env, recibido } = preparar();
      const r = await correr(CARGAR, [comando], env, SOBRE);
      expect(r.status, r.stderr).toBe(0);
      const ll = docker(falsos.llamadas());
      expect(ll).toHaveLength(1);
      const run = ll[0]!;
      expect(run.slice(run.indexOf("run"))).toEqual(["run", "--rm", "-T", "--no-deps", "inv-008-migrador", "/usr/local/bin/inv-cargar", comando]);
      expect(createHash("sha256").update(readFileSync(recibido)).digest("hex")).toBe(createHash("sha256").update(Buffer.from(SOBRE, "latin1")).digest("hex"));
    });
  }

  it("el host no escribe nada fuera de los candados (ni el sobre ni un temporal)", async () => {
    const { base, env } = preparar();
    const antes = inventario(base);
    expect((await correr(CARGAR, ["importar-trii"], env, SOBRE)).status).toBe(0);
    const despues = inventario(base).filter((f) => !/^run\/|^var-lock\//.test(f));
    expect(despues).toEqual(antes);
  });

  it("usa el sha de estado/sha-actual e ignora el INV_TAG del entorno", async () => {
    const { env } = preparar({ INV_TAG: "7".repeat(40) });
    expect((await correr(CARGAR, ["construir-lotes"], env, SOBRE)).status).toBe(0);
    expect(readFileSync(env.FALSO_RUN_TAGS!, "utf8")).toMatch(new RegExp(`^run ${SHA} `, "m"));
  });

  for (const rc of ["1", "2", "3"]) {
    it(`devuelve el código de la carga (${rc}) tal cual`, async () => {
      const { env } = preparar({ FALSO_CARGA_RC: rc });
      expect((await correr(CARGAR, ["importar-trii"], env, SOBRE)).status).toBe(Number(rc));
    });
  }

  it("toma el candado propio y el común con PI", async () => {
    const { falsos, env } = preparar();
    await correr(CARGAR, ["construir-lotes"], env, SOBRE);
    expect(falsos.llamadas().filter((l) => l[0] === "flock").map((l) => l.at(-1))).toEqual(["8", "9"]);
  });

  it("pasa la carpeta de respaldos como el centinela: la carga no depende de la configuración", async () => {
    const { base, env } = preparar({ FALSO_ENTORNO: "" });
    const archivoEntorno = path.join(base, "entorno.txt");
    expect((await correr(CARGAR, ["construir-lotes"], { ...env, FALSO_ENTORNO: archivoEntorno }, SOBRE)).status).toBe(0);
    expect(readFileSync(archivoEntorno, "utf8")).toMatch(/^run\t\/nonexistent\//m);
  });
});

describe("cargar-prod.sh · se niega sin tocar Docker", () => {
  const casos: Array<[string, string[], Record<string, string>, (base: string) => void]> = [
    ["sin comando", [], {}, () => undefined],
    ["con un comando fuera de la lista", ["importar-av"], {}, () => undefined],
    ["con parámetros en la línea de comandos (irían al registro y a ps)", ["importar-trii", "--email", "dueno@ejemplo.ficticio"], {}, () => undefined],
    ["con la marca de pausa", ["importar-trii"], {}, (b) => writeFileSync(path.join(b, "estado", "pausado"), "pausa\n")],
    ["con el candado común tomado (PI desplegando)", ["importar-trii"], { FALSO_FLOCK_OCUPADO: "9" }, () => undefined],
    ["con un despliegue de PI a la vista", ["importar-trii"], { FALSO_PS: "bash\n/bin/bash ./scripts/deploy-prod.sh\n" }, () => undefined],
    ["con estado/sha-actual malformado", ["importar-trii"], {}, (b) => writeFileSync(path.join(b, "estado", "sha-actual"), "latest\n")],
  ];
  for (const [nombre, args, extra, romper] of casos) {
    it(nombre, async () => {
      const { base, falsos, env } = preparar(extra);
      romper(base);
      const r = await correr(CARGAR, args, env, SOBRE);
      expect(r.status).not.toBe(0);
      expect(docker(falsos.llamadas())).toEqual([]);
      expect(r.stderr).not.toContain("dueno@ejemplo.ficticio");
    });
  }

  it("sin despliegue registrado no corre", async () => {
    const { falsos, env } = preparar({}, { sinSha: true });
    expect((await correr(CARGAR, ["importar-trii"], env, SOBRE)).status).not.toBe(0);
    expect(docker(falsos.llamadas())).toEqual([]);
  });
});

describe("cargar-prod.sh · forma del script", () => {
  const texto = leer008("scripts/cargar-prod.sh");
  it("guarda la entrada en el descriptor 3 antes de todo y solo el run la recibe", () => {
    expect(texto).toMatch(/exec 3<&0 0<\/dev\/null/);
    expect(texto.match(/<&3/g)).toHaveLength(1);
    expect(texto).toMatch(/"\$\{COMPOSE\[@\]\}" run --rm -T --no-deps inv-008-migrador \/usr\/local\/bin\/inv-cargar "\$1" <&3 3<&-/);
  });

  it("no guarda nada en disco: sin mktemp, tee ni redirecciones a archivos", () => {
    expect(texto).not.toMatch(/\bmktemp\b|\btee\b|>>?\s*"?\$|>\s*\/tmp/);
  });
});
