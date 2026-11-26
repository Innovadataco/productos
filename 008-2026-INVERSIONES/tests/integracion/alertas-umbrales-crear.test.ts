// crearVersionUmbral contra la base de PRUEBAS: la siguiente versión del número, el autor de la sesión, los valores exactos
// (DECIMAL(5,2)), 409 si la versión de partida ya no es la última (también con dos a la vez: gana una) y 403 si el autor no existe.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearVersionUmbral } from "@/app/edicion/alertas/crear";
import { ErrorUmbral } from "@/app/edicion/alertas/errores";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const db = new PrismaClient();
const corrida = Date.now().toString(36).slice(-6);
let autorId = "";
let familiaId = "";
const ultima = async (): Promise<number> => (await db.umbralVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
const entrada = (cambios = {}) => ({ umbrales: { ...UMBRALES_OMISION, alertaCercaPct: 3.25, alertaMovimientoActiva: false, ...cambios }, motivo: "Umbrales ficticios de la prueba" });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  familiaId = (await db.usuario.create({ data: { email: `familia-umbrales-${corrida}@ejemplo.invalid`, rol: "FAMILIA" } })).id;
  autorId = (await db.usuario.create({ data: { email: `dueno-umbrales-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});
afterAll(async () => {
  await db.$disconnect();
});

describe("crearVersionUmbral", () => {
  it("crea la versión siguiente con el autor, los valores exactos y la hora de la base", async () => {
    const antes = await ultima();
    const r = await crearVersionUmbral(db, entrada(), { autorId, ultimaEsperada: antes });
    expect(r).toEqual({ version: antes + 1 });
    const fila = await db.umbralVersion.findFirstOrThrow({ where: { version: antes + 1 } });
    expect(fila).toMatchObject({ autorId, alertaCercaActiva: true, alertaMovimientoActiva: false, alertaDatoViejoMin: 30, alertaExDiasHabiles: 3, motivo: "Umbrales ficticios de la prueba" });
    expect(fila.alertaCercaPct.toString()).toBe("3.25");
    expect(fila.alertaMovimientoPct.toString()).toBe("3");
    expect(Math.abs(Date.now() - fila.creadaEn.getTime())).toBeLessThan(60_000);
  });

  it("si la versión de partida ya no es la última, UMBRAL_CAMBIO y no escribe nada", async () => {
    const actual = await ultima();
    await expect(crearVersionUmbral(db, entrada(), { autorId, ultimaEsperada: actual - 1 })).rejects.toMatchObject({ codigo: "UMBRAL_CAMBIO" });
    expect(await ultima()).toBe(actual);
  });

  it("dos a la vez con la misma partida: gana una y la otra recibe UMBRAL_CAMBIO", async () => {
    const actual = await ultima();
    const resultados = await Promise.allSettled([crearVersionUmbral(db, entrada(), { autorId, ultimaEsperada: actual }), crearVersionUmbral(db, entrada({ alertaCercaPct: 4 }), { autorId, ultimaEsperada: actual })]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const perdida = resultados.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(perdida?.reason).toBeInstanceOf(ErrorUmbral);
    expect((perdida?.reason as ErrorUmbral).codigo).toBe("UMBRAL_CAMBIO");
    expect(await ultima()).toBe(actual + 1);
  });

  it("un autor que no existe es AUTOR_INEXISTENTE", async () => {
    await expect(crearVersionUmbral(db, entrada(), { autorId: "no-existe", ultimaEsperada: await ultima() })).rejects.toMatchObject({ codigo: "AUTOR_INEXISTENTE" });
  });

  it("un usuario de la familia tampoco firma (el disparador de la base): AUTOR_INEXISTENTE sin escribir", async () => {
    const antes = await ultima();
    await expect(crearVersionUmbral(db, entrada(), { autorId: familiaId, ultimaEsperada: antes })).rejects.toMatchObject({ codigo: "AUTOR_INEXISTENTE" });
    expect(await ultima()).toBe(antes);
  });
});
