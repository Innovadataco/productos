import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import UsuariosAdminClient from "./UsuariosAdminClient";

const pushMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: pushMock }),
    usePathname: () => "/dashboard/admin/usuarios",
}));

function usuarioBase(overrides: Record<string, unknown> = {}) {
    return {
        id: "usr-1",
        email: "test@example.com",
        nombre: "Test User",
        estado: "activo",
        creadoEn: "2026-08-01T10:00:00.000Z",
        ultimaSesion: null,
        reportesEnviados: 0,
        colegiosAsociados: [],
        ...overrides,
    };
}

function mockFetchUsuarios() {
    return vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes("/api/admin/usuarios")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    items: [usuarioBase()],
                    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
                }),
            } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
}

describe("UsuariosAdminClient", () => {
    beforeEach(() => {
        searchParams = new URLSearchParams();
        pushMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga listado de Padres por defecto", async () => {
        mockFetchUsuarios();
        render(<UsuariosAdminClient />);
        await waitFor(() => expect(screen.getByText("test@example.com")).toBeTruthy());
    });

    it("carga listado de Rectores (prop rol)", async () => {
        const fetchMock = mockFetchUsuarios();
        render(<UsuariosAdminClient rol="SCHOOL_ADMIN" />);
        await waitFor(() => expect(screen.getByText("test@example.com")).toBeTruthy());
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("rol=SCHOOL_ADMIN"),
                expect.any(Object)
            )
        );
    });

    it("carga listado de Operadores (prop rol)", async () => {
        const fetchMock = mockFetchUsuarios();
        render(<UsuariosAdminClient rol="OPERADOR" />);
        await waitFor(() => expect(screen.getByText("test@example.com")).toBeTruthy());
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("rol=OPERADOR"),
                expect.any(Object)
            )
        );
    });

    it("carga listado de Comité con rol alias COMITE", async () => {
        const fetchMock = mockFetchUsuarios();
        render(<UsuariosAdminClient rol="COMITE" />);
        await waitFor(() => expect(screen.getByText("test@example.com")).toBeTruthy());
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("rol=COMITE"),
                expect.any(Object)
            )
        );
    });

    it("carga listado de Admins (prop rol)", async () => {
        const fetchMock = mockFetchUsuarios();
        render(<UsuariosAdminClient rol="ADMIN" />);
        await waitFor(() => expect(screen.getByText("test@example.com")).toBeTruthy());
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("rol=ADMIN"),
                expect.any(Object)
            )
        );
    });
});
