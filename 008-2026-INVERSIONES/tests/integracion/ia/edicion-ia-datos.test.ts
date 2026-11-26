// Lo que lee /edicion/ia (E8) contra la base de PRUEBAS: la última versión (para no pisar otra), el formulario precargado
// con la vigente en el formato en que lo escribe el dueño, la historia, el gasto del mes de la nube frente al tope, el
// estado de las puertas y la llave solo como sí/no (nunca su valor). Sin configuración: apagada, con el modelo
// recomendado solo si está en la lista de PI. Datos inventados.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { datosEdicionIa } from "@/app/edicion/ia/datos";
import { crearVersionConfigIa } from "@/ia/config/crear";
import type { EntradaConfigIa } from "@/ia/config/pedido";
import { VARIABLE_LLAVE_NUBE } from "@/ia/nube/config";

const db = new PrismaClient();
const corrida = Date.now().toString(36).slice(-6);
const ip = (...o: readonly number[]): string => o.join(".");
const LLAVE_FICTICIA = "llave-ficticia-de-la-pantalla-4613";
let autorId = "";

const ENTRADA: EntradaConfigIa = {
  modo: "nube", ollamaHost: ip(100, 87, 41, 157), ollamaPuerto: 47213, temperaturaCentesimas: 37,
  tareas: { DIARIO: { activo: true, modeloLocal: null }, REGLAS: { activo: false, modeloLocal: null }, ESCENARIOS: { activo: true, modeloLocal: null } },
  modeloNube: "claude-sonnet-5-5", esfuerzoNube: "medium", topeMicroUsd: 4_610_000n, horaResumen: "21:00", limiteSegundos: 45, motivo: `Pantalla ${corrida}`,
};

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  autorId = (await db.usuario.create({ data: { email: `dueno-pantalla-ia-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const ultima = (await db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
  await crearVersionConfigIa(db, ENTRADA, { autorId, ultimaEsperada: ultima });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("datosEdicionIa", () => {
  it("precarga la vigente como la escribe el dueño, con la última versión y la historia", async () => {
    const d = await datosEdicionIa(db, {}, undefined);
    const ultima = (await db.configIa.findFirstOrThrow({ orderBy: { version: "desc" } })).version;
    expect(d.versionBase).toBe(ultima);
    expect(d.inicial).toMatchObject({
      modo: "nube", ollamaHost: ENTRADA.ollamaHost, ollamaPuerto: "47213", temperatura: "0,37", modeloNube: "claude-sonnet-5-5", esfuerzoNube: "medium",
      topeMensualUsd: "4,61", horaResumen: "21:00", limiteSegundos: "45",
    });
    expect(d.inicial.tareas.REGLAS).toEqual({ activo: false, modeloLocal: "" });
    expect(d.guardado.hayDestino).toBe(true);
    expect(d.historia[0]).toMatchObject({ version: ultima, motivo: `Pantalla ${corrida}`, autor: `dueno-pantalla-ia-${corrida}@ejemplo.invalid` });
  });

  it("la llave solo como sí/no, leída del entorno que se le pasa (nunca su valor)", async () => {
    const con = await datosEdicionIa(db, { [VARIABLE_LLAVE_NUBE]: LLAVE_FICTICIA }, undefined);
    expect(con.llaveCargada).toBe(true);
    expect(JSON.stringify(con)).not.toContain(LLAVE_FICTICIA);
    expect((await datosEdicionIa(db, { [VARIABLE_LLAVE_NUBE]: "" }, undefined)).llaveCargada).toBe(false);
  });

  it("el gasto del mes frente al tope y el estado de las puertas (sin la lista de PI en las pruebas)", async () => {
    const d = await datosEdicionIa(db, {}, undefined);
    expect(d.gasto).toMatchObject({ estado: "LEIDO", tope: "4,61" });
    expect(d.listaPi).toMatchObject({ estado: "SIN_LISTA", detalle: "SIN_VARIABLE" });
    expect(d.puertas.map((p) => [p.puerta, p.enUso])).toEqual([["local", false], ["nube", true]]);
    expect(d.sonda).toBe("PENDIENTE");
  });

  it("?guardada: solo un número de versión que exista; otra cosa, nada", async () => {
    const ultima = (await db.configIa.findFirstOrThrow({ orderBy: { version: "desc" } })).version;
    expect((await datosEdicionIa(db, {}, String(ultima))).guardada).toBe(ultima);
    for (const q of ["abc", "-1", `${ultima + 1000}`, ["1", "2"]]) expect((await datosEdicionIa(db, {}, q as string)).guardada).toBeNull();
  });
});
