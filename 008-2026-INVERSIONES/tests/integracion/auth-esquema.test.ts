// Integración del esquema del login (D-014) contra la base de PRUEBAS. Datos inventados.
// Candado: el registro de intentos es de solo inserción, los CHECK escritos a mano muerden y las transiciones
// de usuario (versión de sesión, clave y TOTP) solo van hacia adelante.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
/** Hash bcrypt de costo 12 con forma válida (no corresponde a ninguna contraseña usada). */
const HASH_DE_FORMA_VALIDA = `$2b$12$${"a".repeat(53)}`;
let usuarioId = "";

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  usuarioId = (await db.usuario.create({ data: { email: `esquema-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("esquema del login", () => {
  it("un usuario nuevo nace con sesionVersion 1, sin clave y sin bloqueo", async () => {
    const u = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(u.sesionVersion).toBe(1);
    expect(u.claveHash).toBeNull();
    expect(u.bloqueadoHasta).toBeNull();
  });

  it("el registro de intentos es de solo inserción", async () => {
    const intento = await db.intentoIngreso.create({ data: { usuarioId, ip: "203.0.113.7", resultado: "CLAVE_INCORRECTA" } });
    await expect(db.intentoIngreso.update({ where: { id: intento.id }, data: { resultado: "EXITO" } })).rejects.toThrow(/solo inserción/);
    await expect(db.intentoIngreso.delete({ where: { id: intento.id } })).rejects.toThrow(/solo inserción/);
  });

  it("guarda la IP como inet y rechaza un texto que no es IP", async () => {
    const v6 = await db.intentoIngreso.create({ data: { usuarioId, ip: "2001:db8::1", resultado: "EXITO" } });
    expect(v6.ip).toBe("2001:db8::1");
    await expect(db.intentoIngreso.create({ data: { usuarioId, ip: "no-es-ip", resultado: "EXITO" } })).rejects.toThrow();
  });

  it("un intento sin usuario solo puede ser USUARIO_INEXISTENTE, y viceversa", async () => {
    await expect(db.intentoIngreso.create({ data: { resultado: "USUARIO_INEXISTENTE" } })).resolves.toBeTruthy();
    await expect(db.intentoIngreso.create({ data: { resultado: "CLAVE_INCORRECTA" } })).rejects.toThrow(/intento_ingreso_usuario_chk/);
    await expect(db.intentoIngreso.create({ data: { usuarioId, resultado: "USUARIO_INEXISTENTE" } })).rejects.toThrow(
      /intento_ingreso_usuario_chk/,
    );
  });

  it("claveHash solo admite bcrypt de costo 12", async () => {
    await expect(db.usuario.update({ where: { id: usuarioId }, data: { claveHash: HASH_DE_FORMA_VALIDA } })).resolves.toBeTruthy();
    // Con la versión de sesión subiendo (como cambia la clave el login): lo que frena es el CHECK.
    const conVersion = (claveHash: string) => ({ claveHash, sesionVersion: { increment: 1 } });
    await expect(db.usuario.update({ where: { id: usuarioId }, data: conVersion(`$2b$10$${"a".repeat(53)}`) })).rejects.toThrow(
      /usuario_clave_hash_chk/,
    );
    await expect(db.usuario.update({ where: { id: usuarioId }, data: conVersion("texto-plano-ficticio") })).rejects.toThrow(
      /usuario_clave_hash_chk/,
    );
  });

  it("sesionVersion no nace por debajo de 1", async () => {
    await expect(
      db.usuario.create({ data: { email: `esquema-${corrida}-v0@ejemplo.invalid`, rol: "DUENO", sesionVersion: 0 } }),
    ).rejects.toThrow(/usuario_sesion_version_chk/);
  });
});

// D2 (database-reviewer): inv_app tiene UPDATE por columna en usuario (docker/migrador/privilegios.sql). Sin
// el disparador usuario_transiciones, una app comprometida podía bajar sesionVersion y revivir JWT revocados.
describe("transiciones de usuario (disparador usuario_transiciones)", () => {
  /** Hash bcrypt de costo 12 con forma válida, distinto del de arriba (no es de ninguna contraseña usada). */
  const OTRO_HASH = `$2b$12$${"b".repeat(53)}`;
  const SOBRE = { v: 1, kid: "v1", iv: "AAAAAAAAAAAAAAAA", tag: "AAAAAAAAAAAAAAAAAAAAAA==", ct: "AAAA" };
  let k = 0;
  const nuevo = async (datos: Record<string, unknown> = {}) =>
    (await db.usuario.create({ data: { email: `transiciones-${corrida}-${(k += 1)}@ejemplo.invalid`, rol: "DUENO", ...datos } })).id;

  it("sesionVersion nunca baja: cerrar sesiones no se deshace", async () => {
    const id = await nuevo({ sesionVersion: 3 });
    await expect(db.usuario.update({ where: { id }, data: { sesionVersion: 2 } })).rejects.toThrow(/la versión de sesión no baja/);
    await expect(db.usuario.update({ where: { id }, data: { sesionVersion: 3, bloqueadoHasta: null } })).resolves.toBeTruthy();
    await expect(db.usuario.update({ where: { id }, data: { sesionVersion: { increment: 1 } } })).resolves.toMatchObject({ sesionVersion: 4 });
  });

  it("sesionVersion sube de a uno: un salto no agota el entero (cerraría el acceso para siempre, porque no baja)", async () => {
    const id = await nuevo();
    await expect(db.usuario.update({ where: { id }, data: { sesionVersion: 3 } })).rejects.toThrow(/la versión de sesión sube de a uno/);
    await expect(db.usuario.update({ where: { id }, data: { sesionVersion: 2_147_483_647 } })).rejects.toThrow(/la versión de sesión sube de a uno/);
    await expect(db.usuario.update({ where: { id }, data: { sesionVersion: { increment: 1 } } })).resolves.toMatchObject({ sesionVersion: 2 });
  });

  it("con el TOTP activo, el último paso no se puede poner en NULL sin apagarlo (lo frena usuario_totp_chk)", async () => {
    const id = await nuevo({ totpSecreto: SOBRE, totpActivadoEn: new Date(), totpUltimoPaso: 100 });
    await expect(db.usuario.update({ where: { id }, data: { totpUltimoPaso: null } })).rejects.toThrow(/usuario_totp_chk/);
  });

  it("cambiar o quitar la clave exige subir sesionVersion en el mismo UPDATE (así lo hace definirClave)", async () => {
    const id = await nuevo({ claveHash: HASH_DE_FORMA_VALIDA });
    await expect(db.usuario.update({ where: { id }, data: { claveHash: OTRO_HASH } })).rejects.toThrow(/cambiar o quitar la clave/);
    await expect(db.usuario.update({ where: { id }, data: { claveHash: null } })).rejects.toThrow(/cambiar o quitar la clave/);
    await expect(db.usuario.update({ where: { id }, data: { claveHash: OTRO_HASH, sesionVersion: { increment: 1 } } })).resolves.toBeTruthy();
  });

  it("la primera clave (de nula a un hash) no exige subir la versión: sin clave no había sesión que cerrar", async () => {
    const id = await nuevo();
    await expect(db.usuario.update({ where: { id }, data: { claveHash: HASH_DE_FORMA_VALIDA } })).resolves.toMatchObject({ sesionVersion: 1 });
  });

  it("con el TOTP activo, el último paso nunca baja (antireplay)", async () => {
    const id = await nuevo({ totpSecreto: SOBRE, totpActivadoEn: new Date(), totpUltimoPaso: 100 });
    await expect(db.usuario.update({ where: { id }, data: { totpUltimoPaso: 99 } })).rejects.toThrow(/último paso del TOTP no baja/);
    await expect(db.usuario.update({ where: { id }, data: { totpUltimoPaso: 100, presesionHash: null } })).resolves.toBeTruthy();
    await expect(db.usuario.update({ where: { id }, data: { totpUltimoPaso: 101 } })).resolves.toBeTruthy();
  });

  it("apagar el TOTP (reiniciarlo) exige subir sesionVersion; después se puede enrolar de nuevo desde el paso que toque", async () => {
    const id = await nuevo({ totpSecreto: SOBRE, totpActivadoEn: new Date(), totpUltimoPaso: 100 });
    const apagar = { totpSecreto: Prisma.DbNull, totpActivadoEn: null, totpUltimoPaso: null };
    await expect(db.usuario.update({ where: { id }, data: apagar })).rejects.toThrow(/apagar el TOTP/);
    await expect(db.usuario.update({ where: { id }, data: { ...apagar, sesionVersion: { increment: 1 } } })).resolves.toBeTruthy();
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: SOBRE, totpActivadoEn: new Date(), totpUltimoPaso: 5 } })).resolves.toBeTruthy();
  });

  it("es un disparador BEFORE UPDATE por fila, sin columnas ni WHEN (no se esquiva tocando otra columna)", async () => {
    const filas = await db.$queryRaw<{ def: string }[]>`
      SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
      WHERE t.tgrelid = 'public.usuario'::regclass AND t.tgname = 'usuario_transiciones'`;
    expect(filas.map((f) => f.def)).toEqual([
      "CREATE TRIGGER usuario_transiciones BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION inv_usuario_transiciones()",
    ]);
  });
});

describe("esquema del enlace de un solo uso (token_acceso)", () => {
  const ahora = new Date(Date.UTC(2030, 5, 1, 12, 0, 0));
  const en = (min: number) => new Date(ahora.getTime() + min * 60_000);
  let k = 0;
  const hashNuevo = () => (k += 1).toString(16).padStart(8, "0").padEnd(64, "c");

  it("solo admite marcar el uso una vez: ni otro UPDATE ni DELETE", async () => {
    const t = await db.tokenAcceso.create({ data: { usuarioId, tokenHash: hashNuevo(), proposito: "INICIAL", creadoEn: ahora, venceEn: en(30) } });
    await expect(db.tokenAcceso.update({ where: { id: t.id }, data: { venceEn: en(29) } })).rejects.toThrow(/un solo uso/);
    await expect(db.tokenAcceso.update({ where: { id: t.id }, data: { usadoEn: en(1) } })).resolves.toBeTruthy();
    await expect(db.tokenAcceso.update({ where: { id: t.id }, data: { usadoEn: en(2) } })).rejects.toThrow(/un solo uso/);
    await expect(db.tokenAcceso.delete({ where: { id: t.id } })).rejects.toThrow(/un solo uso/);
  });

  it("el hash es sha256 en hexadecimal y es único", async () => {
    const hash = hashNuevo();
    await db.tokenAcceso.create({ data: { usuarioId, tokenHash: hash, proposito: "INICIAL", creadoEn: ahora, venceEn: en(30) } });
    await expect(db.tokenAcceso.create({ data: { usuarioId, tokenHash: hash, proposito: "INICIAL", creadoEn: ahora, venceEn: en(30) } })).rejects.toThrow(
      /Unique constraint/,
    );
    await expect(
      db.tokenAcceso.create({ data: { usuarioId, tokenHash: "Z".repeat(64), proposito: "INICIAL", creadoEn: ahora, venceEn: en(30) } }),
    ).rejects.toThrow(/token_acceso_hash_chk/);
  });

  it("vence después de creado y a más tardar a los 30 minutos", async () => {
    await expect(
      db.tokenAcceso.create({ data: { usuarioId, tokenHash: hashNuevo(), proposito: "RECUPERACION", creadoEn: ahora, venceEn: en(31) } }),
    ).rejects.toThrow(/token_acceso_vence_chk/);
    await expect(
      db.tokenAcceso.create({ data: { usuarioId, tokenHash: hashNuevo(), proposito: "RECUPERACION", creadoEn: ahora, venceEn: ahora } }),
    ).rejects.toThrow(/token_acceso_vence_chk/);
  });

  it("un intento de definir clave con token inválido puede quedar sin usuario", async () => {
    await expect(db.intentoIngreso.create({ data: { resultado: "TOKEN_INVALIDO", ip: "203.0.113.200" } })).resolves.toBeTruthy();
    await expect(db.intentoIngreso.create({ data: { resultado: "CLAVE_DEFINIDA" } })).rejects.toThrow(/intento_ingreso_usuario_chk/);
  });
});

describe("índices del login", () => {
  it("los conteos usan índices parciales: fallos por IP y último éxito por cuenta", async () => {
    const filas = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intento_ingreso'`;
    const def = new Map(filas.map((f) => [f.indexname, f.indexdef]));
    expect(def.get("intento_ingreso_fallos_ip_idx")).toMatch(/\(ip, "ocurridoEn"\) WHERE \(resultado <> ALL/);
    expect(def.get("intento_ingreso_ultimo_exito_idx")).toMatch(/\("usuarioId", "ocurridoEn" DESC\) WHERE \(resultado = ANY/);
    expect(def.has("intento_ingreso_ip_ocurridoEn_idx")).toBe(false);
  });
});
