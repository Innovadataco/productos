/**
 * SPEC-932 · conducta del componente único de identificadores (FORMA SPEC-931 §1/§2/§5).
 * Recorrido real del componente con un adaptador `api` espía y `/api/plataformas` mockeado.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import {
    IdentificadoresParaAlertas,
    DESCRIPCION_IDENTIFICADORES,
    type ApiIdentificadores,
    type IdentificadorAlerta,
} from "./IdentificadoresParaAlertas";

const PLATAFORMAS = [{ id: "plat-ig", nombre: "Instagram" }];
const IDENT: IdentificadorAlerta = {
    id: "id-1",
    tipo: "telefono",
    valor: "+573001234567",
    plataformaId: "plat-ig",
    plataforma: { id: "plat-ig", nombre: "Instagram" },
    estado: "activo",
    etiquetaRelacion: "PADRE",
};

function resp(body: unknown, ok = true): Response {
    return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function montar(over: Partial<React.ComponentProps<typeof IdentificadoresParaAlertas>> = {}) {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(resp({ plataformas: PLATAFORMAS }))));
    const api: ApiIdentificadores = {
        crear: vi.fn(() => Promise.resolve(resp({ identificador: IDENT }))),
        editar: vi.fn(() => Promise.resolve(resp({ identificador: IDENT }))),
        cambiarEstado: vi.fn(() => Promise.resolve(resp({ identificador: IDENT }))),
    };
    const onCambio = vi.fn();
    render(<IdentificadoresParaAlertas identificadores={[IDENT]} api={api} onCambio={onCambio} {...over} />);
    return { api, onCambio };
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("SPEC-932 · IdentificadoresParaAlertas", () => {
    it("tabla canon: Valor·Tipo·Plataforma·Estado·Acciones con Editar + Desactivar; sin Relación por defecto", () => {
        montar();
        for (const col of ["Valor", "Tipo", "Plataforma", "Estado", "Acciones"]) {
            expect(screen.getByRole("columnheader", { name: col })).toBeTruthy();
        }
        expect(screen.queryByRole("columnheader", { name: "Relación" })).toBeNull();
        expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Desactivar" })).toBeTruthy();
        expect(screen.getByText("Instagram")).toBeTruthy();
    });

    it("extensión del estudiante: columna «Relación» con la etiqueta legible", () => {
        montar({ relacion: { opciones: [{ value: "PADRE", label: "Padre" }], porDefecto: "PADRE" } });
        expect(screen.getByRole("columnheader", { name: "Relación" })).toBeTruthy();
        expect(screen.getByText("Padre")).toBeTruthy();
    });

    it("Editar abre el modal con el valor y guarda por api.editar (plataforma incluida)", async () => {
        const { api, onCambio } = montar();
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(await screen.findByText("Editar identificador")).toBeTruthy();
        const input = screen.getByDisplayValue("+573001234567");
        fireEvent.change(input, { target: { value: "+573009999999" } });
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).not.toHaveProperty("disabled", true));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(api.editar).toHaveBeenCalledTimes(1));
        expect(api.editar).toHaveBeenCalledWith(IDENT, { valor: "+573009999999", plataformaId: "plat-ig" });
        await waitFor(() => expect(onCambio).toHaveBeenCalled());
        expect(await screen.findByText("Identificador actualizado")).toBeTruthy();
    });

    it("warn-override (SPEC-320): un 200 con `aviso` NO se celebra como guardado; «Guardar de todos modos» reenvía", async () => {
        const { api, onCambio } = montar();
        (api.crear as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            resp({ aviso: { message: "Este identificador ya está registrado para otra persona del colegio.", pertenece: [{ nombre: "Ana", rol: "PROFESOR" }] } }),
        );
        fireEvent.click(screen.getByRole("button", { name: "Nuevo identificador" }));
        fireEvent.change(await screen.findByPlaceholderText(/Ej\. \+573001234567/), { target: { value: "ana@x.co" } });
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).not.toHaveProperty("disabled", true));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText(/ya está registrado para otra persona/)).toBeTruthy();
        expect(screen.queryByText("Identificador agregado")).toBeNull();
        expect(onCambio).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Guardar de todos modos" }));
        await waitFor(() => expect(api.crear).toHaveBeenCalledTimes(2));
        expect((api.crear as ReturnType<typeof vi.fn>).mock.calls[1][0]).toMatchObject({ valor: "ana@x.co", confirmarCompartido: true });
        expect(await screen.findByText("Identificador agregado")).toBeTruthy();
    });

    it("Desactivar va por api.cambiarEstado", async () => {
        const { api } = montar();
        fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
        await waitFor(() => expect(api.cambiarEstado).toHaveBeenCalledWith(IDENT, "inactivo"));
    });

    it("I-429: el copy dice «estos valores», nunca que se vigila «en esta plataforma»", () => {
        montar();
        expect(screen.getByText(DESCRIPCION_IDENTIFICADORES)).toBeTruthy();
        expect(DESCRIPCION_IDENTIFICADORES).toMatch(/estos valores/);
        expect(DESCRIPCION_IDENTIFICADORES).not.toMatch(/en (esta|esa|la) plataforma/i);
    });

    it("variante «anidado»: sin la línea explicativa (la lleva la sección), mismo patrón", () => {
        montar({ variante: "anidado" });
        expect(screen.queryByText(DESCRIPCION_IDENTIFICADORES)).toBeNull();
        expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    });
});
