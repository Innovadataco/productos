/**
 * La lista de modelos de la puerta local la publica PI en un archivo JSON de esquema cerrado (no es un literal del
 * código): `<INV_IA_DIR_COMPARTIDA>/modelos-ia-local-permitidos.json`. El fallo es BLANDO: si falta la variable, falta
 * el archivo, no pasa el esquema o la versión no se conoce, nada lanza; la puerta local queda «sin lista de PI» con su
 * motivo (sin datos) y MODELOS_APROBADOS queda VACÍA. Cada caso de fallo con su control positivo: la lista ficticia
 * (tests/fixtures/ia/*.ficticio.json, tres nombres y digests inventados) pasa, y una sola mutación la tumba.
 * Ninguna IPv4 escrita (el candado de la puerta local las marca): se arman al correr.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PATRON_MODELO } from "@/ia/generador";
import {
  ARCHIVO_LISTA_PI, LISTA_MODELOS_PI, MAX_BYTES_LISTA_PI, MAX_MODELOS_LISTA_PI, MODELOS_APROBADOS, PATRON_DIGEST, VARIABLE_DIR_COMPARTIDA, VERSIONES_LISTA_PI,
  cargarModelosPermitidos, leerArchivoAcotado, leerModelosPermitidos, modeloAprobado, type ListaModelosPi,
} from "@/ia/local/modelos";

const FIXTURE = path.join(__dirname, "..", "..", "..", "fixtures", "ia", "modelos-ia-local-permitidos.ficticio.json");
const TEXTO = readFileSync(FIXTURE, "utf8");
const BASE = (): Record<string, unknown> => JSON.parse(TEXTO) as Record<string, unknown>;
const modelosDe = (o: Record<string, unknown>) => o.modelos as Record<string, unknown>[];
const con = (cambio: (o: Record<string, unknown>) => void): string => {
  const o = BASE();
  cambio(o);
  return JSON.stringify(o);
};
const ip = (...octetos: readonly number[]): string => octetos.join(".");
const motivo = (l: ListaModelosPi): string => (l.estado === "SIN_LISTA" ? l.motivo : "LISTA");
const DIGEST_QWEN = "4613a27c".repeat(8);

const temporales: string[] = [];
function carpeta(conArchivo: string | null = TEXTO): string {
  const dir = mkdtempSync(path.join(tmpdir(), "lista-pi-"));
  temporales.push(dir);
  if (conArchivo !== null) writeFileSync(path.join(dir, ARCHIVO_LISTA_PI), conArchivo);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const dir of temporales.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("el contrato con PI", () => {
  it("la variable es INV_IA_DIR_COMPARTIDA (un directorio), el archivo tiene nombre fijo y la única versión conocida es 1", () => {
    expect(VARIABLE_DIR_COMPARTIDA).toBe("INV_IA_DIR_COMPARTIDA");
    expect(ARCHIVO_LISTA_PI).toBe("modelos-ia-local-permitidos.json");
    expect(VERSIONES_LISTA_PI).toEqual([1]);
    expect(Object.isFrozen(VERSIONES_LISTA_PI)).toBe(true);
  });
});

describe("leerModelosPermitidos · control positivo", () => {
  it("la lista ficticia pasa: tres modelos con su digest y su nota, congelados", () => {
    const l = leerModelosPermitidos(TEXTO);
    expect(l).toEqual({
      estado: "LISTA", version: 1, publicadoPor: "PI (ficticio)", fecha: "2027-01-14",
      modelos: [
        { nombre: "qwen2.5:14b", digest: DIGEST_QWEN, nota: "Recomendado para 008 (nota ficticia)" },
        { nombre: "gemma2:27b", digest: "37911f47".repeat(8) },
        { nombre: "aya-expanse:32b", digest: "1237bead".repeat(8), nota: "Nota ficticia del 32B" },
      ],
    });
    if (l.estado !== "LISTA") throw new Error("no es lista");
    expect(Object.isFrozen(l)).toBe(true);
    expect(Object.isFrozen(l.modelos)).toBe(true);
    for (const m of l.modelos) {
      expect(Object.isFrozen(m)).toBe(true);
      expect(m.nombre).toMatch(PATRON_MODELO);
      expect(m.digest).toMatch(PATRON_DIGEST);
    }
  });

  it("una lista vacía es una lista (de cero modelos), no un fallo", () => {
    expect(leerModelosPermitidos(con((o) => { o.modelos = []; }))).toMatchObject({ estado: "LISTA", modelos: [] });
  });

  // Revisión (código, M1): una hora o una proporción en una nota no es un puerto: no tumba la lista.
  it.each(["ratio 1:1", "mejor a las 10:30", "versión 2:7b"])("una nota con «%s» pasa", (nota) => {
    expect(leerModelosPermitidos(con((o) => { modelosDe(o)[0]!.nota = nota; })).estado).toBe("LISTA");
  });

  it("la nota es opcional", () => {
    const l = leerModelosPermitidos(con((o) => { delete modelosDe(o)[0]!.nota; }));
    expect(l.estado === "LISTA" && l.modelos[0]).toEqual({ nombre: "qwen2.5:14b", digest: DIGEST_QWEN });
  });
});

describe("leerModelosPermitidos · cada fallo cierra blando, sin lanzar", () => {
  const casos: readonly (readonly [string, string | undefined, string])[] = [
    ["el archivo falta", undefined, "ARCHIVO_AUSENTE"],
    ["no es JSON", "{ \"version\": 1,", "JSON_INVALIDO"],
    ["es un arreglo", "[]", "ESQUEMA_INVALIDO"],
    ["es null", "null", "ESQUEMA_INVALIDO"],
    ["versión 2", con((o) => { o.version = 2; }), "VERSION_DESCONOCIDA"],
    ["versión en texto", con((o) => { o.version = "1"; }), "VERSION_DESCONOCIDA"],
    ["sin versión", con((o) => { delete o.version; }), "ESQUEMA_INVALIDO"],
    ["una clave de más arriba", con((o) => { o.destino = "x"; }), "ESQUEMA_INVALIDO"],
    ["sin publicadoPor", con((o) => { delete o.publicadoPor; }), "ESQUEMA_INVALIDO"],
    ["publicadoPor vacío", con((o) => { o.publicadoPor = ""; }), "ESQUEMA_INVALIDO"],
    ["publicadoPor con una IP", con((o) => { o.publicadoPor = `PI ${ip(100, 73, 41, 157)}`; }), "ESQUEMA_INVALIDO"],
    ["una fecha que no existe", con((o) => { o.fecha = "2027-02-30"; }), "ESQUEMA_INVALIDO"],
    ["modelos no es un arreglo", con((o) => { o.modelos = {}; }), "ESQUEMA_INVALIDO"],
    ["un modelo con una clave de más (un puerto)", con((o) => { modelosDe(o)[0]!.puerto = 47213; }), "ESQUEMA_INVALIDO"],
    ["un modelo sin digest", con((o) => { delete modelosDe(o)[1]!.digest; }), "ESQUEMA_INVALIDO"],
    ["un digest null (PI ya los midió: es obligatorio)", con((o) => { modelosDe(o)[1]!.digest = null; }), "ESQUEMA_INVALIDO"],
    ["un digest en mayúsculas", con((o) => { modelosDe(o)[1]!.digest = "37911F47".repeat(8); }), "ESQUEMA_INVALIDO"],
    ["un digest con el prefijo sha256:", con((o) => { modelosDe(o)[1]!.digest = `sha256:${"37911f47".repeat(8)}`; }), "ESQUEMA_INVALIDO"],
    ["un nombre sin etiqueta", con((o) => { modelosDe(o)[0]!.nombre = "qwen2.5"; }), "ESQUEMA_INVALIDO"],
    ["un nombre con registro (barra)", con((o) => { modelosDe(o)[0]!.nombre = "registro/qwen2.5:14b"; }), "ESQUEMA_INVALIDO"],
    ["un nombre que es una IP y un puerto", con((o) => { modelosDe(o)[0]!.nombre = `${ip(100, 73, 41, 157)}:47213`; }), "ESQUEMA_INVALIDO"],
    ["un nombre en mayúsculas", con((o) => { modelosDe(o)[0]!.nombre = "Qwen2.5:14b"; }), "ESQUEMA_INVALIDO"],
    ["un nombre repetido", con((o) => { modelosDe(o)[1]!.nombre = "qwen2.5:14b"; }), "ESQUEMA_INVALIDO"],
    ["una nota con una URL", con((o) => { modelosDe(o)[0]!.nota = "ver https://ejemplo.invalid"; }), "ESQUEMA_INVALIDO"],
    ["una nota con una IP", con((o) => { modelosDe(o)[0]!.nota = `en ${ip(100, 73, 41, 157)}`; }), "ESQUEMA_INVALIDO"],
    ["una nota con un puerto", con((o) => { modelosDe(o)[0]!.nota = "por el :47213"; }), "ESQUEMA_INVALIDO"],
    ["una nota con un salto de línea", con((o) => { modelosDe(o)[0]!.nota = "dos\nlíneas"; }), "ESQUEMA_INVALIDO"],
    ["una nota vacía", con((o) => { modelosDe(o)[0]!.nota = ""; }), "ESQUEMA_INVALIDO"],
    ["una nota demasiado larga", con((o) => { modelosDe(o)[0]!.nota = "n".repeat(201); }), "ESQUEMA_INVALIDO"],
    ["demasiados modelos", con((o) => { o.modelos = Array.from({ length: MAX_MODELOS_LISTA_PI + 1 }, (_, i) => ({ nombre: `ficticio${i}:7b`, digest: "4613a27c".repeat(8) })); }), "ESQUEMA_INVALIDO"],
  ];

  it.each(casos)("%s → SIN_LISTA %s", (_nombre, fuente, esperado) => {
    let l: ListaModelosPi | undefined;
    expect(() => { l = leerModelosPermitidos(fuente); }).not.toThrow();
    expect(motivo(l!)).toBe(esperado);
    expect(Object.isFrozen(l)).toBe(true);
  });

  it("un tipo que no es texto ni undefined tampoco lanza", () => {
    expect(motivo(leerModelosPermitidos(4613 as unknown as string))).toBe("ARCHIVO_ILEGIBLE");
  });
});

describe("cargarModelosPermitidos · la variable y el archivo (fallo blando)", () => {
  it("sin la variable, o vacía: SIN_VARIABLE, sin leer nada", () => {
    const leer = vi.fn();
    expect(motivo(cargarModelosPermitidos({}, leer))).toBe("SIN_VARIABLE");
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: "" }, leer))).toBe("SIN_VARIABLE");
    expect(leer).not.toHaveBeenCalled();
  });

  it.each(["relativa/compartida", "/con\u0000nulo", "/dir/../otra"])("una ruta que no es absoluta y limpia («%s»): RUTA_INVALIDA, sin leer", (valor) => {
    const leer = vi.fn();
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: valor }, leer))).toBe("RUTA_INVALIDA");
    expect(leer).not.toHaveBeenCalled();
  });

  it("lee exactamente <directorio>/modelos-ia-local-permitidos.json (control positivo)", () => {
    const leer = vi.fn(() => ({ ok: true as const, texto: TEXTO }));
    expect(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: "/compartida/ia" }, leer).estado).toBe("LISTA");
    expect(leer).toHaveBeenCalledWith(path.join("/compartida/ia", ARCHIVO_LISTA_PI));
  });

  it("si el lector lanza, ARCHIVO_ILEGIBLE (nada sube)", () => {
    const leer = () => { throw new Error("EIO ficticio"); };
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: "/compartida/ia" }, leer))).toBe("ARCHIVO_ILEGIBLE");
  });

  it("con el disco real: el directorio con la lista ficticia → LISTA", () => {
    expect(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: carpeta() }).estado).toBe("LISTA");
  });

  it("con el disco real: el directorio sin el archivo → ARCHIVO_AUSENTE; un directorio que no existe, también", () => {
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: carpeta(null) }))).toBe("ARCHIVO_AUSENTE");
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: path.join(carpeta(null), "no-existe") }))).toBe("ARCHIVO_AUSENTE");
  });

  it("con el disco real: un archivo mal formado → JSON_INVALIDO; una versión desconocida → VERSION_DESCONOCIDA", () => {
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: carpeta("no es json") }))).toBe("JSON_INVALIDO");
    expect(motivo(cargarModelosPermitidos({ [VARIABLE_DIR_COMPARTIDA]: carpeta(con((o) => { o.version = 7; })) }))).toBe("VERSION_DESCONOCIDA");
  });
});

describe("leerArchivoAcotado", () => {
  it("lee un archivo chico en UTF-8 (control positivo)", () => {
    expect(leerArchivoAcotado(path.join(carpeta(), ARCHIVO_LISTA_PI))).toEqual({ ok: true, texto: TEXTO });
  });

  it("más de MAX_BYTES_LISTA_PI: ARCHIVO_DEMASIADO_GRANDE, sin leerlo entero", () => {
    expect(MAX_BYTES_LISTA_PI).toBe(65_536);
    const dir = carpeta(" ".repeat(MAX_BYTES_LISTA_PI + 1));
    expect(leerArchivoAcotado(path.join(dir, ARCHIVO_LISTA_PI))).toEqual({ ok: false, motivo: "ARCHIVO_DEMASIADO_GRANDE" });
  });

  it("un directorio en el lugar del archivo: ARCHIVO_ILEGIBLE", () => {
    const dir = carpeta(null);
    mkdirSync(path.join(dir, ARCHIVO_LISTA_PI));
    expect(leerArchivoAcotado(path.join(dir, ARCHIVO_LISTA_PI))).toEqual({ ok: false, motivo: "ARCHIVO_ILEGIBLE" });
  });

  it("UTF-8 inválido: ARCHIVO_ILEGIBLE", () => {
    const dir = carpeta(null);
    writeFileSync(path.join(dir, ARCHIVO_LISTA_PI), Buffer.from([0x7b, 0xff, 0xfe, 0x7d]));
    expect(leerArchivoAcotado(path.join(dir, ARCHIVO_LISTA_PI))).toEqual({ ok: false, motivo: "ARCHIVO_ILEGIBLE" });
  });

  it("un archivo que no existe: ARCHIVO_AUSENTE", () => {
    expect(leerArchivoAcotado(path.join(carpeta(null), ARCHIVO_LISTA_PI))).toEqual({ ok: false, motivo: "ARCHIVO_AUSENTE" });
  });
});

/** El módulo vuelve a cargarse con el entorno dado (la lista se lee al cargar el módulo, una vez por proceso). */
async function moduloCon(dir: string | undefined): Promise<typeof import("@/ia/local/modelos")> {
  vi.resetModules();
  vi.stubEnv(VARIABLE_DIR_COMPARTIDA, dir ?? "");
  return import("@/ia/local/modelos");
}

describe("MODELOS_APROBADOS sale de la lista de PI (respaldo: VACÍA)", () => {
  it("en las pruebas, sin la variable: la lista vacía y congelada, y el estado SIN_VARIABLE", () => {
    expect(MODELOS_APROBADOS).toEqual([]);
    expect(Object.isFrozen(MODELOS_APROBADOS)).toBe(true);
    expect(motivo(LISTA_MODELOS_PI)).toBe("SIN_VARIABLE");
    expect(modeloAprobado("qwen2.5:14b")).toBeNull();
    expect(modeloAprobado("ornith:9b")).toBeNull();
  });

  it("con la variable y la lista ficticia: los tres modelos, con el digest de la lista (control positivo)", async () => {
    const m = await moduloCon(carpeta());
    expect(m.MODELOS_APROBADOS.map((x) => x.nombre)).toEqual(["qwen2.5:14b", "gemma2:27b", "aya-expanse:32b"]);
    expect(m.modeloAprobado("qwen2.5:14b")).toEqual({ nombre: "qwen2.5:14b", digest: DIGEST_QWEN, nota: "Recomendado para 008 (nota ficticia)" });
    expect(m.modeloAprobado("aya-expanse:32b")?.digest).toBe("1237bead".repeat(8));
    expect(m.LISTA_MODELOS_PI.estado).toBe("LISTA");
  });

  it.each([
    ["el archivo falta", () => carpeta(null), "ARCHIVO_AUSENTE"],
    ["el archivo no pasa el esquema", () => carpeta(con((o) => { o.extra = true; })), "ESQUEMA_INVALIDO"],
    ["la versión no se conoce", () => carpeta(con((o) => { o.version = 2; })), "VERSION_DESCONOCIDA"],
    ["falta la variable", () => undefined, "SIN_VARIABLE"],
  ])("%s: cargar el módulo no lanza, la lista queda vacía y se registra solo el motivo", async (_n, dir, esperado) => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const valor = dir();
    const m = await moduloCon(valor);
    expect(m.MODELOS_APROBADOS).toEqual([]);
    expect(m.modeloAprobado("qwen2.5:14b")).toBeNull();
    expect(motivo(m.LISTA_MODELOS_PI)).toBe(esperado);
    expect(aviso).toHaveBeenCalledTimes(1);
    const registrado = String(aviso.mock.calls[0]![0]);
    expect(registrado).toContain(esperado);
    // Sin datos: ni la ruta ni el contenido del archivo.
    if (valor !== undefined) expect(registrado).not.toContain(valor);
    expect(registrado).not.toContain("qwen");
  });
});

describe("modeloAprobado", () => {
  it.each(["QWEN2.5:14B", "qwen2.5:14b ", " qwen2.5:14b", "qwen2.5", "", undefined, null, 14])("«%s» no está aprobado, ni con la lista cargada", async (nombre) => {
    const m = await moduloCon(carpeta());
    expect(m.modeloAprobado(nombre)).toBeNull();
  });
});

describe("PATRON_DIGEST", () => {
  const hex = "4613a27c".repeat(8);

  it("acepta 64 hex en minúsculas", () => {
    expect(PATRON_DIGEST.test(hex)).toBe(true);
  });

  it.each([hex.toUpperCase(), hex.slice(1), `${hex}a`, `sha256:${hex}`, `${hex}\n`, ""])("rechaza «%s»", (texto) => {
    expect(PATRON_DIGEST.test(texto)).toBe(false);
  });
});
