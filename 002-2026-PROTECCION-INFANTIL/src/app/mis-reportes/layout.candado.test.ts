/**
 * SPEC-440 P3 (Jelkin vivo 04-09) · `/mis-reportes` renderiza el MISMO shell
 * del área del padre que `/dashboard/padre/**` — pero SOLO para un usuario
 * PARENT autenticado (contrato Jelkin + refino CEO 17:4x).
 *
 * Contrato radicado literal (Jelkin, 04-09): «Todas las pantallas del padre
 * traen la barra "Mi protección"; esta no. Misma barra, mismo componente».
 * Decisión CEO 17:1x: opción (B) — se AGREGA el sidebar a `/mis-reportes`,
 * NO se le quita al resto.
 *
 * Refino CEO 17:4x: montar `PadreSideNav` incondicional le mostraría la
 * navegación de padre a un visitante sin cuenta (que llega por link de
 * seguimiento) o a un PROFESIONAL logueado. El shell del padre debe
 * pintarse SOLO cuando el usuario es PARENT autenticado.
 *
 * Candado por CONDUCTA en las dos direcciones:
 *   · con sesión PARENT válida → el árbol renderizado contiene `PadreSideNav`.
 *   · sin sesión (anónimo) → el árbol NO contiene `PadreSideNav`.
 *   · con sesión PROFESIONAL → el árbol NO contiene `PadreSideNav`.
 *   · con PARENT vencido → devuelve `ServicioVencidoScreen`, no el shell.
 *
 * Verificado por mutación: si el layout monta el shell incondicional (sin el
 * guard `if (!usuario) return <>{children}</>`), los 2 tests de "sin PARENT"
 * caen. Si el layout retira `PadreSideNav`, el test PARENT cae.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookiesMock = vi.fn();
const verifyTokenMock = vi.fn();
const verificarVigenciaMock = vi.fn();
const findSesionPadreMock = vi.fn();
const obtenerSuscripcionMock = vi.fn();

vi.mock("next/headers", () => ({
    cookies: () => cookiesMock(),
}));
vi.mock("@/lib/auth", () => ({
    verifyToken: (token: string) => verifyTokenMock(token),
}));
vi.mock("@/lib/colegio/vigencia", () => ({
    verificarVigenciaCliente: (id: string) => verificarVigenciaMock(id),
}));
vi.mock("@/lib/dal/repositories/usuario", () => ({
    UsuarioRepository: class {
        findSesionPadre(id: string) { return findSesionPadreMock(id); }
    },
}));
vi.mock("@/lib/dal/repositories/pagos-repository", () => ({
    PagosRepository: class {
        obtenerSuscripcionActivaPorUsuarioId(id: string) { return obtenerSuscripcionMock(id); }
    },
}));
vi.mock("@/components/modules/padre/PadreSideNav", () => ({
    PadreSideNav: () => React.createElement("nav", { "data-testid": "padre-sidenav" }),
}));
vi.mock("@/components/modules/padre/PadreNavMovil", () => ({
    PadreNavMovil: () => React.createElement("nav", { "data-testid": "padre-nav-movil" }),
}));
vi.mock("@/components/modules/ServicioVencidoScreen", () => ({
    ServicioVencidoScreen: ({ mensaje }: { mensaje?: string }) => React.createElement("div", { "data-testid": "vencido" }, mensaje),
}));
vi.mock("@/components/ui/Alerta", () => ({
    Alerta: ({ children }: { children: React.ReactNode }) => React.createElement("div", { role: "alert" }, children),
}));
vi.mock("@/lib/pagos/vigencia-middleware", () => ({
    resolverEstadoVigencia: () => "ACTIVA",
    debeMostrarBanner: () => false,
}));

import MisReportesLayout from "./layout";

function pintar(nodo: unknown): string {
    return renderToStaticMarkup(nodo as React.ReactElement);
}

function cookiesConToken(token: string | undefined) {
    return {
        get: (name: string) => {
            if (!token) return undefined;
            if (name === "__Host-token" || name === "token") return { value: token };
            return undefined;
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("SPEC-440 P3 · /mis-reportes reusa el shell del padre — solo si el usuario es PARENT", () => {
    it("con sesión PARENT válida: el árbol contiene el PadreSideNav", async () => {
        cookiesMock.mockResolvedValue(cookiesConToken("t-parent"));
        verifyTokenMock.mockResolvedValue({ sub: "u1", rol: "PARENT" });
        verificarVigenciaMock.mockResolvedValue({ vigente: true });
        findSesionPadreMock.mockResolvedValue({ id: "u1", rol: "PARENT", estado: "activo" });
        obtenerSuscripcionMock.mockResolvedValue(null);

        const arbol = await MisReportesLayout({ children: React.createElement("main", { "data-testid": "contenido" }) });
        expect(pintar(arbol).includes("padre-sidenav")).toBe(true);
        expect(pintar(arbol).includes("contenido")).toBe(true);
    });

    it("sin sesión (anónimo entrando por link de seguimiento): el árbol NO contiene PadreSideNav", async () => {
        cookiesMock.mockResolvedValue(cookiesConToken(undefined));

        const arbol = await MisReportesLayout({ children: React.createElement("main", { "data-testid": "contenido" }) });
        expect(pintar(arbol).includes("padre-sidenav")).toBe(false);
        expect(pintar(arbol).includes("padre-nav-movil")).toBe(false);
        expect(pintar(arbol).includes("contenido")).toBe(true);
    });

    it("con sesión PROFESIONAL: el árbol NO contiene PadreSideNav (no es padre)", async () => {
        cookiesMock.mockResolvedValue(cookiesConToken("t-prof"));
        verifyTokenMock.mockResolvedValue({ sub: "prof1", rol: "PROFESIONAL" });

        const arbol = await MisReportesLayout({ children: React.createElement("main", { "data-testid": "contenido" }) });
        expect(pintar(arbol).includes("padre-sidenav")).toBe(false);
        expect(pintar(arbol).includes("padre-nav-movil")).toBe(false);
        expect(pintar(arbol).includes("contenido")).toBe(true);
    });

    it("con PARENT vencido: devuelve ServicioVencidoScreen (SPEC-119)", async () => {
        cookiesMock.mockResolvedValue(cookiesConToken("t-parent"));
        verifyTokenMock.mockResolvedValue({ sub: "u1", rol: "PARENT" });
        verificarVigenciaMock.mockResolvedValue({ vigente: false, mensaje: "Tu servicio venció" });

        const arbol = await MisReportesLayout({ children: React.createElement("main", { "data-testid": "contenido" }) });
        expect(pintar(arbol).includes("vencido")).toBe(true);
        expect(pintar(arbol).includes("padre-sidenav")).toBe(false);
    });
});
