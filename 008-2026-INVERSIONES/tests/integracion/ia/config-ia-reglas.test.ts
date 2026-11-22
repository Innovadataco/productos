// La tabla config_ia (fase E, E8) contra la base de PRUEBAS: cada CHECK muerde (con su control positivo: la fila válida
// entra), la versión es única, nada se edita ni se borra, el autor existe, y la hora la pone la base. Los privilegios
// de inv_app (INSERT por columna sin "creadaEn") y de inv_ia (SELECT por columna sin el motivo ni el autor) se prueban
// sin crear roles (son globales del clúster): roles predefinidos reciben EXACTAMENTE los GRANT de privilegios.sql sobre
// config_ia, leídos del archivo, y un cliente de una sola conexión hace SET ROLE. Datos e IP inventados (las IP se arman
// al correr). Lo que no es seguridad: la CHECK del destino es solo el FORMATO; el control está en la red de PI.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const corrida = Date.now().toString(36).slice(-6);
const ip = (...o: readonly number[]): string => o.join(".");
const HOST = ip(100, 87, 41, 157);
const sql = readFileSync(fileURLToPath(new URL("../../../docker/migrador/privilegios.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "");
const grantsDe = (rol: string) =>
  [...sql.matchAll(new RegExp(`GRANT\\s+([A-Z]+\\s*(?:\\([^)]*\\))?)\\s+ON\\s+TABLE\\s+public\\.config_ia\\s+TO\\s+${rol}\\s*;`, "g"))].map((m) => m[1]!);
let autorId = "";
let siguiente = 0;

async function version(): Promise<number> {
  const ultima = await db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
  siguiente = Math.max(siguiente, ultima?.version ?? 0) + 1;
  return siguiente;
}

type Datos = Omit<Prisma.ConfigIaUncheckedCreateInput, "version" | "autorId">;
const tareas = (modelo: string | null, activas: readonly string[] = ["DIARIO", "REGLAS"]) =>
  Object.fromEntries(["DIARIO", "REGLAS", "ESCENARIOS"].map((t) => [t, { activo: activas.includes(t), modeloLocal: modelo }]));
const BASE: Datos = {
  modo: "apagado", temperaturaLocal: new Prisma.Decimal("0"), tareas: tareas(null), modeloNube: "claude-opus-5-5", horaResumen: "19:00",
  limiteSegundos: 120, esfuerzoNube: "low", motivo: "Versión ficticia de la prueba",
};
const crear = async (cambios: Partial<Datos> = {}) => db.configIa.create({ data: { ...BASE, ...cambios, version: await version(), autorId } });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  autorId = (await db.usuario.create({ data: { email: `dueno-config-ia-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("config_ia · control positivo", () => {
  it("entran una apagada, una local con su destino y su modelo, y una de nube con su tope", async () => {
    await expect(crear()).resolves.toMatchObject({ modo: "apagado" });
    await expect(crear({ modo: "local", ollamaHost: HOST, ollamaPuerto: 47213, tareas: tareas("qwen2.5:14b") })).resolves.toMatchObject({ modo: "local" });
    const nube = await crear({ modo: "nube", topeMensualUsd: new Prisma.Decimal("4.61"), modeloNube: "claude-haiku-5-5", esfuerzoNube: "medium" });
    expect(nube.topeMensualUsd?.toString()).toBe("4.61");
    await expect(crear({ modo: "local-luego-nube", ollamaHost: HOST, ollamaPuerto: 47213, tareas: tareas("aya-expanse:32b"), topeMensualUsd: new Prisma.Decimal("50") })).resolves.toBeDefined();
    // Una tarea inactiva no necesita modelo; cada tarea puede tener el suyo.
    const porTarea = { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" }, REGLAS: { activo: true, modeloLocal: "gemma2:27b" }, ESCENARIOS: { activo: false, modeloLocal: null } };
    await expect(crear({ modo: "local", ollamaHost: HOST, ollamaPuerto: 47213, tareas: porTarea })).resolves.toBeDefined();
  });

  it("los bordes entran: límite 10 y 120, tope 1 y 50, puerto 1 y 65535, horas de la lista", async () => {
    await expect(crear({ limiteSegundos: 10 })).resolves.toBeDefined();
    for (const t of ["0", "0.37", "1"]) await expect(crear({ temperaturaLocal: new Prisma.Decimal(t) })).resolves.toBeDefined();
    await expect(crear({ modo: "nube", topeMensualUsd: new Prisma.Decimal("1.00") })).resolves.toBeDefined();
    await expect(crear({ ollamaHost: ip(100, 64, 0, 1), ollamaPuerto: 1 })).resolves.toBeDefined();
    await expect(crear({ ollamaHost: ip(100, 127, 255, 254), ollamaPuerto: 65535 })).resolves.toBeDefined();
    for (const hora of ["18:00", "21:00"]) await expect(crear({ horaResumen: hora })).resolves.toBeDefined();
  });
});

describe("config_ia · cada CHECK muerde", () => {
  it.each([
    ["un modo que no es de la lista", { modo: "nube-luego-local" }, "config_ia_modo_chk"],
    ["un modelo de nube que no es de la lista", { modeloNube: "claude-opus-5" }, "config_ia_modelo_nube_chk"],
    ["un esfuerzo que no es de la lista", { esfuerzoNube: "high" }, "config_ia_esfuerzo_chk"],
    ["una hora que no es de la lista", { horaResumen: "19:30" }, "config_ia_hora_chk"],
    ["un límite de 9 s", { limiteSegundos: 9 }, "config_ia_limite_chk"],
    ["un límite de 121 s", { limiteSegundos: 121 }, "config_ia_limite_chk"],
    ["un tope de USD 0,99", { topeMensualUsd: new Prisma.Decimal("0.99") }, "config_ia_tope_chk"],
    ["un tope de USD 50,01", { topeMensualUsd: new Prisma.Decimal("50.01") }, "config_ia_tope_chk"],
    ["una temperatura negativa", { temperaturaLocal: new Prisma.Decimal("-0.01") }, "config_ia_temperatura_chk"],
    ["una temperatura sobre 1", { temperaturaLocal: new Prisma.Decimal("1.01") }, "config_ia_temperatura_chk"],
    ["un modelo local en mayúsculas", { tareas: tareas("Qwen2.5:14B") }, "config_ia_tareas_chk"],
    ["un modelo local con registro", { tareas: tareas("registro/qwen2.5:14b") }, "config_ia_tareas_chk"],
    ["un modelo local que no es texto", { tareas: { DIARIO: { activo: true, modeloLocal: 4613 } } }, "config_ia_tareas_chk"],
    ["una tarea que no es de la lista", { tareas: { ...tareas(null), OPERAR: { activo: true, modeloLocal: null } } }, "config_ia_tareas_chk"],
    ["una tarea con un campo de más", { tareas: { DIARIO: { activo: true, modeloLocal: null, temperatura: 1 } } }, "config_ia_tareas_chk"],
    ["una tarea sin «activo» booleano", { tareas: { DIARIO: { activo: "sí", modeloLocal: null } } }, "config_ia_tareas_chk"],
    ["las tareas como arreglo", { tareas: ["DIARIO"] }, "config_ia_tareas_chk"],
    ["un host sin puerto", { ollamaHost: HOST }, "config_ia_destino_chk"],
    ["un puerto sin host", { ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["el puerto 0", { ollamaHost: HOST, ollamaPuerto: 0 }, "config_ia_destino_chk"],
    ["el puerto 65536", { ollamaHost: HOST, ollamaPuerto: 65536 }, "config_ia_destino_chk"],
    ["un nombre en vez de la IPv4", { ollamaHost: "ollama.ficticio", ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["una IPv4 con ceros a la izquierda", { ollamaHost: ip(100, 87, 41, "07" as unknown as number), ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["una IPv4 fuera del formato de la tailnet (primer octeto)", { ollamaHost: ip(101, 87, 41, 157), ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["una IPv4 fuera del formato de la tailnet (segundo octeto bajo)", { ollamaHost: ip(100, 63, 41, 157), ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["una IPv4 fuera del formato de la tailnet (segundo octeto alto)", { ollamaHost: ip(100, 128, 41, 157), ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["un octeto de más de 255", { ollamaHost: ip(100, 87, 256, 157), ollamaPuerto: 47213 }, "config_ia_destino_chk"],
    ["un motivo de solo espacios", { motivo: "   " }, "config_ia_motivo_chk"],
    ["un motivo de más de 2000 caracteres", { motivo: "m".repeat(2001) }, "config_ia_motivo_chk"],
    ["el modo local con una tarea activa sin modelo", { modo: "local", ollamaHost: HOST, ollamaPuerto: 47213, tareas: { ...tareas("qwen2.5:14b"), ESCENARIOS: { activo: true, modeloLocal: null } } }, "config_ia_usa_chk"],
    ["el modo local sin destino", { modo: "local", tareas: tareas("qwen2.5:14b") }, "config_ia_usa_chk"],
    ["el modo nube sin tope", { modo: "nube" }, "config_ia_usa_chk"],
    ["local-luego-nube sin tope", { modo: "local-luego-nube", ollamaHost: HOST, ollamaPuerto: 47213, tareas: tareas("qwen2.5:14b") }, "config_ia_usa_chk"],
  ] as const)("rechaza %s (%s)", async (_n, cambios, restriccion) => {
    await expect(crear(cambios as Partial<Datos>)).rejects.toThrow(new RegExp(restriccion));
  });

  it("la versión es única y mayor que cero", async () => {
    const v = await version();
    await db.configIa.create({ data: { ...BASE, version: v, autorId } });
    await expect(db.configIa.create({ data: { ...BASE, version: v, autorId } })).rejects.toThrow(/Unique constraint|P2002/);
    await expect(db.configIa.create({ data: { ...BASE, version: 0, autorId } })).rejects.toThrow(/config_ia_version_chk/);
  });

  it("el autor existe (llave con RESTRICT)", async () => {
    await expect(db.configIa.create({ data: { ...BASE, version: await version(), autorId: `no-existe-${corrida}` } })).rejects.toThrow(/Foreign key|P2003/);
  });
});

describe("config_ia · solo inserción", () => {
  it("una versión no se edita ni se borra", async () => {
    const c = await crear();
    await expect(db.configIa.update({ where: { id: c.id }, data: { motivo: "otro" } })).rejects.toThrow(/solo inserción/);
    await expect(db.configIa.delete({ where: { id: c.id } })).rejects.toThrow(/solo inserción/);
  });
});

describe("config_ia · privilegios de inv_app (pg_read_all_data con los GRANT de privilegios.sql)", () => {
  const ROL = "pg_read_all_data";
  let restringida: PrismaClient;

  beforeAll(async () => {
    const grants = grantsDe("inv_app");
    expect(grants).toHaveLength(1);
    for (const g of grants) await db.$executeRawUnsafe(`GRANT ${g} ON TABLE public.config_ia TO ${ROL}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    restringida = new PrismaClient({ datasourceUrl: url.toString() });
    await restringida.$executeRawUnsafe(`SET ROLE ${ROL}`);
  });

  afterAll(async () => {
    await restringida.$disconnect();
    await db.$executeRawUnsafe(`REVOKE INSERT ON TABLE public.config_ia FROM ${ROL}`);
  });

  it("inserta una versión con Prisma (sin mandar la hora) y la base la fecha con su reloj", async () => {
    const antes = new Date();
    const c = await restringida.configIa.create({ data: { ...BASE, version: await version(), autorId } });
    const despues = new Date();
    expect(c.creadaEn.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 5_000);
    expect(c.creadaEn.getTime()).toBeLessThanOrEqual(despues.getTime() + 5_000);
  });

  it("no puede nombrar la hora (42501, también sin filas) ni editar ni borrar", async () => {
    for (const sentencia of [
      `INSERT INTO config_ia (id, "creadaEn") SELECT 'x', TIMESTAMPTZ '2019-02-11 10:37:00+00' WHERE false`,
      "UPDATE config_ia SET motivo = motivo WHERE false",
      "DELETE FROM config_ia WHERE false",
    ]) await expect(restringida.$executeRawUnsafe(sentencia), sentencia).rejects.toThrow(/42501|permission denied/);
  });
});

describe("config_ia · privilegios de inv_ia (pg_signal_backend con los GRANT de privilegios.sql)", () => {
  const ROL = "pg_signal_backend";
  let restringida: PrismaClient;

  beforeAll(async () => {
    const grants = grantsDe("inv_ia");
    expect(grants).toHaveLength(1);
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROL}`);
    for (const g of grants) await db.$executeRawUnsafe(`GRANT ${g} ON TABLE public.config_ia TO ${ROL}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    restringida = new PrismaClient({ datasourceUrl: url.toString() });
    await restringida.$executeRawUnsafe(`SET ROLE ${ROL}`);
  });

  afterAll(async () => {
    await restringida.$disconnect();
    await db.$executeRawUnsafe(`REVOKE SELECT ON TABLE public.config_ia FROM ${ROL}`);
  });

  it("lee lo que necesita (control positivo) y nada del motivo ni del autor", async () => {
    await crear();
    const filas = await restringida.$queryRawUnsafe<unknown[]>(`SELECT id, version, modo, "ollamaHost", "ollamaPuerto", "temperaturaLocal", tareas, "modeloNube", "topeMensualUsd", "horaResumen", "limiteSegundos", "esfuerzoNube", "creadaEn" FROM config_ia ORDER BY version DESC LIMIT 1`);
    expect(filas).toHaveLength(1);
    for (const sentencia of ['SELECT motivo FROM config_ia LIMIT 1', 'SELECT "autorId" FROM config_ia LIMIT 1', "INSERT INTO config_ia (id) VALUES ('x')"]) {
      await expect(restringida.$executeRawUnsafe(sentencia), sentencia).rejects.toThrow(/42501|permission denied/);
    }
  });
});
