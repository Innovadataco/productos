// Candado del repo PÚBLICO: ningún archivo de infraestructura de 008 trae rutas ni identificadores del VPS. Los
// valores reales viven en el ESTADO.md privado de la gestión; aquí se escribe «<ver ESTADO en la gestión>».
// Los patrones son GENÉRICOS (prefijos de carpeta y formas), nunca los valores reales: si este archivo los
// trajera, se delataría a sí mismo. El cruce con los valores reales lo corre la Fábrica antes de cada push.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIR_008 } from "./falsos";

// Archivos de infraestructura: documentación, scripts, imágenes, compose, pruebas de producción y AGENTS.md.
const ALCANCE = /^(docs\/|scripts\/|docker\/|tests\/unit\/produccion\/|AGENTS\.md$|README\.md$|Dockerfile$|docker-compose[^/]*\.yml$|\.env\.example$|\.dockerignore$)/;

const PATRONES: Array<[string, RegExp]> = [
  ["una carpeta bajo la raíz de software opcional del host", /\/opt\//],
  ["la carpeta de respaldos del host", /\/var\/backups/],
  ["la configuración del túnel en el host", /\/etc\/cloudflared/],
  // El home de root del host. Excepción: la caché de npm de la etapa de build del Dockerfile (es del contenedor de
  // build, no del VPS).
  ["el home de root del host", /\/root\/\.(?!npm\b)/],
  ["el nombre de una unidad del servicio del túnel", /cloudflared-[a-z0-9]/i],
];

/** Una IPv4 que no es de bucle, privada ni de documentación (las reales del VPS son públicas). */
const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
function esIpPublica(m: RegExpMatchArray): boolean {
  const o = m.slice(1, 5).map(Number);
  if (o.some((x) => x > 255)) return false;
  const [a, b, c] = o as [number, number, number, number];
  const permitida =
    a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
  return !permitida;
}

function archivosDelAlcance(): string[] {
  const r = spawnSync("git", ["ls-files", "-z", "."], { cwd: DIR_008, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ls-files falló: ${r.stderr}`);
  return r.stdout.split("\0").filter((f) => f && ALCANCE.test(f));
}

/** Hallazgos de un texto: solo el patrón y el número de línea, nunca el contenido. */
function hallazgos(texto: string): string[] {
  const salida: string[] = [];
  texto.split("\n").forEach((linea, i) => {
    for (const [nombre, patron] of PATRONES) if (patron.test(linea)) salida.push(`línea ${i + 1}: ${nombre}`);
    for (const m of linea.matchAll(IPV4)) if (esIpPublica(m)) salida.push(`línea ${i + 1}: una IPv4 pública`);
  });
  return salida;
}

describe("sin literales de infraestructura en 008 (repo público)", () => {
  const archivos = archivosDelAlcance();

  it("revisa los archivos de infraestructura (si el alcance quedara vacío, el candado no serviría)", () => {
    for (const f of ["docs/despliegue/produccion.md", "scripts/produccion-comun.sh", "docker-compose.prod.yml", "AGENTS.md"]) {
      expect(archivos, f).toContain(f);
    }
  });

  for (const archivo of archivos) {
    it(archivo, () => {
      expect(hallazgos(readFileSync(path.join(DIR_008, archivo), "utf8"))).toEqual([]);
    });
  }
});

describe("controles positivos del candado (si dejan de morder, no sirve)", () => {
  const base = ["", "opt", "inversiones-ficticia", "repo"].join("/");
  for (const [linea, esperado] of [
    [`sudo ${base}/scripts/pausar-008.sh`, "raíz de software opcional"],
    [["", "var", "backups", "x", "y"].join("/"), "carpeta de respaldos"],
    [["", "etc", "cloudflared", "config.yml"].join("/"), "configuración del túnel"],
    [["", "root", ".ficticio", "cert.pem"].join("/"), "home de root"],
    [`systemctl restart ${["cloudflared", "ficticio"].join("-")}`, "servicio del túnel"],
    // Las IPs se arman en ejecución: el cruce de literales de la Fábrica marca cualquier IPv4 escrita.
    [`ssh root@${[8, 8, 4, 4].join(".")}`, "IPv4 pública"],
  ] as const) {
    it(`detecta «${esperado}»`, () => {
      expect(hallazgos(linea).join(" ")).toContain(esperado);
    });
  }

  for (const linea of ["127.0.0.1:5008", "0.0.0.0", [192, 168, 0, 10].join("."), [10, 0, 0, 1].join("."), "203.0.113.7", "RUN --mount=type=cache,target=/root/.npm npm ci", "el túnel de Cloudflare", "postgres:16-alpine"]) {
    it(`deja pasar «${linea}»`, () => {
      expect(hallazgos(linea)).toEqual([]);
    });
  }
});
