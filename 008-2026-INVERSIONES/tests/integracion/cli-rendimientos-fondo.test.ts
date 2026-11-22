// scripts/registrar-rendimientos-fondo.ts como proceso contra la base de PRUEBAS (frente fondo-rendimientos, T4): salidas
// 0 (ensayo, aplicado, sin cambios), 1 (sin claves de cifrado), 2 (uso, archivo inexistente o que no es regular) y 3
// (CSV inválido o fondo sin constitución), y que la consola NUNCA lleve el correo, el código del fondo, los valores, las
// fechas ni la URL de la base. En producción (NODE_ENV=production, la vía B) los fallos terminan pidiendo parar la
// carga. El hijo recibe un entorno mínimo. El CSV se escribe en una carpeta temporal propia; datos inventados (2027).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../ayudas/cli";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = String(Date.now()).slice(-6);
const email = `dueno-cli-rendimientos-${corrida}@ejemplo.invalid`;
const CODIGO = `57${corrida}`;
const CODIGO_SIN_CONSTITUCION = `58${corrida}`;
const VALOR = "37911.4713";
const RETENCION = "1374.0219";
const FECHA = "2027-06-17";
const SCRIPT = "registrar-rendimientos-fondo.ts";
const PARE = "Vía B: pare la carga y avise al CEO de 008";
const NUNCA = [email, CODIGO, CODIGO_SIN_CONSTITUCION, VALOR, "37911", RETENCION, "1374.02", FECHA, URL_BASE, "postgresql://"];

const claves = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;
const correr = (args: readonly string[], extra: Record<string, string> = {}): Salida =>
  correrCli(SCRIPT, args, entornoMinimo({ DATABASE_URL: URL_BASE, ...claves(), ...extra }));
const comprobar = (s: Salida, codigo: number, esperado: string) => comprobarSalida(s, codigo, esperado, NUNCA);

let carpeta = "";
let fondoId = "";
const archivo = (nombre: string, filas: readonly string[]): string => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, `fecha,tipo,valor\n${filas.join("\n")}\n`);
  return ruta;
};
const CSV = [`${FECHA},RENDIMIENTO,${VALOR}`, `${FECHA},RETENCION,${RETENCION}`];
const hechos = () => db.rendimientoFondo.count({ where: { fondoId } });
const base = (ruta: string, codigo = CODIGO) => ["--archivo", ruta, "--email", email, "--fondo", codigo];

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»`);
  const dueno = await db.usuario.create({ data: { email, rol: "DUENO" } });
  fondoId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: CODIGO, nombre: "Fondo ficticio del CLI" } })).id;
  await db.instrumento.create({ data: { tipo: "FIC", codigoFic: CODIGO_SIN_CONSTITUCION, nombre: "Fondo ficticio sin constitución" } });
  const ajuste = await db.ajusteCaja.create({
    data: { fecha: new Date("2027-04-14T00:00:00Z"), monto: new Prisma.Decimal("-2713946.2817"), categoria: "APORTE_FIC", fuente: "EXTRACTO", motivo: "aporte ficticio", creadoPorId: dueno.id },
  });
  await db.movimientoFondo.create({
    data: { fondoId, fecha: new Date("2027-04-14T00:00:00Z"), unidades: new Prisma.Decimal("947.31277"), monto: new Prisma.Decimal("2713946.2817"), tipo: "CONSTITUCION", fuente: "EXTRACTO", ajusteCajaId: ajuste.id },
  });
  carpeta = mkdtempSync(join(tmpdir(), "rendimientos-cli-"));
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("registrar-rendimientos-fondo como proceso", { timeout: 12 * POR_CLI_MS }, () => {
  it("uso (2): sin argumentos, sin --fondo, archivo inexistente o que no es un archivo regular; no toca la base", () => {
    comprobar(correr([]), 2, "argumentos · FALTA_ARCHIVO");
    comprobar(correr(["--archivo", join(carpeta, "x.csv"), "--email", email]), 2, "argumentos · FALTA_FONDO");
    comprobar(correr(base(join(carpeta, "no-existe.csv"))), 2, "ARCHIVO_ILEGIBLE");
    mkdirSync(join(carpeta, "carpeta.csv"));
    comprobar(correr(base(join(carpeta, "carpeta.csv"))), 2, "ARCHIVO_NO_REGULAR");
  });

  it("rechazado (3): CSV inválido o fondo sin constitución, con la línea y el código; no escribe nada", async () => {
    comprobar(correr([...base(archivo("invalido.csv", [`${FECHA},RENDIMIENTO,-${VALOR}`])), "--aplicar"]), 3, "línea 2 · valor · VALOR_NO_POSITIVO");
    comprobar(correr([...base(archivo("sin-constitucion.csv", CSV), CODIGO_SIN_CONSTITUCION), "--aplicar"]), 3, "todo el archivo · FONDO_SIN_CONSTITUCION");
    expect(await hechos()).toBe(0);
  });

  it("sin claves de cifrado (1): ErrorCifrado con su código, sin tocar la base", async () => {
    const s = correrCli(SCRIPT, [...base(archivo("sin-claves.csv", CSV)), "--aplicar"], entornoMinimo({ DATABASE_URL: URL_BASE }));
    comprobar(s, 1, "ErrorCifrado CLAVE_ACTIVA_AUSENTE");
    expect(await hechos()).toBe(0);
  });

  it("ensayo (0, no escribe), --aplicar (0, aplicado) y otra vez (0, sin cambios)", async () => {
    // El nombre del archivo lo elige el dueño: no se guarda (la carga dice «rendimientos-fondo.csv»).
    const ruta = archivo(`rendimientos-${CODIGO}.csv`, CSV);
    comprobar(correr(base(ruta)), 0, "listo para --aplicar; no se escribió nada");
    expect(await hechos()).toBe(0);
    comprobar(correr([...base(ruta), "--aplicar"]), 0, "Resultado: aplicado · carga");
    expect(await hechos()).toBe(2);
    const { filaFuente } = await db.rendimientoFondo.findFirstOrThrow({ where: { fondoId }, select: { filaFuente: { select: { primeraCarga: { select: { nombreArchivo: true } } } } } });
    expect(filaFuente.primeraCarga.nombreArchivo).toBe("rendimientos-fondo.csv");
    comprobar(correr([...base(ruta), "--aplicar"]), 0, "ya estaba todo registrado; no se escribió nada");
    expect(await hechos()).toBe(2);
  });

  it("en producción (vía B): un rechazo termina pidiendo parar la carga; el ensayo no, y dice repetir con --aplicar; nunca `npx tsx`", () => {
    const prod = { NODE_ENV: "production" };
    const rechazo = correr(base(archivo("prod-invalido.csv", [`${FECHA},RENDIMIENTO,0`])), prod);
    comprobar(rechazo, 3, PARE);
    const uso = correr(["--email", email], prod);
    comprobar(uso, 2, PARE);
    expect(uso.texto).not.toContain("npx tsx");
    const ensayo = correr(base(archivo("prod.csv", ["2027-07-19,RENDIMIENTO,37913.0461"])), prod);
    comprobar(ensayo, 0, "vía B con --aplicar");
    expect(ensayo.texto).not.toContain(PARE);
  });
});
