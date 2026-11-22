// Los falsos de las pruebas de producción (falsos.ts › crearFalsos): siempre los mismos archivos versionados de
// ./falsos/, nunca copias. En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema,
// en una sola fila para todo el Mac: con la máquina cargada son segundos por archivo, y copiar nueve falsos en cada
// prueba hacía que los archivos de producción tardaran varias veces más. Y una prueba que pone un falso propio no
// puede escribir sobre el versionado.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { carpetaTemporal, crearFalsos, DIR_008, entorno, ruta008 } from "./falsos";

const DIR_FALSOS = ruta008("tests/unit/produccion/falsos");
const NOMBRES = readdirSync(DIR_FALSOS).sort();

/** Identidad del archivo (sigue los enlaces): dispositivo e inodo. */
const idArchivo = (ruta: string) => {
  const s = statSync(ruta);
  return `${s.dev}:${s.ino}`;
};
/** Ruta que bash ejecutaría para `nombre` con el PATH de esos falsos. */
const resuelve = (falsos: ReturnType<typeof crearFalsos>, nombre: string) => {
  const r = spawnSync("bash", ["-c", 'command -v "$1"', "bash", nombre], { env: entorno(falsos) as NodeJS.ProcessEnv, encoding: "utf8" });
  expect(r.status, `${nombre}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
};
const sha256 = (ruta: string) => createHash("sha256").update(readFileSync(ruta)).digest("hex");

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

  it("los falsos versionados son ejecutables, en git (100755) y en disco", () => {
    const r = spawnSync("git", ["-C", DIR_008, "ls-files", "-s", "--", "tests/unit/produccion/falsos"], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    const modos = Object.fromEntries(
      r.stdout
        .trim()
        .split("\n")
        .map((l) => [path.basename(l.split("\t")[1]!), l.split(" ")[0]]),
    );
    for (const nombre of NOMBRES) {
      expect(modos[nombre], nombre).toBe("100755");
      expect(statSync(path.join(DIR_FALSOS, nombre)).mode & 0o111, nombre).toBe(0o111);
    }
  });

  it("cada llamada queda en el registro con el nombre del falso y sus argumentos", () => {
    const falsos = crearFalsos(carpetaTemporal("falsos-registro"));
    const r = spawnSync("bash", ["-c", "sleep 7"], { env: entorno(falsos) as NodeJS.ProcessEnv, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(falsos.llamadas()).toEqual([["sleep", "7"]]);
  });
});
