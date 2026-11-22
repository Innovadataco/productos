// reanudar-008.sh con el servicio de precios (D-018, PR 3): el up de todo el proyecto levanta inv-008-precios solo si la
// imagen del sha que corre lo trae (su commit tiene src/servicio-precios/bucle.ts, mirado en el clon). Con una imagen
// anterior (después de una vuelta atrás) o si no se puede saber, lo baja con --scale inv-008-precios=0 y lo dice:
// saldría con 2 en un bucle de reinicios y el --wait fallaría, y la marca de pausa quedaría puesta.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, crearRepo, entorno, envProduccionFicticio, git } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const COPIAR = ["docker-compose.prod.yml", "scripts/produccion-comun.sh", "scripts/reanudar-008.sh", "scripts/pausar-008.sh"];
const BUCLE = "src/servicio-precios/bucle.ts";

/** Un clon de prueba con un commit sin el servicio y otro con él; lo que corre es `corre` («sin», «con» o un sha ajeno). */
function preparar(corre: "sin" | "con" | "ajeno") {
  const repo = crearRepo(COPIAR);
  const sin = repo.sha;
  mkdirSync(path.join(repo.dir008, path.dirname(BUCLE)), { recursive: true });
  writeFileSync(path.join(repo.dir008, BUCLE), "// el servicio de precios (ficticio para la prueba)\n");
  git(repo.dir, ["add", "-A"]);
  git(repo.dir, ["commit", "-q", "-m", "con el servicio"]);
  const con = git(repo.dir, ["rev-parse", "HEAD"]);
  const sha = corre === "sin" ? sin : corre === "con" ? con : "4613".repeat(10);
  const base = carpetaTemporal("reanudar-precios");
  envProduccionFicticio(base);
  mkdirSync(path.join(base, "estado"), { recursive: true });
  writeFileSync(path.join(base, "estado", "sha-actual"), `${sha}\n`);
  writeFileSync(path.join(base, "estado", "pausado"), "pausa ficticia\n");
  const falsos = crearFalsos(base);
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_TAGS: path.join(base, "tags.txt") });
  return { base, sha, env, script: path.join(repo.dir008, "scripts/reanudar-008.sh") };
}
const ups = (base: string) => readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n").filter((l) => l.startsWith("up "));

describe("reanudar-008.sh · el servicio de precios", () => {
  it("con una imagen que trae el servicio: up -d --wait de todo, sin --scale, y borra la marca", async () => {
    const p = preparar("con");
    const r = await correr(p.script, [], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ups(p.base)).toHaveLength(1);
    expect(ups(p.base)[0]).toMatch(new RegExp(`^up ${p.sha} .* up -d --wait --wait-timeout 180$`));
    expect(existsSync(path.join(p.base, "estado", "pausado"))).toBe(false);
  });

  it("con una imagen anterior al servicio: lo baja con --scale inv-008-precios=0, levanta lo demás y lo dice", async () => {
    const p = preparar("sin");
    const r = await correr(p.script, [], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ups(p.base)[0]).toMatch(new RegExp(`^up ${p.sha} .* up -d --wait --wait-timeout 180 --scale inv-008-precios=0$`));
    expect(r.stderr).toContain("la imagen del sha que corre no trae el servicio de precios");
    expect(existsSync(path.join(p.base, "estado", "pausado"))).toBe(false);
  });

  it("si el clon no tiene el commit del sha que corre (no se puede saber): también lo baja y lo dice", async () => {
    const p = preparar("ajeno");
    const r = await correr(p.script, [], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ups(p.base)[0]).toMatch(/ --scale inv-008-precios=0$/);
    expect(r.stderr).toContain("no se pudo saber si la imagen del sha que corre trae el servicio de precios");
  });
});
