import { describe, it, expect } from "vitest";
import { listaSegura } from "./respuestaApi";

function respuesta(cuerpo: string, status = 200): Response {
  return new Response(cuerpo, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listaSegura (spec 005, FR-005)", () => {
  it("devuelve la lista cuando la respuesta es correcta", async () => {
    const { items, error } = await listaSegura<{ id: string }>(
      respuesta(JSON.stringify([{ id: "a" }, { id: "b" }])),
    );

    expect(items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(error).toBeNull();
  });

  it("ante un 401 deja la lista vacía y avisa, sin lanzar (US-2)", async () => {
    const { items, error } = await listaSegura(
      respuesta(JSON.stringify({ error: "No autenticado" }), 401),
    );

    expect(items).toEqual([]);
    expect(error).toBe("Sesión no válida: vuelve a iniciar sesión");
  });

  it("ante un 500 deja la lista vacía y avisa", async () => {
    const { items, error } = await listaSegura(
      respuesta(JSON.stringify({ error: "Error interno" }), 500),
    );

    expect(items).toEqual([]);
    expect(error).toBe("No se pudieron cargar los datos");
  });

  it("un 200 cuyo cuerpo NO es lista no llega al estado", async () => {
    const { items, error } = await listaSegura(respuesta(JSON.stringify({ error: "raro" })));

    expect(items).toEqual([]);
    expect(error).toBe("Respuesta inesperada del servidor");
  });

  it("un cuerpo ilegible tampoco rompe", async () => {
    const { items, error } = await listaSegura(respuesta("<html>login</html>"));

    expect(items).toEqual([]);
    expect(error).toBe("Respuesta ilegible del servidor");
  });

  it("nunca devuelve algo que no sea un arreglo (garantía para el .map de la pantalla)", async () => {
    for (const caso of [
      respuesta(JSON.stringify({ error: "x" }), 401),
      respuesta(JSON.stringify({ items: [] })),
      new Response(null, { status: 204 }),
    ]) {
      const { items } = await listaSegura(caso);
      expect(Array.isArray(items)).toBe(true);
    }
  });

  it("no filtra detalle técnico del servidor en el mensaje (§0.3)", async () => {
    const { error } = await listaSegura(
      respuesta(JSON.stringify({ error: "timeout en db:5432" }), 500),
    );

    expect(error).not.toContain("db:5432");
  });
});
