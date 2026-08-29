import { describe, it, expect } from "vitest";
import {
  fechaEnFraccion,
  snap,
  nuevaFechaSnap,
  moverBarra,
  redimensionar,
  detectarConflictos,
} from "./ganttInteractivo";
import type { ItemGantt, RangoGantt } from "./gantt";

const d = (iso: string) => new Date(iso + "T00:00:00");
const rango: RangoGantt = { desde: d("2026-09-01"), hasta: d("2026-09-11") }; // 10 días

const barra: ItemGantt = {
  id: "e1",
  tipo: "barra",
  inicio: d("2026-09-03"),
  fin: d("2026-09-06"),
  label: "Barra",
};

describe("fechaEnFraccion (spec 016, FR-006) — inversa de fraccion", () => {
  it("0 es el inicio del rango y 1 el fin", () => {
    expect(fechaEnFraccion(0, rango)).toEqual(d("2026-09-01"));
    expect(fechaEnFraccion(1, rango)).toEqual(d("2026-09-11"));
  });

  it("0.5 es la mitad", () => {
    expect(soloDia(fechaEnFraccion(0.5, rango))).toBe("2026-09-06");
  });

  it("acota fuera de rango", () => {
    expect(fechaEnFraccion(-1, rango)).toEqual(d("2026-09-01"));
    expect(fechaEnFraccion(2, rango)).toEqual(d("2026-09-11"));
  });
});

function soloDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

describe("snap (spec 016, FR-004)", () => {
  it("día: al propio día", () => {
    expect(soloDia(snap(d("2026-09-16"), "dia"))).toBe("2026-09-16");
  });

  it("semana: al lunes de esa semana", () => {
    // 16-sep-2026 es miércoles; el lunes es 14.
    expect(soloDia(snap(d("2026-09-16"), "semana"))).toBe("2026-09-14");
  });

  it("mes: al día 1", () => {
    expect(soloDia(snap(d("2026-09-16"), "mes"))).toBe("2026-09-01");
  });
});

describe("moverBarra (spec 016, FR-001)", () => {
  it("mueve inicio y fin juntos: la duración no cambia", () => {
    // barra dura 3 días (3→6). Se suelta el inicio en la fracción del 5-sep.
    const nueva = moverBarra(barra, 0.4, rango, "dia"); // 0.4*10 días = día 4 → 5-sep
    expect(soloDia(nueva.inicio)).toBe("2026-09-05");
    expect(soloDia(nueva.fin!)).toBe("2026-09-08"); // +3 días
  });

  it("un hito puntual solo mueve su fecha", () => {
    const hito: ItemGantt = { id: "h", tipo: "hito", inicio: d("2026-09-03"), fin: null, label: "H" };
    const nueva = moverBarra(hito, 0.5, rango, "dia");
    expect(nueva.fin).toBeNull();
    expect(soloDia(nueva.inicio)).toBe("2026-09-06");
  });
});

describe("redimensionar (spec 016, FR-001)", () => {
  it("por el fin cambia solo el fin", () => {
    const nueva = redimensionar(barra, "fin", 0.8, rango, "dia"); // 0.8*10 = día 8 → 9-sep
    expect(soloDia(nueva.inicio)).toBe("2026-09-03"); // inicio intacto
    expect(soloDia(nueva.fin!)).toBe("2026-09-09");
  });

  it("por el inicio cambia solo el inicio", () => {
    const nueva = redimensionar(barra, "inicio", 0.1, rango, "dia"); // día 1 → 2-sep
    expect(soloDia(nueva.inicio)).toBe("2026-09-02");
    expect(soloDia(nueva.fin!)).toBe("2026-09-06"); // fin intacto
  });

  it("impide un fin anterior al inicio: se pega al inicio", () => {
    const nueva = redimensionar(barra, "fin", 0, rango, "dia"); // intentar fin en 1-sep < inicio 3-sep
    expect(nueva.fin!.getTime()).toBeGreaterThanOrEqual(nueva.inicio.getTime());
  });
});

describe("detectarConflictos (spec 016, FR-003)", () => {
  const A: ItemGantt = { id: "A", tipo: "barra", inicio: d("2026-09-01"), fin: d("2026-09-10"), label: "A" };
  const B: ItemGantt = { id: "B", tipo: "barra", inicio: d("2026-09-05"), fin: d("2026-09-15"), label: "B", dependeDe: "A" };

  it("marca B cuando A termina después de que empieza B (fin→inicio incumplido)", () => {
    expect(detectarConflictos([A, B])).toEqual(new Set(["B"]));
  });

  it("no marca nada cuando A termina antes de que empieza B", () => {
    const Aok = { ...A, fin: d("2026-09-04") };
    expect(detectarConflictos([Aok, B]).size).toBe(0);
  });

  it("una referencia colgada (la precedente ya no está) no genera conflicto", () => {
    const huerfano = { ...B, dependeDe: "no-existe" };
    expect(detectarConflictos([huerfano]).size).toBe(0);
  });

  it("no reprograma: solo devuelve el conjunto a marcar (RZ-5)", () => {
    const resultado = detectarConflictos([A, B]);
    // A y B siguen con sus fechas originales; la función no las toca.
    expect(A.inicio).toEqual(d("2026-09-01"));
    expect(B.inicio).toEqual(d("2026-09-05"));
    expect(resultado).toBeInstanceOf(Set);
  });

  it("una dependencia circular no cuelga: se evalúa y marca, no reprograma", () => {
    const x: ItemGantt = { id: "X", tipo: "barra", inicio: d("2026-09-05"), fin: d("2026-09-10"), label: "X", dependeDe: "Y" };
    const y: ItemGantt = { id: "Y", tipo: "barra", inicio: d("2026-09-01"), fin: d("2026-09-08"), label: "Y", dependeDe: "X" };
    const resultado = detectarConflictos([x, y]);
    // No entra en bucle; devuelve un Set (con los que incumplen).
    expect(resultado).toBeInstanceOf(Set);
  });
});
