import { describe, it, expect } from "vitest";
import { redactar, truncar, redactarYTruncar } from "./redactar";

describe("redacción RECURSIVA (ZEUS-003)", () => {
  it("redacta claves sensibles de primer nivel", () => {
    expect(redactar({ usuario: "u", clave: "secreta", token: "abc" })).toEqual({
      usuario: "u",
      clave: "***",
      token: "***",
    });
  });

  it("redacta claves sensibles ANIDADAS a cualquier profundidad", () => {
    const entrada = {
      nivel1: { nivel2: { Authorization: "Bearer xyz", dato: 1, nivel3: { tokenAutorizado: "T", ok: true } } },
    };
    expect(redactar(entrada)).toEqual({
      nivel1: { nivel2: { Authorization: "***", dato: 1, nivel3: { tokenAutorizado: "***", ok: true } } },
    });
  });

  it("redacta dentro de ARRAYS de objetos", () => {
    const entrada = { items: [{ password: "p1", id: 1 }, { password: "p2", id: 2 }] };
    expect(redactar(entrada)).toEqual({ items: [{ password: "***", id: 1 }, { password: "***", id: 2 }] });
  });

  it("es case-insensitive en el nombre de la clave", () => {
    expect(redactar({ TOKEN: "x", Clave: "y" })).toEqual({ TOKEN: "***", Clave: "***" });
  });

  it("trunca valores que exceden el límite", () => {
    const grande = { blob: "x".repeat(10_000) };
    const r = truncar(grande, 1024) as { _truncado?: boolean };
    expect(r._truncado).toBe(true);
  });

  it("redactarYTruncar combina ambos (redacta primero)", () => {
    const r = redactarYTruncar({ token: "secreto", dato: "ok" }) as { token?: string; dato?: string };
    expect(r.token).toBe("***");
    expect(r.dato).toBe("ok");
  });
});
