// Huella del servicio inv-008-precios para el vigía (PR 4): archivos clave=valor en /estado (volumen
// inv-008-precios-estado), escritos de forma atómica (temporal + rename: el vigía nunca lee uno a medias), y el
// candado de «una corrida a la vez» entre el bucle y un --ahora (O_EXCL, con dueño por token y viejo si su dueño
// deja de refrescarlo). El vigía es sh de busybox, sin jq: por eso clave=valor, una por línea y en ASCII.
import { mkdtempSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARCHIVO_BUCLE,
  ARCHIVO_CANDADO,
  ARCHIVO_ULTIMA,
  CANDADO_VIEJO_MS,
  ESTADO_DIR_POR_DEFECTO,
  FORMATO_HUELLA,
  escribirAtomico,
  leerClaveValor,
  textoClaveValor,
  tomarCandado,
} from "../../../src/servicio-precios/estado";

const carpeta = (): string => mkdtempSync(path.join(tmpdir(), "inv-008-precios-estado-"));
const leer = (dir: string, nombre: string) => leerClaveValor(readFileSync(path.join(dir, nombre), "utf8"));
const envejecer = (ruta: string, ms: number) => {
  const t = new Date(Date.now() - ms);
  utimesSync(ruta, t, t);
};

describe("nombres y formato", () => {
  it("la carpeta es /estado y los archivos son bucle, ultima-corrida y corrida.candado (formato 1)", () => {
    expect(ESTADO_DIR_POR_DEFECTO).toBe("/estado");
    expect([ARCHIVO_BUCLE, ARCHIVO_ULTIMA, ARCHIVO_CANDADO]).toEqual(["bucle", "ultima-corrida", "corrida.candado"]);
    expect(FORMATO_HUELLA).toBe(1);
    expect(CANDADO_VIEJO_MS).toBe(3 * 60_000);
  });

  it("textoClaveValor: formato primero, una clave por línea, números como texto", () => {
    expect(textoClaveValor({ estado: "ESPERANDO", proxima: 1799449217, desde: "" })).toBe("formato=1\nestado=ESPERANDO\nproxima=1799449217\ndesde=\n");
  });

  for (const [caso, campos] of [
    ["una clave con mayúsculas", { Estado: "OK" }],
    ["una clave con espacio", { "mi clave": "OK" }],
    ["la clave reservada formato", { formato: "7" }],
    ["un valor con salto de línea (inyectaría otra clave)", { estado: "OK\nresultado=OK" }],
    ["un valor con retorno de carro", { estado: "OK\r" }],
    ["un valor fuera de ASCII imprimible", { estado: "año" }],
    ["un número no finito", { proxima: Number.NaN }],
  ] as const) {
    it(`textoClaveValor rechaza ${caso}`, () => {
      expect(() => textoClaveValor(campos as Record<string, string | number>)).toThrow(RangeError);
    });
  }

  it("leerClaveValor: lee clave=valor (el valor puede traer «=»), ignora líneas sin «=»", () => {
    expect(leerClaveValor("formato=1\nestado=OK\nnota=a=b\nbasura\n\n")).toEqual({ formato: "1", estado: "OK", nota: "a=b" });
  });
});

describe("escribirAtomico", () => {
  it("deja el archivo completo con permisos 600 y sin temporales", async () => {
    const dir = carpeta();
    await escribirAtomico(dir, ARCHIVO_BUCLE, { estado: "ESPERANDO", latido: 1799449217 });
    expect(leer(dir, ARCHIVO_BUCLE)).toEqual({ formato: "1", estado: "ESPERANDO", latido: "1799449217" });
    expect(statSync(path.join(dir, ARCHIVO_BUCLE)).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual([ARCHIVO_BUCLE]);
  });

  it("reemplaza el anterior entero (rename): con 17 escrituras a la vez queda una sola, completa", async () => {
    const dir = carpeta();
    await Promise.all(Array.from({ length: 17 }, (_, i) => escribirAtomico(dir, ARCHIVO_ULTIMA, { resultado: "OK", inicio: 1799449217 + i, fin: 1799449217 + i })));
    const h = leer(dir, ARCHIVO_ULTIMA);
    expect(h.inicio).toBe(h.fin);
    expect(Object.keys(h)).toEqual(["formato", "resultado", "inicio", "fin"]);
    expect(readdirSync(dir)).toEqual([ARCHIVO_ULTIMA]);
  });

  it("si no puede escribir (la carpeta no existe), rechaza y no deja nada", async () => {
    const dir = path.join(carpeta(), "no-existe");
    await expect(escribirAtomico(dir, ARCHIVO_BUCLE, { estado: "OK" })).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("si el rename falla (el destino es una carpeta), rechaza y borra su temporal", async () => {
    const dir = carpeta();
    mkdtempSync(path.join(dir, "x"));
    const destino = readdirSync(dir)[0]!;
    await expect(escribirAtomico(dir, destino, { estado: "OK" })).rejects.toBeInstanceOf(Error);
    expect(readdirSync(dir)).toEqual([destino]);
  });

  it("con campos inválidos no escribe nada", async () => {
    const dir = carpeta();
    await expect(escribirAtomico(dir, ARCHIVO_BUCLE, { estado: "a\nb" })).rejects.toBeInstanceOf(RangeError);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("tomarCandado · una corrida a la vez", () => {
  const OPC = () => ({ ahoraMs: Date.now(), viejoMs: CANDADO_VIEJO_MS });

  it("el primero lo toma (con sus datos y un token) y el segundo no; al soltarlo, se puede volver a tomar", async () => {
    const dir = carpeta();
    const a = await tomarCandado(dir, { modo: "bucle", inicio: 1799449217 }, OPC());
    expect(a).not.toBeNull();
    const h = leer(dir, ARCHIVO_CANDADO);
    expect(h).toMatchObject({ formato: "1", modo: "bucle", inicio: "1799449217" });
    expect(h.token).toMatch(/^[0-9a-f]{32}$/);
    expect(statSync(path.join(dir, ARCHIVO_CANDADO)).mode & 0o777).toBe(0o600);
    expect(await tomarCandado(dir, { modo: "ahora" }, OPC())).toBeNull();
    await a!.soltar();
    expect(readdirSync(dir)).toEqual([]);
    const b = await tomarCandado(dir, { modo: "ahora" }, OPC());
    expect(b).not.toBeNull();
    await b!.soltar();
  });

  it("dos que compiten a la vez: gana uno solo", async () => {
    const dir = carpeta();
    const [a, b] = await Promise.all([tomarCandado(dir, { modo: "bucle" }, OPC()), tomarCandado(dir, { modo: "ahora" }, OPC())]);
    expect([a, b].filter((c) => c !== null)).toHaveLength(1);
  });

  it("uno reciente (2 min sin refrescar) se respeta; uno viejo (4 min) se rompe y se toma", async () => {
    const dir = carpeta();
    const ruta = path.join(dir, ARCHIVO_CANDADO);
    writeFileSync(ruta, "formato=1\nmodo=ahora\ntoken=ficticio\n");
    envejecer(ruta, 2 * 60_000);
    expect(await tomarCandado(dir, { modo: "bucle" }, OPC())).toBeNull();
    envejecer(ruta, 4 * 60_000);
    const c = await tomarCandado(dir, { modo: "bucle" }, OPC());
    expect(c).not.toBeNull();
    expect(leer(dir, ARCHIVO_CANDADO).modo).toBe("bucle");
  });

  it("refrescar lo mantiene vivo; soltar o refrescar uno que ya no es suyo no toca el del otro", async () => {
    const dir = carpeta();
    const ruta = path.join(dir, ARCHIVO_CANDADO);
    const a = (await tomarCandado(dir, { modo: "bucle" }, OPC()))!;
    envejecer(ruta, 2 * 60_000 + 37_000);
    await a.refrescar();
    expect(Date.now() - statSync(ruta).mtimeMs).toBeLessThan(60_000);
    // Lo dan por viejo y lo toma otro: el primero ya no es el dueño.
    envejecer(ruta, 4 * 60_000);
    const b = (await tomarCandado(dir, { modo: "ahora" }, OPC()))!;
    envejecer(ruta, 37_000);
    const antes = statSync(ruta).mtimeMs;
    await a.refrescar();
    await a.soltar();
    expect(statSync(ruta).mtimeMs).toBe(antes);
    expect(leer(dir, ARCHIVO_CANDADO).modo).toBe("ahora");
    await b.soltar();
    expect(readdirSync(dir)).toEqual([]);
    await b.soltar();
    await b.refrescar();
  });

  it("si la carpeta no existe, rechaza con su error (no lo toma por libre ni por ocupado)", async () => {
    const dir = path.join(carpeta(), "no-existe");
    await expect(tomarCandado(dir, { modo: "bucle" }, OPC())).rejects.toMatchObject({ code: "ENOENT" });
  });
});
