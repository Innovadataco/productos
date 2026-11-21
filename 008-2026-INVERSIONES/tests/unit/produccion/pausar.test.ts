// pausar-008.sh (el corte de las operaciones de 008) nunca se rompe por interpolación: el down va solo con el
// nombre del proyecto (sin -f ni --env-file), no lee la configuración no secreta y escribe la marca ANTES del
// down. Si el down por nombre falla, cae al compose del clon con el centinela. Con las anclas de producción
// rotas no escribe nada: hace el down de último recurso y sale con error («SIN marca»).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { arbolProduccionFalso, carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, ruta008, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const PAUSAR = ruta008("scripts/pausar-008.sh");
const docker = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker");
const marca = (base: string) => path.join(base, "estado", "pausado");

function preparar(opciones: { sinConf?: boolean; sinEnv?: boolean; conf?: string; cambiosEnv?: Record<string, string> } = {}, extra: Record<string, string> = {}) {
  const base = carpetaTemporal("pausar");
  if (!opciones.sinEnv) envProduccionFicticio(base, opciones.cambiosEnv ?? {}, { sinConf: opciones.sinConf || opciones.conf !== undefined });
  if (opciones.conf !== undefined) writeFileSync(path.join(base, "inv-008.conf"), opciones.conf);
  const falsos = crearFalsos(base);
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_ENTORNO: path.join(base, "entorno.txt"), ...extra });
  return { base, falsos, env };
}

describe("pausar-008.sh · nunca se rompe por interpolación", () => {
  it("el down es solo `docker compose -p <proyecto> down`: sin -f ni --env-file, sin -v", async () => {
    const { base, falsos, env } = preparar();
    const r = await correr(PAUSAR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(marca(base))).toBe(true);
    expect(docker(falsos.llamadas())).toEqual([["docker", "compose", "-p", "inv-008-prueba", "down"]]);
  });

  const casos: Array<[string, Parameters<typeof preparar>[0]]> = [
    ["sin inv-008.conf", { sinConf: true }],
    ["con una configuración inválida (ruta relativa)", { conf: "INV_RESPALDOS_DIR=respaldos\n" }],
    ["con una configuración que apunta a una carpeta que no existe", { conf: "INV_RESPALDOS_DIR=/nonexistent/x\n" }],
    ["con el archivo de producción sin una variable obligatoria", { cambiosEnv: { INV_AUTH_SECRET: "" } }],
    ["sin el archivo de producción", { sinEnv: true }],
  ];
  for (const [nombre, opciones] of casos) {
    it(`${nombre}: baja igual, deja la marca y sale con 0`, async () => {
      const { base, falsos, env } = preparar(opciones);
      const r = await correr(PAUSAR, ["prueba"], env);
      expect(r.status, r.stderr).toBe(0);
      expect(readFileSync(marca(base), "utf8")).toMatch(/prueba/);
      expect(docker(falsos.llamadas()).filter((l) => l.includes("down"))).toHaveLength(1);
    });
  }

  it("nunca levanta ni corre nada (ni up ni run)", async () => {
    const { falsos, env } = preparar();
    await correr(PAUSAR, [], env);
    expect(docker(falsos.llamadas()).some((l) => l.includes("up") || l.includes("run"))).toBe(false);
  });

  it("si el down por nombre falla (un compose que no lo admite), cae al compose del clon con el centinela y la marca queda", async () => {
    const { base, falsos, env } = preparar({}, { FALSO_DOWN_SIN_F_RC: "1" });
    const r = await correr(PAUSAR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(marca(base))).toBe(true);
    const downs = docker(falsos.llamadas()).filter((l) => l.includes("down"));
    expect(downs).toHaveLength(2);
    expect(downs[1]).toEqual(expect.arrayContaining(["-f", "--env-file", "down"]));
    // El segundo intento no lee la configuración: pasa el centinela, que no existe.
    const [, respaldos] = readFileSync(path.join(base, "entorno.txt"), "utf8").trim().split("\n").at(-1)!.split("\t");
    expect(respaldos).toMatch(/^\/nonexistent\//);
  });

  it("si fallan los dos down, sale con error y la marca queda (la pausa se mantiene)", async () => {
    const { base, env } = preparar({}, { FALSO_DOWN_RC: "1" });
    expect((await correr(PAUSAR, [], env)).status).not.toBe(0);
    expect(existsSync(marca(base))).toBe(true);
  });

  it("la marca se escribe antes del down", async () => {
    const { base, env } = preparar({ sinConf: true });
    const sonda = path.join(base, "sonda.txt");
    const r = await correr(PAUSAR, [], { ...env, FALSO_SONDA_MARCA: marca(base), FALSO_SONDA_SALIDA: sonda });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(sonda, "utf8").trim()).toBe("marca-presente");
  });

  it.skipIf(userInfo().username === "root")(
    "en producción con las anclas rotas (un árbol que no es de root): no escribe nada, baja por nombre y sale con error «SIN marca»",
    async () => {
      const a = arbolProduccionFalso({ copiar: ["scripts/pausar-008.sh"] });
      const falsos = crearFalsos(carpetaTemporal("pausar-anclas"));
      const antes = readdirSync(a.raiz).sort();
      const r = await correr(path.join(a.dir008, "scripts", "pausar-008.sh"), [], entorno(falsos));
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/SIN marca/);
      expect(readdirSync(a.raiz).sort()).toEqual(antes);
      expect(existsSync(path.join(a.raiz, "estado"))).toBe(false);
      expect(docker(falsos.llamadas())).toEqual([["docker", "compose", "-p", "inv-008-prod", "down"]]);
      expect(falsos.llamadas().some((l) => l[0] === "flock")).toBe(false);
    },
  );

  it("con otra operación de Inversiones en curso (candado propio): no deja marca ni toca Docker", async () => {
    const { base, falsos, env } = preparar({}, { FALSO_FLOCK_OCUPADO: "8" });
    expect((await correr(PAUSAR, [], env)).status).not.toBe(0);
    expect(existsSync(marca(base))).toBe(false);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("la marca va en la raíz de prueba; nada se escribe fuera de ella", async () => {
    const { base, env } = preparar();
    rmSync(path.join(base, "respaldos"), { recursive: true });
    mkdirSync(path.join(base, "estado"), { recursive: true });
    expect((await correr(PAUSAR, [], env)).status).toBe(0);
    expect(existsSync(marca(base))).toBe(true);
  });
});
