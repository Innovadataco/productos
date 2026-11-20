// Candado del calendario de la BVC (INV-SPEC-9): los días sembrados en las migraciones deben ser
// exactamente los festivos de Colombia (Ley 51 de 1983) de cada año sembrado, sin fines de semana.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIA_MS = 86_400_000;
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
const sumar = (f: Date, dias: number) => new Date(f.getTime() + dias * DIA_MS);
const lunesSiguiente = (f: Date) => sumar(f, (8 - f.getUTCDay()) % 7);
const iso = (f: Date) => f.toISOString().slice(0, 10);

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(a: number): Date {
  const [b, c, d] = [Math.floor(a / 100), a % 100, a % 19];
  const h = (19 * d + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((d + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return utc(a, mes, ((h + l - 7 * m + 114) % 31) + 1);
}

function festivosColombia(a: number): string[] {
  const p = pascua(a);
  const fijos = [utc(a, 1, 1), utc(a, 5, 1), utc(a, 7, 20), utc(a, 8, 7), utc(a, 12, 8), utc(a, 12, 25), sumar(p, -3), sumar(p, -2)];
  const trasladables = [utc(a, 1, 6), utc(a, 3, 19), utc(a, 6, 29), utc(a, 8, 15), utc(a, 10, 12), utc(a, 11, 1), utc(a, 11, 11), sumar(p, 39), sumar(p, 60), sumar(p, 68)].map(lunesSiguiente);
  const habiles = [...fijos, ...trasladables].filter((f) => f.getUTCDay() !== 0 && f.getUTCDay() !== 6);
  return [...new Set(habiles.map(iso))].sort();
}

function sembrados(): Map<number, string[]> {
  const dir = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
  const fechas = readdirSync(dir)
    .filter((n) => n.includes("calendario_bvc"))
    .flatMap((n) => [...readFileSync(`${dir}${n}/migration.sql`, "utf8").matchAll(/\('(\d{4}-\d{2}-\d{2})', false,/g)].map((m) => m[1]!));
  const porAnio = new Map<number, string[]>();
  for (const f of fechas) porAnio.set(Number(f.slice(0, 4)), [...(porAnio.get(Number(f.slice(0, 4))) ?? []), f]);
  return porAnio;
}

describe("calendario de la BVC sembrado", () => {
  const porAnio = sembrados();

  it("cubre 2022-2027 (el rango histórico y el año siguiente que necesita la liquidación T+2)", () => {
    expect([...porAnio.keys()].sort()).toEqual([2022, 2023, 2024, 2025, 2026, 2027]);
  });

  it.each([2022, 2023, 2024, 2025, 2026, 2027])("%i: son exactamente los festivos de Colombia que caen entre semana", (anio) => {
    expect([...(porAnio.get(anio) ?? [])].sort()).toEqual(festivosColombia(anio));
  });

  it("la regla reconoce fechas conocidas (Pascua y traslados al lunes)", () => {
    expect(iso(pascua(2025))).toBe("2025-04-20");
    expect(iso(pascua(2026))).toBe("2026-04-05");
    expect(festivosColombia(2026)).toContain("2026-01-12"); // Reyes (martes 6) → lunes 12
    expect(festivosColombia(2025)).not.toContain("2025-07-20"); // 20 de julio cayó en domingo
  });
});
