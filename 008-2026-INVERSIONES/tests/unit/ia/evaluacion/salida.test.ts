/**
 * La carpeta de resultados del arnés (E7): absoluta, fuera de todo repo (ningún ancestro con `.git`, por realpath),
 * nunca un enlace, 0700 y del usuario; con los datos del portafolio, tampoco dentro de las raíces prohibidas (el
 * temporal, donde viven los scratchpads). Archivos 0600 abiertos con `wx` (nunca se pisa uno), JSONL con fsync por
 * línea (sobrevive a un corte) y lectura con tope. Todo en carpetas temporales propias de la prueba.
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { abrirCarpeta, ErrorSalida, nombreDeModelo, revisarArchivoPrivado, revisarCarpeta } from "@/ia/evaluacion/salida";

const RAIZ_008 = path.join(__dirname, "..", "..", "..", "..");
const nueva = (): string => mkdtempSync(path.join(tmpdir(), "e7-salida-"));
const modo = (p: string): number => statSync(p).mode & 0o777;

function codigoDe(f: () => unknown): string {
  try {
    f();
    return "SIN_ERROR";
  } catch (e) {
    return e instanceof ErrorSalida ? e.codigo : `OTRO:${String(e)}`;
  }
}

describe("abrirCarpeta", () => {
  it("crea la carpeta 0700 si no existe (con el padre existente)", () => {
    const ruta = path.join(nueva(), "resultados");
    const c = abrirCarpeta(ruta, { raicesProhibidas: [] });
    expect(c.ruta).toBe(ruta);
    expect(modo(ruta)).toBe(0o700);
  });

  it("acepta una carpeta propia 0700 que ya existe; con otros permisos, no", () => {
    const ruta = nueva();
    chmodSync(ruta, 0o700);
    expect(codigoDe(() => abrirCarpeta(ruta, { raicesProhibidas: [] }))).toBe("SIN_ERROR");
    chmodSync(ruta, 0o755);
    expect(codigoDe(() => abrirCarpeta(ruta, { raicesProhibidas: [] }))).toBe("PERMISOS_ABIERTOS");
  });

  it("rechaza una ruta relativa, un padre que no existe, un archivo y un enlace", () => {
    const base = nueva();
    writeFileSync(path.join(base, "archivo"), "x");
    mkdirSync(path.join(base, "real"), { mode: 0o700 });
    symlinkSync(path.join(base, "real"), path.join(base, "enlace"));
    expect(codigoDe(() => abrirCarpeta("resultados/e7", { raicesProhibidas: [] }))).toBe("RUTA_RELATIVA");
    expect(codigoDe(() => abrirCarpeta(path.join(base, "no", "existe"), { raicesProhibidas: [] }))).toBe("PADRE_INEXISTENTE");
    expect(codigoDe(() => abrirCarpeta(path.join(base, "archivo"), { raicesProhibidas: [] }))).toBe("NO_ES_CARPETA");
    expect(codigoDe(() => abrirCarpeta(path.join(base, "enlace"), { raicesProhibidas: [] }))).toBe("ES_ENLACE");
  });

  it("rechaza cualquier carpeta dentro de un repo: un .git carpeta, un .git archivo (worktree) y este mismo repo", () => {
    const repo = nueva();
    mkdirSync(path.join(repo, ".git"));
    mkdirSync(path.join(repo, "sub"));
    const worktree = nueva();
    writeFileSync(path.join(worktree, ".git"), "gitdir: /otra/parte\n");
    expect(codigoDe(() => abrirCarpeta(path.join(repo, "sub", "resultados"), { raicesProhibidas: [] }))).toBe("DENTRO_DE_UN_REPO");
    expect(codigoDe(() => abrirCarpeta(path.join(worktree, "resultados"), { raicesProhibidas: [] }))).toBe("DENTRO_DE_UN_REPO");
    expect(codigoDe(() => abrirCarpeta(path.join(RAIZ_008, "resultados-e7-no-debe-existir"), { raicesProhibidas: [] }))).toBe("DENTRO_DE_UN_REPO");
    expect(existsSync(path.join(RAIZ_008, "resultados-e7-no-debe-existir"))).toBe(false);
  });

  it("rechaza una carpeta dentro de una raíz prohibida (por realpath, también a través de un enlace)", () => {
    const prohibida = nueva();
    const afuera = nueva();
    symlinkSync(prohibida, path.join(afuera, "atajo"));
    expect(codigoDe(() => abrirCarpeta(path.join(prohibida, "datos"), { raicesProhibidas: [prohibida] }))).toBe("EN_CARPETA_PROHIBIDA");
    expect(codigoDe(() => abrirCarpeta(path.join(afuera, "atajo", "datos"), { raicesProhibidas: [prohibida] }))).toBe("EN_CARPETA_PROHIBIDA");
    expect(existsSync(path.join(prohibida, "datos"))).toBe(false);
  });

  it("revisarCarpeta solo revisa (no crea nada); sin crear, una carpeta que no existe es SALIDA_INEXISTENTE", () => {
    const ruta = path.join(nueva(), "resultados");
    expect(codigoDe(() => revisarCarpeta(ruta, { raicesProhibidas: [] }))).toBe("SIN_ERROR");
    expect(existsSync(ruta)).toBe(false);
    expect(codigoDe(() => revisarCarpeta(path.join(RAIZ_008, "x"), { raicesProhibidas: [] }))).toBe("DENTRO_DE_UN_REPO");
    expect(codigoDe(() => abrirCarpeta(ruta, { raicesProhibidas: [], crear: false }))).toBe("SALIDA_INEXISTENTE");
    expect(existsSync(ruta)).toBe(false);
  });

  it("el error nunca repite la ruta", () => {
    const ruta = path.join(nueva(), "no", "existe");
    try {
      abrirCarpeta(ruta, { raicesProhibidas: [] });
    } catch (e) {
      expect((e as Error).message).not.toContain(ruta);
    }
  });
});

describe("los archivos de la carpeta", () => {
  it("JSONL 0600 con wx: cada línea queda escrita aunque no se cierre; no se pisa un archivo", () => {
    const c = abrirCarpeta(path.join(nueva(), "r"), { raicesProhibidas: [] });
    const jsonl = c.crearJsonl("corridas-ficticio.jsonl");
    jsonl.anotar({ uno: 1 });
    jsonl.anotar({ dos: "ñ" });
    const ruta = path.join(c.ruta, "corridas-ficticio.jsonl");
    expect(modo(ruta)).toBe(0o600);
    expect(readFileSync(ruta, "utf8")).toBe('{"uno":1}\n{"dos":"ñ"}\n');
    expect(c.leerJsonl("corridas-ficticio.jsonl")).toEqual([{ uno: 1 }, { dos: "ñ" }]);
    expect(codigoDe(() => c.crearJsonl("corridas-ficticio.jsonl"))).toBe("ARCHIVO_EXISTE");
    jsonl.cerrar();
  });

  it("escribirArchivo 0600 con wx; existe y lista", () => {
    const c = abrirCarpeta(path.join(nueva(), "r"), { raicesProhibidas: [] });
    c.escribirArchivo("pares-a-ciegas.md", "# Pares\n");
    expect(modo(path.join(c.ruta, "pares-a-ciegas.md"))).toBe(0o600);
    expect(c.existe("pares-a-ciegas.md")).toBe(true);
    expect(c.existe("otro.md")).toBe(false);
    expect(c.listar()).toEqual(["pares-a-ciegas.md"]);
    expect(codigoDe(() => c.escribirArchivo("pares-a-ciegas.md", "otra vez"))).toBe("ARCHIVO_EXISTE");
  });

  it("nombres solo de una pieza, sin rutas ni puntos al inicio", () => {
    const c = abrirCarpeta(path.join(nueva(), "r"), { raicesProhibidas: [] });
    for (const nombre of ["../fuera.md", "sub/x.md", ".oculto", "", "con espacio.md"]) expect(codigoDe(() => c.escribirArchivo(nombre, "x")), nombre).toBe("NOMBRE_INVALIDO");
  });

  it("la lectura tiene tope: un JSONL demasiado grande no se lee", () => {
    const c = abrirCarpeta(path.join(nueva(), "r"), { raicesProhibidas: [] });
    c.escribirArchivo("grande.jsonl", `${JSON.stringify({ x: "y".repeat(64) })}\n`);
    expect(codigoDe(() => c.leerJsonl("grande.jsonl", 16))).toBe("DEMASIADO_GRANDE");
    c.escribirArchivo("roto.jsonl", "{no es json}\n");
    expect(codigoDe(() => c.leerJsonl("roto.jsonl"))).toBe("JSONL_INVALIDO");
  });
});

describe("revisarArchivoPrivado (revisión de seguridad: el JSON del portafolio)", () => {
  it("acepta un archivo regular propio 0600; rechaza uno legible por otros, un enlace y una carpeta", () => {
    const base = nueva();
    const privado = path.join(base, "hechos.json");
    writeFileSync(privado, "{}", { mode: 0o600 });
    chmodSync(privado, 0o600);
    expect(codigoDe(() => revisarArchivoPrivado(privado))).toBe("SIN_ERROR");
    const abierto = path.join(base, "abierto.json");
    writeFileSync(abierto, "{}");
    chmodSync(abierto, 0o644);
    expect(codigoDe(() => revisarArchivoPrivado(abierto))).toBe("ARCHIVO_ABIERTO");
    symlinkSync(privado, path.join(base, "enlace.json"));
    expect(codigoDe(() => revisarArchivoPrivado(path.join(base, "enlace.json")))).toBe("ES_ENLACE");
    expect(codigoDe(() => revisarArchivoPrivado(base))).toBe("NO_ES_ARCHIVO");
    expect(codigoDe(() => revisarArchivoPrivado(path.join(base, "no-existe.json")))).toBe("NO_SE_PUDO_LEER");
  });
});

describe("nombreDeModelo", () => {
  it("un nombre de archivo seguro desde el nombre del modelo", () => {
    expect(nombreDeModelo("qwen2.5:14b")).toBe("qwen2.5-14b");
    expect(nombreDeModelo("aya-expanse:32b")).toBe("aya-expanse-32b");
    expect(nombreDeModelo("Ficticio/Raro:7B")).toBe("ficticio-raro-7b");
  });
});
