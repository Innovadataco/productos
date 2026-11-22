// scripts/importar-decretos.ts como proceso contra la base de PRUEBAS (fase C, C4a): salidas 0 (ensayo, aplicado, sin
// cambios), 1 (sin claves de cifrado), 2 (uso, archivo inexistente o que no es regular) y 3 (CSV inválido o especie no
// registrada), y que la consola NUNCA lleve el correo, la especie, el valor, la referencia, la nota ni la URL de la
// base. En producción (NODE_ENV=production, la vía B) los fallos terminan pidiendo parar la carga. El hijo recibe un
// entorno mínimo. El CSV se escribe en una carpeta temporal propia; datos inventados.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENCABEZADO_DECRETOS } from "@/datos-oficiales/decretos/csv";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../ayudas/cli";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = String(Date.now()).slice(-6);
const email = `dueno-cli-decretos-${corrida}@ejemplo.invalid`;
const NEMO = `FICTD${corrida}`;
const NEMO_SIN_REGISTRAR = `FICTE${corrida}`;
const VALOR = "2731.904613";
const REFERENCIA = `https://www.bvc.com.co/ficticio/decreto-${corrida}`;
const NOTA = `nota-ficticia-${corrida}`;
const SCRIPT = "importar-decretos.ts";
const PARE = "Vía B: pare la carga y avise al CEO de 008";
const NUNCA = [email, NEMO, NEMO_SIN_REGISTRAR, VALOR, "2731.9", REFERENCIA, NOTA, URL_BASE, "postgresql://"];

const claves = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;
const correr = (args: readonly string[], extra: Record<string, string> = {}): Salida =>
  correrCli(SCRIPT, args, entornoMinimo({ DATABASE_URL: URL_BASE, ...claves(), ...extra }));
const comprobar = (s: Salida, codigo: number, esperado: string) => comprobarSalida(s, codigo, esperado, NUNCA);

let carpeta = "";
const archivo = (nombre: string, filas: readonly string[]): string => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, `${ENCABEZADO_DECRETOS.join(",")}\n${filas.join("\n")}\n`);
  return ruta;
};
const fila = (especie: string, valor = VALOR) => `${especie},ORDINARIO,2020-03-11,1,${valor},COP,DINERO,2020-07-08,2020-07-15,${REFERENCIA},,${NOTA}`;
const decretos = () => db.dividendoDecretado.count({ where: { instrumento: { nemotecnico: NEMO } } });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  await db.usuario.create({ data: { email, rol: "DUENO" } });
  await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: NEMO, nombre: "Ficticia del CLI" } });
  carpeta = mkdtempSync(join(tmpdir(), "decretos-cli-"));
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("importar-decretos como proceso", { timeout: 12 * POR_CLI_MS }, () => {
  it("uso (2): sin argumentos, archivo inexistente o que no es un archivo regular; no toca la base", () => {
    comprobar(correr([]), 2, "argumentos · FALTA_ARCHIVO");
    comprobar(correr(["--archivo", join(carpeta, "no-existe.csv"), "--email", email]), 2, "ARCHIVO_ILEGIBLE");
    mkdirSync(join(carpeta, "carpeta.csv"));
    comprobar(correr(["--archivo", join(carpeta, "carpeta.csv"), "--email", email]), 2, "ARCHIVO_NO_REGULAR");
    expect(correr([]).texto).toContain("NO cargue decretos reales");
  });

  it("rechazado (3): CSV inválido o especie no registrada, con la línea y el código; no escribe nada", async () => {
    comprobar(correr(["--archivo", archivo("invalido.csv", [fila(NEMO, "-1.3719")]), "--email", email, "--aplicar"]), 3, "línea 2 · valor_por_accion · VALOR_NO_POSITIVO");
    comprobar(correr(["--archivo", archivo("sin-especie.csv", [fila(NEMO_SIN_REGISTRAR)]), "--email", email, "--aplicar"]), 3, "línea 2 · especie · ESPECIE_NO_REGISTRADA");
    expect(await decretos()).toBe(0);
  });

  it("sin claves de cifrado (1): ErrorCifrado con su código, sin tocar la base", async () => {
    const s = correrCli(SCRIPT, ["--archivo", archivo("sin-claves.csv", [fila(NEMO)]), "--email", email, "--aplicar"], entornoMinimo({ DATABASE_URL: URL_BASE }));
    comprobar(s, 1, "ErrorCifrado CLAVE_ACTIVA_AUSENTE");
    expect(await decretos()).toBe(0);
  });

  it("ensayo (0, no escribe), --aplicar (0, aplicado) y otra vez (0, sin cambios)", async () => {
    // El nombre del archivo lo elige el dueño y puede nombrar una especie: no se guarda (la carga dice «decretos.csv»).
    const ruta = archivo(`decretos-${NEMO}.csv`, [fila(NEMO)]);
    comprobar(correr(["--archivo", ruta, "--email", email]), 0, "listo para --aplicar; no se escribió nada");
    expect(await decretos()).toBe(0);
    comprobar(correr(["--archivo", ruta, "--email", email, "--aplicar"]), 0, "Resultado: aplicado · carga");
    expect(await decretos()).toBe(1);
    const { filaFuente } = await db.dividendoDecretado.findFirstOrThrow({ where: { instrumento: { nemotecnico: NEMO } }, select: { filaFuente: { select: { primeraCarga: { select: { nombreArchivo: true } } } } } });
    expect(filaFuente.primeraCarga.nombreArchivo).toBe("decretos.csv");
    comprobar(correr(["--archivo", ruta, "--email", email, "--aplicar"]), 0, "ya estaba todo registrado; no se escribió nada");
    expect(await decretos()).toBe(1);
  });

  it("en producción (vía B): un rechazo termina pidiendo parar la carga; el ensayo no, y dice repetir con --aplicar; nunca `npx tsx`", () => {
    const prod = { NODE_ENV: "production" };
    const rechazo = correr(["--archivo", archivo("prod-invalido.csv", [fila(NEMO, "0")]), "--email", email], prod);
    comprobar(rechazo, 3, PARE);
    const uso = correr(["--email", email], prod);
    comprobar(uso, 2, PARE);
    expect(uso.texto).not.toContain("npx tsx");
    const ensayo = correr(["--archivo", archivo("prod.csv", [fila(NEMO, "2731.904617")]), "--email", email], prod);
    comprobar(ensayo, 0, "vía B con --aplicar");
    expect(ensayo.texto).not.toContain(PARE);
  });
});
