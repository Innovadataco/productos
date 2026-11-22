// Candado del camino ÚNICO de escritura de movimiento_fondo y ajuste_caja (frente fondo-movimientos): solo
// src/fondo/movimiento.ts (registrarConstitucion) los escribe, dentro de una transacción con candado por fondo, y la
// base exige la coherencia entre los dos. Otro camino podría dejar un aporte sin su movimiento (o al revés), que la
// conciliación contaría en la caja sin marcar el aporte como registrado.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..");
const ESCRITURA = /\b(movimientoFondo|ajusteCaja)\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\b/g;
/** INSERT, UPDATE, DELETE o COPY sobre las tablas, con o sin el esquema y las comillas; o el delegado en una variable. */
const ESCRITURA_CRUDA = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|COPY)\s+(?:"?public"?\s*\.\s*)?"?(movimiento_fondo|ajuste_caja)\b|=\s*\w+\.(movimientoFondo|ajusteCaja)\s*;/i;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx|mts|mjs|sh|sql)$/.test(n) ? [p] : [];
  });
}

const todos = () => ["src", "scripts"].flatMap((d) => archivos(path.join(RAIZ, d)));
const relativo = (a: string) => path.relative(RAIZ, a).split(path.sep).join("/");

describe("movimiento_fondo y ajuste_caja · un solo camino de escritura", () => {
  it("solo src/fondo/movimiento.ts los crea, y nada los edita ni los borra", () => {
    const usos = new Set<string>();
    for (const a of todos()) for (const m of readFileSync(a, "utf8").matchAll(ESCRITURA)) usos.add(`${relativo(a)} ${m[1]}.${m[2]}`);
    expect([...usos].sort()).toEqual(["src/fondo/movimiento.ts ajusteCaja.create", "src/fondo/movimiento.ts movimientoFondo.create"]);
  });

  it("el patrón de SQL crudo reconoce el nombre con esquema y con comillas (code-reviewer, MEDIO)", () => {
    for (const sql of [
      "INSERT INTO ajuste_caja", 'INSERT INTO "movimiento_fondo"', "INSERT INTO public.ajuste_caja", 'INSERT INTO "public"."movimiento_fondo"',
      'UPDATE public."ajuste_caja"', "DELETE FROM public.movimiento_fondo", 'COPY "public".ajuste_caja', "const a = tx.ajusteCaja;",
    ]) {
      expect(ESCRITURA_CRUDA.test(sql), sql).toBe(true);
    }
    for (const sql of ["SELECT * FROM public.ajuste_caja", "BEFORE DELETE OR UPDATE ON public.movimiento_fondo", "INSERT INTO ajuste_caja_viejo"]) {
      expect(ESCRITURA_CRUDA.test(sql), sql).toBe(false);
    }
  });

  it("ningún módulo ni script los escribe con SQL crudo ni guarda el delegado en una variable", () => {
    expect(todos().filter((a) => ESCRITURA_CRUDA.test(readFileSync(a, "utf8"))).map(relativo)).toEqual([]);
  });
});
