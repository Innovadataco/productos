/**
 * Candado de TIPOS_DIARIOS: los tres tipos de hoy (DIARIO, REGLAS y ESCENARIOS) son los únicos que recorren la corrida
 * diaria, `servicio-ia/ahora.ts`, las tarjetas de la familia y la exportación de hechos. SIMULACION (a demanda, solo del
 * dueño, por la puerta local) nunca aparece ahí: ni en una tarjeta ni en una lectura de la familia.
 * Es una prueba del código fuente (lee los archivos): si alguien hace que un recorrido use TIPOS_RESUMEN, o que una
 * lectura pida SIMULACION, da rojo. Lleva su control positivo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TAREAS_IA } from "@/ia/config/parametros";
import type { ConfigIaVigente } from "@/ia/config/leer";
import { TIPOS_DIARIOS, TIPOS_RESUMEN } from "@/ia/contrato";
import { REINTENTOS_AHORA, duracionMaximaMs } from "@/servicio-ia/ahora";
import { TEXTOS_RESUMEN_IA } from "@/app/_comun/resumen-ia/textos";

const RAIZ = path.resolve(__dirname, "../../../../src");
const leer = (ruta: string): string => readFileSync(path.join(RAIZ, ruta), "utf8");
const archivosDe = (carpeta: string): readonly string[] =>
  readdirSync(path.join(RAIZ, carpeta)).flatMap((nombre) => {
    const relativa = path.join(carpeta, nombre);
    return statSync(path.join(RAIZ, relativa)).isDirectory() ? archivosDe(relativa) : /\.(ts|tsx)$/u.test(nombre) ? [relativa] : [];
  });

/** Dónde NO puede aparecer SIMULACION ni TIPOS_RESUMEN: la corrida diaria, ahora.ts, el bucle, las tarjetas, las páginas de la familia y la exportación. */
const SOLO_DIARIOS: readonly string[] = [
  "servicio-ia/corrida.ts", "servicio-ia/ahora.ts", "servicio-ia/bucle.ts", ...archivosDe("app/_comun/resumen-ia"),
  "app/page.tsx", "app/plan/page.tsx", "app/proyecciones/page.tsx", "ia/evaluacion/exportar/exportar.ts",
];
const USA_TODOS = (texto: string): boolean => /\bSIMULACION\b|\bTIPOS_RESUMEN\b/u.test(texto.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, ""));

describe("TIPOS_DIARIOS", () => {
  it("son los tres de hoy, en su orden, y los primeros de TIPOS_RESUMEN; SIMULACION es el cuarto y último", () => {
    expect([...TIPOS_DIARIOS]).toEqual(["DIARIO", "REGLAS", "ESCENARIOS"]);
    expect(Object.isFrozen(TIPOS_DIARIOS)).toBe(true);
    expect([...TIPOS_RESUMEN]).toEqual([...TIPOS_DIARIOS, "SIMULACION"]);
  });

  it("la corrida diaria (TAREAS_IA) es exactamente TIPOS_DIARIOS", () => {
    expect([...TAREAS_IA]).toEqual([...TIPOS_DIARIOS]);
  });

  it("ahora.ts calcula la duración con los tres tipos de hoy, no con los cuatro", () => {
    const config = { limiteSegundos: 60 } as ConfigIaVigente;
    expect(duracionMaximaMs(config)).toBe(TIPOS_DIARIOS.length * (1 + REINTENTOS_AHORA.maximo) * 60 * 1000 + REINTENTOS_AHORA.pausaMs);
    expect(duracionMaximaMs(config)).not.toBe(TIPOS_RESUMEN.length * (1 + REINTENTOS_AHORA.maximo) * 60 * 1000 + REINTENTOS_AHORA.pausaMs);
  });

  it("las tarjetas solo tienen título para los tres de hoy", () => {
    expect(Object.keys(TEXTOS_RESUMEN_IA.titulos).sort()).toEqual([...TIPOS_DIARIOS].sort());
  });

  it.each(SOLO_DIARIOS)("%s no usa TIPOS_RESUMEN ni nombra SIMULACION", (ruta) => {
    expect(USA_TODOS(leer(ruta)), ruta).toBe(false);
  });

  it("ninguna lectura de la familia pide SIMULACION: los tipos que piden las páginas son de TIPOS_DIARIOS", () => {
    const pedidos = ["app/page.tsx", "app/plan/page.tsx", "app/proyecciones/page.tsx"].flatMap((ruta) =>
      [...leer(ruta).matchAll(/resumenDelDia\(\s*\w+,\s*"([A-Z_]+)"/gu)].map((m) => m[1] as string));
    expect(pedidos.sort()).toEqual(["DIARIO", "ESCENARIOS", "REGLAS"]);
    for (const tipo of pedidos) expect(TIPOS_DIARIOS as readonly string[]).toContain(tipo);
  });

  it("control positivo: el detector ve SIMULACION y TIPOS_RESUMEN en código, y no en comentarios", () => {
    expect(USA_TODOS('resumenDelDia(db, "SIMULACION", id)')).toBe(true);
    expect(USA_TODOS("for (const t of TIPOS_RESUMEN) {}")).toBe(true);
    expect(USA_TODOS("// SIMULACION no va aquí\n/* TIPOS_RESUMEN */ const x = 1;")).toBe(false);
    expect(USA_TODOS("for (const t of TIPOS_DIARIOS) {}")).toBe(false);
  });
});
