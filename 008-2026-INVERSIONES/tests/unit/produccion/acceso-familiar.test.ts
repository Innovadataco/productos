// scripts/acceso-familiar.sh (frente familia-lectura): el acceso de un familiar en producción. Lo corre Jelk por SSH
// (nunca la Fábrica: maneja accesos), como crear-acceso-inicial.sh: el CLI en el migrador (rol inv_dueno), con los dos
// candados, sin correr en pausa y con la imagen del sha desplegado. Además, lista blanca en bash ANTES de tocar nada:
// solo `--email <correo>` y, si acaso, UNA de `--revocar` o `--reiniciar-totp`; ningún mensaje repite el correo.
// Con los falsos de docker y flock (tests/unit/produccion/falsos.ts). Datos inventados.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, leer008, ruta008, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const ACCESO = ruta008("scripts/acceso-familiar.sh");
const CORREO = "familiar-sh@ejemplo.invalid";
const SHA = "3".repeat(40);

function preparar(extra: Record<string, string> = {}) {
  const base = carpetaTemporal("acceso-familiar");
  envProduccionFicticio(base);
  const falsos = crearFalsos(base);
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, ...extra });
  return { base, falsos, env };
}

const docker = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker");

describe("acceso-familiar.sh · el acceso de un familiar (lo corre Jelk por SSH)", () => {
  it.each([[["--email", CORREO]], [["--email", CORREO, "--revocar"]], [["--reiniciar-totp", "--email", CORREO]]])(
    "%j: corre acceso-familiar.ts en el migrador con tsx y le pasa los argumentos tal cual",
    async (argv) => {
      const { falsos, env } = preparar({ INV_TAG: SHA });
      const r = await correr(ACCESO, argv, env);
      expect(r.status, r.stderr).toBe(0);
      const ll = docker(falsos.llamadas());
      expect(ll).toHaveLength(1);
      const corrida = ll[0] ?? [];
      expect(corrida).toEqual(expect.arrayContaining(["run", "--rm", "-T", "inv-008-migrador", "node_modules/.bin/tsx", "scripts/acceso-familiar.ts"]));
      expect(corrida.slice(-argv.length)).toEqual(argv);
    },
  );

  it.each([
    ["sin argumentos", []],
    ["sin correo", ["--revocar"]],
    ["--email sin valor", ["--email"]],
    ["un correo que empieza por «-»", ["--email", "-familiar@ejemplo.invalid"]],
    ["una opción como correo", ["--email", "--revocar"]],
    ["un correo con espacios", ["--email", "fam iliar@ejemplo.invalid"]],
    ["--email repetido", ["--email", CORREO, "--email", "otro@ejemplo.invalid"]],
    ["las dos acciones", ["--email", CORREO, "--revocar", "--reiniciar-totp"]],
    ["una acción repetida", ["--email", CORREO, "--revocar", "--revocar"]],
    ["una opción fuera de la lista", ["--email", CORREO, "--reactivar"]],
    ["un argumento suelto", ["--email", CORREO, "extra"]],
  ])("%s: se niega con el uso, sin tocar Docker ni repetir el correo", async (_caso, argv) => {
    const { falsos, env } = preparar({ INV_TAG: SHA });
    const r = await correr(ACCESO, argv, env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--email <correo-del-familiar>/);
    expect(`${r.stdout}${r.stderr}`).not.toContain(CORREO);
    expect(docker(falsos.llamadas())).toEqual([]);
    expect(falsos.llamadas().filter((l) => l[0] === "flock")).toEqual([]);
  });

  it("con la marca de pausa se niega, sin tocar Docker", async () => {
    const { base, falsos, env } = preparar({ INV_TAG: SHA });
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "pausado"), "pausa\n");
    const r = await correr(ACCESO, ["--email", CORREO], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/pausa/);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("toma los dos candados sin esperar; con el común ocupado dice «PI desplegando»", async () => {
    const ok = preparar({ INV_TAG: SHA });
    expect((await correr(ACCESO, ["--email", CORREO], ok.env)).status).toBe(0);
    expect(ok.falsos.llamadas().filter((l) => l[0] === "flock")).toHaveLength(2);
    const ocupado = preparar({ INV_TAG: SHA, FALSO_FLOCK_OCUPADO: "9" });
    const r = await correr(ACCESO, ["--email", CORREO], ocupado.env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/PI desplegando/);
    expect(docker(ocupado.falsos.llamadas())).toEqual([]);
  });

  for (const malo of ["latest", "3".repeat(39), "G".repeat(40), "$(id)"]) {
    it(`INV_TAG «${malo}» no es un sha de 40 hex: se niega sin tocar Docker`, async () => {
      const { falsos, env } = preparar({ INV_TAG: malo });
      const r = await correr(ACCESO, ["--email", CORREO], env);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/40 hex/);
      expect(docker(falsos.llamadas())).toEqual([]);
    });
  }

  it("sin INV_TAG usa el sha de estado/sha-actual para el migrador", async () => {
    const { base, env } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${SHA}\n`);
    const runs = path.join(base, "runs.txt");
    const r = await correr(ACCESO, ["--email", CORREO], { ...env, FALSO_RUN_TAGS: runs });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(runs, "utf8")).toMatch(new RegExp(`^run ${SHA} .*inv-008-migrador`, "m"));
  });

  it("la cabecera dice que lo corre Jelk, no la Fábrica; no guarda nada en disco", () => {
    const texto = leer008("scripts/acceso-familiar.sh");
    expect(texto).toMatch(/Lo corre Jelk por SSH \(nunca la Fábrica/);
    expect(texto).not.toMatch(/\btee\b|>>?\s*"?\$|\bmktemp\b/);
  });
});
