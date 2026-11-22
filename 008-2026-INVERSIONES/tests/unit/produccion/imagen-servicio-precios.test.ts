// El servicio de precios DENTRO de la imagen de la app ya construida (scripts/construir-imagen.sh <sha>). Corre solo si
// se nombra la imagen; en CI no hay imagen y se salta:
//   INV_IMAGEN_APP=inv-008-app:<sha> npx vitest run tests/unit/produccion/imagen-servicio-precios.test.ts
// Como el servicio inv-008-precios del compose: usuario 10008, solo lectura, sin capacidades ni escalada, /estado en un
// tmpfs de 10008, sin red (--network none) y 96 MiB sin swap (256 MiB bajo emulación: ver imagen-precios.test.ts).
// Prueba el healthcheck del compose con el find y el grep de busybox de la imagen, y que sin el secreto el bucle NO se
// cae y se detiene limpio con docker stop.
import { spawn } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { leer008 } from "./falsos";

const IMAGEN = process.env.INV_IMAGEN_APP ?? "";
const BUNDLE = "/app/precios/servicio-precios.mjs";
const POR_CONTENEDOR_MS = 180_000;
const NATIVA: Readonly<Record<string, string>> = { aarch64: "linux/arm64", arm64: "linux/arm64", x86_64: "linux/amd64", amd64: "linux/amd64" };

type Salida = { codigo: number | null; stdout: string; stderr: string };
const compose = parse(leer008("docker-compose.prod.yml")) as { services: Record<string, { healthcheck: { test: string[] } }> };
const SALUD = compose.services["inv-008-precios"]?.healthcheck.test[1] ?? "";

function docker(args: readonly string[]): Promise<Salida> {
  return new Promise((ok, mal) => {
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

let plataforma = "";
let tope = "96m";
const aislado = (): string[] => [
  "--network", "none", "--platform", plataforma, "--user", "10008:10008", "--read-only", "--cap-drop", "ALL",
  "--security-opt", "no-new-privileges:true", "--memory", tope, "--memory-swap", tope, "--pids-limit", "64",
  "--tmpfs", "/estado:size=64k,uid=10008,gid=10008,mode=0700,nosuid,nodev,noexec", "-e", "TZ=America/Bogota",
];
const correr = (entrypoint: string, args: readonly string[]): Promise<Salida> => docker(["run", "--rm", ...aislado(), "--entrypoint", entrypoint, IMAGEN, ...args]);

describe.skipIf(!IMAGEN)("imagen de la app · servicio inv-008-precios", { timeout: POR_CONTENEDOR_MS }, () => {
  beforeAll(async () => {
    plataforma = (await docker(["image", "inspect", "-f", "{{.Os}}/{{.Architecture}}", IMAGEN])).stdout.trim();
    const servidor = (await docker(["info", "-f", "{{.Architecture}}"])).stdout.trim();
    tope = NATIVA[servidor] === plataforma ? "96m" : "256m";
  });

  it("el uso del bundle trae el modo bucle y --ahora", async () => {
    const s = await correr("node", ["--max-old-space-size=64", BUNDLE, "--ayuda"]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout).toMatch(/^ {2}bucle\b/m);
    expect(s.stdout).toMatch(/^ {2}--ahora \[--desde AAAA-MM-DD\]/m);
  });

  it("el healthcheck del compose, con el busybox de la imagen: sin latido 1 · fresco 0 · viejo 1", async () => {
    expect(SALUD).toBe("find /estado/bucle -mmin -3 | grep -q .");
    const guion = [
      `${SALUD}; echo "sin=$?"`,
      `touch /estado/bucle; ${SALUD}; echo "fresco=$?"`,
      `touch -d "2019-08-23 13:37:00" /estado/bucle; ${SALUD}; echo "viejo=$?"`,
    ].join("; ");
    const s = await correr("sh", ["-c", guion]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout.trim().split("\n")).toEqual(["sin=1", "fresco=0", "viejo=1"]);
  });

  it("--ahora sin el secreto sale con 64 y lo dice", async () => {
    const s = await correr("node", ["--max-old-space-size=64", BUNDLE, "--ahora"]);
    expect(s.codigo, `${s.stdout}${s.stderr}`).toBe(64);
    expect(s.stdout).toContain("sin INV_PRECIOS_DATABASE_URL");
  });

  it("bucle sin el secreto NO se cae: latido SIN_SECRETO, healthcheck en 0, y docker stop lo detiene con 0", async () => {
    const nombre = `inv-008-imagen-precios-${process.pid}`;
    const arranque = await docker(["run", "-d", "--name", nombre, ...aislado(), "--init", "--entrypoint", "node", IMAGEN, "--max-old-space-size=64", BUNDLE, "bucle"]);
    expect(arranque.codigo, arranque.stderr).toBe(0);
    try {
      let latido = "";
      for (let i = 0; i < 60 && !latido.includes("estado=SIN_SECRETO"); i += 1) {
        await new Promise((ok) => setTimeout(ok, 1_000));
        latido = (await docker(["exec", nombre, "cat", "/estado/bucle"])).stdout;
      }
      expect(latido).toContain("estado=SIN_SECRETO");
      expect((await docker(["exec", nombre, "sh", "-c", SALUD])).codigo).toBe(0);
      expect((await docker(["inspect", "-f", "{{.State.Running}} {{.RestartCount}}", nombre])).stdout.trim()).toBe("true 0");
      expect((await docker(["stop", "-t", "15", nombre])).codigo).toBe(0);
      expect((await docker(["inspect", "-f", "{{.State.ExitCode}}", nombre])).stdout.trim()).toBe("0");
      const log = await docker(["logs", nombre]);
      expect(`${log.stdout}${log.stderr}`).toContain("detenido por SIGTERM");
    } finally {
      await docker(["rm", "-f", nombre]);
    }
  });
});
