// scripts/registrar-movimiento-fondo.ts como proceso contra la base de PRUEBAS (frente fondo-movimientos, T5): códigos
// de salida (0 ensayo, registrada o ya existía · 2 uso · 3 rechazo) y que la consola NO lleve el correo, el código del
// fondo, las unidades, el monto ni la URL de la base. El hijo recibe un entorno mínimo. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../ayudas/cli";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = String(Date.now()).slice(-5);
const email = `dueno-cli-fondo-${corrida}@ejemplo.invalid`;
const CODIGO = `6${corrida}47`;
// El CLI usa el reloj real: la fecha debe ser pasada, fuera del rango de la historia real (reglas de valores inventados)
// y anterior a la fecha del caso «corte sin historia» de conciliacion.test.ts, que exige que nada escriba caja hasta ese día.
const FECHA = "2022-09-14";
const UNIDADES = "1031.77246";
const MONTO = "4729785.4531";
const MONTO_QUE_NO_CUADRA = "4760000.1373";
const SCRIPT = "registrar-movimiento-fondo.ts";

const correr = (args: readonly string[]): Salida => correrCli(SCRIPT, args, entornoMinimo({ DATABASE_URL: URL_BASE }));
const NUNCA = [email, CODIGO, UNIDADES, MONTO, MONTO_QUE_NO_CUADRA, "4729785", "1031.7", URL_BASE, "postgresql://"];
const comprobar = (s: Salida, codigo: number, esperado: string) => comprobarSalida(s, codigo, esperado, NUNCA);
const args = (monto = MONTO, extra: readonly string[] = []) => ["--email", email, "--fondo", CODIGO, "--fecha", FECHA, "--unidades", UNIDADES, "--monto", monto, ...extra];

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  await db.usuario.create({ data: { email, rol: "DUENO" } });
  const { id } = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: CODIGO, nombre: "Fondo ficticio del CLI" } });
  await db.valorUnidadFondo.create({ data: { fondoId: id, fechaValor: new Date(`${FECHA}T00:00:00Z`), valorUnidad: new Prisma.Decimal("4584.13617") } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registrar-movimiento-fondo contra la base", { timeout: 6 * POR_CLI_MS }, () => {
  it("uso inválido: sale con 2 sin tocar la base y dice campo y código", () => {
    const s = correr([...args(), "--tipo", "APORTE"]);
    comprobar(s, 2, "argumentos · ARGUMENTOS_INVALIDOS");
    comprobar(correr(args("4729785,4531")), 2, "monto · NUMERO_FORMATO");
  });

  it("el monto que no cuadra con el valor de unidad del día sale con 3, con el código y qué revisar en el extracto", () => {
    const s = correr(args(MONTO_QUE_NO_CUADRA, ["--aplicar"]));
    comprobar(s, 3, "No se registró: MONTO_NO_CUADRA_CON_VALOR_UNIDAD");
    expect(s.texto).toMatch(/extracto/);
  });

  it("ensayo (0, sin escribir), --aplicar (0, registrada) y otra vez (0, ya existía)", async () => {
    comprobar(correr(args()), 0, "No se escribió nada");
    expect(await db.movimientoFondo.count({ where: { fondo: { codigoFic: CODIGO } } })).toBe(0);
    comprobar(correr(args(MONTO, ["--aplicar"])), 0, "Constitución del fondo registrada");
    comprobar(correr(args(MONTO, ["--aplicar"])), 0, "ya estaba registrada");
    expect(await db.movimientoFondo.count({ where: { fondo: { codigoFic: CODIGO } } })).toBe(1);
  });
});
