import { describe, it, expect, afterEach } from "vitest";
import { modoIntegracion, integracionRealActiva } from "@/lib/integracion/modo";

const orig = {
  modo: process.env.INTEGRACIONES_MODO,
  hab: process.env.SUPERTRANSPORTE_HABILITADO,
};

afterEach(() => {
  process.env.INTEGRACIONES_MODO = orig.modo;
  process.env.SUPERTRANSPORTE_HABILITADO = orig.hab;
});

describe("gate de integración (guardarraíl)", () => {
  it("por defecto es stub", () => {
    delete process.env.INTEGRACIONES_MODO;
    delete process.env.SUPERTRANSPORTE_HABILITADO;
    expect(modoIntegracion()).toBe("stub");
    expect(integracionRealActiva()).toBe(false);
  });

  it("NO activa real si solo INTEGRACIONES_MODO=real", () => {
    process.env.INTEGRACIONES_MODO = "real";
    process.env.SUPERTRANSPORTE_HABILITADO = "false";
    expect(modoIntegracion()).toBe("stub");
  });

  it("NO activa real si solo SUPERTRANSPORTE_HABILITADO=true", () => {
    process.env.INTEGRACIONES_MODO = "stub";
    process.env.SUPERTRANSPORTE_HABILITADO = "true";
    expect(modoIntegracion()).toBe("stub");
  });

  it("activa real SOLO con ambos gates", () => {
    process.env.INTEGRACIONES_MODO = "real";
    process.env.SUPERTRANSPORTE_HABILITADO = "true";
    expect(modoIntegracion()).toBe("real");
    expect(integracionRealActiva()).toBe(true);
  });
});
