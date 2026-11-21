// El bundle de precios DENTRO de la imagen de la app ya construida (scripts/construir-imagen.sh <sha>). Corre solo
// si se nombra la imagen; en CI no hay imagen y se salta:
//   INV_IMAGEN_APP=inv-008-app:<sha> npx vitest run tests/unit/produccion/imagen-precios.test.ts
// Sin red (--network none), con la plataforma de la propia imagen (amd64 para el VPS, emulada en el Mac) y con los
// topes que tendrá el servicio inv-008-precios: 96 MiB sin swap y --max-old-space-size=64.
// Bajo emulación (qemu-user: amd64 en el Mac arm64) el tope de memoria es 256 MiB: qemu suma su propia memoria y
// solo `new PrismaClient().$connect()` llegó a ~110 MiB de pico de cgroup (medido el 2026-11-21); con 96 MiB lo
// mata el OOM sin que sea un defecto de la imagen. Los 96 MiB se prueban en nativo (imagen arm64 en el Mac o el VPS).
import { spawn } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

const IMAGEN = process.env.INV_IMAGEN_APP ?? "";
const BUNDLE = "/app/precios/servicio-precios.mjs";
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
/** Lo que nunca debe salir en la consola: la URL de la base, su host y su clave. */
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test"];
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

let plataforma = "";
let tope = "96m";
/** Arquitectura del servidor de docker → plataforma que corre sin emulación. */
const NATIVA: Readonly<Record<string, string>> = { aarch64: "linux/arm64", arm64: "linux/arm64", x86_64: "linux/amd64", amd64: "linux/amd64" };

/** `docker run` aislado como el servicio: sin red, solo lectura, sin capacidades ni escalada; la base, inalcanzable. */
async function correr(entrypoint: string, args: readonly string[]): Promise<Salida> {
  return docker([
    "run", "--rm", "--network", "none", "--platform", plataforma, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
    "--memory", tope, "--memory-swap", tope, "-e", `DATABASE_URL=${INALCANZABLE}`, "--entrypoint", entrypoint, IMAGEN, ...args,
  ]);
}

describe.skipIf(!IMAGEN)("imagen de la app · bundle de precios", { timeout: POR_CONTENEDOR_MS }, () => {
  beforeAll(async () => {
    plataforma = (await docker(["image", "inspect", "-f", "{{.Os}}/{{.Architecture}}", IMAGEN])).stdout.trim();
    const servidor = (await docker(["info", "-f", "{{.Architecture}}"])).stdout.trim();
    tope = NATIVA[servidor] === plataforma ? "96m" : "256m";
  });

  it("INV_IMAGEN_APP nombra una imagen de la app por su sha completo, de linux amd64 o arm64", () => {
    expect(IMAGEN).toMatch(/^inv-008-app:[0-9a-f]{40}$/);
    expect(plataforma).toMatch(/^linux\/(amd64|arm64)$/);
  });

  it("node <bundle> --ayuda sale con 0, sin red y con los topes del servicio, con el usuario 10008", async () => {
    const s = await correr("node", ["--max-old-space-size=64", BUNDLE, "--ayuda"]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout).toContain("Uso: node servicio-precios.mjs <tarea>");
  });

  it("el bundle es de root, 0444 en /app/precios (0755): 10008 lo lee pero no lo cambia; sin tsx ni esbuild", async () => {
    const guion = [
      "id -u",
      `stat -c '%u:%g %a' ${BUNDLE} /app/precios`,
      `if [ -w ${BUNDLE} ] || [ -w /app/precios ]; then echo escribible; else echo solo-lectura; fi`,
      "for p in tsx esbuild @esbuild; do if [ -e /app/node_modules/$p ]; then echo con-$p; fi; done",
    ].join("; ");
    const s = await correr("sh", ["-c", guion]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout.trim().split("\n")).toEqual(["10008", "0:0 444", "0:0 755", "solo-lectura"]);
  });

  it("el engine de Prisma del standalone carga con 10008, solo lectura y el tope de memoria: llega a conectar (P1001), no falla al cargarse", async () => {
    // Si el engine no cargara (ilegible, sin schema o de otra plataforma), el error no traería P1001.
    const codigo = [
      'const { PrismaClient } = require("@prisma/client");',
      "new PrismaClient().$connect().then(",
      '  () => { console.log("conectó"); process.exitCode = 1; },',
      '  (e) => { console.log(e.name, e.errorCode); process.exitCode = e.errorCode === "P1001" ? 0 : 1; });',
    ].join("\n");
    const s = await correr("node", ["--max-old-space-size=64", "-e", codigo]);
    expect(s.codigo, `${s.stdout}${s.stderr}`).toBe(0);
    expect(s.stdout.trim()).toBe("PrismaClientInitializationError P1001");
  });

  it("precios con la base inalcanzable: el CLI del bundle llega a Prisma y sale con SU 1, sin imprimir la URL", async () => {
    const s = await correr("node", ["--max-old-space-size=64", BUNDLE, "precios"]);
    const texto = `${s.stdout}${s.stderr}`;
    expect(s.codigo, texto).toBe(1);
    expect(texto).toContain("No se actualizaron los precios: PrismaClientInitializationError");
    for (const dato of NUNCA) expect(texto, dato).not.toContain(dato);
  });
});
