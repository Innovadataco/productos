// Candado del esquema del login (D-014): los campos de la sesión y el registro de intentos.
// La migración del login es aditiva: no borra, no renombra ni altera columnas existentes.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = (ruta: string) => fileURLToPath(new URL(`../../../${ruta}`, import.meta.url));
const esquema = readFileSync(raiz("prisma/schema.prisma"), "utf8");
const codigo = esquema.replace(/\/\/.*$/gm, "");

function campos(modelo: string): Map<string, string> {
  const bloque = new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`).exec(codigo);
  if (!bloque?.[1]) throw new Error(`No existe el modelo ${modelo}`);
  const mapa = new Map<string, string>();
  for (const linea of bloque[1].split("\n")) {
    const m = /^\s+(\w+)\s+(\S+)(.*)$/.exec(linea);
    if (m?.[1] && m[2] && !m[1].startsWith("@@")) mapa.set(m[1], `${m[2]}${m[3] ?? ""}`);
  }
  return mapa;
}

/** La migración del login: la única que crea `intento_ingreso`. */
function migracionDelLogin(): string {
  const carpeta = raiz("prisma/migrations");
  const sql = readdirSync(carpeta, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readFileSync(`${carpeta}/${d.name}/migration.sql`, "utf8"))
    .filter((s) => s.includes('CREATE TABLE "intento_ingreso"'));
  expect(sql, "migraciones que crean intento_ingreso").toHaveLength(1);
  return sql[0] ?? "";
}

describe("candado del esquema del login", () => {
  it("Usuario guarda el hash, la versión de sesión y el bloqueo", () => {
    const u = campos("Usuario");
    expect(u.get("claveHash")).toMatch(/^String\?(\s|$)/);
    expect(u.get("sesionVersion")).toMatch(/^Int\s+@default\(1\)/);
    expect(u.get("bloqueadoHasta")).toMatch(/^DateTime\?\s+@db\.Timestamptz\(6\)/);
  });

  it("IntentoIngreso no guarda el correo tecleado ni la contraseña", () => {
    const i = campos("IntentoIngreso");
    expect(i.get("usuarioId")).toMatch(/^String\?/);
    expect(i.get("ip")).toMatch(/^String\?\s+@db\.Inet/);
    expect(i.get("resultado")).toMatch(/^ResultadoIngreso\b/);
    expect(i.get("ocurridoEn")).toMatch(/^DateTime\s+.*@db\.Timestamptz\(6\)/);
    for (const nombre of i.keys()) expect(nombre).not.toMatch(/email|correo|clave|password/i);
  });

  it("IntentoIngreso no tiene campos de edición (es de solo inserción)", () => {
    const bloque = /model IntentoIngreso \{([\s\S]*?)\n\}/.exec(codigo)?.[1] ?? "";
    expect(bloque).not.toBe("");
    expect(bloque).not.toMatch(/@updatedAt|actualizad|editad/i);
  });

  it("la migración del login es aditiva: sin DROP, RENAME, TRUNCATE ni ALTER COLUMN", () => {
    const sql = migracionDelLogin().replace(/--.*$/gm, "");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i);
  });

  it("la migración del login trae el disparador de solo inserción y sus CHECK", () => {
    const sql = migracionDelLogin();
    expect(sql).toMatch(/CREATE TRIGGER "intento_ingreso_solo_insercion"\s+BEFORE UPDATE OR DELETE ON "intento_ingreso"/);
    expect(sql).toMatch(/CREATE TRIGGER "token_acceso_un_solo_uso"\s+BEFORE UPDATE OR DELETE ON "token_acceso"/);
    for (const chk of [
      "usuario_sesion_version_chk",
      "usuario_clave_hash_chk",
      "intento_ingreso_usuario_chk",
      "token_acceso_hash_chk",
      "token_acceso_vence_chk",
    ]) {
      expect(sql, chk).toContain(`"${chk}"`);
    }
  });

  it("la migración del login trae los índices parciales de los conteos", () => {
    const sql = migracionDelLogin();
    expect(sql).toMatch(/CREATE INDEX "intento_ingreso_fallos_ip_idx" ON "intento_ingreso" \("ip", "ocurridoEn"\)\s+WHERE "resultado" NOT IN/);
    expect(sql).toMatch(/CREATE INDEX "intento_ingreso_ultimo_exito_idx" ON "intento_ingreso" \("usuarioId", "ocurridoEn" DESC\)\s+WHERE "resultado" IN/);
  });

  it("TokenAcceso guarda solo el sha256 del token (único), su propósito, vencimiento y uso", () => {
    const t = campos("TokenAcceso");
    expect(t.get("usuarioId")).toMatch(/^String(\s|$)/);
    expect(t.get("tokenHash")).toMatch(/^String\s+@unique\s+@db\.Char\(64\)/);
    expect(t.get("proposito")).toMatch(/^PropositoToken\b/);
    expect(t.get("venceEn")).toMatch(/^DateTime\s+@db\.Timestamptz\(6\)/);
    expect(t.get("usadoEn")).toMatch(/^DateTime\?\s+@db\.Timestamptz\(6\)/);
    expect(t.get("creadoEn")).toMatch(/^DateTime\s+.*@db\.Timestamptz\(6\)/);
    expect([...t.keys()].filter((k) => /token|clave/i.test(k))).toEqual(["tokenHash"]);
    expect(/enum PropositoToken \{\s*INICIAL\s+RECUPERACION\s*\}/.test(codigo)).toBe(true);
  });
});
