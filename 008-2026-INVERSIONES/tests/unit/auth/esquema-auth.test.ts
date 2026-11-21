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

// Candado del esquema del TOTP: el secreto va cifrado (sobre en jsonb), el antireplay y la pre-sesión
// viven en Usuario, y los códigos de recuperación solo guardan su sha256. La migración es aditiva.
const VALORES_TOTP = [
  "TOTP_EXITO",
  "TOTP_INCORRECTO",
  "TOTP_REPETIDO",
  "RECUPERACION_USADA",
  "RECUPERACION_INVALIDA",
  "TOTP_ENROLADO",
  "TOTP_REINICIADO",
  "CODIGOS_REGENERADOS",
  "BLOQUEO_SEGUNDO_PASO",
  "TOTP_PENDIENTE",
] as const;

/** La segunda migración del TOTP: el índice parcial que usa valores del enum agregados en la primera. */
const leerMigracion = (nombre: string): string => readFileSync(raiz(`prisma/migrations/${nombre}/migration.sql`), "utf8");

/** La migración del TOTP: la única que crea `codigo_recuperacion`. */
function migracionDelTotp(): string {
  const carpeta = raiz("prisma/migrations");
  const sql = readdirSync(carpeta, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readFileSync(`${carpeta}/${d.name}/migration.sql`, "utf8"))
    .filter((s) => s.includes('CREATE TABLE "codigo_recuperacion"'));
  expect(sql, "migraciones que crean codigo_recuperacion").toHaveLength(1);
  return sql[0] ?? "";
}

describe("candado del esquema del TOTP", () => {
  it("Usuario guarda el sobre del secreto, la activación, el último paso y el hash de la pre-sesión", () => {
    const u = campos("Usuario");
    expect(u.get("totpSecreto")).toMatch(/^Json\?(\s|$)/);
    expect(u.get("totpActivadoEn")).toMatch(/^DateTime\?\s+@db\.Timestamptz\(6\)/);
    expect(u.get("totpUltimoPaso")).toMatch(/^Int\?(\s|$)/);
    expect(u.get("presesionHash")).toMatch(/^String\?\s+@db\.Char\(64\)/);
  });

  it("ningún campo guarda el secreto o un código en claro", () => {
    expect([...campos("Usuario").keys()].filter((k) => /totp|secreto|otp/i.test(k)).sort()).toEqual(["totpActivadoEn", "totpSecreto", "totpUltimoPaso"]);
    const c = campos("CodigoRecuperacion");
    expect([...c.keys()].filter((k) => /codigo/i.test(k))).toEqual(["codigoHash"]);
    expect(c.get("codigoHash")).toMatch(/^String\s+@unique\s+@db\.Char\(64\)/);
    expect(c.get("usadoEn")).toMatch(/^DateTime\?\s+@db\.Timestamptz\(6\)/);
    expect(c.get("anuladoEn")).toMatch(/^DateTime\?\s+@db\.Timestamptz\(6\)/);
  });

  it("ResultadoIngreso trae los resultados del segundo paso", () => {
    const bloque = /enum ResultadoIngreso \{([\s\S]*?)\}/.exec(codigo)?.[1] ?? "";
    for (const valor of VALORES_TOTP) expect(bloque, valor).toMatch(new RegExp(`\\b${valor}\\b`));
  });

  it("la migración del TOTP es aditiva: sin DROP, RENAME, TRUNCATE ni ALTER COLUMN", () => {
    const sql = migracionDelTotp().replace(/--.*$/gm, "");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i);
  });

  it("los valores nuevos del enum no se usan en la misma migración (PostgreSQL lo prohíbe)", () => {
    const sql = migracionDelTotp().replace(/--.*$/gm, "");
    for (const valor of VALORES_TOTP) expect(sql, valor).toContain(`ALTER TYPE "ResultadoIngreso" ADD VALUE '${valor}'`);
    const resto = sql.replace(/^ALTER TYPE "ResultadoIngreso" ADD VALUE '[A-Z_]+';$/gm, "");
    for (const valor of VALORES_TOTP) expect(resto, valor).not.toContain(valor);
  });

  it("la segunda migración del TOTP es aditiva y trae el índice parcial del último reinicio", () => {
    const sql = leerMigracion("20261121061000_totp_indices");
    const sinComentarios = sql.replace(/--.*$/gm, "");
    for (const prohibido of [/\bDROP\b/i, /\bRENAME\b/i, /\bTRUNCATE\b/i, /\bALTER\s+COLUMN\b/i, /\bADD VALUE\b/i]) expect(sinComentarios).not.toMatch(prohibido);
    expect(sql).toMatch(
      /CREATE INDEX "intento_ingreso_reinicio_totp_idx" ON "intento_ingreso" \("usuarioId", "ocurridoEn" DESC\)\s+WHERE "resultado" IN \('TOTP_EXITO', 'RECUPERACION_USADA', 'TOTP_ENROLADO', 'CODIGOS_REGENERADOS', 'TOTP_REINICIADO', 'CLAVE_DEFINIDA'\)/,
    );
  });

  it("la migración trae el disparador de un solo uso, sus CHECK y el índice de los vigentes", () => {
    const sql = migracionDelTotp();
    expect(sql).toMatch(/CREATE TRIGGER "codigo_recuperacion_un_solo_uso"\s+BEFORE UPDATE OR DELETE ON "codigo_recuperacion"/);
    for (const chk of [
      "usuario_totp_secreto_chk",
      "usuario_totp_chk",
      "usuario_totp_paso_chk",
      "usuario_presesion_hash_chk",
      "codigo_recuperacion_hash_chk",
      "codigo_recuperacion_marca_chk",
      "codigo_recuperacion_fechas_chk",
    ]) {
      expect(sql, chk).toContain(`"${chk}"`);
    }
    expect(sql).toMatch(/CREATE INDEX "codigo_recuperacion_vigentes_idx" ON "codigo_recuperacion" \("usuarioId"\)\s+WHERE "usadoEn" IS NULL AND "anuladoEn" IS NULL/);
  });
});
