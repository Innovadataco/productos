// construir-imagen.sh <sha>: en el Mac, desde `git archive` (nunca la carpeta de trabajo), con
// npm audit de producción, buildx linux/amd64 sin attestations, las dos imágenes con la etiqueta revision,
// y opcionalmente el .tar con su sha256 para verificarlo en el VPS antes de `docker load`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, crearRepo, entorno } from "./falsos";

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const COPIAR = ["scripts/construir-imagen.sh", "scripts/produccion-comun.sh", "Dockerfile", ".dockerignore", "package.json", "package-lock.json"];

function preparar(extra: Record<string, string> = {}) {
  const repo = crearRepo(COPIAR, { "comprometido.txt": "sí\n" });
  // Cambio sin commit en la carpeta de trabajo: NO debe entrar al contexto de la imagen.
  writeFileSync(path.join(repo.dir008, "sin-commit.txt"), "no\n");
  const tmp = carpetaTemporal("construir");
  const falsos = crearFalsos(tmp);
  const contexto = path.join(tmp, "contexto.txt");
  const env = entorno(falsos, { FALSO_SHA: repo.sha, FALSO_ID: `sha256:${"a".repeat(64)}`, FALSO_CONTEXTO: contexto, TMPDIR: tmp, ...extra });
  return { repo, tmp, falsos, contexto, env, script: path.join(repo.dir008, "scripts/construir-imagen.sh") };
}

describe("construir-imagen.sh", () => {
  it("construye runner y migrador para linux/amd64 desde git archive del sha y por stdout imprime solo el ID", async () => {
    const { repo, falsos, contexto, env, script } = preparar();
    const r = await correr(script, [repo.sha], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe(`sha256:${"a".repeat(64)}\n`);
    const builds = falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "buildx");
    expect(builds).toHaveLength(3);
    for (const [target, etiqueta] of [["runner", "inv-008-app"], ["migrador", "inv-008-migrador"], ["vigia", "inv-008-vigia"]]) {
      const b = builds.find((l) => l.includes(target))!;
      expect(b).toEqual(
        expect.arrayContaining(["--platform", "linux/amd64", "--target", target, "--build-arg", `APP_VERSION=${repo.sha}`, "--provenance=false", "--sbom=false", "--load", "-t", `${etiqueta}:${repo.sha}`]),
      );
      expect(b.at(-1)).not.toBe(repo.dir008);
    }
    const listado = readFileSync(contexto, "utf8");
    expect(listado).toContain("comprometido.txt");
    expect(listado).toContain("Dockerfile");
    expect(listado).not.toContain("sin-commit.txt");
  });

  it("corre npm audit de producción en la copia y aborta antes del build si hay vulnerabilidades altas", async () => {
    const { repo, falsos, env, script } = preparar({ FALSO_AUDIT_RC: "1" });
    expect((await correr(script, [repo.sha], env)).status).not.toBe(0);
    const audit = falsos.llamadas().find((l) => l[0] === "npm")!;
    expect(audit).toEqual(["npm", "audit", "--omit=dev", "--audit-level=high"]);
    expect(falsos.llamadas().some((l) => l[1] === "buildx")).toBe(false);
  });

  for (const [nombre, sha] of [
    ["corto", "abc1234"],
    ["en mayúsculas", "A".repeat(40)],
    ["que no existe", "f".repeat(40)],
    ["con opciones", "--help"],
  ]) {
    it(`rechaza un sha ${nombre} sin construir nada`, async () => {
      const { falsos, env, script } = preparar();
      expect((await correr(script, [sha], env)).status).not.toBe(0);
      expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
    });
  }

  it("aborta si la imagen no trae la etiqueta revision del sha", async () => {
    const { repo, env, script } = preparar({ FALSO_SHA: "0".repeat(40) });
    expect((await correr(script, [repo.sha], env)).status).not.toBe(0);
  });

  it("--guardar deja el .tar con las tres imágenes y su sha256 en la carpeta pedida", async () => {
    const { repo, tmp, falsos, env, script } = preparar();
    const destino = path.join(tmp, "envio");
    const r = await correr(script, [repo.sha, "--guardar", destino], env);
    expect(r.status, r.stderr).toBe(0);
    const tar = path.join(destino, `inv-008-${repo.sha}.tar`);
    expect(existsSync(tar)).toBe(true);
    expect(readFileSync(`${tar}.sha256`, "utf8")).toMatch(new RegExp(`^[0-9a-f]{64}  inv-008-${repo.sha}\\.tar\\n$`));
    expect(falsos.llamadas().find((l) => l[1] === "save")).toEqual(
      expect.arrayContaining(["save", "-o", tar, `inv-008-app:${repo.sha}`, `inv-008-migrador:${repo.sha}`, `inv-008-vigia:${repo.sha}`]),
    );
    expect(r.stdout).toBe(`sha256:${"a".repeat(64)}\n`);
  });

  it("no deja la copia temporal del código al terminar", async () => {
    const { repo, tmp, env, script } = preparar();
    await correr(script, [repo.sha], env);
    const restos = readFileSync(path.join(tmp, "contexto.txt"), "utf8");
    expect(restos.length).toBeGreaterThan(0);
    expect(readdirSync(tmp).filter((n) => n.startsWith("inv-008-imagen."))).toEqual([]);
  });
});
