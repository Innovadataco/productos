import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import EmpresasPage from "./page";

// I-17: el error de guardado debe verse DENTRO del modal (no detrás del overlay fixed).
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

function json(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

// Rutas mockeadas por "MÉTODO /ruta"; el stub queda instalado toda la suite (incluye llamadas
// tardías de recarga tras cerrar el modal) para no golpear el fetch real con URLs relativas.
let routes: Record<string, () => Response | Promise<Response>> = {};

beforeEach(() => {
  routes = {};
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method ?? "GET"} ${url.replace("http://localhost", "")}`;
    if (routes[key]) return routes[key]();
    if (url.includes("/api/me")) return json({ usuario: { id: 1, rol: 1 } });
    if (url.includes("/api/configuracion/modulos")) return json({ items: [] });
    if (url.includes("/api/configuracion/empresas")) return json({ items: [] });
    return json({});
  });
});
afterEach(() => cleanup());

describe("EmpresasPage — I-17 error dentro del modal", () => {
  it("un error de guardado se muestra DENTRO del modal (role=alert), no detrás del overlay", async () => {
    routes["POST /api/configuracion/empresas"] = () => json({ error: "Correo inválido" }, false, 400);
    render(<EmpresasPage />);

    fireEvent.click(await screen.findByText("Nueva empresa"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("Guardar"));

    await waitFor(() => {
      const alerta = within(dialog).getByRole("alert");
      expect(alerta.textContent).toContain("Correo inválido");
    });
    // El modal sigue abierto (no se cerró ante el error).
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("con datos válidos el modal cierra (sin error dentro)", async () => {
    routes["POST /api/configuracion/empresas"] = () => json({ proveedorId: 1, usuarioId: 2, correoEnviado: true }, true, 201);
    render(<EmpresasPage />);
    fireEvent.click(await screen.findByText("Nueva empresa"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("Guardar"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
