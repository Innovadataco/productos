// La plantilla del archivo de producción (docs/despliegue/env-inversiones-production.example) declara
// exactamente las variables que interpola docker-compose.prod.yml, más las que lee solo un script (SOLO_DE_SCRIPTS),
// y no trae ningún valor secreto.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carpetaTemporal, envProduccionFicticio, leer008 } from "./falsos";

const ejemplo = leer008("docs/despliegue/env-inversiones-production.example");
const compose = leer008("docker-compose.prod.yml")
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");

const enCompose = new Set([...compose.matchAll(/\$\{([A-Z0-9_]+)[:?}-]/g)].map((m) => m[1]!));
enCompose.delete("INV_TAG"); // lo exporta desplegar-prod.sh: es el sha, no va en el archivo
// Las dos que pasan los scripts con `env` (armar_compose): la carpeta de respaldos sale de la configuración no
// secreta (inv-008.conf) y la ruta de la pausa, de la ubicación del clon. Nunca van en el archivo de producción.
const DEL_SCRIPT = ["INV_RESPALDOS_DIR", "INV_RUTA_PAUSA"];
for (const n of DEL_SCRIPT) enCompose.delete(n);
const activas = new Map(
  ejemplo
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)] as const),
);
const obligatorias = new Set([...compose.matchAll(/\$\{([A-Z0-9_]+):\?/g)].map((m) => m[1]!));
const opcionales = new Set([...ejemplo.matchAll(/^# ([A-Z0-9_]+)=/gm)].map((m) => m[1]!));
// Las que lee un script y todavía no interpola el compose. Hoy ninguna: INV_PRECIOS_DATABASE_URL la lee
// crear-roles-prod.sh para darle LOGIN y clave a inv_precios (sin ella, el rol queda NOLOGIN y sin clave) y, desde el
// servicio de precios (PR 3, D-018), la interpola también el compose (opcional, ${…:-}): salió de esta lista.
const SOLO_DE_SCRIPTS: string[] = [];

describe("plantilla del archivo de producción", () => {
  it("cubre exactamente las variables que interpola el compose y las que lee solo un script (las opcionales, comentadas)", () => {
    expect([...new Set([...activas.keys(), ...opcionales])].sort()).toEqual([...new Set([...enCompose, ...SOLO_DE_SCRIPTS])].sort());
  });

  it("las de SOLO_DE_SCRIPTS no las interpola el compose y sí las lee un script de producción", () => {
    const rolesSh = leer008("scripts/crear-roles-prod.sh");
    for (const n of SOLO_DE_SCRIPTS) {
      expect(enCompose.has(n), `${n} ya está en el compose: sáquela de SOLO_DE_SCRIPTS`).toBe(false);
      expect(rolesSh, n).toMatch(new RegExp(`leer_variable_env "\\$INV_ENV_PROD" ${n}\\b`));
    }
  });

  it("INV_PRECIOS_DATABASE_URL: la interpola el compose (opcional, sin :?) y la sigue leyendo crear-roles-prod.sh", () => {
    expect(enCompose.has("INV_PRECIOS_DATABASE_URL")).toBe(true);
    expect(obligatorias.has("INV_PRECIOS_DATABASE_URL")).toBe(false);
    expect(compose).toContain("${INV_PRECIOS_DATABASE_URL:-}");
    expect(leer008("scripts/crear-roles-prod.sh")).toMatch(/leer_variable_env "\$INV_ENV_PROD" INV_PRECIOS_DATABASE_URL\b/);
  });

  it("INV_PRECIOS_DATABASE_URL va solo comentada (sin ella el rol queda NOLOGIN y sin clave) y con el formato del ESTADO", () => {
    expect(activas.has("INV_PRECIOS_DATABASE_URL")).toBe(false);
    expect(ejemplo).toContain("\n# INV_PRECIOS_DATABASE_URL=postgresql://inv_precios:<clave>@inv-008-db:5432/inversiones?connection_limit=2\n");
  });

  it("no trae valores: solo vacíos, marcadores <clave> o el origen público", () => {
    for (const [nombre, valor] of activas) {
      if (nombre === "APP_ORIGEN") expect(valor).toBe("https://inversiones.innovadataco.com");
      else if (nombre === "INV_RESPALDO_GID") expect(valor).toBe("");
      else expect(valor.replace(/<clave>/g, ""), nombre).toMatch(/^(|postgresql:\/\/inv_(dueno|app):@inv-008-db:5432\/inversiones\?schema=public&connection_limit=[35])$/);
    }
  });

  it("todas las claves secretas del compose son obligatorias (${VAR:?…})", () => {
    for (const nombre of ["INV_POSTGRES_CLAVE", "INV_DUENO_DATABASE_URL", "INV_APP_DATABASE_URL", "INV_AUTH_SECRET", "INV_CIFRADO_CLAVE_ACTIVA", "INV_CIFRADO_CLAVE_V1", "INV_AGE_PUBLICA", "INV_TELEGRAM_BOT_TOKEN", "INV_TELEGRAM_CHAT_ID", "APP_ORIGEN", "INV_RESPALDO_GID"]) {
      expect(compose, nombre).toContain(`\${${nombre}:?falta ${nombre}}`);
    }
  });
});

describe("variables que ponen los scripts (no el archivo de producción)", () => {
  it("el compose interpola la carpeta de respaldos y la ruta de la pausa, y la plantilla no las trae", () => {
    for (const n of DEL_SCRIPT) {
      expect(compose, n).toContain(`\${${n}:-`);
      expect(ejemplo, n).not.toMatch(new RegExp(`^#? ?${n}=`, "m"));
    }
  });
});

describe("plantilla de la configuración no secreta (docs/despliegue/inv-008.conf.example)", () => {
  const conf = leer008("docs/despliegue/inv-008.conf.example");
  const activas = conf.split("\n").filter((l) => l && !l.startsWith("#"));

  it("trae exactamente una clave, la carpeta de respaldos, con el marcador y sin la ruta real", () => {
    expect(activas).toEqual(["INV_RESPALDOS_DIR=<ver ESTADO en la gestión>"]);
  });
});

describe("archivo de producción ficticio de las pruebas (falsos.ts)", () => {
  // Si se desfasa del compose, las pruebas de los scripts corren con un archivo que en el VPS no arrancaría.
  it("trae todas las variables obligatorias del compose y ninguna que el compose no use", () => {
    const archivo = envProduccionFicticio(carpetaTemporal("env-ficticio"));
    const nombres = readFileSync(archivo, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(0, l.indexOf("=")));
    expect(nombres.filter((n) => !enCompose.has(n))).toEqual([]);
    expect([...obligatorias].filter((n) => !nombres.includes(n))).toEqual([]);
  });
});
