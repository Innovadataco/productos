/**
 * SPEC-114 · Journey sesión — los 5 roles, camino completo (no piezas):
 * entrar con credenciales REALES → aterrizar en el home del rol → menú solo con lo suyo →
 * logo nunca es clic muerto (nunca apunta al pathname actual) → salir con sesión muerta.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { limpiarJar } from "../mock-headers";
import { render, screen } from "@testing-library/react";
import { NavHeader } from "@/components/modules/NavHeader";
import { sembrarBase, datosCiclo } from "../seed-ciclo";
import { entrarComo, viaProxy, esperarPasoLibre, esperarBloqueo, salirYExigirSesionMuerta, HOME_POR_ROL, type Sesion } from "../helpers";
import type { RolUsuario } from "@prisma/client";
import React from "react";
import { vi } from "vitest";

const ROLES: RolUsuario[] = ["PARENT", "SCHOOL_ADMIN", "ADMIN", "OPERADOR", "COMITE_VALIDACION"];
const CICLO = Number(process.env.E2E_CICLO ?? "1");

const mockAuthState = { sesion: null as Sesion | null };
vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: mockAuthState.sesion
            ? { id: mockAuthState.sesion.usuarioId, email: mockAuthState.sesion.email, nombre: "E2E", rol: mockAuthState.sesion.rol }
            : null,
        isLoading: false,
        isAuthenticated: !!mockAuthState.sesion,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn(),
    }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => mockAuthState.sesion ? HOME_POR_ROL[mockAuthState.sesion.rol] : "/",
}));

vi.mock("@/components/ui/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">Theme</button> }));

const RUTA_PRIVADA_POR_ROL: Record<RolUsuario, string> = {
    PARENT: "/mis-reportes",
    SCHOOL_ADMIN: "/dashboard/colegio",
    ADMIN: "/dashboard/admin",
    OPERADOR: "/dashboard/admin",
    COMITE_VALIDACION: "/dashboard/admin/comite",
};

describe(`SPEC-114 · sesión de los 5 roles (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
        mockAuthState.sesion = null;
    });

    for (const rol of ROLES) {
        it(`${rol}: entrar → home del rol → menú solo suyo → logo no muerto → salir con sesión muerta`, async () => {
            const datos = datosCiclo(CICLO);
            const sesion = await entrarComo(rol, `e2e-c${CICLO}-${rol.toLowerCase()}@test.local`, "ClaveE2E-2026");

            // 2. Aterriza en el home que le corresponde (el proxy deja pasar al home del rol)
            const home = HOME_POR_ROL[rol];
            esperarPasoLibre(await viaProxy(sesion, home), `${rol} debe aterrizar en su home ${home}`);

            // 3. El menú ofrece solo lo suyo (I-36): el helper del proxy con el criterio real
            const { esDestinoPermitidoPorRol } = await import("@/lib/proxy");
            const destinosPadre = ["/dashboard", "/mis-reportes", "/dashboard/circulo-confianza"];
            if (rol === "SCHOOL_ADMIN") {
                for (const d of destinosPadre) {
                    expect(esDestinoPermitidoPorRol(rol, d), `SCHOOL_ADMIN no debe ofrecer ${d}`).toBe(false);
                }
            }
            if (rol === "PARENT") {
                for (const d of destinosPadre) {
                    expect(esDestinoPermitidoPorRol(rol, d), `PARENT debe ofrecer ${d}`).toBe(true);
                }
            }

            // 4. El logo NUNCA es clic muerto: en el home del rol, no apunta al pathname actual (I-38)
            mockAuthState.sesion = sesion;
            const { container } = render(<NavHeader />);
            const logo = container.querySelector("header a");
            const logoHref = logo?.getAttribute("href");
            expect(logoHref, "el logo debe existir").toBeTruthy();
            expect(logoHref, `el logo no debe ser un clic muerto (${logoHref} === ${home})`).not.toBe(home);

            // 4b. D-37 (SPEC-118): por propiedad, NINGÚN enlace visible del header apunta
            // a la página actual (botón Dashboard incluido) — para los 5 roles.
            const enlaces = [...container.querySelectorAll("header a[href]")]
                .map((a) => a.getAttribute("href"))
                .filter((href): href is string => href !== null);
            expect(enlaces.length, "el header siempre muestra al menos el logo").toBeGreaterThan(0);
            for (const href of enlaces) {
                expect(href, `D-37: el header no ofrece la página actual (${href} === ${home})`).not.toBe(home);
            }
            // ...ni un destino que el proxy vaya a bloquear para este rol
            for (const href of enlaces) {
                expect(
                    esDestinoPermitidoPorRol(rol, href),
                    `D-37: el header no ofrece destinos bloqueados (${rol} → ${href})`
                ).toBe(true);
            }

            // 5. Cierra sesión y la sesión muere de verdad (I-32/I-35b)
            await salirYExigirSesionMuerta(sesion, RUTA_PRIVADA_POR_ROL[rol]);
        });
    }

    it("aislamiento base del home: cada rol NO aterriza en el home de otro rol", async () => {
        const homes: [RolUsuario, RolUsuario][] = [
            ["PARENT", "ADMIN"],
            ["SCHOOL_ADMIN", "PARENT"],
            ["ADMIN", "SCHOOL_ADMIN"],
        ];
        for (const [rol, ajeno] of homes) {
            const sesion = await entrarComo(rol, `e2e-c${CICLO}-aisl-${rol.toLowerCase()}@test.local`, "ClaveE2E-2026");
            esperarBloqueo(await viaProxy(sesion, HOME_POR_ROL[ajeno]), `${rol} no debe aterrizar en el home de ${ajeno}`);
        }
    });
});
