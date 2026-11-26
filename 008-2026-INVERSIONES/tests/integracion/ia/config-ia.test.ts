// La configuración de la IA (fase E, E8) contra la base de PRUEBAS: crear una versión nueva contra la última que vio el
// formulario (409 CONFIG_CAMBIO si otra entró en medio, también con dos a la vez), leer la vigente (la de mayor
// versión; también con SOLO los permisos de inv_ia), la historia con su autor y su motivo, y el gasto del mes de la
// nube valorado con el precio del modelo de cada corrida (por su `modeloDigest`; uno desconocido, a precio de opus), con
// los mismos tokens que `gastoDelMes` de E3. Datos inventados.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearVersionConfigIa, ErrorConfigIa } from "@/ia/config/crear";
import { gastoNubeDelMes, MAX_CORRIDAS_GASTO } from "@/ia/config/gasto";
import { leerConfigIa, leerHistoriaConfigIa } from "@/ia/config/leer";
import type { EntradaConfigIa } from "@/ia/config/pedido";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { costoTokensMicroUsd } from "@/ia/nube/tope";
import { gastoDelMes, registrarResumen } from "@/ia/registro/registro";
import { rangoDelMes } from "@/ia/registro/mes";
import { fechaEnBogota } from "@/precios/horario";
import { ENTRADAS_FICTICIAS } from "../../unit/ia/apoyo/hechos.ficticio";

const db = new PrismaClient();
const corrida = Date.now().toString(36).slice(-6);
const ip = (...o: readonly number[]): string => o.join(".");
const sql = readFileSync(fileURLToPath(new URL("../../../docker/migrador/privilegios.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "");
let autorId = "";

const ENTRADA: EntradaConfigIa = {
  modo: "local-luego-nube",
  ollamaHost: ip(100, 87, 41, 157),
  ollamaPuerto: 47213,
  temperaturaCentesimas: 37,
  tareas: { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" }, REGLAS: { activo: true, modeloLocal: "aya-expanse:32b" }, ESCENARIOS: { activo: false, modeloLocal: null } },
  modeloNube: "claude-haiku-5-5",
  esfuerzoNube: "medium",
  topeMicroUsd: 4_610_000n,
  horaResumen: "20:00",
  limiteSegundos: 45,
  analisisDemanda: true,
  motivo: `Configuración ficticia ${corrida}`,
};
const ultima = async (): Promise<number> => (await db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  autorId = (await db.usuario.create({ data: { email: `dueno-config-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("crearVersionConfigIa y leerConfigIa", () => {
  it("crea la versión siguiente y la vigente es esa, con todo convertido de vuelta", async () => {
    const antes = await ultima();
    const r = await crearVersionConfigIa(db, ENTRADA, { autorId, ultimaEsperada: antes });
    expect(r.version).toBe(antes + 1);
    const vigente = await leerConfigIa(db);
    expect(vigente).toMatchObject({
      version: antes + 1, modo: "local-luego-nube", ollamaHost: ENTRADA.ollamaHost, ollamaPuerto: 47213, temperaturaCentesimas: 37,
      tareas: ENTRADA.tareas, modeloNube: "claude-haiku-5-5", esfuerzoNube: "medium", topeMicroUsd: 4_610_000n, horaResumen: "20:00", limiteSegundos: 45, analisisDemanda: true,
    });
    expect(vigente?.creadaEn).toBeInstanceOf(Date);
  });

  it("si otra versión entró en medio: CONFIG_CAMBIO, sin escribir", async () => {
    const antes = await ultima();
    await crearVersionConfigIa(db, ENTRADA, { autorId, ultimaEsperada: antes });
    await expect(crearVersionConfigIa(db, { ...ENTRADA, motivo: "Vieja" }, { autorId, ultimaEsperada: antes })).rejects.toThrow(new ErrorConfigIa("CONFIG_CAMBIO"));
    expect(await ultima()).toBe(antes + 1);
  });

  it("dos a la vez contra la misma: una entra y la otra da CONFIG_CAMBIO", async () => {
    const antes = await ultima();
    const r = await Promise.allSettled([
      crearVersionConfigIa(db, { ...ENTRADA, motivo: "Una" }, { autorId, ultimaEsperada: antes }),
      crearVersionConfigIa(db, { ...ENTRADA, motivo: "Otra" }, { autorId, ultimaEsperada: antes }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rechazo = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(rechazo.reason).toEqual(new ErrorConfigIa("CONFIG_CAMBIO"));
    expect(await ultima()).toBe(antes + 1);
  });

  it("un autor que no existe: AUTOR_INEXISTENTE", async () => {
    await expect(crearVersionConfigIa(db, ENTRADA, { autorId: `no-existe-${corrida}`, ultimaEsperada: await ultima() })).rejects.toThrow(new ErrorConfigIa("AUTOR_INEXISTENTE"));
  });

  it("una apagada sin destino ni tope también se guarda y se lee", async () => {
    await crearVersionConfigIa(db, { ...ENTRADA, modo: "apagado", ollamaHost: null, ollamaPuerto: null, topeMicroUsd: null }, { autorId, ultimaEsperada: await ultima() });
    expect(await leerConfigIa(db)).toMatchObject({ modo: "apagado", ollamaHost: null, topeMicroUsd: null });
  });
});

describe("el interruptor del análisis a demanda (analisisDemanda)", () => {
  it("una versión sin decirlo queda con el análisis APAGADO (el valor de la base: falla cerrada)", async () => {
    const v = (await ultima()) + 1;
    const fila = await db.configIa.create({
      data: {
        version: v, modo: "apagado", temperaturaLocal: new Prisma.Decimal("0"), tareas: { DIARIO: { activo: false }, REGLAS: { activo: false }, ESCENARIOS: { activo: false } },
        modeloNube: "claude-opus-5-5", horaResumen: "19:00", limiteSegundos: 45, esfuerzoNube: "low", motivo: `Sin interruptor ${corrida}`, autorId,
      },
    });
    expect(fila.analisisDemanda).toBe(false);
    expect((await leerConfigIa(db))?.analisisDemanda).toBe(false);
  });

  it("crear la versión con el interruptor encendido o apagado se guarda y se lee", async () => {
    await crearVersionConfigIa(db, { ...ENTRADA, analisisDemanda: true }, { autorId, ultimaEsperada: await ultima() });
    expect((await leerConfigIa(db))?.analisisDemanda).toBe(true);
    await crearVersionConfigIa(db, { ...ENTRADA, analisisDemanda: false }, { autorId, ultimaEsperada: await ultima() });
    expect((await leerConfigIa(db))?.analisisDemanda).toBe(false);
  });

  it("una versión guardada de más de 60 s (las viejas llegaban a 120) se lee acotada a 60", async () => {
    const v = (await ultima()) + 1;
    await db.configIa.create({
      data: {
        version: v, modo: "apagado", temperaturaLocal: new Prisma.Decimal("0"), tareas: { DIARIO: { activo: false }, REGLAS: { activo: false }, ESCENARIOS: { activo: false } },
        modeloNube: "claude-opus-5-5", horaResumen: "19:00", limiteSegundos: 120, esfuerzoNube: "low", motivo: `Vieja ${corrida}`, autorId,
      },
    });
    expect((await leerConfigIa(db))?.limiteSegundos).toBe(60);
  });
});

describe("leerHistoriaConfigIa", () => {
  it("de la más nueva a la más vieja, con el autor, el motivo y la hora de la base; con tope", async () => {
    await crearVersionConfigIa(db, { ...ENTRADA, motivo: `Historia ${corrida}` }, { autorId, ultimaEsperada: await ultima() });
    const h = await leerHistoriaConfigIa(db, 3);
    expect(h).toHaveLength(3);
    expect(h[0]).toMatchObject({ version: await ultima(), modo: "local-luego-nube", motivo: `Historia ${corrida}`, autor: `dueno-config-${corrida}@ejemplo.invalid` });
    expect(h.map((v) => v.version)).toEqual([...h.map((v) => v.version)].sort((a, b) => b - a));
  });
});

describe("leerConfigIa con SOLO los permisos de inv_ia (pg_signal_backend)", () => {
  const ROL = "pg_signal_backend";
  let restringida: PrismaClient;

  beforeAll(async () => {
    const grant = /GRANT\s+(SELECT\s*\([^)]*\))\s+ON\s+TABLE\s+public\.config_ia\s+TO\s+inv_ia\s*;/.exec(sql)?.[1];
    expect(grant).toBeDefined();
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROL}`);
    await db.$executeRawUnsafe(`GRANT ${grant} ON TABLE public.config_ia TO ${ROL}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    restringida = new PrismaClient({ datasourceUrl: url.toString() });
    await restringida.$executeRawUnsafe(`SET ROLE ${ROL}`);
  });

  afterAll(async () => {
    await restringida.$disconnect();
    await db.$executeRawUnsafe(`REVOKE SELECT ON TABLE public.config_ia FROM ${ROL}`);
  });

  it("lee la vigente (control positivo); la historia, que trae el motivo y el autor, no (42501)", async () => {
    expect((await leerConfigIa(restringida))?.version).toBe(await ultima());
    await expect(leerHistoriaConfigIa(restringida, 3)).rejects.toThrow(/42501|permission denied/);
  });
});

describe("gastoNubeDelMes · cada corrida con el precio de su modelo", () => {
  const PROMPT = { version: "resumen-diario-v1", hash: sha256Hex(`prompt ficticio de config ${corrida}`) };

  async function nube(modeloDigest: string, tokensEntrada: number, tokensSalida: number, aviso: string): Promise<void> {
    const paquete = construirPaquete({ ...ENTRADAS_FICTICIAS.DIARIO(), hoy: "2027-04-13", avisos: [`${aviso}_${corrida.toUpperCase()}`] } as never);
    await registrarResumen(db, {
      paquete, prompt: PROMPT, opciones: { temperature: 0 }, validadorVersion: "validador-v1", estado: "RECHAZADO", motivos: ["LONGITUD"],
      exito: { ok: true, puerta: "nube", salidaCruda: "", modelo: "claude-haiku-5-5", modeloDigest, latenciaMs: 1237, tokensEntrada, tokensSalida },
    });
  }

  it("haiku a su precio, sonnet al suyo y un digest desconocido a precio de opus; los tokens, los de E3", async () => {
    const dia = fechaEnBogota(new Date()).toISOString().slice(0, 10);
    const antes = await gastoNubeDelMes(db, dia);
    await nube("claude-haiku-5-5", 37_911, 4_613, "HAIKU");
    await nube("claude-sonnet-5-5", 1_237, 211, "SONNET");
    await nube("claude-desconocido-ficticio", 41, 7, "OTRO");
    const despues = await gastoNubeDelMes(db, dia);
    const esperado = costoTokensMicroUsd("claude-haiku-5-5", 37_911, 4_613) + costoTokensMicroUsd("claude-sonnet-5-5", 1_237, 211) + costoTokensMicroUsd("claude-opus-5-5", 41, 7);
    expect(despues.microUsd - antes.microUsd).toBe(esperado);
    expect(despues.tokensEntrada - antes.tokensEntrada).toBe(37_911 + 1_237 + 41);
    expect(despues.corridas - antes.corridas).toBe(3);
    const { desde, hasta } = rangoDelMes(dia);
    const e3 = await gastoDelMes(db, "nube", desde, hasta);
    expect({ entrada: despues.tokensEntrada, salida: despues.tokensSalida, corridas: despues.corridas }).toEqual({ entrada: e3.tokensEntrada, salida: e3.tokensSalida, corridas: e3.corridas });
    expect(despues.mes).toBe(dia.slice(0, 7));
  });

  it("un tope de corridas por mes acota la lectura", () => {
    expect(MAX_CORRIDAS_GASTO).toBeGreaterThanOrEqual(1000);
  });
});
