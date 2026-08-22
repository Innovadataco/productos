import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import UsuariosAdminClient from "./UsuariosAdminClient";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/dashboard/admin/usuarios",
}));

function itemParaRol(rol: string) {
    const base = { id: "usr-1", email: "test@example.com", nombre: "Test User", estado: "activo", ultimaSesion: null };
    switch (rol) {
        case "PARENT":
            return { rol: "PARENT", ...base, reportesEnviados: 0, reportesUltimos30Dias: 0, colegiosAsociados: [], creadoEn: "2026-08-01T10:00:00.000Z" };
        case "SCHOOL_ADMIN":
            return { rol: "SCHOOL_ADMIN", ...base, colegio: null, alumnos: 0, profesores: 0, cursos: 0, reportesColegio: 0 };
        case "OPERADOR":
            return { rol: "OPERADOR", ...base, cupoMaximo: 10, casosAbiertos: 0, enProceso: 0, cerrados30Dias: 0, tiempoMedioResolucionMs: null };
        case "COMITE_CONVIVENCIA":
            return { rol: "COMITE_CONVIVENCIA", ...base, colegio: null, integrantesActivos: 0, casosEscaladosAbiertos: 0, casosEscaladosResueltos: 0, tiempoMedioResolucionHoras: null };
        case "COMITE_VALIDACION":
            return { rol: "COMITE_VALIDACION", ...base, casosEscaladosPlataforma: 0, casosPendientes: 0, casosResueltos: 0, ultimasDecisiones: [] };
        case "ADMIN":
            return { rol: "ADMIN", ...base, modulosGestionados: [{ clave: "usuarios", nombre: "Usuarios" }] };
        default:
            return { rol: "PARENT", ...base, reportesEnviados: 0, reportesUltimos30Dias: 0, colegiosAsociados: [], creadoEn: "2026-08-01T10:00:00.000Z" };
    }
}

function mockFetchUsuarios() {
    return vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes("/api/admin/usuarios/dashboard")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    kpi: [
                        { key: "padres", label: "Padres", total: 1, activos: 1, inactivos: 0, bloqueados: 0, alerta: false },
                    ],
                    alertas: [],
                }),
            } as Response;
        }
        if (u.includes("/api/admin/usuarios?")) {
            const params = new URLSearchParams(u.split("?")[1] ?? "");
            const rol = params.get("rol") ?? "PARENT";
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    items: [itemParaRol(rol)],
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga listado de Padres por defecto", async () => {
        mockFetchUsuarios();
        render(<UsuariosAdminClient rol="PARENT" />);
        await waitFor(() => expect(screen.getByText("Test User")).toBeTruthy());
    });

    it("carga listado de Rectores (prop rol)", async () => {
        const fetchMock = mockFetchUsuarios();
        render(<UsuariosAdminClient rol="SCHOOL_ADMIN" />);
        await waitFor(() => expect(screen.getByText("Test User")).toBeTruthy());
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
        await waitFor(() => expect(screen.getByText("Test User")).toBeTruthy());
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("rol=OPERADOR"),
                expect.any(Object)
            )
        );
    });

    it("carga listado de Admins (prop rol)", async () => {
        const fetchMock = mockFetchUsuarios();
        render(<UsuariosAdminClient rol="ADMIN" />);
        await waitFor(() => expect(screen.getByText("Test User")).toBeTruthy());
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("rol=ADMIN"),
                expect.any(Object)
            )
        );
    });
});
