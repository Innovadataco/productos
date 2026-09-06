/**
 * SPEC-325 (002-PI-225): UI "A quién protejo" — render, alta y desvinculación.
 *
 * SPEC-325 (extensión UI): el alta acepta VARIOS identificadores y la tarjeta
 * expone las cuatro acciones del backend. Dos de ellas se parecen y NO son lo
 * mismo — los tests fijan el contrato de cada una para que no se confundan:
 *   · PATCH /api/padre/hijos/[id] .......................... estado del hijo
 *   · POST  /api/padre/hijos/identificadores ............... agregar a hijo ya creado
 *   · PATCH /api/padre/hijos/identificadores/[id] .......... flag GLOBAL compartido
 *   · DELETE /api/padre/hijos/identificadores/[id] ......... quitar solo de este padre
 *
 * El mock enruta por URL (no por orden de llamada): al montar, el componente
 * pide /api/padre/hijos y /api/plataformas, y encadenar `mockReturnValueOnce`
 * ataría los tests al orden interno de esos dos fetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MisHijos } from "./MisHijos";

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

const PLATAFORMAS = [{ id: "p1", clave: "roblox", nombre: "Roblox" }];

/** Enruta por URL; `hijos` puede ser una lista fija o una función por llamada. */
function mockRutas(hijos: unknown[] | (() => unknown[]), respuestaAccion: unknown = { ok: true }) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes("/api/plataformas")) return jsonRes({ plataformas: PLATAFORMAS });
        if (String(url) === "/api/padre/hijos" && (!init || !init.method || init.method === "GET")) {
            return jsonRes(typeof hijos === "function" ? hijos() : hijos);
        }
        return jsonRes(respuestaAccion);
    });
}

function hijoBase(over: Record<string, unknown> = {}) {
    return {
        id: "h1",
        nombre: "Juan",
        apellidos: "Pérez",
        documentoTipo: "TI",
        documentoNumero: "1001",
        anioNacimiento: 2015,
        sexo: "M",
        estado: "activo",
        identificadores: [
            { id: "i1", valor: "robloxjuan", tipo: null, activo: true, plataforma: null },
        ],
        ...over,
    };
}

/** Última llamada a `fetch` que coincide con método y (opcionalmente) URL. */
function llamada(metodo: string, url?: string) {
    return fetchMock.mock.calls
        .filter((c) => c[1]?.method === metodo && (url === undefined || c[0] === url))
        .at(-1);
}

describe("MisHijos", () => {
    it("muestra el vacío cuando no hay hijos", async () => {
        mockRutas([]);
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());
        // sección distinguible con el título de protejo
        expect(screen.getByText("A quién protejo")).toBeDefined();
    });

    it("lista un hijo con su identificador", async () => {
        mockRutas([hijoBase()]);
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        expect(screen.getByText("Juan Pérez")).toBeDefined();
        expect(screen.getByText(/robloxjuan/)).toBeDefined();
    });

    it("registrar hace POST y recarga", async () => {
        mockRutas([], { hijoId: "h9", vinculadoAExistente: false });
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());

        // SPEC-363 (rojo CI #241): payload REAL — documento válido para TI
        // (>= 5 dígitos) y apellidos, que ahora se validan antes de enviar. Con
        // "3003" (4 dígitos) la validación F7 cortaba el submit antes del POST.
        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Ana" } });
        fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Ramírez" } });
        fireEvent.change(screen.getByLabelText("Número de documento"), { target: { value: "1030512345" } });
        fireEvent.submit(screen.getByTestId("form-hijo"));

        await waitFor(() => {
            const post = llamada("POST", "/api/padre/hijos");
            expect(post).toBeDefined();
            expect(String(post![1].body)).toContain("Ana");
        });
    });

    // El alta manda TODOS los identificadores cargados, no solo el último: el
    // padre suele conocer varios (Roblox, teléfono) y cargarlos de una.
    it("el alta envía VARIOS identificadores, con y sin plataforma", async () => {
        mockRutas([], { hijoId: "h9", vinculadoAExistente: false });
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());
        // el catálogo de plataformas ya llegó
        await waitFor(() => expect(screen.getByRole("option", { name: "Roblox" })).toBeDefined());

        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Ana" } });
        fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Ramírez" } });
        fireEvent.change(screen.getByLabelText("Número de documento"), { target: { value: "1030512345" } });

        // 1º con plataforma → se acumula en la lista
        fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: "anaroblox" } });
        fireEvent.change(screen.getByLabelText("Plataforma"), { target: { value: "p1" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar otro" }));
        await waitFor(() => expect(screen.getByTestId("identificadores-nuevos")).toBeDefined());

        // 2º sin plataforma, escrito pero NO "agregado": debe entrar igual.
        fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: "+573001112233" } });
        fireEvent.submit(screen.getByTestId("form-hijo"));

        await waitFor(() => {
            const post = llamada("POST", "/api/padre/hijos");
            expect(post).toBeDefined();
            const body = JSON.parse(String(post![1].body));
            expect(body.identificadores).toEqual([
                { valor: "anaroblox", plataformaId: "p1" },
                { valor: "+573001112233" },
            ]);
        });
    });

    it("desvincular identificador hace DELETE a la ruta correcta", async () => {
        mockRutas([hijoBase({ nombre: "Leo", apellidos: "", identificadores: [{ id: "ix", valor: "leogamer", tipo: null, activo: true, plataforma: null }] })]);
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        fireEvent.click(screen.getByLabelText("Quitar leogamer"));
        await waitFor(() => {
            const del = llamada("DELETE");
            expect(del).toBeDefined();
            expect(del![0]).toBe("/api/padre/hijos/identificadores/ix");
        });
    });

    it("inactivar un hijo hace PATCH con estado inactivo", async () => {
        mockRutas([hijoBase()], { ok: true, estado: "inactivo" });
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        fireEvent.click(screen.getByRole("button", { name: "Inactivar" }));
        await waitFor(() => {
            const patch = llamada("PATCH", "/api/padre/hijos/h1");
            expect(patch).toBeDefined();
            expect(JSON.parse(String(patch![1].body))).toEqual({ estado: "inactivo" });
        });
    });

    it("un hijo inactivo se marca y ofrece Activar", async () => {
        mockRutas([hijoBase({ estado: "inactivo" })]);
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        expect(screen.getByText("Inactivo")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: "Activar" }));
        await waitFor(() => {
            const patch = llamada("PATCH", "/api/padre/hijos/h1");
            expect(JSON.parse(String(patch![1].body))).toEqual({ estado: "activo" });
        });
    });

    // Contraste con el DELETE de arriba: mismo identificador, acción distinta.
    // Este PATCH toca el flag GLOBAL (compartido con el otro padre); el DELETE
    // solo saca el identificador de la vista de este padre.
    it("inactivar un identificador hace PATCH global, NO el DELETE de desvincular", async () => {
        mockRutas([hijoBase()], { ok: true, activo: false });
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());

        fireEvent.click(screen.getByLabelText("Inactivar robloxjuan para todos"));
        await waitFor(() => {
            const patch = llamada("PATCH", "/api/padre/hijos/identificadores/i1");
            expect(patch).toBeDefined();
            expect(JSON.parse(String(patch![1].body))).toEqual({ activo: false });
        });
        expect(llamada("DELETE")).toBeUndefined();
    });

    it("un identificador inactivo ofrece Activar (PATCH activo:true)", async () => {
        mockRutas([
            hijoBase({ identificadores: [{ id: "i1", valor: "robloxjuan", tipo: null, activo: false, plataforma: null }] }),
        ]);
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        fireEvent.click(screen.getByLabelText("Activar robloxjuan para todos"));
        await waitFor(() => {
            const patch = llamada("PATCH", "/api/padre/hijos/identificadores/i1");
            expect(JSON.parse(String(patch![1].body))).toEqual({ activo: true });
        });
    });

    it("agrega un identificador a un hijo ya creado", async () => {
        mockRutas([hijoBase()], { ok: true, identificadorId: "i2", yaExistia: false });
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        await waitFor(() => expect(screen.getAllByRole("option", { name: "Roblox" }).length).toBeGreaterThan(0));

        fireEvent.change(screen.getByLabelText("Agregar cuenta"), { target: { value: "juan@correo.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => {
            const post = llamada("POST", "/api/padre/hijos/identificadores");
            expect(post).toBeDefined();
            expect(JSON.parse(String(post![1].body))).toEqual({ hijoId: "h1", valor: "juan@correo.com" });
        });
    });
});
