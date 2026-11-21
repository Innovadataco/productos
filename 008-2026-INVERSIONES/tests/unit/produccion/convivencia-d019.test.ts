// Candado de D-019 (decisión de Jelk, 2026-11-21): la pausa de Inversiones durante un despliegue de PI deja de ser
// obligatoria. PI la hace solo si su preflight de memoria arranca bajo: MemAvailable < 1 GiB o SwapFree < 512 MB.
// La marca de pausa y el candado común siguen como están acordados.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ruta008 } from "./falsos";

const DOC = readFileSync(ruta008("docs/despliegue/convivencia-pi.md"), "utf8");

describe("convivencia con PI · D-019", () => {
  it("la pausa ya no es obligatoria en cada despliegue de PI", () => {
    expect(DOC).not.toMatch(/pausa obligatoria/i);
    expect(DOC).not.toMatch(/(es|era) \**obligatori[oa]\** en cada despliegue/);
  });

  it("PI pausa solo si su preflight arranca con MemAvailable < 1 GiB o SwapFree < 512 MB, y solo para ese build", () => {
    expect(DOC).toContain("D-019");
    expect(DOC).toMatch(/MemAvailable`?\s*<\s*\**1 GiB/);
    expect(DOC).toMatch(/SwapFree`?\s*<\s*\**512 MB/);
    expect(DOC).toMatch(/solo para ese build/);
    expect(DOC).toMatch(/Inversiones sigue arriba durante el build de PI/);
    expect(DOC).toMatch(/aviso del vigía durante un build de PI sin pausa es esperable/);
  });

  it("la marca de pausa y el candado común siguen como están", () => {
    expect(DOC).toContain("salvo que exista la marca de pausa");
    expect(DOC).toContain("/var/lock/despliegue-vps.lock");
  });
});
