// Candado del runbook §6: la prueba de restauración mensual dice el comando que funciona en el Mac (el que corrió el
// dueño el 2026-11-21) y sus avisos. Si alguien la vuelve a dejar en tres viñetas sin comando, o quita un aviso, falla.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ruta008 } from "./falsos";

const RUNBOOK = readFileSync(ruta008("docs/despliegue/produccion.md"), "utf8");

/** El bloque de la prueba mensual: desde su título hasta la sección siguiente (## 7). */
function pruebaMensual(): string {
  const inicio = RUNBOOK.indexOf("**Prueba de restauración mensual**");
  const fin = RUNBOOK.indexOf("\n## 7 ", inicio);
  expect(inicio, "falta la prueba de restauración mensual en el §6").toBeGreaterThan(-1);
  expect(fin, "la prueba mensual debe quedar dentro del §6").toBeGreaterThan(inicio);
  return RUNBOOK.slice(inicio, fin);
}

describe("runbook §6 · prueba de restauración mensual", () => {
  it("identifica la clave derivando la pública, sin mostrarla, y explica el prefijo que falta", () => {
    const b = pruebaMensual();
    expect(b).toContain("--entrypoint age-keygen");
    expect(b).toMatch(/age-keygen[^\n]*\s-y\b/);
    expect(b).toContain("printf 'AGE-SECRET-KEY-'");
  });

  it("verifica con solo conteos (tablas con datos, orden y lote), sin red y en amd64", () => {
    const b = pruebaMensual();
    expect(b).toContain("--network none");
    expect(b).toContain("--platform linux/amd64");
    expect(b).toContain("age -d -i -");
    expect(b).toContain("pg_restore -f -");
    expect(b).toMatch(/tablas con datos/);
    expect(b).toContain('"public.orden"');
    expect(b).toContain('"public.lote"');
  });

  it("trabaja en una carpeta 700 del home (Docker Desktop no ve /private/tmp) y la borra al terminar", () => {
    const b = pruebaMensual();
    expect(b).toContain("umask 077");
    expect(b).toMatch(/mkdir -m 700 ~\//);
    expect(b).toMatch(/rm -rf ~\//);
    expect(b).toContain("/private/tmp");
    expect(b).toContain("pbcopy < /dev/null");
  });

  it("avisa que la clave va solo en la Terminal de macOS y que es la maestra compartida con PI y BI", () => {
    const b = pruebaMensual();
    expect(b).toContain("Terminal de macOS");
    expect(b).toMatch(/nunca en una sesión de Claude/);
    expect(b).toMatch(/PI y BI/);
    expect(b).toContain("Portapapeles Universal");
    expect(b).toMatch(/historial del portapapeles/);
  });

  it("todo docker run pasa por D, que va sin red; los montajes son de solo lectura y la clave nunca va en un archivo", () => {
    const b = pruebaMensual();
    const comandos = [...b.matchAll(/```sh\n([\s\S]*?)```/g)].map((m) => m[1] ?? "").join("\n");
    expect(comandos.match(/docker run/g)).toHaveLength(1);
    expect(comandos).toMatch(/D=\(docker run --rm -i --network none --platform linux\/amd64\)/);
    const montajes = [...b.matchAll(/-v (\S+)/g)].map((m) => m[1]);
    expect(montajes.length).toBeGreaterThan(0);
    for (const m of montajes) expect(m).toMatch(/:ro$/);
    expect(b).not.toMatch(/age -d -i (?!- )/);
    expect(b).toContain("shasum -a 256 -c");
  });

  it("un fallo de age o de pg_restore no sale como un resultado (sin pipefail, el awk imprimía ceros)", () => {
    const b = pruebaMensual();
    expect(b).toContain("set -o pipefail");
    expect(b).toContain('FALLÓ: no se leyó ninguna tabla');
    expect(b).toContain('|| echo "FALLÓ: la prueba no pasó"');
  });

  it("fija las frecuencias del CEO: la ligera mensual, la real de (A) trimestral (la primera antes de 2027-02-21) y (B) al cambiar el esquema", () => {
    const b = pruebaMensual();
    expect(b).toMatch(/\*\*Mensual:\*\*/);
    expect(b).toMatch(/\*\*Trimestral:\*\*[^\n]*caso \(A\)[^\n]*`ok`/);
    expect(b).toContain("antes de 2027-02-21");
    expect(b).toMatch(/\*\*Caso \(B\):\*\*[^\n]*cambie el esquema de respaldo/);
    expect(b).not.toContain("su frecuencia la decide el CEO");
  });

  it("los bloques para pegar no llevan comentarios # (zsh interactivo no los reconoce por defecto)", () => {
    const bloques = [...pruebaMensual().matchAll(/```sh\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");
    expect(bloques.length).toBeGreaterThanOrEqual(4);
    for (const bloque of bloques) expect(bloque).not.toMatch(/\s#\s/);
  });
});
