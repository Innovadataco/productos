/**
 * Siembra de las gráficas del tablero para el E2E (frente graficas-tablero). La llama tests/e2e/sembrar.ts al final.
 * Cierres INVENTADOS de días hábiles entre la compra de cada especie y la primera fecha ya sembrada, generados por
 * una fórmula determinista (interpolación entre las anclas que ya existen en la siembra + una onda), con fuente
 * «e2e-ficticio». No toca lo que miran el tablero, la conciliación y el plan:
 *   - ningún cierre el 14 ni el 22-nov-2024 ni después del 15-nov-2024;
 *   - FICTA sin los días de sus cierres de Yahoo (22-jul, 21-ago y 18-oct-2024) y siempre bajo 1.200;
 *   - FICTB siempre sobre 2.000; FICTC solo hasta el 30-oct-2024 (sigue ilíquida) y siempre sobre 480;
 *   - un día que ya tenga cierre de esa especie se salta.
 * Con eso la evolución va del 8-abr al 22-nov-2024 y su último punto cuadra con el tablero ($ 268.090 y costo $ 265.000).
 */
import { Prisma, type PrismaClient } from "@prisma/client";

const DIA_MS = 86_400_000;
const FUENTE = "e2e-ficticio";
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const t = (dia: string) => Date.parse(`${dia}T00:00:00Z`);

interface Plan {
  readonly nemo: string;
  /** [día, precio]: la compra (precio de la orden) y los cierres que ya existen. */
  readonly anclas: readonly (readonly [string, number])[];
  readonly hasta: string;
  readonly piso: number;
  readonly techo: number;
  readonly onda: number;
}

const PLANES: readonly Plan[] = [
  { nemo: "FICTA", anclas: [["2024-04-08", 1000], ["2024-07-22", 953], ["2024-08-21", 989], ["2024-10-18", 1063], ["2024-11-18", 1000]], hasta: "2024-11-15", piso: 900, techo: 1197, onda: 0.017 },
  { nemo: "FICTB", anclas: [["2024-04-09", 2013], ["2024-07-01", 2241], ["2024-11-18", 2104]], hasta: "2024-11-15", piso: 2003, techo: 9999, onda: 0.013 },
  { nemo: "FICTC", anclas: [["2024-04-11", 500], ["2024-08-01", 523], ["2024-10-31", 500]], hasta: "2024-10-30", piso: 483, techo: 9999, onda: 0.011 },
];

/** Precio de la interpolación entre anclas más una onda determinista, recortado a [piso, techo], con 2 decimales. */
function precio(p: Plan, dia: number, k: number): number {
  const tramo = p.anclas.findIndex(([d], i) => i < p.anclas.length - 1 && dia <= t(p.anclas[i + 1]![0]) && dia >= t(d));
  const [d0, v0] = p.anclas[Math.max(0, tramo)]!;
  const [d1, v1] = p.anclas[Math.max(0, tramo) + 1] ?? p.anclas[p.anclas.length - 1]!;
  const f = t(d1) === t(d0) ? 0 : (dia - t(d0)) / (t(d1) - t(d0));
  const base = v0 + (v1 - v0) * f;
  const onda = base * p.onda * Math.sin(k * 0.9) * Math.sin(k * 0.23 + 0.7);
  return Math.min(p.techo, Math.max(p.piso, Math.round((base + onda) * 100) / 100));
}

export async function sembrarGraficas(db: PrismaClient): Promise<number> {
  const noHabiles = new Set((await db.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } })).map((d) => iso(d.dia.getTime())));
  const filas: Prisma.PrecioCierreCreateManyInput[] = [];
  for (const p of PLANES) {
    const { id } = await db.instrumento.findFirstOrThrow({ where: { nemotecnico: p.nemo }, select: { id: true } });
    const ya = new Set((await db.precioCierre.findMany({ where: { instrumentoId: id }, select: { fecha: true } })).map((c) => iso(c.fecha.getTime())));
    let k = 0;
    for (let dia = t(p.anclas[0]![0]); dia <= t(p.hasta); dia += DIA_MS) {
      const semana = new Date(dia).getUTCDay();
      const clave = iso(dia);
      if (semana === 0 || semana === 6 || noHabiles.has(clave) || ya.has(clave) || clave === "2024-11-14") continue;
      k += 1;
      filas.push({ instrumentoId: id, fecha: new Date(dia), precio: new Prisma.Decimal(precio(p, dia, k).toFixed(2)), fuente: FUENTE, estado: "NO_VERIFICADO" });
    }
  }
  await db.precioCierre.createMany({ data: filas });
  return filas.length;
}
