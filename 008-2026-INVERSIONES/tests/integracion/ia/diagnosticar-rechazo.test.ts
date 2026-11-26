// scripts/diagnosticar-rechazo-ia.ts como proceso contra la base de PRUEBAS (T1): lee los rechazos guardados, imprime
// código, patrón, frase y parte con los dígitos como «#», no escribe NADA y sale con códigos cerrados. Datos inventados.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { registrarResumen } from "@/ia/registro/registro";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { ENTRADAS_FICTICIAS } from "../../unit/ia/apoyo/hechos.ficticio";
import { RAIZ, correr, entornoMinimo } from "../../ayudas/cli";

const db = new PrismaClient();
const marca = Date.now().toString(36).toUpperCase();
const SCRIPT = "diagnosticar-rechazo-ia.ts";
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = (args: readonly string[]) => correr(SCRIPT, args, entornoMinimo({ DATABASE_URL: URL_BASE }));
const SALIDA = JSON.stringify({ frases: [{ segmentos: [{ texto: "El valor cerró en 4613,27 hoy." }] }] });
let idRechazado = "";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  const paquete = construirPaquete({ ...ENTRADAS_FICTICIAS.DIARIO(), hoy: "2027-05-05", avisos: [`DIAGNOSTICO_${marca}`] } as never);
  const r = await registrarResumen(db, {
    paquete, prompt: { version: "resumen-diario-v3", hash: sha256Hex(`prompt ficticio ${marca}`) }, opciones: { temperature: 0, seed: 42 },
    validadorVersion: "validador-v2", estado: "RECHAZADO", motivos: ["CIFRA_SUELTA"],
    exito: { ok: true, puerta: "local", salidaCruda: SALIDA, modelo: "ornith:9b", modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
  });
  idRechazado = r.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("diagnosticar-rechazo-ia como proceso", () => {
  it("imprime las versiones, el código, el patrón, la frase y la parte, sin una cifra del modelo, y no escribe nada", async () => {
    const antes = await db.resumenIa.count();
    const s = corrida(["--id", idRechazado]);
    expect(s.codigo, s.texto).toBe(0);
    expect(s.texto).toContain("validador de la fila validador-v2");
    expect(s.texto).toContain(`validador actual ${VERSION_VALIDADOR}`);
    // Validador v3: el código escribe el obligatorio que el modelo no citó (frase 0), así que la del modelo es la 1.
    expect(s.texto).toMatch(/CIFRA_SUELTA · CIFRA_SUELTA\.\S+ · frase 1 · MODELO · «El valor cerró en ####,## hoy\.»/u);
    expect(s.texto).not.toContain("· CODIGO ·");
    expect(s.texto).not.toContain("4613");
    expect(s.texto).not.toContain(URL_BASE);
    expect(await db.resumenIa.count()).toBe(antes);
  });

  it("sin --id toma los últimos rechazos y respeta --tipo y --ultimos", () => {
    const s = corrida(["--tipo", "DIARIO", "--ultimos", "1"]);
    expect(s.codigo, s.texto).toBe(0);
    expect(s.texto.match(/^fila /gmu)?.length).toBe(1);
  });

  it("un id que no existe: 3, sin imprimir la base", () => {
    const s = corrida(["--id", "no-existe"]);
    expect(s.codigo).toBe(3);
    expect(s.texto).toContain("SIN_FILAS");
  });

  it.each([[["--ultimos", "0"]], [["--ultimos", "51"]], [["--ultimos", "x"]], [["--tipo", "OTRO"]], [["--no-existe"]], [["--id"]]])("uso inválido %j: 2", (args) => {
    const s = corrida(args);
    expect(s.codigo, s.texto).toBe(2);
    expect(s.texto).toContain("USO");
  });

  it("el script solo lee: usa la foto de solo lectura y ningún método que escriba", () => {
    const codigo = readFileSync(join(RAIZ, "scripts", SCRIPT), "utf8");
    expect(codigo).toContain("enFotoDeSoloLectura");
    expect(codigo).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw(?!`SET)|\$executeRawUnsafe|\$queryRawUnsafe/u);
  });
});
