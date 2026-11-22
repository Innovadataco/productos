// Lo que lee /datos-oficiales (src/app/datos-oficiales/datos.ts; frente datos-oficiales-pantalla, C6a) contra la base de
// PRUEBAS, con las cuatro series del catálogo sembradas por el camino único (guardarSeries) en 1907–1908, lejos de las
// demás pruebas (el IPC de series-leer está en 1913–1914, la TRM de series-importar en 1991 y en 2027). La pantalla usa
// los códigos reales, así que no se inyecta catálogo. Comprueba, con las reglas de la base (índice único parcial y
// exclusión de vigencias):
// - una sola transacción REPEATABLE READ para todo (la lectura combinada de C5a);
// - la TRM que vale hoy (un tramo que lo cubre) y no la publicada por adelantado; la TPM de ayer, al día pero sin «hoy»;
//   la IBR atrasada; el IPC del mes anterior con la variación en 12 meses CALCULADA;
// - la historia de cada ventana, en orden, sin lo que empieza después de hoy.
// Cifras inventadas.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UNIDAD_VARIACION } from "@/datos-oficiales/series/consulta";
import { guardarSeries, type SerieAGuardar } from "@/datos-oficiales/series/guardar";
import { datosOficiales } from "@/app/datos-oficiales/datos";
import type { SerieConDatos, VistaDatosOficiales } from "@/app/datos-oficiales/tipos";

const db = new PrismaClient();
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fila = (desde: string, hasta: string, valor: string) => ({ desde: dia(desde), hasta: dia(hasta), valor });
const HOY = dia("1908-06-17");
const mesDe = (k: number) => {
  const d = new Date(Date.UTC(1907, 4 + k, 1));
  const fin = new Date(Date.UTC(1907, 5 + k, 0));
  return [d.toISOString().slice(0, 10), fin.toISOString().slice(0, 10)] as const;
};

const SERIES: readonly SerieAGuardar[] = [
  {
    codigo: "TRM", fuente: "sfc:32sa-8pi3",
    valores: [
      fila("1908-06-10", "1908-06-10", "3917.43"), fila("1908-06-11", "1908-06-11", "3921.17"), fila("1908-06-12", "1908-06-14", "3919.61"),
      fila("1908-06-15", "1908-06-15", "3923.07"), fila("1908-06-16", "1908-06-18", "3925.33"),
      // Por adelantado: empieza después de hoy.
      fila("1908-06-19", "1908-06-19", "3927.11"),
    ],
  },
  { codigo: "TPM", fuente: "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", valores: [fila("1908-06-14", "1908-06-14", "4.41"), fila("1908-06-15", "1908-06-15", "4.37"), fila("1908-06-16", "1908-06-16", "4.39")] },
  { codigo: "IBR_3M_EA", fuente: "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER", valores: [fila("1908-05-27", "1908-05-27", "3.931"), fila("1908-05-28", "1908-05-28", "3.917"), fila("1908-05-29", "1908-05-29", "3.923")] },
  {
    codigo: "IPC_INDICE", fuente: "dane:anex-IPC-Indices",
    valores: Array.from({ length: 13 }, (_, k) => fila(...mesDe(k), k === 0 ? "61.37" : k === 12 ? "63.19" : (61.37 + k * 0.13).toFixed(2))),
  },
];

let vista: VistaDatosOficiales;
let transaccion: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  for (const balance of await guardarSeries(db, SERIES)) expect(balance.fallo, balance.codigo).toBeNull();
  transaccion = vi.spyOn(db, "$transaction");
  vista = await datosOficiales(db, HOY);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await db.$disconnect();
});

const serie = (codigo: string): SerieConDatos => {
  const s = vista.series.find((x) => x.codigo === codigo);
  if (s?.estado !== "CON_DATOS") throw new Error(`${codigo} sin datos`);
  return s;
};

describe("/datos-oficiales contra la base", () => {
  it("todo en una sola transacción REPEATABLE READ", () => {
    expect(transaccion).toHaveBeenCalledTimes(1);
    expect(transaccion.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "RepeatableRead" });
    expect(vista.hoy).toBe("1908-06-17");
    expect(vista.series.map((s) => [s.codigo, s.estado])).toEqual([["TRM", "CON_DATOS"], ["TPM", "CON_DATOS"], ["IBR_3M_EA", "CON_DATOS"], ["IPC_INDICE", "CON_DATOS"]]);
  });

  it("TRM: la del tramo que cubre hoy, no la de mañana; la historia sin lo que empieza después de hoy", () => {
    const trm = serie("TRM");
    expect(trm.ultimo).toMatchObject({ valor: "3925.33", desde: "1908-06-16", hasta: "1908-06-18", fuente: "sfc:32sa-8pi3" });
    expect(trm.ultimo.traidoEn).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(trm.frescura).toEqual({ estado: "AL_DIA", dias: 0, umbralDias: 3, valeHoy: true });
    expect(trm.historia.map((p) => [p.desde, p.hasta, p.valor])).toEqual([
      ["1908-06-10", "1908-06-10", "3917.43"], ["1908-06-11", "1908-06-11", "3921.17"], ["1908-06-12", "1908-06-14", "3919.61"],
      ["1908-06-15", "1908-06-15", "3923.07"], ["1908-06-16", "1908-06-18", "3925.33"],
    ]);
  });

  it("TPM de ayer: al día, sin «vale hoy»; IBR atrasada", () => {
    expect(serie("TPM").frescura).toEqual({ estado: "AL_DIA", dias: 1, umbralDias: 7, valeHoy: false });
    expect(serie("TPM").ultimo.valor).toBe("4.39");
    expect(serie("IBR_3M_EA").frescura).toEqual({ estado: "ATRASADA", dias: 19, umbralDias: 7, valeHoy: false });
    expect(serie("IBR_3M_EA").historia.map((p) => p.valor)).toEqual(["3.931", "3.917", "3.923"]);
  });

  it("IPC: el mes anterior y la variación en 12 meses calculada contra el mismo mes del año anterior", () => {
    const ipc = serie("IPC_INDICE");
    expect(ipc.ultimo).toMatchObject({ valor: "63.19", desde: "1908-05-01", hasta: "1908-05-31" });
    expect(ipc.frescura).toEqual({ estado: "AL_DIA", dias: 17, umbralDias: 45, valeHoy: false });
    expect(ipc.variacion).toEqual({ estado: "CALCULADA", valor: "2.97", unidad: UNIDAD_VARIACION, mesBase: "1907-05-01", mesFinal: "1908-05-01" });
    expect(ipc.historia).toHaveLength(13);
  });
});
