// Integración del esquema del TOTP contra la base de PRUEBAS: los CHECK escritos a mano muerden y los
// códigos de recuperación son de un solo uso (solo se marca usadoEn o anuladoEn, una vez; nunca DELETE).
// Datos inventados: correos `@ejemplo.invalid`, hashes y sobres de forma válida que no cifran nada real.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const corrida = Date.now().toString(36);
let n = 0;
/** Un sobre con la forma de src/cifrado/sobre.ts (no descifra nada: solo prueba el CHECK de forma). */
const SOBRE = { v: 1, kid: "v1", iv: "AAAAAAAAAAAAAAAA", tag: "AAAAAAAAAAAAAAAAAAAAAA==", ct: "AAAA" };
const hex = (c: string) => c.repeat(64);
const CREADO = new Date(Date.UTC(2030, 0, 1));

async function usuario(): Promise<string> {
  return (await db.usuario.create({ data: { email: `totp-esquema-${corrida}-${(n += 1)}@ejemplo.invalid`, rol: "DUENO" } })).id;
}

async function codigo(usuarioId: string, caracter: string) {
  return db.codigoRecuperacion.create({ data: { usuarioId, codigoHash: hex(caracter).slice(0, 63) + String(n++ % 10), creadoEn: CREADO } });
}

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("Usuario: secreto, activación y antireplay", () => {
  it("un usuario nuevo nace sin TOTP", async () => {
    const u = await db.usuario.findUniqueOrThrow({ where: { id: await usuario() } });
    expect(u).toMatchObject({ totpSecreto: null, totpActivadoEn: null, totpUltimoPaso: null, presesionHash: null });
  });

  it("el secreto solo admite un sobre con exactamente sus 5 llaves", async () => {
    const id = await usuario();
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: SOBRE } })).resolves.toBeTruthy();
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: { ...SOBRE, claro: "x" } } })).rejects.toThrow(/usuario_totp_secreto_chk/);
    const { ct: _ct, ...sinCt } = SOBRE;
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: sinCt } })).rejects.toThrow(/usuario_totp_secreto_chk/);
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" } })).rejects.toThrow(/usuario_totp_secreto_chk/);
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: Prisma.JsonNull } })).rejects.toThrow(/usuario_totp_secreto_chk/);
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: Prisma.DbNull } })).resolves.toBeTruthy();
  });

  it("activado exige secreto y último paso, y sin activar no hay último paso", async () => {
    const id = await usuario();
    const ahora = new Date();
    await expect(db.usuario.update({ where: { id }, data: { totpActivadoEn: ahora, totpUltimoPaso: 1 } })).rejects.toThrow(/usuario_totp_chk/);
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: SOBRE, totpActivadoEn: ahora } })).rejects.toThrow(/usuario_totp_chk/);
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: SOBRE, totpUltimoPaso: 1 } })).rejects.toThrow(/usuario_totp_chk/);
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: SOBRE, totpActivadoEn: ahora, totpUltimoPaso: 1 } })).resolves.toBeTruthy();
    await expect(db.usuario.update({ where: { id }, data: { totpSecreto: Prisma.DbNull } })).rejects.toThrow(/usuario_totp_chk/);
  });

  it("el último paso no es negativo", async () => {
    const id = await usuario();
    await expect(
      db.usuario.update({ where: { id }, data: { totpSecreto: SOBRE, totpActivadoEn: new Date(), totpUltimoPaso: -1 } }),
    ).rejects.toThrow(/usuario_totp_paso_chk/);
  });

  it("la pre-sesión solo guarda un sha256 hexadecimal", async () => {
    const id = await usuario();
    await expect(db.usuario.update({ where: { id }, data: { presesionHash: hex("a") } })).resolves.toBeTruthy();
    await expect(db.usuario.update({ where: { id }, data: { presesionHash: hex("G") } })).rejects.toThrow(/usuario_presesion_hash_chk/);
  });
});

describe("codigo_recuperacion", () => {
  it("solo guarda un sha256 hexadecimal, único", async () => {
    const id = await usuario();
    await expect(db.codigoRecuperacion.create({ data: { usuarioId: id, codigoHash: hex("Z"), creadoEn: CREADO } })).rejects.toThrow(
      /codigo_recuperacion_hash_chk/,
    );
    const c = await codigo(id, "b");
    await expect(db.codigoRecuperacion.create({ data: { usuarioId: id, codigoHash: c.codigoHash, creadoEn: CREADO } })).rejects.toThrow();
  });

  it("se marca usado una sola vez y ya no cambia", async () => {
    const c = await codigo(await usuario(), "c");
    const usado = new Date(Date.UTC(2030, 0, 2));
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { usadoEn: usado } })).resolves.toBeTruthy();
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { usadoEn: new Date(Date.UTC(2030, 0, 3)) } })).rejects.toThrow(/un solo uso/);
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { usadoEn: null } })).rejects.toThrow(/un solo uso/);
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { anuladoEn: usado } })).rejects.toThrow(/un solo uso|codigo_recuperacion_marca_chk/);
  });

  it("se anula una sola vez, y un anulado no se puede usar", async () => {
    const c = await codigo(await usuario(), "d");
    const anulado = new Date(Date.UTC(2030, 0, 2));
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { anuladoEn: anulado } })).resolves.toBeTruthy();
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { usadoEn: anulado } })).rejects.toThrow(/un solo uso|codigo_recuperacion_marca_chk/);
  });

  it("no se marcan las dos cosas a la vez ni se toca otra columna", async () => {
    const c = await codigo(await usuario(), "e");
    const t = new Date(Date.UTC(2030, 0, 2));
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { usadoEn: t, anuladoEn: t } })).rejects.toThrow(
      /un solo uso|codigo_recuperacion_marca_chk/,
    );
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { codigoHash: hex("f") } })).rejects.toThrow(/un solo uso/);
  });

  it("una marca no puede ser anterior a la creación", async () => {
    const c = await codigo(await usuario(), "1");
    await expect(db.codigoRecuperacion.update({ where: { id: c.id }, data: { usadoEn: new Date(Date.UTC(2029, 0, 1)) } })).rejects.toThrow(
      /codigo_recuperacion_fechas_chk/,
    );
  });

  it("no se borra", async () => {
    const c = await codigo(await usuario(), "2");
    await expect(db.codigoRecuperacion.delete({ where: { id: c.id } })).rejects.toThrow(/un solo uso/);
  });
});

describe("enum del registro de intentos", () => {
  it("acepta los resultados del segundo paso, siempre con usuario", async () => {
    const id = await usuario();
    for (const resultado of ["TOTP_EXITO", "TOTP_INCORRECTO", "TOTP_REPETIDO", "RECUPERACION_USADA", "RECUPERACION_INVALIDA", "TOTP_ENROLADO", "TOTP_REINICIADO", "CODIGOS_REGENERADOS", "BLOQUEO_SEGUNDO_PASO", "TOTP_PENDIENTE"] as const) {
      await expect(db.intentoIngreso.create({ data: { usuarioId: id, resultado } })).resolves.toBeTruthy();
      await expect(db.intentoIngreso.create({ data: { resultado } })).rejects.toThrow(/intento_ingreso_usuario_chk/);
    }
  });
});
