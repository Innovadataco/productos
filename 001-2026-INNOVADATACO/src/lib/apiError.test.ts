import { describe, it, expect, vi, afterEach } from "vitest";
import { apiError, detalleDeError, esCodigoPrisma } from "./apiError";

describe("apiError (FR-004, FR-005)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no expone el mensaje de la excepción al cliente", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("conexión rechazada en 10.0.0.5:5435 — password=secreto");

    const res = apiError("Licitaciones", "GET lista", "Error al obtener licitaciones", 500, err);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener licitaciones" });
    const serializado = JSON.stringify(body);
    expect(serializado).not.toContain("10.0.0.5");
    expect(serializado).not.toContain("secreto");
    expect(serializado).not.toContain("conexión rechazada");
  });

  it("registra el detalle técnico en el log del servidor con el formato de §2.5", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    apiError("Auth", "POST login", "Error en login", 500, new Error("bcrypt falló"));

    expect(spy).toHaveBeenCalledWith("[Auth] POST login: error — bcrypt falló");
  });

  it("nunca incluye un campo details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = apiError("Proyectos", "POST proyecto", "Error creando proyecto", 500, new Error("x"));
    const body = await res.json();

    expect(body).not.toHaveProperty("details");
  });

  it("conserva los campos extra legítimos de la respuesta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = apiError("Configuración", "GET discover", "No se pudo contactar Ollama", 502, new Error("ECONNREFUSED"), {
      models: [],
    });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "No se pudo contactar Ollama", models: [] });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("respeta el código HTTP recibido (§2.4)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(apiError("M", "A", "no encontrado", 404).status).toBe(404);
    expect(apiError("M", "A", "upstream caído", 502).status).toBe(502);
    expect(apiError("M", "A", "sin modelo", 503).status).toBe(503);
  });
});

describe("detalleDeError", () => {
  it("extrae el mensaje de un Error", () => {
    expect(detalleDeError(new Error("boom"))).toBe("boom");
  });

  it("acepta strings lanzados", () => {
    expect(detalleDeError("fallo textual")).toBe("fallo textual");
  });

  it("degrada con seguridad ante valores desconocidos", () => {
    expect(detalleDeError({ raro: true })).toBe("Error desconocido");
    expect(detalleDeError(null)).toBe("Error desconocido");
    expect(detalleDeError(undefined)).toBe("Error desconocido");
  });
});

describe("esCodigoPrisma", () => {
  it("detecta el código de violación de unicidad", () => {
    expect(esCodigoPrisma({ code: "P2002" }, "P2002")).toBe(true);
  });

  it("no confunde otros códigos ni valores sin code", () => {
    expect(esCodigoPrisma({ code: "P2025" }, "P2002")).toBe(false);
    expect(esCodigoPrisma(new Error("x"), "P2002")).toBe(false);
    expect(esCodigoPrisma(null, "P2002")).toBe(false);
  });
});
