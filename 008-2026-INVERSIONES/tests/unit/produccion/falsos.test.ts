// Los falsos de las pruebas de producción (falsos.ts › crearFalsos): siempre los mismos archivos versionados de
// ./falsos/, nunca copias. En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema,
// en una sola fila para todo el Mac: con la máquina cargada son segundos por archivo, y copiar nueve falsos en cada
// prueba hacía que los archivos de producción tardaran varias veces más. Y una prueba que pone un falso propio no
// puede escribir sobre el versionado.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appCargarFalsa, carpetaTemporal, crearFalsos, DIR_008, entorno, idArchivo, ruta008, rutaEnPath, TSX_CARGAR_FALSO } from "./falsos";

// La primera ejecución de cada falso en un clon recién sacado pasa por la revisión de macOS: con el Mac cargado,
// segundos. Ya revisado, cuesta milisegundos.
vi.setConfig({ testTimeout: 60_000 });

const DIR_PRODUCCION = ruta008("tests/unit/produccion");
const DIR_FALSOS = path.join(DIR_PRODUCCION, "falsos");
const NOMBRES = readdirSync(DIR_FALSOS).sort();
/** Todas las carpetas de falsos versionados: ./falsos/ y las propias de un archivo de pruebas (./falsos-*). */
const CARPETAS_FALSOS = readdirSync(DIR_PRODUCCION, { withFileTypes: true })
  .filter((e) => e.isDirectory() && (e.name === "falsos" || e.name.startsWith("falsos-")))
  .map((e) => e.name)
  .sort();

/** Ruta que bash ejecutaría para `nombre` con el PATH de esos falsos. */
const resuelve = (falsos: ReturnType<typeof crearFalsos>, nombre: string) => {
  const ruta = rutaEnPath(entorno(falsos), nombre);
  expect(ruta, `${nombre} no está en el PATH de los falsos`).not.toBe("");
  return ruta;
};
const sha256 = (ruta: string) => createHash("sha256").update(readFileSync(ruta)).digest("hex");

describe("falsos.ts · appCargarFalsa (el /app de inv-cargar)", () => {
  it("el tsx del /app es un enlace simbólico al versionado: ni una copia ni un enlace duro, y no sobrescribe", () => {
    const dir = carpetaTemporal("falsos-app");
    const tsx = path.join(appCargarFalsa(dir), "node_modules", ".bin", "tsx");
    expect(lstatSync(tsx).isSymbolicLink()).toBe(true);
    expect(readlinkSync(tsx)).toBe(TSX_CARGAR_FALSO);
    // Una segunda vez en la misma carpeta falla (EEXIST): nunca escribe sobre lo que haya.
    expect(() => appCargarFalsa(dir)).toThrow(/EEXIST/);
  });
});

describe("falsos.ts · crearFalsos", () => {
  it("hay falsos versionados que probar", () => {
    expect(NOMBRES).toEqual(expect.arrayContaining(["docker", "sleep"]));
  });

  it("cada falso es el archivo versionado de ./falsos/, el mismo en todas las pruebas: no se copia", () => {
    const [a, b] = [crearFalsos(carpetaTemporal("falsos-a")), crearFalsos(carpetaTemporal("falsos-b"))];
    for (const nombre of NOMBRES) {
      const versionado = idArchivo(path.join(DIR_FALSOS, nombre));
      expect(idArchivo(resuelve(a, nombre)), nombre).toBe(versionado);
      expect(idArchivo(resuelve(b, nombre)), nombre).toBe(versionado);
    }
  });

  it("la carpeta propia de la prueba empieza vacía: ahí van solo los falsos propios de esa prueba", () => {
    expect(readdirSync(crearFalsos(carpetaTemporal("falsos-vacia")).bin)).toEqual([]);
  });

  it("un falso propio en la carpeta de la prueba tapa al versionado en el PATH y no lo toca", () => {
    const falsos = crearFalsos(carpetaTemporal("falsos-propio"));
    const propio = path.join(falsos.bin, "sleep");
    // Antes de escribir: si ahí hubiera un enlace o el mismo archivo, la prueba pisaría el del repo.
    expect(existsSync(propio)).toBe(false);
    const versionado = path.join(DIR_FALSOS, "sleep");
    const [antesSha, antesId] = [sha256(versionado), idArchivo(versionado)];
    writeFileSync(propio, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    expect(resuelve(falsos, "sleep")).toBe(propio);
    expect([sha256(versionado), idArchivo(versionado)]).toEqual([antesSha, antesId]);
  });

  it("hay carpetas de falsos que revisar, además de ./falsos/", () => {
    expect(CARPETAS_FALSOS).toEqual(expect.arrayContaining(["falsos", "falsos-cargar", "falsos-montaje", "falsos-vigia"]));
  });

  it("los falsos versionados de todas las carpetas son ejecutables, en git (100755) y en disco", () => {
    for (const carpeta of CARPETAS_FALSOS) {
      const r = spawnSync("git", ["-C", DIR_008, "ls-files", "-s", "--", `tests/unit/produccion/${carpeta}`], { encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
      const modos = Object.fromEntries(
        r.stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => [path.basename(l.split("\t")[1]!), l.split(" ")[0]]),
      );
      const nombres = readdirSync(path.join(DIR_PRODUCCION, carpeta)).sort();
      expect(nombres.length, carpeta).toBeGreaterThan(0);
      for (const nombre of nombres) {
        expect(modos[nombre], `${carpeta}/${nombre}`).toBe("100755");
        expect(statSync(path.join(DIR_PRODUCCION, carpeta, nombre)).mode & 0o111, `${carpeta}/${nombre}`).toBe(0o111);
      }
    }
  });

  // En macOS, `cp <archivo> ""` copia al directorio actual (sale con 0): sin la guarda, el falso escribiría en el clon.
  it("sleep: un cambio que no se puede hacer (falta su destino) sale con 97, no pasa en silencio", () => {
    const falsos = crearFalsos(carpetaTemporal("falsos-sleep-sin-destino"));
    const sinMeminfo = spawnSync("bash", ["-c", "sleep 7"], { env: entorno(falsos, { FALSO_SLEEP_MEMINFO: falsos.registro }) as NodeJS.ProcessEnv, encoding: "utf8" });
    expect(sinMeminfo.status, sinMeminfo.stderr).toBe(97);
    expect(sinMeminfo.stderr).toMatch(/falta INV_MEMINFO/);
    const sinSalud = spawnSync("bash", ["-c", "sleep 7"], { env: entorno(falsos, { FALSO_SLEEP_ROMPE_SALUD: "{}" }) as NodeJS.ProcessEnv, encoding: "utf8" });
    expect(sinSalud.status, sinSalud.stderr).toBe(97);
    expect(sinSalud.stderr).toMatch(/falta FALSO_SALUD_ARCHIVO/);
  });

  it("cada llamada queda en el registro con el nombre del falso y sus argumentos", () => {
    const falsos = crearFalsos(carpetaTemporal("falsos-registro"));
    const r = spawnSync("bash", ["-c", "sleep 7"], { env: entorno(falsos) as NodeJS.ProcessEnv, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(falsos.llamadas()).toEqual([["sleep", "7"]]);
  });
});
