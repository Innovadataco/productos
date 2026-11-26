// El cableado del servicio de las alertas contra la base de PRUEBAS: la evaluación (`correr`) sale 0 con conteos y la segunda no
// inserta nada, el calendario real decide el día hábil y el rol se revisa con current_user. NODE_ENV=test e INV_ALERTAS_ROL_PRUEBA
// hacen aceptar al usuario de la base de pruebas como el rol equivalente (en producción esa variable no se mira). Deja la base como la
// encontró: borra lo que la prueba guardó. Datos inventados.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dependenciasReales, type Proceso } from "@/servicio-alertas/cableado";
import { exigirBaseDePruebas } from "./apoyo/base-de-pruebas";

const db = new PrismaClient();
const USUARIO_BASE = decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").username);
let inicio = new Date();

const proceso = (env: Record<string, string>): Proceso => ({
  env: { NODE_ENV: "test", INV_ALERTAS_ROL_PRUEBA: USUARIO_BASE, ...env },
  stdout: { write: () => true },
  once: () => undefined,
  removeListener: () => undefined,
});

beforeAll(async () => {
  await exigirBaseDePruebas(db);
  inicio = new Date(Date.now() - 1000);
});

afterAll(async () => {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
    await tx.$executeRaw`DELETE FROM alerta_vista WHERE "alertaId" IN (SELECT id FROM alerta WHERE "detectadaEn" >= ${inicio})`;
    await tx.$executeRaw`DELETE FROM alerta WHERE "detectadaEn" >= ${inicio}`;
  });
  await db.$disconnect();
});

describe("servicio de las alertas · cableado real", () => {
  it("revisarRol acepta el usuario de la base de pruebas solo con la variable de prueba (y NODE_ENV=test)", async () => {
    expect(await dependenciasReales(proceso({}), db).revisarRol()).toBe(true);
    expect(await dependenciasReales(proceso({ NODE_ENV: "production" }), db).revisarRol()).toBe(false);
  });

  it("correr evalúa y guarda con salida 0; la segunda vez no inserta nada", async () => {
    const d = dependenciasReales(proceso({}), db);
    const primera = await d.correr(new Date());
    expect(primera.codigoSalida).toBe(0);
    expect(primera.resultado.fallidas).toBe(0);
    const segunda = await d.correr(new Date());
    expect(segunda.codigoSalida).toBe(0);
    expect(segunda.resultado.insertadas).toBe(0);
  });

  it("esHabil lee el calendario real: un sábado nunca es hábil", async () => {
    const d = dependenciasReales(proceso({}), db);
    expect(await d.esHabil(new Date("2027-03-20T00:00:00.000Z"))).toBe(false);
  });
});
