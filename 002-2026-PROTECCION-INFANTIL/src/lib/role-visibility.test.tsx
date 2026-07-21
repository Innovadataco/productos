import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComiteSubNav } from "@/app/dashboard/admin/comite/components/ComiteSubNav";
import { AdminNav } from "@/components/modules/AdminNav";
import { proxy } from "@/lib/proxy";
import { createToken } from "@/lib/auth";
import { puedeGestionarReporte } from "@/lib/operadores/permisos";
import type { RolUsuario } from "@prisma/client";

type Usuario = import("@prisma/client").Usuario;

vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard/admin/comite",
}));

vi.mock("next/server", () => {
    class MockNextRequest {
        public nextUrl: URL;
        public url: string;
        private cookieStore: Map<string, string>;
        public cookies: {
            get: (name: string) => { value: string | undefined } | undefined;
        };

        constructor(input: Request | string, init?: RequestInit) {
            const request =
                typeof input === "string" ? new Request(input, init) : input;
            this.url = request.url;
            this.nextUrl = new URL(request.url);
            this.cookieStore = new Map<string, string>();
            const cookieHeader = request.headers.get("cookie");
            if (cookieHeader) {
                for (const part of cookieHeader.split(";")) {
                    const [name, ...rest] = part.trim().split("=");
                    if (name && rest.length > 0) {
                        this.cookieStore.set(name, rest.join("="));
                    }
                }
            }
            this.cookies = {
                get: (name: string) => {
                    const value = this.cookieStore.get(name);
                    return value !== undefined ? { value } : undefined;
                },
            };
        }
    }

    return {
        NextRequest: MockNextRequest,
        NextResponse: {
            redirect: (url: URL) =>
                new Response(null, {
                    status: 307,
                    headers: { location: url.toString() },
                }),
            next: () => new Response(null, { status: 200 }),
            json: (body: unknown, init: { status?: number }) =>
                new Response(JSON.stringify(body), {
                    status: init.status ?? 200,
                    headers: { "content-type": "application/json" },
                }),
        },
    };
});

function makeUsuario(props: { id: string; rol: RolUsuario; tenantId: string | null }): Usuario {
    return {
        id: props.id,
        email: "user@example.com",
        nombre: "Usuario",
        rol: props.rol,
        tenantId: props.tenantId,
        estado: "activo",
        creadoEn: new Date(),
        actualizadoEn: new Date(),
        passwordHash: null,
        resetToken: null,
        resetTokenExpira: null,
        emailVerificado: false,
        ultimoAcceso: null,
        emailNotificaciones: true,
    } as unknown as Usuario;
}

async function makeCookieForRol(rol: RolUsuario) {
    const token = await createToken({ sub: "00000000-0000-0000-0000-000000000001", rol });
    return `token=${token}`;
}

describe("ComiteSubNav", () => {
    it("COMITE_VALIDACION solo ve 'Bandeja' y no 'Gestión' ni 'Auditoría'", () => {
        render(<ComiteSubNav rol="COMITE_VALIDACION" />);
        expect(screen.getByText("Bandeja")).toBeTruthy();
        expect(screen.queryByText("Gestión")).toBeNull();
        expect(screen.queryByText("Auditoría")).toBeNull();
    });

    it("ADMIN ve las 3 pestañas", () => {
        render(<ComiteSubNav rol="ADMIN" />);
        expect(screen.getByText("Bandeja")).toBeTruthy();
        expect(screen.getByText("Gestión")).toBeTruthy();
        expect(screen.getByText("Auditoría")).toBeTruthy();
    });

    it("SCHOOL_ADMIN no ve pestañas de comité", () => {
        render(<ComiteSubNav rol="SCHOOL_ADMIN" />);
        expect(screen.queryByText("Bandeja")).toBeNull();
        expect(screen.queryByText("Gestión")).toBeNull();
        expect(screen.queryByText("Auditoría")).toBeNull();
    });
});

describe("AdminNav", () => {
    const allLabels = [
        "Bandeja de reportes",
        "Revisión de spam",
        "Comité",
        "Dashboard",
        "Centro de Control IA",
        "Operadores",
        "Anti-abuso",
        "Apelaciones",
        "Dataset",
        "Configuración",
    ];

    it("ADMIN ve todas las secciones", () => {
        render(<AdminNav rol="ADMIN" />);
        for (const label of allLabels) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it("SCHOOL_ADMIN no ve secciones de administración", () => {
        render(<AdminNav rol="SCHOOL_ADMIN" />);
        for (const label of allLabels) {
            expect(screen.queryByText(label)).toBeNull();
        }
    });

    it("OPERADOR ve solo 'Bandeja de reportes' y 'Revisión de spam'", () => {
        render(<AdminNav rol="OPERADOR" />);
        expect(screen.getByText("Bandeja de reportes")).toBeTruthy();
        expect(screen.getByText("Revisión de spam")).toBeTruthy();
        expect(screen.queryByText("Comité")).toBeNull();
        expect(screen.queryByText("Dashboard")).toBeNull();
        expect(screen.queryByText("Centro de Control IA")).toBeNull();
        expect(screen.queryByText("Operadores")).toBeNull();
        expect(screen.queryByText("Anti-abuso")).toBeNull();
        expect(screen.queryByText("Apelaciones")).toBeNull();
        expect(screen.queryByText("Dataset")).toBeNull();
        expect(screen.queryByText("Configuración")).toBeNull();
    });

    it("COMITE_VALIDACION solo ve 'Comité'", () => {
        render(<AdminNav rol="COMITE_VALIDACION" />);
        expect(screen.getByText("Comité")).toBeTruthy();
        for (const label of allLabels) {
            if (label !== "Comité") {
                expect(screen.queryByText(label)).toBeNull();
            }
        }
    });
});

describe("proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("PARENT en /dashboard/admin es redirigido a /", async () => {
        const cookie = await makeCookieForRol("PARENT");
        const { NextRequest } = await import("next/server");
        const request = new NextRequest("http://localhost/dashboard/admin", {
            headers: { cookie },
        });
        const response = await proxy(request);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/");
    });

    it("COMITE_VALIDACION en /dashboard/admin/comite/gestion es redirigido a /dashboard/admin/comite", async () => {
        const cookie = await makeCookieForRol("COMITE_VALIDACION");
        const { NextRequest } = await import("next/server");
        const request = new NextRequest("http://localhost/dashboard/admin/comite/gestion", {
            headers: { cookie },
        });
        const response = await proxy(request);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/dashboard/admin/comite");
    });

    it("COMITE_VALIDACION en /dashboard/admin/comite/auditoria es redirigido a /dashboard/admin/comite", async () => {
        const cookie = await makeCookieForRol("COMITE_VALIDACION");
        const { NextRequest } = await import("next/server");
        const request = new NextRequest("http://localhost/dashboard/admin/comite/auditoria", {
            headers: { cookie },
        });
        const response = await proxy(request);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/dashboard/admin/comite");
    });

    it("ADMIN puede acceder a /dashboard/admin/comite/gestion", async () => {
        const cookie = await makeCookieForRol("ADMIN");
        const { NextRequest } = await import("next/server");
        const request = new NextRequest("http://localhost/dashboard/admin/comite/gestion", {
            headers: { cookie },
        });
        const response = await proxy(request);
        expect(response.status).toBe(200);
    });

    it("COMITE_VALIDACION puede acceder a /dashboard/admin/comite", async () => {
        const cookie = await makeCookieForRol("COMITE_VALIDACION");
        const { NextRequest } = await import("next/server");
        const request = new NextRequest("http://localhost/dashboard/admin/comite", {
            headers: { cookie },
        });
        const response = await proxy(request);
        expect(response.status).toBe(200);
    });
});

describe("puedeGestionarReporte", () => {
    const reporteAsignado = { operadorId: "operador-1", tenantId: "tenant-1" };
    const reporteOtroOperador = { operadorId: "operador-2", tenantId: "tenant-1" };
    const reporteOtroTenant = { operadorId: "operador-3", tenantId: "tenant-2" };

    it("OPERADOR con reporte asignado a otro operador devuelve false", () => {
        const user = makeUsuario({ id: "operador-1", rol: "OPERADOR", tenantId: "tenant-1" });
        expect(puedeGestionarReporte(user, reporteOtroOperador)).toBe(false);
    });

    it("SCHOOL_ADMIN no puede gestionar reportes", () => {
        const user = makeUsuario({ id: "admin-1", rol: "SCHOOL_ADMIN", tenantId: "tenant-1" });
        expect(puedeGestionarReporte(user, reporteOtroTenant)).toBe(false);
        expect(puedeGestionarReporte(user, reporteAsignado)).toBe(false);
    });

    it("ADMIN puede gestionar cualquier reporte", () => {
        const user = makeUsuario({ id: "admin-1", rol: "ADMIN", tenantId: "tenant-1" });
        expect(puedeGestionarReporte(user, reporteOtroTenant)).toBe(true);
        expect(puedeGestionarReporte(user, reporteAsignado)).toBe(true);
    });

    it("OPERADOR puede gestionar reportes asignados a él", () => {
        const user = makeUsuario({ id: "operador-1", rol: "OPERADOR", tenantId: "tenant-1" });
        expect(puedeGestionarReporte(user, reporteAsignado)).toBe(true);
    });
});
