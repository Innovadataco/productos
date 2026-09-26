import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NavHeader } from "./NavHeader";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => mockPathname,
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
    ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from "@/lib/contexts/AuthContext";

function mockAuth(
    user: { id: string; email: string; nombre: string; rol: string; googleSub?: string | null; passwordCreadaEn?: string | null } | null,
    isLoading = false
) {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        user,
        isLoading,
        isAuthenticated: !!user,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn(),
    });
}

describe("NavHeader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPathname = "/";
    });

    // SPEC-742 · abre el menú de CUENTA (avatar) por el nombre del usuario.
    const abrirCuenta = (nombre: string) => {
        const toggle = screen.getByText(nombre).closest("button");
        if (toggle) fireEvent.click(toggle);
    };
    // SPEC-742 · abre la NAV móvil (hamburguesa) por su aria-label.
    const abrirNav = () => fireEvent.click(screen.getByLabelText("Menú"));

    it("SPEC-106: logo va al home público «/» para un ADMIN en la ZONA PÚBLICA", () => {
        // En zona pública `destinoLogo` ya devuelve «/» (un interno puede navegar el sitio público).
        mockAuth({ id: "1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        render(<NavHeader />);
        expect(screen.getByText("Infantil").closest("a")?.getAttribute("href")).toBe("/");
    });

    it("SPEC-742: logueado en /dashboard/**, el logo va a su panel — NUNCA a «/», ni en su propio home", () => {
        mockPathname = "/dashboard/admin/reportes";
        mockAuth({ id: "1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        const { unmount } = render(<NavHeader />);
        expect(screen.getByText("Infantil").closest("a")?.getAttribute("href")).toBe("/dashboard/admin/bandeja");
        unmount();

        // El bug de Jelkin: parado en su propio home, el logo caía a «/» (landing pública).
        // SPEC-742: sigue yendo a su panel, jamás a «/».
        mockPathname = "/dashboard/admin/bandeja";
        render(<NavHeader />);
        expect(screen.getByText("Infantil").closest("a")?.getAttribute("href")).toBe("/dashboard/admin/bandeja");
    });

    it("SPEC-742: NO existe el botón «Dashboard» de home en el header (ningún rol, ninguna ruta)", () => {
        for (const [rol, path] of [["PARENT", "/dashboard/padre/hijos"], ["SCHOOL_ADMIN", "/dashboard-publico"], ["ADMIN", "/dashboard/admin/reportes"]] as const) {
            mockPathname = path;
            mockAuth({ id: "1", email: "u@test.com", nombre: "U", rol });
            const { unmount } = render(<NavHeader />);
            expect(screen.queryByText("Dashboard"), `no debe haber botón Dashboard (${rol})`).toBeNull();
            unmount();
        }
        // Anónimo tampoco.
        mockPathname = "/dashboard-publico";
        mockAuth(null);
        render(<NavHeader />);
        expect(screen.queryByText("Dashboard")).toBeNull();
    });

    it("SPEC-742: el AVATAR es solo CUENTA — cero navegación del rol", () => {
        mockPathname = "/dashboard/padre";
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        abrirCuenta("Padre");
        // Cuenta: Cambiar contraseña + Cerrar sesión.
        expect(screen.getByText("Cambiar contraseña").closest("a")?.getAttribute("href")).toBe("/cambiar-password");
        expect(screen.getByText("Cerrar sesión")).toBeTruthy();
        // NADA de navegación del rol acá (vive en la hamburguesa / barra lateral).
        expect(screen.queryByText("Mi panel")).toBeNull();
        expect(screen.queryByText("Círculo de Confianza")).toBeNull();
        expect(screen.queryByText("Mis reportes")).toBeNull();
    });

    it("SPEC-742: el AVATAR del admin es solo cuenta — sin «Panel de administración» ni «Configuración»", () => {
        mockPathname = "/dashboard/admin/reportes";
        mockAuth({ id: "1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        render(<NavHeader />);
        abrirCuenta("Admin");
        expect(screen.getByText("Cerrar sesión")).toBeTruthy();
        expect(screen.queryByText("Panel de administración")).toBeNull();
        expect(screen.queryByText("Configuración")).toBeNull();
    });

    it("SPEC-742: la NAV del padre vive en la hamburguesa (móvil), NO «Inicio»→«/» ni «Dashboard»→/dashboard-publico", () => {
        mockPathname = "/dashboard/padre";
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        abrirNav();
        // La nav del rol está acá (una sola vez).
        expect(screen.getByText("Círculo de Confianza").closest("a")?.getAttribute("href")).toBe("/dashboard/padre/circulo-confianza");
        expect(screen.getByText("Mis reportes").closest("a")?.getAttribute("href")).toBe("/mis-reportes");
        // NINGÚN enlace de home equivocado: ni «/» ni /dashboard-publico.
        const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
        expect(hrefs).not.toContain("/");
        expect(hrefs).not.toContain("/dashboard-publico");
    });

    it("SCHOOL_ADMIN NO ve las entradas del área de padres (I-36) en ningún menú", () => {
        mockAuth({ id: "2", email: "colegio@test.com", nombre: "Colegio", rol: "SCHOOL_ADMIN" });
        render(<NavHeader />);
        abrirCuenta("Colegio");
        expect(screen.queryByText("Círculo de Confianza")).toBeNull();
        expect(screen.queryByText("Mis reportes")).toBeNull();
    });

    // ── SPEC-340 (A-68 §5 · T034): el ámbar del escudo ──────────────────────
    describe("SPEC-340 · el escudo en ámbar", () => {
        function mockResumen(noLeidas: number) {
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response(JSON.stringify({ noLeidas }), { status: 200 }))
            );
        }

        it("padre con alertas sin ver → el Guardián en alerta (ámbar)", async () => {
            mockResumen(2);
            mockAuth({ id: "p1", email: "p@x.co", nombre: "Padre", rol: "PARENT" });
            const { container } = render(<NavHeader />);
            await waitFor(() => {
                expect(container.querySelector('[data-estado="alerta"]')).not.toBeNull();
            });
        });

        it("padre sin alertas → calma", async () => {
            mockResumen(0);
            mockAuth({ id: "p1", email: "p@x.co", nombre: "Padre", rol: "PARENT" });
            const { container } = render(<NavHeader />);
            await waitFor(() => {
                expect(container.querySelector('[data-estado="calma"]')).not.toBeNull();
            });
            expect(container.querySelector('[data-estado="alerta"]')).toBeNull();
        });

        it("un rol que no es padre NI consulta el resumen: escudo en calma", async () => {
            const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
            vi.stubGlobal("fetch", fetchMock);
            mockAuth({ id: "a1", email: "a@x.co", nombre: "Admin", rol: "ADMIN" });
            const { container } = render(<NavHeader />);
            await waitFor(() => {
                expect(container.querySelector('[data-estado="calma"]')).not.toBeNull();
            });
            expect(fetchMock).not.toHaveBeenCalledWith("/api/notificaciones/resumen", expect.anything());
        });
    });

    // SPEC-647 (D-136): Google salió del producto → toda cuenta tiene clave local. El menú ofrece
    // «Cambiar contraseña» a la cuenta autenticada y JAMÁS «Crear contraseña» (esa entrada era de
    // SPEC-598 para cuentas OAuth, y se removió con Google — «una cuenta, una puerta», orden de Jelkin).
    describe("SPEC-647 · el menú del padre ofrece «Cambiar contraseña», nunca «Crear contraseña»", () => {
        it("la cuenta autenticada ve «Cambiar contraseña» (→ /cambiar-password) y NUNCA «Crear contraseña»", () => {
            mockAuth({ id: "u1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
            render(<NavHeader />);
            const toggle = screen.getByText("Padre").closest("button");
            if (toggle) fireEvent.click(toggle);

            expect(screen.getByText("Cambiar contraseña").closest("a")?.getAttribute("href")).toBe("/cambiar-password");
            expect(screen.queryByText("Crear contraseña")).toBeNull();
        });
    });
});
