// El bundle de precios DENTRO de la imagen de la app ya construida (scripts/construir-imagen.sh <sha>). Corre solo
// si se nombra la imagen; en CI no hay imagen y se salta:
//   INV_IMAGEN_APP=inv-008-app:<sha> npx vitest run tests/unit/produccion/imagen-precios.test.ts
// Sin red (--network none), con la plataforma de la propia imagen (amd64 para el VPS, emulada en el Mac) y con los
// topes que tendrá el servicio inv-008-precios: 96 MiB sin swap y --max-old-space-size=64.
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const IMAGEN = process.env.INV_IMAGEN_APP ?? "";
const BUNDLE = "/app/precios/servicio-precios.mjs";
/** Bajo emulación amd64, arrancar node toma varios segundos. */
const POR_CONTENEDOR_MS = 180_000;

type Salida = { codigo: number | null; stdout: string; stderr: string };

function docker(args: readonly string[]): Promise<Salida> {
  return new Promise((ok, mal) => {
    // Solo lo que el cliente de docker necesita para hallar su contexto (Colima en el Mac).
    const env = Object.fromEntries(["PATH", "HOME", "DOCKER_HOST", "DOCKER_CONTEXT"].flatMap((k) => (process.env[k] ? [[k, process.env[k]]] : [])));
    const hijo = spawn("docker", [...args], { env: env as NodeJS.ProcessEnv });
    let stdout = "";
    let stderr = "";
    const reloj = setTimeout(() => hijo.kill("SIGKILL"), POR_CONTENEDOR_MS - 5_000);
    hijo.stdout.on("data", (c: Buffer) => (stdout += c));
    hijo.stderr.on("data", (c: Buffer) => (stderr += c));
    hijo.on("error", mal);
    hijo.on("close", (codigo: number | null) => {
      clearTimeout(reloj);
      ok({ codigo, stdout, stderr });
    });
  });
}

/** `docker run` aislado como el servicio: sin red, solo lectura, sin capacidades ni escalada. */
async function correr(plataforma: string, entrypoint: string, args: readonly string[]): Promise<Salida> {
  return docker([
    "run", "--rm", "--network", "none", "--platform", plataforma, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
    "--memory", "96m", "--memory-swap", "96m", "--entrypoint", entrypoint, IMAGEN, ...args,
  ]);
}

describe.skipIf(!IMAGEN)("imagen de la app · bundle de precios", { timeout: POR_CONTENEDOR_MS }, () => {
  it("INV_IMAGEN_APP nombra una imagen de la app por su sha completo", () => {
    expect(IMAGEN).toMatch(/^inv-008-app:[0-9a-f]{40}$/);
  });

  it("node <bundle> --ayuda sale con 0, sin red y con los topes del servicio, con el usuario 10008", async () => {
    const plataforma = (await docker(["image", "inspect", "-f", "{{.Os}}/{{.Architecture}}", IMAGEN])).stdout.trim();
    expect(plataforma).toMatch(/^linux\/(amd64|arm64)$/);
    const s = await correr(plataforma, "node", ["--max-old-space-size=64", BUNDLE, "--ayuda"]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout).toContain("Uso: node servicio-precios.mjs <tarea>");
  });

  it("el bundle es de root, 0444 en /app/precios (0755): 10008 lo lee pero no lo cambia; sin tsx ni esbuild", async () => {
    const plataforma = (await docker(["image", "inspect", "-f", "{{.Os}}/{{.Architecture}}", IMAGEN])).stdout.trim();
    const guion = [
      "id -u",
      `stat -c '%u:%g %a' ${BUNDLE} /app/precios`,
      `if [ -w ${BUNDLE} ] || [ -w /app/precios ]; then echo escribible; else echo solo-lectura; fi`,
      "for p in tsx esbuild @esbuild; do if [ -e /app/node_modules/$p ]; then echo con-$p; fi; done",
    ].join("; ");
    const s = await correr(plataforma, "sh", ["-c", guion]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout.trim().split("\n")).toEqual(["10008", "0:0 444", "0:0 755", "solo-lectura"]);
  });
});
