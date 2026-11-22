// Lo que imprime scripts/registrar-rendimientos-fondo.ts (frente fondo-rendimientos, T4: src/fondo/rendimientos/salida.ts):
// el modo, conteos, códigos, números de línea e ids internos; nunca valores, fechas, el código del fondo ni el correo.
// 0 ensayo, sin cambios o aplicado · 3 rechazado · 2 o 3 si el archivo no se pudo leer. En producción (vía B) todo fallo
// termina con la frase de parar y el ensayo dice repetir por el sobre. Datos inventados.
import { describe, expect, it } from "vitest";
import { PARE_VIA_B } from "@/cli/via-b";
import { salidaArchivoRendimientos, salidaRendimientos } from "@/fondo/rendimientos/salida";
import type { ResultadoRendimientos } from "@/fondo/rendimientos/registrar";

const LOCAL = { produccion: false };
const PROD = { produccion: true };
const conteos = { filas: 4, rendimientos: 2, retenciones: 1, sinCambios: 1 };
const listo: ResultadoRendimientos = { modo: "ENSAYO", estado: "LISTO", fondoId: "cfondoficticio0000000000001", conteos, cargaId: null };
const aplicado: ResultadoRendimientos = { modo: "APLICAR", estado: "APLICADO", fondoId: "cfondoficticio0000000000001", conteos, cargaId: "ccargaficticia0000000000001" };
const sinCambios: ResultadoRendimientos = { modo: "APLICAR", estado: "SIN_CAMBIOS", fondoId: "cfondoficticio0000000000001", conteos: { filas: 4, rendimientos: 0, retenciones: 0, sinCambios: 4 }, cargaId: null };
const rechazado: ResultadoRendimientos = {
  modo: "APLICAR", estado: "RECHAZADO", total: 3,
  hallazgos: [{ linea: 0, columna: null, codigo: "FONDO_SIN_CONSTITUCION" }, { linea: 3, columna: "valor", codigo: "VALOR_DISTINTO" }, { linea: 5, columna: "fecha", codigo: "FECHA_ANTES_DE_LA_CONSTITUCION" }],
};

describe("rendimientos · salida del CLI", () => {
  it("ensayo: 0, el modo, el fondo por su id, los conteos, que la retención no mueve la caja y «listo para --aplicar»", () => {
    const s = salidaRendimientos(listo, LOCAL);
    expect(s.codigoSalida).toBe(0);
    expect(s.errores).toEqual([]);
    expect(s.lineas).toEqual([
      "Rendimientos del fondo · ENSAYO (no escribe nada)",
      "Fondo cfondoficticio0000000000001 · filas: 4 · por registrar: rendimientos 2, retenciones 1 · sin cambios: 1",
      "Las retenciones quedan como hecho del fondo: no mueven la caja (el pago del rendimiento ya llega neto).",
      "Resultado: listo para --aplicar; no se escribió nada",
    ]);
  });

  it("ensayo en producción: repetir por la vía B con --aplicar en la cabecera", () => {
    expect(salidaRendimientos(listo, PROD).lineas.at(-1)).toBe("Resultado: listo; no se escribió nada. Para registrarlo, repita por la vía B con --aplicar en la cabecera del sobre");
  });

  it("aplicado: la carga y el siguiente paso (conciliar los cortes otra vez), local y por la vía B", () => {
    const local = salidaRendimientos(aplicado, LOCAL);
    expect(local.codigoSalida).toBe(0);
    expect(local.lineas.slice(0, 2)).toEqual([
      "Rendimientos del fondo · APLICAR (escribe en la base)",
      "Fondo cfondoficticio0000000000001 · filas: 4 · registradas: rendimientos 2, retenciones 1 · sin cambios: 1",
    ]);
    expect(local.lineas).toContain("Resultado: aplicado · carga ccargaficticia0000000000001");
    expect(local.lineas.at(-1)).toMatch(/^Siguiente paso: `npx tsx scripts\/conciliar-certificacion\.ts --fecha-corte <corte>`/);
    expect(salidaRendimientos(aplicado, PROD).lineas.at(-1)).toMatch(/^Siguiente paso \(vía B, §11 del runbook\): `cargar-prod\.sh conciliar-certificacion`/);
  });

  it("sin cambios: 0 y «ya estaba todo registrado», sin siguiente paso", () => {
    const s = salidaRendimientos(sinCambios, LOCAL);
    expect(s.codigoSalida).toBe(0);
    expect(s.lineas.at(-1)).toBe("Resultado: ya estaba todo registrado; no se escribió nada");
  });

  it("rechazado: 3, cada hallazgo (línea · columna · código) y qué revisar; en producción, la frase de parar al final", () => {
    const s = salidaRendimientos(rechazado, LOCAL);
    expect(s.codigoSalida).toBe(3);
    expect(s.lineas).toEqual(["Rendimientos del fondo · APLICAR (escribe en la base)"]);
    expect(s.errores.slice(0, 4)).toEqual([
      "❌ Rechazado, no se escribió nada · 3 hallazgo(s):",
      "   todo el archivo · FONDO_SIN_CONSTITUCION",
      "   línea 3 · valor · VALOR_DISTINTO",
      "   línea 5 · fecha · FECHA_ANTES_DE_LA_CONSTITUCION",
    ]);
    expect(s.errores.join("\n")).toMatch(/FONDO_SIN_CONSTITUCION: .*constitución/);
    expect(s.errores.join("\n")).toMatch(/VALOR_DISTINTO: .*no se corrige/);
    expect(salidaRendimientos(rechazado, PROD).errores.at(-1)).toBe(PARE_VIA_B);
    expect(s.errores).not.toContain(PARE_VIA_B);
  });

  it("cada código de rechazo de la base tiene su explicación", () => {
    for (const codigo of ["USUARIO_NO_AUTORIZADO", "FONDO_NO_REGISTRADO", "FONDO_INACTIVO", "FONDO_SIN_CONSTITUCION", "FECHA_ANTES_DE_LA_CONSTITUCION", "VALOR_DISTINTO", "FILA_REPETIDA", "CONFLICTO_CONCURRENTE"]) {
      const s = salidaRendimientos({ modo: "ENSAYO", estado: "RECHAZADO", total: 1, hallazgos: [{ linea: 0, columna: null, codigo }] }, LOCAL);
      expect(s.errores.some((e) => e.startsWith(`   ${codigo}: `)), codigo).toBe(true);
    }
  });

  it("el archivo: 3 si pasa del tope (no tocó la base), 2 si no se pudo leer", () => {
    expect(salidaArchivoRendimientos("ARCHIVO_DEMASIADO_GRANDE", LOCAL)).toMatchObject({ codigoSalida: 3 });
    expect(salidaArchivoRendimientos("ARCHIVO_ILEGIBLE", LOCAL)).toMatchObject({ codigoSalida: 2 });
    expect(salidaArchivoRendimientos("ARCHIVO_NO_REGULAR", PROD).errores.at(-1)).toBe(PARE_VIA_B);
  });

  it("nunca recomienda comprar ni vender", () => {
    const todo = [listo, aplicado, sinCambios, rechazado].flatMap((r) => [LOCAL, PROD].flatMap((o) => [...salidaRendimientos(r, o).lineas, ...salidaRendimientos(r, o).errores]));
    expect(todo.join("\n")).not.toMatch(/\b(compre|compren|venda|vendan|recomend\w*)\b/i);
  });
});
