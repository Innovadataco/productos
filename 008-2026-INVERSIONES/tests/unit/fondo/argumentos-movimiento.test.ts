/**
 * Argumentos de scripts/registrar-movimiento-fondo.ts (frente fondo-movimientos, T5): estrictos y leídos ANTES de abrir
 * la base. Cada opción una sola vez, nada suelto, una opción nunca es el valor de otra; sin --aplicar es ensayo. La fecha
 * no puede ser posterior a hoy en Bogotá. Los errores llevan campo y código, nunca el valor. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { interpretarArgumentosMovimiento } from "@/fondo/argumentos-movimiento";

// 2027-07-14 a las 22:00 en Bogotá (ya es 15 en UTC).
const AHORA = new Date("2027-07-15T03:00:00Z");
const BASE = ["--email", "dueno@ejemplo.invalid", "--fondo", "7316284", "--fecha", "2027-06-23", "--unidades", "1031.77246", "--monto", "4729785.4531"];
const DATOS = { email: "dueno@ejemplo.invalid", codigoFic: "7316284", fecha: new Date("2027-06-23T00:00:00Z"), unidades: "1031.77246", monto: "4729785.4531" };
const INVALIDOS = { ok: false, errores: [{ campo: "argumentos", codigo: "ARGUMENTOS_INVALIDOS" }] };

describe("interpretarArgumentosMovimiento", () => {
  it("sin --aplicar es ensayo; con --aplicar, escribe", () => {
    expect(interpretarArgumentosMovimiento(BASE, AHORA)).toEqual({ ok: true, aplicar: false, datos: DATOS });
    expect(interpretarArgumentosMovimiento([...BASE, "--aplicar"], AHORA)).toEqual({ ok: true, aplicar: true, datos: DATOS });
  });

  it("una opción desconocida, un argumento suelto o --aplicar con valor se rechazan", () => {
    for (const extra of [["--tipo", "APORTE"], ["--evidencia", "extracto"], ["suelto"], ["--aplicar=no"], ["--"]]) {
      expect(interpretarArgumentosMovimiento([...BASE, ...extra], AHORA)).toEqual(INVALIDOS);
    }
  });

  it("una opción nunca es el valor de otra", () => {
    expect(interpretarArgumentosMovimiento(["--email", "--fondo", "7316284", ...BASE.slice(4)], AHORA)).toEqual(INVALIDOS);
  });

  it("una opción repetida se rechaza por su nombre (aunque los dos valores sean válidos)", () => {
    expect(interpretarArgumentosMovimiento([...BASE, "--monto", "4729785.4531", "--aplicar", "--aplicar"], AHORA)).toEqual({
      ok: false,
      errores: [{ campo: "monto", codigo: "OPCION_REPETIDA" }, { campo: "aplicar", codigo: "OPCION_REPETIDA" }],
    });
  });

  it("la fecha se compara con hoy en Bogotá: la de hoy vale y la de mañana no", () => {
    const con = (fecha: string) => interpretarArgumentosMovimiento([...BASE.slice(0, 5), fecha, ...BASE.slice(6)], AHORA);
    expect(con("2027-07-14").ok).toBe(true);
    expect(con("2027-07-15")).toEqual({ ok: false, errores: [{ campo: "fecha", codigo: "FECHA_FUTURA" }] });
  });

  it("los datos inválidos dicen campo y código, sin el valor", () => {
    const r = interpretarArgumentosMovimiento([...BASE.slice(0, 7), "1031,77246", "--monto", "-4729785.4531"], AHORA);
    expect(r).toEqual({ ok: false, errores: [{ campo: "unidades", codigo: "NUMERO_FORMATO" }, { campo: "monto", codigo: "DEBE_SER_POSITIVO" }] });
    expect(JSON.stringify(r)).not.toMatch(/1031|4729785/);
  });

  it("sin nada: faltan los cinco datos", () => {
    const r = interpretarArgumentosMovimiento([], AHORA);
    expect(r.ok ? [] : r.errores.map((e) => e.campo)).toEqual(["email", "fondo", "fecha", "unidades", "monto"]);
  });
});
