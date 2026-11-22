/**
 * Lo que imprime scripts/registrar-movimiento-fondo.ts (frente fondo-movimientos, T5): ids internos y códigos, nunca las
 * cifras, el correo ni el código del fondo. Si el contraste falla, dice el código y qué revisar en el extracto (el día y
 * el valor de unidad). Nunca recomienda comprar ni vender.
 */
import { describe, expect, it } from "vitest";
import type { CodigoRechazo } from "@/fondo/movimiento";
import { textoRechazo, textoResultado } from "@/fondo/salida-movimiento";

const CODIGOS: readonly CodigoRechazo[] = [
  "USUARIO_NO_AUTORIZADO", "FONDO_NO_REGISTRADO", "FONDO_INACTIVO", "CONSTITUCION_DISTINTA", "MOVIMIENTO_ANTES_DE_LA_CONSTITUCION",
  "SIN_VALOR_UNIDAD_DEL_DIA", "MONTO_NO_CUADRA_CON_VALOR_UNIDAD", "REGISTRO_EN_CONFLICTO",
];

describe("textoResultado", () => {
  it("ensayo: no escribió nada y dice cómo registrarla", () => {
    const t = textoResultado({ estado: "ENSAYO", fondoId: "cfondo", movimientoId: null, ajusteId: null });
    expect(t).toContain("Ensayo");
    expect(t).toContain("No se escribió nada");
    expect(t).toContain("--aplicar");
  });

  it("registrada: los ids internos del fondo, del movimiento y del ajuste, y el siguiente paso", () => {
    const t = textoResultado({ estado: "REGISTRADA", fondoId: "cfondo", movimientoId: "cmov", ajusteId: "cajuste" });
    for (const id of ["cfondo", "cmov", "cajuste", "conciliar-certificacion"]) expect(t).toContain(id);
  });

  it("ya existía: no escribió nada", () => {
    const t = textoResultado({ estado: "YA_EXISTIA", fondoId: "cfondo", movimientoId: "cmov", ajusteId: "cajuste" });
    expect(t).toContain("ya estaba registrada");
    expect(t).toContain("no se escribió nada");
  });
});

describe("textoRechazo", () => {
  it("cada código dice su nombre y qué revisar", () => {
    for (const codigo of CODIGOS) {
      const t = textoRechazo(codigo);
      expect(t).toContain(`No se registró: ${codigo}`);
      expect(t.length).toBeGreaterThan(`No se registró: ${codigo}`.length + 20);
      expect(t).not.toMatch(/\b(compr|vend)/i);
    }
  });

  it("si el monto no cuadra o falta el valor de unidad, manda a revisar en el extracto el día y el valor de unidad", () => {
    for (const codigo of ["MONTO_NO_CUADRA_CON_VALOR_UNIDAD", "SIN_VALOR_UNIDAD_DEL_DIA"] as const) {
      expect(textoRechazo(codigo)).toMatch(/extracto/);
      expect(textoRechazo(codigo)).toMatch(/día/);
      expect(textoRechazo(codigo)).toMatch(/valor de unidad/);
    }
  });
});
