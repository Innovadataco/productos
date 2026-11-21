// respaldar-base.sh (en el host): le pide un respaldo ya al contenedor inv-008-respaldo (exec --ahora) y
// verifica en la carpeta de respaldos de la configuración (inv-008.conf) que el archivo exista, sea de age y
// cuadre con su sha256.
// El cifrado y la retención los prueba respaldo-contenedor.test.ts.
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, confFicticia, correr, crearFalsos, entorno, envProduccionFicticio, ruta008 } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = ruta008("scripts/respaldar-base.sh");

function preparar(extra: Record<string, string> = {}) {
  const base = carpetaTemporal("respaldo-host");
  envProduccionFicticio(base);
  const respaldos = path.join(base, "respaldos");
  mkdirSync(respaldos, { recursive: true });
  const falsos = crearFalsos(base);
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RESPALDOS_DIR: respaldos, ...extra });
  return { base, respaldos, falsos, env };
}

describe("respaldar-base.sh", () => {
  it("pide el respaldo al contenedor y devuelve la ruta en el host, ya verificada", async () => {
    const { respaldos, falsos, env } = preparar();
    const r = await correr(SCRIPT, ["--motivo", "pre-migracion"], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe(path.join(respaldos, "inv-008-20261121-023000-pre-migracion.dump.age"));
    const exec = falsos.llamadas().find((l) => l[0] === "docker" && l.includes("exec"))!;
    expect(exec).toEqual(expect.arrayContaining(["exec", "-T", "inv-008-respaldo", "/usr/local/bin/inv-respaldo", "--ahora", "--motivo", "pre-migracion"]));
    expect(exec.slice(1, 4)).toEqual(["compose", "-p", "inv-008-prueba"]);
  });

  for (const [nombre, extra] of [
    ["el contenedor falla", { FALSO_RESPALDO_RC: "1" }],
    ["el archivo no es de age", { FALSO_RESPALDO_CORRUPTO: "1" }],
    ["el sha256 no cuadra", { FALSO_RESPALDO_SHA_MALO: "1" }],
  ] as const) {
    it(`falla si ${nombre}`, async () => {
      const { env } = preparar(extra);
      expect((await correr(SCRIPT, [], env)).status).not.toBe(0);
    });
  }

  it("rechaza un motivo con caracteres raros sin llamar a Docker", async () => {
    const { falsos, env } = preparar();
    expect((await correr(SCRIPT, ["--motivo", "../../etc"], env)).status).not.toBe(0);
    expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
  });

  it("verifica en la carpeta que dice la configuración, no en una fija", async () => {
    const base = carpetaTemporal("respaldo-host-conf");
    envProduccionFicticio(base, {}, { sinConf: true });
    const otra = path.join(base, "otra", "carpeta");
    confFicticia(base, otra);
    const falsos = crearFalsos(base);
    const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RESPALDOS_DIR: otra });
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe(path.join(otra, "inv-008-20261121-023000.dump.age"));
  });

  it("sin la configuración no verifica nada ni llama a Docker", async () => {
    const base = carpetaTemporal("respaldo-host-sin-conf");
    envProduccionFicticio(base, {}, { sinConf: true });
    const falsos = crearFalsos(base);
    const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base });
    const r = await correr(SCRIPT, [], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/inv-008\.conf/);
    expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
  });

  it("candado de rutas: si respaldos es un enlace que sale de la raíz, no sigue", async () => {
    const base = carpetaTemporal("respaldo-host-enlace");
    envProduccionFicticio(base, {}, { sinConf: true });
    writeFileSync(path.join(base, "inv-008.conf"), `INV_RESPALDOS_DIR=${base}/respaldos\n`);
    const afuera = carpetaTemporal("afuera");
    symlinkSync(afuera, path.join(base, "respaldos"));
    const falsos = crearFalsos(base);
    const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_RESPALDOS_DIR: afuera });
    expect((await correr(SCRIPT, [], env)).status).not.toBe(0);
  });
});
