import { describe, expect, it } from "vitest";
import { validarEscision } from "@/eventos/escision";

const base = { origen: "FICTA", destino: "FICTB", fecha: "2025-07-14" };

describe("validarEscision", () => {
  it("acepta un evento mínimo y uno completo", () => {
    expect(validarEscision(base).ok).toBe(true);
    const r = validarEscision({ ...base, razon: "0.5000", pagoFraccion: "2025-07-25", montoFraccion: "1234.50", nota: "por confirmar" });
    expect(r.ok && r.valor).toMatchObject({ razon: "0.5", montoFraccion: "1234.5", nota: "por confirmar" });
  });

  it.each([
    [{ destino: "FICTA" }, "destino", "ORIGEN_IGUAL_A_DESTINO"],
    [{ fecha: "14/07/2025" }, "fecha", "FECHA_FORMATO"],
    [{ razon: "0" }, "razon", "DEBE_SER_POSITIVO"],
    [{ razon: "0,72" }, "razon", "NUMERO_FORMATO"],
    [{ razon: "0.12345678901" }, "razon", "NUMERO_PRECISION"],
    [{ pagoFraccion: "2025-07-01" }, "pagoFraccion", "ANTES_DEL_EVENTO"],
    [{ montoFraccion: "10" }, "pagoFraccion", "FALTA_CON_MONTO"],
    [{ montoFraccion: "-5", pagoFraccion: "2025-07-25" }, "montoFraccion", "DEBE_SER_POSITIVO"],
    [{ origen: "FIC.CL" }, "origen", "NEMOTECNICO_FORMATO"],
    [{ nota: "x".repeat(201) }, "nota", "DEMASIADO_LARGA"],
  ])("rechaza %j en %s con %s", (cambio, campo, codigo) => {
    const r = validarEscision({ ...base, ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toContainEqual({ campo, codigo });
  });
});
