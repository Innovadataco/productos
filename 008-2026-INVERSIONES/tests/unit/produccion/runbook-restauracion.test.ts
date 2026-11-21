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
  });
});
