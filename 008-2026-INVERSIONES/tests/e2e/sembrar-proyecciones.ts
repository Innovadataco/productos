/**
 * Siembra de la pantalla de proyecciones para el E2E (frente proyecciones-pantalla). La llama tests/e2e/sembrar.ts al
 * final. El motor solo lee cierres de fuente «yahoo» (src/proyecciones/leer.ts) y pide 250 días por especie; el resto
 * de la siembra casi no trae yahoo. Aquí: cierres yahoo INVENTADOS de FICTA y FICTB de lunes a viernes de 2019 a 2021
 * (antes de 2022: nada del periodo de la historia real), con una caminata determinista (PRNG con semilla) recortada:
 *   - FICTA entre 901 y 1.197 y su último cierre cerca de 953 (su primer yahoo de 2024 es 953: sin salto aparente);
 *   - FICTB entre 2.003 y 2.391.
 * No toca lo que miran las demás pantallas: el tablero y la evolución empiezan con la primera compra (abril de 2024),
 * el plan lee yahoo solo alrededor de sus decisiones (2024) y la conciliación, el día de cada corte (nov-2024).
 * 2019-2021 no están en calendario_bvc: el motor lo avisa, y eso también se ve en la pantalla.
 */
import { Prisma, type PrismaClient } from "@prisma/client";

const DIA_MS = 86_400_000;
const DESDE = Date.UTC(2019, 0, 2);
const HASTA = Date.UTC(2021, 11, 30);

interface Plan {
  readonly nemo: string;
  readonly inicio: number;
  readonly fin: number;
  readonly piso: number;
  readonly techo: number;
  readonly semilla: number;
}

const PLANES: readonly Plan[] = [
  { nemo: "FICTA", inicio: 1013.37, fin: 953.41, piso: 901, techo: 1197, semilla: 4613 },
  { nemo: "FICTB", inicio: 2137.13, fin: 2211.71, piso: 2003, techo: 2391, semilla: 4711 },
];

/** mulberry32: el mismo PRNG que usan las pruebas del motor (tests/unit/proyecciones/ficticio.ts). */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function diasHabiles(): number[] {
  const dias: number[] = [];
  for (let t = DESDE; t <= HASTA; t += DIA_MS) {
    const semana = new Date(t).getUTCDay();
    if (semana !== 0 && semana !== 6) dias.push(t);
  }
  return dias;
}

/** Una caminata con ruido de ±1,3 % diario que tiende de `inicio` a `fin`, recortada a [piso, techo], con 2 decimales. */
function precios(p: Plan, n: number): number[] {
  const r = azar(p.semilla);
  let x = p.inicio;
  return Array.from({ length: n }, (_, k) => {
    const objetivo = p.inicio + ((p.fin - p.inicio) * k) / Math.max(1, n - 1);
    if (k > 0) x = x * (1 + (r() - 0.5) * 0.026) + (objetivo - x) * 0.03;
    const ultimo = k === n - 1 ? p.fin : x;
    return Math.min(p.techo, Math.max(p.piso, Math.round(ultimo * 100) / 100));
  });
}

export async function sembrarProyecciones(db: PrismaClient): Promise<number> {
  const dias = diasHabiles();
  const filas: Prisma.PrecioCierreCreateManyInput[] = [];
  for (const p of PLANES) {
    const { id } = await db.instrumento.findFirstOrThrow({ where: { nemotecnico: p.nemo }, select: { id: true } });
    const serie = precios(p, dias.length);
    dias.forEach((t, k) => filas.push({ instrumentoId: id, fecha: new Date(t), precio: new Prisma.Decimal(serie[k]!.toFixed(2)), fuente: "yahoo", estado: "NO_VERIFICADO" }));
  }
  await db.precioCierre.createMany({ data: filas });
  return filas.length;
}
