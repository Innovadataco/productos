// Interpretación de la ficha de ODIN → estructura intermedia (fase B, corte 2). Solo la ficha
// inventada `ficha.ficticio.md` y textos inventados: nunca la ficha real.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leerFicha } from "@/plan/importar/interpretar";
import { normalizarTexto } from "@/plan/importar/markdown";
import type { FichaLeida, Hallazgo } from "@/plan/importar/tipos";

const FIXTURE = readFileSync(new URL("../../fixtures/ficha.ficticio.md", import.meta.url), "utf8");
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const resumen = (hs: readonly Hallazgo[]) => hs.map((h) => [h.linea, h.item, h.codigo]);
const codigos = (hs: readonly Hallazgo[]) => hs.map((h) => h.codigo);

const POSICIONES = ["| Ticker | Acciones | Costo total (COP) | Compra |", "|---|---|---|---|", "| FICTA | 120 | 100 | ene |", "| FICTB | 250 | 100 | feb |"];
const PIE = "> v0.1 · 2025-03-23 · prueba";

/** Ficha mínima: posiciones, encabezado del plan (línea 8), tabla (filas desde la línea 11) y pie. */
function armar(filas: readonly string[], o: { encabezado?: string | null; pie?: string | null; posiciones?: readonly string[]; despues?: readonly string[] } = {}): string {
  return [
    "# Ficha de prueba",
    "",
    "## Portafolio",
    ...(o.posiciones ?? POSICIONES),
    ...(o.encabezado === null ? ["texto"] : [o.encabezado ?? "**Posición única (15-mar) — prueba.**"]),
    "| Ticker | Decisión | Detalle |",
    "|---|---|---|",
    ...filas,
    ...(o.despues ?? []),
    "",
    ...(o.pie === null ? [] : [o.pie ?? PIE]),
  ].join("\n");
}

function lineasNoVacias(texto: string): number[] {
  return normalizarTexto(texto)
    .split("\n")
    .flatMap((l, i) => (l.trim() === "" ? [] : [i + 1]));
}

describe("la ficha inventada completa", () => {
  const ficha: FichaLeida = leerFicha(FIXTURE);
  const plan = ficha.plan!;

  it("toma la fecha de referencia del pie y la vigencia de «Posición única» con ese año", () => {
    expect(ficha.referencia).toEqual(dia("2025-03-23"));
    expect([plan.linea, plan.vigenteDesde]).toEqual([20, dia("2025-03-15")]);
  });

  it("el motivo de la versión es el párrafo del encabezado, sin marcas de markdown", () => {
    expect(plan.motivo).toBe("Posición única (15-mar) — aprobada por el dueño ficticio; reemplaza la versión de prueba anterior. Texto inventado del encabezado.");
    expect(plan.motivo).not.toContain("**");
  });

  it("arma las reglas de especie, la condicionada y las de portafolio, en orden y con su línea", () => {
    expect(plan.reglas.map((r) => [r.linea, r.item, r.especie, r.condicion, r.nivel, r.accion, r.cantidad, r.plazoHasta])).toEqual([
      [23, null, "FICTA", "NINGUNA", null, "VENDER", 120n, null],
      [24, null, "FICTB", "NINGUNA", null, "NO_ACTUAR", null, null],
      [24, null, "FICTB", "CIERRE_BAJO", "1111", "VENDER", null, null],
      [25, null, null, "LIBRE", null, "NO_ACTUAR", null, null],
      [26, 1, null, "LIBRE", null, "NO_ACTUAR", null, null],
      [26, 2, null, "MONTO_ORDEN_BAJO", "2222000", "NO_ACTUAR", null, null],
      [26, 3, null, "LIBRE", null, "NO_ACTUAR", null, null],
      [27, null, null, "LIBRE", null, "NO_ACTUAR", null, null],
      [28, null, null, "LIBRE", null, "NO_ACTUAR", null, null],
    ]);
  });

  it("el detalle de una regla de especie lleva la Decisión y el Detalle de la fila (nada se pierde)", () => {
    expect(plan.reglas[0]!.detalle).toBe("Vender las 120 — Texto inventado de la fila A. Destino: más FICTB (FICTB), en la misma prueba");
    expect(plan.reglas[1]!.detalle).toBe("Mantener hasta el dividendo de junio — Si cierra < $1.111, vender una parte");
    expect(plan.reglas[2]!.detalle).toBe("Si cierra < $1.111, vender una parte");
    expect(plan.reglas[5]!.detalle).toBe("no comprar con < $2,222 M por orden (excepciones: una inventada, aprobada)");
  });

  it("una decisión por regla principal de especie: fecha de la vigencia, cantidad de la decisión o de las posiciones", () => {
    expect(plan.decisiones.map((d) => [d.linea, d.especie, d.accion, d.cantidad, d.indiceRegla, d.fechaDecision])).toEqual([
      [23, "FICTA", "VENDER", 120n, 0, dia("2025-03-15")],
      [24, "FICTB", "NO_ACTUAR", 250n, 1, dia("2025-03-15")],
    ]);
  });

  it("el motivo de cada decisión es el párrafo del plan más el detalle de su fila", () => {
    expect(plan.decisiones.map((d) => d.motivo)).toEqual([`${plan.motivo} — ${plan.reglas[0]!.detalle}`, `${plan.motivo} — ${plan.reglas[1]!.detalle}`]);
  });

  it("reporta como no importado, con línea e ítem, todo lo que no es plan", () => {
    expect(resumen(ficha.noImportados)).toEqual([
      [5, null, "METADATOS"],
      [6, null, "METADATOS"],
      [9, null, "METADATOS"],
      [13, null, "OPERACION_EJECUTADA"],
      [14, null, "POSICION"],
      [15, null, "CIFRA_AGREGADA"],
      [16, null, "CIFRA_AGREGADA"],
      [18, 1, "CALENDARIO"],
      [18, 2, "CALENDARIO"],
      [18, 3, "CALENDARIO"],
      [26, 2, "EXCEPCION_EN_DETALLE"],
      [29, null, "PENDIENTE_DE_DECISION"],
      [32, null, "CONTEXTO"],
      [33, null, "CONTEXTO"],
    ]);
  });

  it("avisa lo que se importa con una parte solo en el texto, y no tiene bloqueos", () => {
    expect(resumen(ficha.avisos)).toEqual([
      [23, null, "DESTINO_EN_DETALLE"],
      [24, null, "PLAZO_EN_TEXTO"],
      [24, null, "CANTIDAD_EN_TEXTO"],
    ]);
    expect(ficha.bloqueos).toEqual([]);
  });

  it("candado: cada línea no vacía queda clasificada una sola vez (nada se descarta en silencio)", () => {
    expect(ficha.lineas.map((l) => l.linea)).toEqual(lineasNoVacias(FIXTURE));
    const importadas = new Set([plan.linea, ...plan.reglas.map((r) => r.linea)]);
    const conHallazgo = new Set(ficha.noImportados.map((h) => h.linea));
    for (const l of ficha.lineas) {
      if (l.destino === "IMPORTADA") expect(importadas.has(l.linea), `línea ${l.linea}`).toBe(true);
      if (l.destino === "NO_IMPORTADA") expect(conHallazgo.has(l.linea), `línea ${l.linea}`).toBe(true);
    }
    expect(ficha.lineas.filter((l) => l.destino === "ESTRUCTURA").map((l) => l.linea)).toEqual([1, 3, 4, 8, 11, 12, 21, 22, 31, 35, 36]);
  });

  it("ningún detalle queda vacío ni es solo «—»", () => {
    for (const r of plan.reglas) expect(r.detalle.replace(/[—\s-]/g, "")).not.toBe("");
  });
});

describe("formas de la columna Decisión", () => {
  it("«No tocar» con dos especies da una regla y una decisión por especie, con la cantidad de cada posición", () => {
    const { plan } = leerFicha(armar(["| FICTA · FICTB | No tocar | — |"]));
    expect(plan!.reglas.map((r) => [r.especie, r.accion, r.detalle])).toEqual([
      ["FICTA", "NO_ACTUAR", "No tocar"],
      ["FICTB", "NO_ACTUAR", "No tocar"],
    ]);
    expect(plan!.decisiones.map((d) => [d.especie, d.cantidad, d.indiceRegla])).toEqual([
      ["FICTA", 120n, 0],
      ["FICTB", 250n, 1],
    ]);
  });

  it.each([
    ["Mantener; texto inventado", "NO_ACTUAR", null, 120n],
    ["Mantener", "NO_ACTUAR", null, 120n],
    ["Comprar 10", "COMPRAR", 10n, 10n],
    ["Vender 30 y conservar el resto", "VENDER", 30n, 30n],
  ])("«%s» → %s", (texto, accion, cantidadRegla, cantidadDecision) => {
    const ficha = leerFicha(armar([`| FICTA | ${texto} | — |`]));
    expect([ficha.plan!.reglas[0]!.accion, ficha.plan!.reglas[0]!.cantidad, ficha.plan!.decisiones[0]!.cantidad]).toEqual([accion, cantidadRegla, cantidadDecision]);
    expect(ficha.avisos).toEqual([]);
  });

  it("una Decisión que no se reconoce bloquea la versión entera (la foto es permanente)", () => {
    const ficha = leerFicha(armar(["| FICTA | Rotar a medias | x |"]));
    expect(resumen(ficha.bloqueos)).toEqual([[11, null, "DECISION_NO_RECONOCIDA"]]);
  });

  it.each(["Vender 1.5", "Vender las 1,5", "Comprar 2.34"])("«%s»: una cantidad con decimales no se trunca, bloquea", (texto) => {
    const ficha = leerFicha(armar([`| FICTA | ${texto} | — |`]));
    expect(resumen(ficha.bloqueos)).toEqual([[11, null, "CANTIDAD_NO_RECONOCIDA"]]);
  });

  it("una cantidad con dos especies es ambigua y bloquea", () => {
    expect(codigos(leerFicha(armar(["| FICTA · FICTB | Vender 10 | — |"])).bloqueos)).toEqual(["CANTIDAD_AMBIGUA"]);
  });

  it("una especie que no es un nemotécnico bloquea", () => {
    expect(codigos(leerFicha(armar(["| ficta | Mantener | — |"])).bloqueos)).toEqual(["ESPECIE_NO_RECONOCIDA"]);
  });

  it("una fila con celdas de menos bloquea", () => {
    expect(codigos(leerFicha(armar(["| FICTA | Mantener |"])).bloqueos)).toEqual(["FILA_INCOMPLETA"]);
  });

  it("«no actuar» sin posición leíble: la regla entra y la decisión queda como no importada", () => {
    const sinFila = leerFicha(armar(["| FICTC | Mantener | — |"]));
    expect([sinFila.plan!.reglas.length, sinFila.plan!.decisiones.length]).toEqual([1, 0]);
    expect(resumen(sinFila.noImportados)).toContainEqual([11, null, "SIN_CANTIDAD"]);
    const conNota = leerFicha(armar(["| FICTA | Mantener | — |"], { posiciones: [...POSICIONES.slice(0, 2), "| FICTA | 120 (nota) | 100 | ene |", POSICIONES[3]!] }));
    expect(codigos(conNota.noImportados)).toContain("SIN_CANTIDAD");
  });
});

describe("columna Detalle", () => {
  it("«Si cierra > $X, vender N» da una regla CIERRE_SOBRE con su cantidad y sin aviso", () => {
    const { plan, avisos } = leerFicha(armar(["| FICTA | Mantener | Si cierra > $5, vender 10 |"]));
    expect(plan!.reglas.map((r) => [r.condicion, r.nivel, r.accion, r.cantidad])).toEqual([
      ["NINGUNA", null, "NO_ACTUAR", null],
      ["CIERRE_SOBRE", "5", "VENDER", 10n],
    ]);
    expect(avisos).toEqual([]);
  });

  it("una cantidad con decimales en la condición no se trunca, bloquea", () => {
    expect(codigos(leerFicha(armar(["| FICTA | Mantener | Si cierra > $5, vender 1,5 |"])).bloqueos)).toEqual(["CANTIDAD_NO_RECONOCIDA"]);
  });

  it("un nivel que no está en formato es-CO bloquea (no se adivina «$1.5»)", () => {
    expect(codigos(leerFicha(armar(["| FICTA | Mantener | Si cierra < $1.5, vender |"])).bloqueos)).toEqual(["NIVEL_NO_RECONOCIDO"]);
  });
});

describe("fechas y encabezado del plan", () => {
  it("sin pie con fecha no hay año para las fechas: bloquea", () => {
    const ficha = leerFicha(armar(["| FICTA | Mantener | — |"], { pie: null }));
    expect([ficha.plan, codigos(ficha.bloqueos)]).toEqual([null, ["SIN_FECHA_DE_REFERENCIA"]]);
  });

  it("una tabla de plan sin «Posición única (fecha)» antes bloquea y sus filas quedan reportadas", () => {
    const ficha = leerFicha(armar(["| FICTA | Mantener | — |"], { encabezado: null }));
    expect([ficha.plan, resumen(ficha.bloqueos)]).toEqual([null, [[9, null, "PLAN_SIN_FECHA"]]]);
    expect(resumen(ficha.noImportados)).toContainEqual([11, null, "TEXTO_NO_RECONOCIDO"]);
  });

  it("una fecha imposible en el encabezado bloquea", () => {
    expect(codigos(leerFicha(armar(["| FICTA | Mantener | — |"], { encabezado: "**Posición única (31-feb) — prueba.**" })).bloqueos)).toEqual(["FECHA_DEL_PLAN_INVALIDA"]);
  });

  it("un segundo encabezado de plan bloquea (un corte importa una sola versión)", () => {
    const ficha = leerFicha(armar(["| FICTA | Mantener | — |"], { despues: ["**Posición única (16-mar) — otra.**"] }));
    expect(resumen(ficha.bloqueos)).toEqual([[12, null, "PLAN_DUPLICADO"]]);
  });

  it("una ficha sin plan bloquea con SIN_PLAN", () => {
    expect(codigos(leerFicha(`# Sin plan\n\n${PIE}`).bloqueos)).toEqual(["SIN_PLAN"]);
  });
});

describe("secciones y viñetas", () => {
  it("«**Reglas:**» en negrita también se parte en reglas de portafolio", () => {
    const { plan } = leerFicha(armar(["| FICTA | Mantener | — |"], { despues: ["- **Reglas:** una · otra"] }));
    expect(plan!.reglas.slice(1).map((r) => [r.item, r.condicion, r.detalle])).toEqual([
      [1, "LIBRE", "una"],
      [2, "LIBRE", "otra"],
    ]);
  });

  it("una tabla desconocida queda reportada fila por fila", () => {
    // La línea vacía la separa de la tabla del plan (pegada, sería una fila más de esa tabla).
    const ficha = leerFicha(armar(["| FICTA | Mantener | — |"], { despues: ["", "| X | Y |", "|---|---|", "| a | b |"] }));
    expect(resumen(ficha.noImportados)).toContainEqual([15, null, "TEXTO_NO_RECONOCIDO"]);
  });

  it("todo lo que sigue al título de contexto es contexto", () => {
    const ficha = leerFicha(armar(["| FICTA | Mantener | — |"], { despues: ["## Contexto", "párrafo", "- viñeta"] }));
    expect(resumen(ficha.noImportados).slice(-2)).toEqual([
      [13, null, "CONTEXTO"],
      [14, null, "CONTEXTO"],
    ]);
  });
});
