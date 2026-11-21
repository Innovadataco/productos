// Ayudas de las pruebas de los CLI de 008 como proceso (tests/unit/cli y tests/integracion/cli). El hijo
// corre con un entorno MÍNIMO (nunca hereda el de quien corre las pruebas: ni su DATABASE_URL, ni su
// AUTH_SECRET, ni sus claves) y desde la raíz de 008, se lance vitest desde donde se lance.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect } from "vitest";

export const RAIZ = join(__dirname, "..", "..");
const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
/** Tope por CLI: arranca Node, tsx y Prisma (uno toma menos de 1 s en el Mac). */
export const POR_CLI_MS = 60_000;

export interface Salida {
  readonly codigo: number | null;
  /** stdout y stderr juntos: lo que vería quien corre el CLI. */
  readonly texto: string;
}

/** PATH, NODE_ENV y NO_COLOR, más lo que cada prueba pase (la base y, si hace falta, las claves). */
export function entornoMinimo(extra: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? "", NODE_ENV: "test", NO_COLOR: "1", ...extra };
}

export function correr(script: string, args: readonly string[], env: NodeJS.ProcessEnv): Salida {
  const r = spawnSync(TSX, [join("scripts", script), ...args], { cwd: RAIZ, env, encoding: "utf8", timeout: POR_CLI_MS });
  return { codigo: r.status, texto: `${r.stdout}${r.stderr}` };
}

/** Los ids internos (cuid) que imprimen los CLI se quitan antes de buscar datos: una cifra dentro de un id no es un dato. */
const sinIds = (texto: string): string => texto.replace(/\bc[a-z0-9]{24}\b/g, "<id>");

/** Sale con `codigo`, dice `esperado` y no imprime ninguno de los datos de `nunca`. */
export function comprobar(s: Salida, codigo: number, esperado: string, nunca: readonly string[]): void {
  expect(s.codigo, s.texto).toBe(codigo);
  expect(s.texto).toContain(esperado);
  const limpio = sinIds(s.texto);
  for (const dato of nunca) {
    expect(dato, "un dato vacío no prueba nada").not.toBe("");
    expect(limpio, dato).not.toContain(dato);
  }
}
