// precios:depurar (SPEC-13), parte pura: qué cierres vigentes ya guardados sobran y los conteos que prueban
// los supuestos de volumen antes de aplicar. Datos inventados.
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { clasificarVigentes, depurarPrecios, diagnosticar } from "@/precios/depurar";
import { leerCalendario } from "@/precios/negociacion";
import type { Buscar, Cierre } from "@/precios/yahoo";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const CALENDARIO = leerCalendario([{ dia: utc("2024-03-28"), esHabil: false }]); // jueves festivo ficticio
const DESPUES = new Date("2024-04-10T20:00:00Z");
const vigente = (dia: string) => ({ id: `v-${dia}`, fecha: utc(dia) });
const barra = (dia: string, precio: string, volumen: number | null): Cierre => ({ fecha: utc(dia), precio, volumen });

describe("clasificarVigentes", () => {
  const vigentes = [vigente("2024-03-26"), vigente("2024-03-27"), vigente("2024-03-28"), vigente("2024-03-30"), vigente("2024-04-01"), vigente("2019-03-12")];
  const barras = [barra("2024-03-26", "100", 1500), barra("2024-03-27", "100", 0), barra("2024-03-28", "100", 0), barra("2024-04-01", "101", null), barra("2019-03-12", "90", 700)];

  it("festivo y fin de semana por calendario; volumen 0 por Yahoo; sin calendario solo se cuenta", () => {
    expect(clasificarVigentes(vigentes, barras, DESPUES, CALENDARIO)).toEqual({
      noHabil: ["v-2024-03-28", "v-2024-03-30"],
      sinNegociacion: ["v-2024-03-27"],
      sinCalendario: 1,
      aunNoDefinitivos: 0,
    });
  });

  it("si Yahoo falló (null), los días no hábiles se retiran igual y los hábiles no se tocan", () => {
    expect(clasificarVigentes(vigentes, null, DESPUES, CALENDARIO)).toEqual({ noHabil: ["v-2024-03-28", "v-2024-03-30"], sinNegociacion: [], sinCalendario: 1, aunNoDefinitivos: 0 });
  });

  it("un vigente de hoy antes de la hora definitiva no se toca: se cuenta como aún no definitivo", () => {
    const r = clasificarVigentes([vigente("2024-03-26")], [barra("2024-03-26", "100", 0)], new Date("2024-03-26T15:00:00Z"), CALENDARIO);
    expect(r).toEqual({ noHabil: [], sinNegociacion: [], sinCalendario: 0, aunNoDefinitivos: 1 });
  });
});

describe("diagnosticar", () => {
  it("cuenta volumen 0 con cierre distinto del anterior y días hábiles con volumen null (los supuestos por verificar)", () => {
    const barras = [
      barra("2024-03-25", "100", 10),
      barra("2024-03-26", "100", 0), // volumen 0 con el cierre repetido: lo esperado
      barra("2024-03-27", "105", 0), // volumen 0 con otro cierre: contradice el supuesto
      barra("2024-03-28", "105", null), // festivo: no cuenta como hábil
      barra("2024-04-01", "106", null), // hábil con volumen null: se guarda sin saber si negoció
    ];
    expect(diagnosticar(barras, DESPUES, CALENDARIO)).toEqual({ barras: 5, sinNegociacionConCierreDistinto: 1, habilesConVolumenNull: 1 });
  });

  it("sin barras, todo en cero", () => {
    expect(diagnosticar([], DESPUES, CALENDARIO)).toEqual({ barras: 0, sinNegociacionConCierreDistinto: 0, habilesConVolumenNull: 0 });
  });
});

// Base falsa para depurarPrecios: dos especies con un cierre de festivo cada una; `fallar` decide qué falla.
const SECRETO = "valor 424242 en la consulta";
const errorPrisma = () => Object.assign(new Error(SECRETO), { name: "PrismaClientKnownRequestError", code: "P1001" });
function baseDepurar(fallar: { simboloDe?: string; retiroDe?: string }) {
  const retirados: string[] = [];
  const vigentes = [{ id: "a-28", instrumentoId: "esp-a", fecha: utc("2024-03-28") }, { id: "b-28", instrumentoId: "esp-b", fecha: utc("2024-03-28") }];
  const db = {
    $queryRaw: async () => [{ base: "base_falsa" }],
    calendarioBvc: { findMany: async () => [{ dia: utc("2024-03-28"), esHabil: false }] },
    instrumento: { findMany: async () => [{ id: "esp-a", nemotecnico: "FICTA" }, { id: "esp-b", nemotecnico: "FICTB" }] },
    simboloPrecio: {
      findFirst: async ({ where }: { where: { instrumentoId: string } }) => {
        if (where.instrumentoId === fallar.simboloDe) throw errorPrisma();
        return null;
      },
    },
    precioCierre: {
      findMany: async () => vigentes,
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        if (where.id.in.some((id) => vigentes.find((v) => v.id === id)?.instrumentoId === fallar.retiroDe)) throw errorPrisma();
        retirados.push(...where.id.in);
        return { count: where.id.in.length };
      },
    },
  };
  return { db: db as unknown as PrismaClient, retirados };
}
const yahooVacio: Buscar = async () => new Response(JSON.stringify({ chart: { result: [{ meta: { currency: "COP" }, timestamp: [], indicators: { quote: [{ close: [], volume: [] }] } }] } }));
const aplicar = { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahooVacio, aplicar: true, base: "base_falsa", ahora: DESPUES };

describe("depurarPrecios · un fallo de base en una especie no aborta las demás", () => {
  it("si falla el retiro de una especie: la otra se retira; la fallida va con GUARDADO_ERROR, nombre y código, sin el mensaje", async () => {
    const { db, retirados } = baseDepurar({ retiroDe: "esp-a" });
    const r = await depurarPrecios(db, aplicar);
    expect(retirados).toEqual(["b-28"]);
    expect(r).toMatchObject({ aRetirarNoHabil: 2, retirados: 1, cambiadosPorOtro: 0, fallidas: [{ instrumentoId: "esp-a", codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P1001" }] });
    expect(JSON.stringify(r)).not.toContain("424242");
  });

  it("si falla la lectura del símbolo de una especie: no se toca esa especie y la otra sigue", async () => {
    const { db, retirados } = baseDepurar({ simboloDe: "esp-b" });
    const r = await depurarPrecios(db, aplicar);
    expect(retirados).toEqual(["a-28"]);
    expect(r).toMatchObject({ retirados: 1, fallidas: [{ instrumentoId: "esp-b", codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P1001" }] });
    expect(JSON.stringify(r)).not.toContain("424242");
  });
});
