/**
 * SPEC-744 · CANDADO — NavLateral, la barra lateral ÚNICA de los 4 roles. Absorbe la
 * cobertura de los tres SideNavs que reemplaza (AdminNav/ColegioSideNav/PadreSideNav):
 *
 *  - la lista sale de `navParaRol` (fuente única, ya gateada); el activo lo calcula la
 *    superficie con la ruta (aria-current).
 *  - GRUPOS colapsables que NACEN EXPANDIDOS (FORMA §4); el chevron colapsa.
 *  - SPEC-703: el profesional EN el muro de aceptación ve PORTERO, no el menú operativo
 *    (control positivo: fuera del muro sí ve los operativos).
 *  - SPEC-502: cero color crudo (sólo tokens del sistema).
 *  - SPEC-478: el subtítulo del colegio va en `text-muted` (AA); SPEC-479: el padre en cielo.
 *  - SPEC-212: la entrada Pagos (admin) va en ámbar, no en el acento del rol.
 *
 * La propagación por centinela (cada superficie refleja la fuente) vive en
 * `nav-superficie-unica.candado.test.tsx`; acá se prueba el RENDER real con la fuente real.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

let mockPathname = "/x";
const authRef: { value: unknown } = { value: { user: null } };
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => authRef.value }));

import { NavLateral, type RolLateral } from "./NavLateral";

afterEach(() => {
    cleanup();
    authRef.value = { user: null };
    mockPathname = "/x";
});

function montar(
    rol: RolLateral,
    opts: { modulos?: string[]; pathname?: string; profesional?: unknown } = {},
) {
    mockPathname = opts.pathname ?? "/x";
    authRef.value = { user: { rol }, isLoading: false };
    // SPEC-802: el estado del profesional llega por PROP (resuelto en el servidor), no por el cliente.
    return render(
        <NavLateral
            rol={rol}
            modulosPermitidos={opts.modulos ?? []}
            profesionalInicial={opts.profesional as { habilitado: boolean } | null | undefined}
        />,
    );
}

const ADMIN_MODULOS = ["inicio_admin", "bandeja_reportes", "revision_spam", "comite_bandeja", "estadisticas", "pagos_admin"];

describe("SPEC-744 · NavLateral: título + lista de la fuente única, por rol", () => {
    it("admin: título «Administración» y pinta los ítems que devuelve navParaRol (gateados)", () => {
        montar("ADMIN", { modulos: ["bandeja_reportes", "estadisticas"], pathname: "/dashboard/admin/bandeja" });
        expect(screen.getByText("Administración")).toBeTruthy();
        expect(screen.getByText("Bandeja de reportes")).toBeTruthy();
        expect(screen.getByText("Estadísticas")).toBeTruthy(); // label de /dashboard/admin/estadisticas (SPEC-744)
        // Gateado: sin el módulo de spam, no aparece.
        expect(screen.queryByText("Revisión de spam")).toBeNull();
    });

    it("operador y comité de validación conservan el título «Operador»/«Administración»", () => {
        montar("OPERADOR", { modulos: ["bandeja_reportes"], pathname: "/x" });
        expect(screen.getByText("Operador")).toBeTruthy();
        cleanup();
        montar("COMITE_VALIDACION", { modulos: ["comite_bandeja"], pathname: "/x" });
        expect(screen.getByText("Administración")).toBeTruthy();
    });

    it("colegio: título «Mi colegio» y subtítulo en text-muted (AA · SPEC-478), no text-subtle", () => {
        montar("SCHOOL_ADMIN", { modulos: ["colegios", "colegios_gestion"], pathname: "/dashboard/colegio" });
        expect(screen.getByText("Mi colegio")).toBeTruthy();
        const sub = screen.getByText("Panel institucional");
        expect(sub.className).toContain("text-muted");
        expect(sub.className).not.toContain("text-subtle");
    });

    it("padre: título «Mi protección»; los grupos NACEN EXPANDIDOS y el chevron los colapsa", () => {
        montar("PARENT", { pathname: "/dashboard/padre" });
        expect(screen.getByText("Mi protección")).toBeTruthy();
        // Grupo «Reportar» nace expandido → su hijo «Mis expedientes» se ve.
        expect(screen.getByText("Mis expedientes")).toBeTruthy();
        const boton = screen.getByRole("button", { name: "Reportar" });
        expect(boton.getAttribute("aria-expanded")).toBe("true");
        // Colapsar oculta los hijos del grupo (y no toca el otro grupo).
        fireEvent.click(boton);
        expect(boton.getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByText("Mis expedientes")).toBeNull();
    });
});

describe("SPEC-744 · NavLateral: estado activo por ruta (aria-current)", () => {
    it("en el landing /dashboard/admin nada queda activo; en una subruta se marca la entrada", () => {
        const { container } = montar("ADMIN", { modulos: ADMIN_MODULOS, pathname: "/dashboard/admin" });
        expect(container.querySelector('[aria-current="page"]')).toBeNull();
        cleanup();
        // SPEC-857: «Comité» pasó a MÓDULO; /comite/gestion es su hijo «Gestión» (gate `comite`). La
        // subruta marca al HIJO activo, anidado bajo el grupo «Comité de Convivencia» (que nace abierto
        // por abrir-en-activo). Antes era una hoja top-level «Comité»; hoy el activo es «Gestión».
        const r = montar("ADMIN", { modulos: [...ADMIN_MODULOS, "comite"], pathname: "/dashboard/admin/comite/gestion" });
        const activo = r.container.querySelector('[aria-current="page"]');
        expect(activo?.textContent).toContain("Gestión"); // el hijo activo del módulo Comité
        expect(screen.getByText("Comité de Convivencia")).toBeTruthy(); // el grupo que lo contiene
    });
});

describe("SPEC-703 · el profesional en el muro de aceptación ve PORTERO, no el menú operativo", () => {
    it("EN el muro: sólo «Mi ficha», sin Casos/Calendario", () => {
        montar("PROFESIONAL", { profesional: { habilitado: true }, pathname: "/perfil-profesional/autorizacion" });
        expect(screen.getByText("Mi ficha")).toBeTruthy();
        expect(screen.queryByText("Casos")).toBeNull();
        expect(screen.queryByText("Calendario")).toBeNull();
    });
    it("CONTROL POSITIVO · fuera del muro (habilitado) sí ve los operativos", () => {
        montar("PROFESIONAL", { profesional: { habilitado: true }, pathname: "/dashboard/profesional/mi-perfil" });
        expect(screen.getByText("Casos")).toBeTruthy();
        expect(screen.getByText("Calendario")).toBeTruthy();
    });
});

describe("SPEC-802 · el menú del profesional sale del estado resuelto EN EL SERVIDOR (prop), no de la carrera del cliente", () => {
    it("habilitado por PROP con el cliente SIN dato (user=null) → menú verificado, NUNCA «Mi ficha» (elimina la ventana de carga)", () => {
        // El cliente todavía no sabe (user=null: el SSR y la ventana previa al fetch de /api/me). Antes,
        // derivar de user?.profesional caía a portero. Ahora el prop resuelto en el servidor ya trae el estado.
        authRef.value = { user: null, isLoading: true };
        mockPathname = "/dashboard/profesional";
        render(<NavLateral rol="PROFESIONAL" modulosPermitidos={[]} profesionalInicial={{ habilitado: true }} />);
        for (const label of ["Inicio", "Casos", "Calendario", "Mi perfil"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        expect(screen.queryByText("Mi ficha")).toBeNull();
    });

    it("no habilitado por PROP → sólo «Mi ficha», nada operativo", () => {
        authRef.value = { user: null, isLoading: false };
        mockPathname = "/dashboard/profesional";
        render(<NavLateral rol="PROFESIONAL" modulosPermitidos={[]} profesionalInicial={{ habilitado: false }} />);
        expect(screen.getByText("Mi ficha")).toBeTruthy();
        expect(screen.queryByText("Mi perfil")).toBeNull();
        expect(screen.queryByText("Casos")).toBeNull();
    });

    it("MUTACIÓN: el PROP del servidor MANDA — si se vuelve a derivar de user?.profesional del cliente, esto da ROJO", () => {
        // Cliente: NO habilitado. Servidor (prop): habilitado. Si alguien revierte NavLateral a
        // `user?.profesional`, acá se vería el portero → el test se pone rojo. Con el fix, el prop manda.
        authRef.value = { user: { rol: "PROFESIONAL", profesional: { habilitado: false } }, isLoading: false };
        mockPathname = "/dashboard/profesional";
        render(<NavLateral rol="PROFESIONAL" modulosPermitidos={[]} profesionalInicial={{ habilitado: true }} />);
        expect(screen.getByText("Mi perfil")).toBeTruthy();
        expect(screen.queryByText("Mi ficha")).toBeNull();
    });
});

describe("SPEC-744 · NavLateral: tokens del sistema y ámbar de Pagos", () => {
    it("SPEC-502: cero color crudo (slate/sky/amber… -NNN) en ninguna familia", () => {
        const { container } = montar("PARENT", { pathname: "/dashboard/padre" });
        const crudo =
            /\b(?:bg|text|border|ring|shadow|from|to|via|divide|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
        expect(crudo.test(container.innerHTML), "NavLateral no puede usar color crudo; sólo tokens.").toBe(false);
    });

    it("SPEC-479: el activo del padre va en bg-cielo (acento del territorio), no sky", () => {
        const { container } = montar("PARENT", { pathname: "/dashboard/padre" });
        const activo = container.querySelector('[aria-current="page"]'); // Inicio en el landing padre
        expect(activo?.className).toContain("bg-cielo");
    });

    it("SPEC-212/857: el hijo activo de Pagos va en ámbar (token), no en el acento cielo del admin", () => {
        // SPEC-857: Pagos pasó a MÓDULO; su hijo activo (p.ej. «Pendientes») hereda el ámbar. El grupo
        // nace abierto por abrir-en-activo, así que el hijo activo se renderiza con aria-current.
        const { container } = montar("ADMIN", { modulos: ["pagos_admin"], pathname: "/dashboard/admin/pagos/pendientes" });
        const activo = container.querySelector('[aria-current="page"]');
        expect(activo?.textContent).toContain("Pendientes");
        expect(activo?.className).toContain("bg-ambar");
        expect(activo?.className).not.toContain("accent-gradient");
    });
});
