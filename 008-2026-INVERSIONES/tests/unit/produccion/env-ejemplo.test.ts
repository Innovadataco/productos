// La plantilla del archivo de producción (docs/despliegue/env-inversiones-production.example) declara
// exactamente las variables que interpola docker-compose.prod.yml, y no trae ningún valor secreto.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const ejemplo = leer008("docs/despliegue/env-inversiones-production.example");
const compose = leer008("docker-compose.prod.yml")
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");

const enCompose = new Set([...compose.matchAll(/\$\{([A-Z0-9_]+)[:?}-]/g)].map((m) => m[1]!));
enCompose.delete("INV_TAG"); // lo exporta desplegar-prod.sh: es el sha, no va en el archivo
const activas = new Map(
  ejemplo
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)] as const),
);
const opcionales = new Set([...ejemplo.matchAll(/^# ([A-Z0-9_]+)=/gm)].map((m) => m[1]!));

describe("plantilla del archivo de producción", () => {
  it("cubre exactamente las variables que interpola el compose (las opcionales, comentadas)", () => {
    expect([...new Set([...activas.keys(), ...opcionales])].sort()).toEqual([...enCompose].sort());
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
