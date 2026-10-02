import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComiteSubNav } from "@/app/dashboard/admin/comite/components/ComiteSubNav";
import { NavLateral } from "@/components/modules/nav/NavLateral";
import { proxy } from "@/lib/proxy";
import { createToken } from "@/lib/auth";
import { puedeGestionarReporte } from "@/lib/operadores/permisos";
import type { RolUsuario } from "@prisma/client";

type Usuario = import("@prisma/client").Usuario;

vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard/admin/comite",
}));

// SPEC-691: NavLateral ahora consume useAuth (el menú del profesional se condiciona a
// su estado). Estos casos son de ADMIN/OPERADOR/COMITE/SCHOOL_ADMIN, que siguen por
// módulo; basta con satisfacer el hook con un usuario nulo.
vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => ({ user: null }),
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

describe("ComiteSubNav (módulo de BD ∧ predicado del proxy, spec 086 + D-41/SPEC-126)", () => {
    it("con solo comite_bandeja permitido solo ve 'Bandeja' y 'Apelaciones'", () => {
        render(<ComiteSubNav rol="COMITE_VALIDACION" modulosPermitidos={["comite_bandeja"]} />);
        expect(screen.getByText("Bandeja")).toBeTruthy();
        expect(screen.getByText("Apelaciones")).toBeTruthy();
        expect(screen.queryByText("Gestión")).toBeNull();
        expect(screen.queryByText("Auditoría")).toBeNull();
    });

    it("ADMIN con los 3 módulos permitidos ve las 4 pestañas", () => {
        render(<ComiteSubNav rol="ADMIN" modulosPermitidos={["comite_bandeja", "comite", "comite_auditoria"]} />);
        expect(screen.getByText("Bandeja")).toBeTruthy();
        expect(screen.getByText("Apelaciones")).toBeTruthy();
        expect(screen.getByText("Gestión")).toBeTruthy();
        expect(screen.getByText("Auditoría")).toBeTruthy();
    });

    it("D-41: COMITE_VALIDACION con los 3 módulos NO ve 'Gestión' ni 'Auditoría' (la puerta las redirige)", () => {
        // Decisión D-41 (SPEC-126, ZEUS), NO ablandamiento: el módulo de BD decide QUÉ
        // se ofrece, pero el predicado del proxy tiene la ÚLTIMA palabra sobre si se
        // pinta. /dashboard/admin/comite/{gestion,auditoria} son ADMIN_ONLY_ROUTES:
        // el proxy redirige al COMITE a su bandeja (ver los tests del proxy más abajo,
        // que NO cambian: la puerta sigue bloqueando). Pintar esas tabs era un clic
        // muerto (I-39, detectado por la aserción B de la línea base).
        render(<ComiteSubNav rol="COMITE_VALIDACION" modulosPermitidos={["comite_bandeja", "comite", "comite_auditoria"]} />);
        expect(screen.getByText("Bandeja")).toBeTruthy();
        expect(screen.getByText("Apelaciones")).toBeTruthy();
        expect(screen.queryByText("Gestión")).toBeNull();
        expect(screen.queryByText("Auditoría")).toBeNull();
    });

    it("sin módulos permitidos no ve pestañas", () => {
        render(<ComiteSubNav rol="ADMIN" modulosPermitidos={[]} />);
        expect(screen.queryByText("Bandeja")).toBeNull();
        expect(screen.queryByText("Gestión")).toBeNull();
        expect(screen.queryByText("Auditoría")).toBeNull();
    });
});

describe("NavLateral (filtrada por módulo, spec 086 · SPEC-857 menú de 2 niveles)", () => {
    // SPEC-857: el menú admin es de 2 niveles. Un MÓDULO (grupo) rinde su ENCABEZADO (botón con
    // label) SIEMPRE que se muestra; sus hojas solo están en el DOM si el grupo está EXPANDIDO
    // (admin: colapsado por defecto, abierto si la ruta activa cae dentro — pathname mock
    // /dashboard/admin/comite ⇒ el grupo «Comité de Convivencia» nace abierto). Por eso se asierta
    // por los LABELS de GRUPO (robustos al colapso), sin debilitar el menú honesto ni el no-fuga.
    const modulosAmplios = [
        "bandeja_reportes",
        "revision_spam",
        "comite_bandeja",
        "estadisticas",
        "centro_control_ia",
        "operadores",
        "colegios_gestion",
        "anti_abuso",
        "dataset_entrenamiento",
        "configuracion_sistema",
    ];

    it("con módulos de varias secciones ve sus grupos + los dos encabezados de sección", () => {
        render(<NavLateral rol="ADMIN" modulosPermitidos={modulosAmplios} />);
        // Encabezados de GRUPO (en el DOM aunque el grupo esté colapsado).
        expect(screen.getByText("Reportes")).toBeTruthy();
        expect(screen.getByText("Comité de Convivencia")).toBeTruthy(); // SPEC-857: antes «Comité»
        expect(screen.getByText("Motor IA")).toBeTruthy();
        expect(screen.getByText("Operadores")).toBeTruthy();
        expect(screen.getByText("Estadísticas")).toBeTruthy();
        expect(screen.getByText("Configuración")).toBeTruthy();
        // Encabezados de SECCIÓN no navegables (SPEC-857).
        expect(screen.getByText("Citas y profesionales")).toBeTruthy();
        expect(screen.getByText("Directorio")).toBeTruthy();
        // El grupo activo por la ruta mock (/dashboard/admin/comite) nace EXPANDIDO → su hijo en el DOM.
        expect(screen.getByText("Bandeja")).toBeTruthy(); // hijo de «Comité de Convivencia»
    });

    it("sin módulos permitidos no ve grupos ni encabezados", () => {
        render(<NavLateral rol="SCHOOL_ADMIN" modulosPermitidos={[]} />);
        expect(screen.queryByText("Reportes")).toBeNull();
        expect(screen.queryByText("Configuración")).toBeNull();
        expect(screen.queryByText("Citas y profesionales")).toBeNull();
    });

    it("con solo bandeja y spam ve SOLO el grupo «Reportes» (menú honesto · no-fuga)", () => {
        render(<NavLateral rol="OPERADOR" modulosPermitidos={["bandeja_reportes", "revision_spam"]} />);
        // Las dos hojas caen bajo el módulo «Reportes» → se ve ese grupo (colapsado por la ruta mock).
        expect(screen.getByText("Reportes")).toBeTruthy();
        // NO-FUGA: ningún otro grupo ni encabezado de sección (sus módulos no están concedidos).
        expect(screen.queryByText("Comité de Convivencia")).toBeNull();
        expect(screen.queryByText("Estadísticas")).toBeNull(); // SPEC-744: era «Dashboard»
        expect(screen.queryByText("Motor IA")).toBeNull();
        expect(screen.queryByText("Operadores")).toBeNull();
        expect(screen.queryByText("Configuración")).toBeNull();
        expect(screen.queryByText("Citas y profesionales")).toBeNull();
        expect(screen.queryByText("Directorio")).toBeNull();
    });

    it("con solo comite_bandeja ve SOLO el grupo «Comité de Convivencia» (abierto por su ruta activa)", () => {
        render(<NavLateral rol="COMITE_VALIDACION" modulosPermitidos={["comite_bandeja"]} />);
        expect(screen.getByText("Comité de Convivencia")).toBeTruthy();
        expect(screen.getByText("Bandeja")).toBeTruthy(); // hijo visible (grupo expandido por la ruta mock)
        // NO-FUGA.
        expect(screen.queryByText("Reportes")).toBeNull();
        expect(screen.queryByText("Configuración")).toBeNull();
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
