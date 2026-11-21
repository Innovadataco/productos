// INV-SPEC-16: el detalle de un fallo expone solo nombre y código, nunca el mensaje (puede traer valores).
import { describe, expect, it } from "vitest";
import { detalleDeError } from "@/precios/actualizar";

describe("detalleDeError", () => {
  it("incluye el nombre y el código de Prisma, y nunca el mensaje", () => {
    const e = Object.assign(new Error("valor 123456 en la consulta"), { name: "PrismaClientKnownRequestError", code: "P2002" });
    const d = detalleDeError(e);
    expect(d).toBe("PrismaClientKnownRequestError P2002");
    expect(d).not.toContain("123456");
  });
  it("sin código, solo el nombre", () => {
    expect(detalleDeError(new TypeError("secreto"))).toBe("TypeError");
  });
  it("un valor que no es Error no filtra contenido", () => {
    expect(detalleDeError("texto 999")).toBe("error");
    expect(detalleDeError(null)).toBe("error");
  });
});
