import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { esDestinoPermitidoPorRol, esRutaPermitidaSchoolAdmin, proxy } from "./proxy";

describe("COMITE_CONVIVENCIA (SPEC-173, FASE-C)", () => {
    it("puede usar su panel: inicio, casos y estadísticas", () => {
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/dashboard/colegio/comite")).toBe(true);
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/dashboard/colegio/comite/casos")).toBe(true);
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/dashboard/colegio/comite/estadisticas")).toBe(true);
    });

    it("NO puede entrar a integrantes (candado B: gestión solo del rector)", () => {
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/dashboard/colegio/comite/integrantes")).toBe(false);
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/api/colegio/comite/integrantes")).toBe(false);
    });

    it("NO puede usar el resto del módulo colegio", () => {
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/dashboard/colegio/cursos")).toBe(false);
        expect(esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", "/dashboard/colegio")).toBe(false);
    });

    it("el rector (SCHOOL_ADMIN) SÍ puede gestionar integrantes", () => {
        expect(esDestinoPermitidoPorRol("SCHOOL_ADMIN", "/dashboard/colegio/comite/integrantes")).toBe(true);
        expect(esDestinoPermitidoPorRol("SCHOOL_ADMIN", "/api/colegio/comite/integrantes")).toBe(true);
    });

    it("su home es /dashboard/colegio/comite y aterriza sin rebote", async () => {
        const token = await tokenParaRol("COMITE_CONVIVENCIA");

        // Fuera de su área lo redirigen a su home...
        const redirect = await proxy(requestConSesion("/dashboard/colegio/cursos", token));
        expect(redirect.status).toBe(307);
        const destino = new URL(redirect.headers.get("location")!).pathname;
        expect(destino).toBe("/dashboard/colegio/comite");

        // ...y ese destino le está permitido: aterriza sin segundo rebote.
        const aterrizaje = await proxy(requestConSesion(destino, token));
        expect(aterrizaje.status).toBe(200);
    });

    it("la API de integrantes le responde 403 (no redirect)", async () => {
        const token = await tokenParaRol("COMITE_CONVIVENCIA");
        const res = await proxy(requestConSesion("/api/colegio/comite/integrantes", token));
        expect(res.status).toBe(403);
    });
});

describe("esRutaPermitidaSchoolAdmin", () => {
    it("permite las rutas del módulo colegio", () => {
        expect(esRutaPermitidaSchoolAdmin("/dashboard/colegio")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/dashboard/colegio/cursos")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/colegio/cursos")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/me/colegio")).toBe(true);
    });

    it("permite /api/me para que el header reconozca la sesión (I-25)", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/me")).toBe(true);
    });

    it("permite /cambiar-password para el cambio obligatorio de contraseña (C-9)", () => {
        expect(esRutaPermitidaSchoolAdmin("/cambiar-password")).toBe(true);
    });

    it("permite el endpoint /api/auth/cambiar-password que la página llama (I-35)", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/auth/cambiar-password")).toBe(true);
    });

    it("permite el endpoint /api/auth/logout para salir de la pantalla (I-35b)", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/auth/logout")).toBe(true);
    });

    // SPEC-118 (D-37, decisión ZEUS): el colegio PUEDE usar el área pública de
    // solo lectura. El aislamiento total no aportaba seguridad (son estadísticas
    // públicas agregadas, visibles incluso sin sesión) y creaba clics muertos.
    it("permite las rutas públicas de solo lectura (D-37)", () => {
        expect(esRutaPermitidaSchoolAdmin("/")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/dashboard-publico")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/seguimiento")).toBe(true);
    });

    it("permite las APIs públicas de solo lectura que esas pantallas consumen (D-37)", () => {
        // home "/": formulario de consulta → /api/consulta (GET/POST de consulta)
        expect(esRutaPermitidaSchoolAdmin("/api/consulta")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/consulta/detalle")).toBe(true);
        // /dashboard-publico → /api/estadisticas-publicas
        expect(esRutaPermitidaSchoolAdmin("/api/estadisticas-publicas")).toBe(true);
        // /seguimiento → /api/reportes/seguimiento/[numero] (GET, solo lectura)
        expect(esRutaPermitidaSchoolAdmin("/api/reportes/seguimiento")).toBe(true);
        expect(esRutaPermitidaSchoolAdmin("/api/reportes/seguimiento/RPT-2026-000001")).toBe(true);
    });

    it("la raíz '/' NO abre el árbol entero por prefijo", () => {
        expect(esRutaPermitidaSchoolAdmin("/privacidad")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/login")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/x")).toBe(false);
    });

    it("no confunde /api/me con rutas ajenas como /api/metricas", () => {
        expect(esRutaPermitidaSchoolAdmin("/api/metricas")).toBe(false);
    });

    it("sigue bloqueando rutas de administración y de usuario final", () => {
        expect(esRutaPermitidaSchoolAdmin("/dashboard/admin")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/api/admin/colegios")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/dashboard")).toBe(false);
        expect(esRutaPermitidaSchoolAdmin("/mis-reportes")).toBe(false);
    });

    it("sigue bloqueando /reportar y la creación de reportes: la cuenta institucional no reporta", () => {
        expect(esRutaPermitidaSchoolAdmin("/reportar")).toBe(false);
        // Solo se abre el sub-árbol de seguimiento (GET); /api/reportes (POST de
        // creación) y el resto de sus subrutas quedan cerradas.
        expect(esRutaPermitidaSchoolAdmin("/api/reportes")).toBe(false);
    });
});

/**
 * SPEC-127 (I-40, D-42) — homeForRole(PARENT) debe ser "/dashboard/padre" (SPEC-317).
 * Antes del fix SPEC-127, PARENT caía al default "/dashboard/admin", que la propia puerta le
 * niega (esDestinoPermitidoPorRol, proxy.ts:122) → doble rebote a "/".
 * Tokens firmados en memoria con jose (el proxy solo verifica el JWT; no toca BD).
 */
async function tokenParaRol(rol: string): Promise<string> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    return new SignJWT({ sub: "test-proxy-home", rol })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);
}

function requestConSesion(pathname: string, token: string): NextRequest {
    return new NextRequest(`http://localhost:5005${pathname}`, {
        headers: { cookie: `token=${token}` },
    });
}

describe("proxy — home por rol (SPEC-127, I-40/D-42)", () => {
    it("PARENT redirigido a su home aterriza en /dashboard/padre SIN doble rebote", async () => {
        const token = await tokenParaRol("PARENT");

        // La puerta lo redirige desde una ruta admin-only a su home...
        const redirect = await proxy(requestConSesion("/dashboard/admin/comite/gestion", token));
        expect(redirect.status).toBe(307);
        const destino = new URL(redirect.headers.get("location")!).pathname;
        // SPEC-317: home de PARENT es /dashboard/padre (zona canónica).
        expect(destino).toBe("/dashboard/padre");

        // ...y ese destino le está permitido: aterriza sin segundo rebote.
        const aterrizaje = await proxy(requestConSesion(destino, token));
        expect(aterrizaje.status).toBe(200);
    });

    it("cada rol tiene su home y el default interno no se mueve", async () => {
        const casos: Array<[string, string, string]> = [
            // [rol, ruta que provoca redirectToHome, home esperado]
            ["COMITE_VALIDACION", "/dashboard", "/dashboard/admin/comite"],
            ["SCHOOL_ADMIN", "/dashboard", "/dashboard/colegio"],
            // SPEC-317: home de PARENT es /dashboard/padre. Ruta admin-only → esRutaAdminOnly
            // → redirectToHome (no isInternalRoute), por eso devuelve el home del rol.
            ["PARENT", "/dashboard/admin/comite/gestion", "/dashboard/padre"],
            ["ADMIN", "/dashboard", "/dashboard/admin"],
            ["OPERADOR", "/dashboard", "/dashboard/admin"],
        ];
        for (const [rol, ruta, home] of casos) {
            const res = await proxy(requestConSesion(ruta, await tokenParaRol(rol)));
            expect(res.status, `${rol} en ${ruta} debería redirigir`).toBe(307);
            const destino = new URL(res.headers.get("location")!).pathname;
            expect(destino, `home de ${rol}`).toBe(home);
        }
    });

    it("monitoreo worker: ADMIN accede, roles no internos redirigen a su home", async () => {
        const admin = await proxy(requestConSesion("/dashboard/admin/monitoreo/worker", await tokenParaRol("ADMIN")));
        expect(admin.status).toBe(200);

        const parent = await proxy(requestConSesion("/dashboard/admin/monitoreo/worker", await tokenParaRol("PARENT")));
        expect(parent.status).toBe(307);
        expect(new URL(parent.headers.get("location")!).pathname).toBe("/");

        const schoolAdmin = await proxy(requestConSesion("/dashboard/admin/monitoreo/worker", await tokenParaRol("SCHOOL_ADMIN")));
        expect(schoolAdmin.status).toBe(307);
        expect(new URL(schoolAdmin.headers.get("location")!).pathname).toBe("/dashboard/colegio");
    });
});

describe("PUBLIC_ROUTES — SPEC-249 hotfix /registro-colegio + /activar", () => {
    function requestAnonima(pathname: string): NextRequest {
        return new NextRequest(`http://localhost:5005${pathname}`);
    }

    it("anónimo alcanza /registro-colegio sin redirect", async () => {
        const res = await proxy(requestAnonima("/registro-colegio"));
        expect(res.status, "anónimo → /registro-colegio no redirige").not.toBe(307);
        expect(res.status, "anónimo → /registro-colegio no redirige").not.toBe(302);
    });

    it("anónimo alcanza /activar con token sin redirect", async () => {
        const res = await proxy(requestAnonima("/activar?token=TOKEN-DE-PRUEBA"));
        expect(res.status, "anónimo → /activar?token no redirige").not.toBe(307);
        expect(res.status, "anónimo → /activar?token no redirige").not.toBe(302);
    });

    it("anónimo sigue bloqueado en /dashboard", async () => {
        const res = await proxy(requestAnonima("/dashboard"));
        expect(res.status, "anónimo → /dashboard sigue cerrado").toBe(307);
        expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    });
});

describe("SESION_ROUTES — SPEC-250 hotfix /consentimiento (I-111)", () => {
    function requestAnonima(pathname: string): NextRequest {
        return new NextRequest(`http://localhost:5005${pathname}`);
    }

    it("SCHOOL_ADMIN alcanza /consentimiento sin redirect", async () => {
        const res = await proxy(requestConSesion("/consentimiento", await tokenParaRol("SCHOOL_ADMIN")));
        expect(res.status, "SCHOOL_ADMIN → /consentimiento no redirige").toBe(200);
    });

    it("PARENT alcanza /consentimiento sin redirect", async () => {
        const res = await proxy(requestConSesion("/consentimiento", await tokenParaRol("PARENT")));
        expect(res.status, "PARENT → /consentimiento no redirige").toBe(200);
    });

    it("COMITE_CONVIVENCIA alcanza /consentimiento sin redirect", async () => {
        const res = await proxy(requestConSesion("/consentimiento", await tokenParaRol("COMITE_CONVIVENCIA")));
        expect(res.status, "COMITE_CONVIVENCIA → /consentimiento no redirige").toBe(200);
    });

    it("ADMIN alcanza /consentimiento sin redirect", async () => {
        const res = await proxy(requestConSesion("/consentimiento", await tokenParaRol("ADMIN")));
        expect(res.status, "ADMIN → /consentimiento no redirige").toBe(200);
    });

    it("cualquier rol autenticado alcanza /api/consentimiento/aceptar sin redirect del proxy", async () => {
        const res = await proxy(requestConSesion("/api/consentimiento/aceptar", await tokenParaRol("SCHOOL_ADMIN")));
        expect(res.status, "SCHOOL_ADMIN → /api/consentimiento/aceptar no redirige").toBe(200);
    });

    it("anónimo NO alcanza /consentimiento (redirige a /login)", async () => {
        const res = await proxy(requestAnonima("/consentimiento"));
        expect(res.status, "anónimo → /consentimiento redirige").toBe(307);
        expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    });
});

describe("SPEC-317 — zona canónica /dashboard/padre", () => {
    it("PARENT puede acceder a su home /dashboard/padre (esDestinoPermitidoPorRol)", () => {
        expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/padre")).toBe(true);
    });

    it("PARENT puede acceder a las subrutas de su zona canónica", () => {
        expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/padre/circulo-confianza")).toBe(true);
        expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/padre/notificaciones")).toBe(true);
        expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/padre/reportar")).toBe(true);
    });

    // Propiedad I-40/D-42: la rama isInternalRoute usa "/" literal (aislamiento de roles,
    // decisión CEO 2026-08-30), lo que por construcción impide el bucle — homeForRole
    // devuelve /dashboard/admin para roles sin caso propio, y ese destino volvería a
    // esta misma rama. El "/" rompe el ciclo sin necesidad de guarda explícita.
    it("rol desconocido en ruta admin cae a '/' y no rebota (anti-bucle I-40/D-42)", async () => {
        const token = await tokenParaRol("ROL_INEXISTENTE");
        const redirect = await proxy(requestConSesion("/dashboard/admin/monitoreo/worker", token));
        expect(redirect.status).toBe(307);
        const destino = new URL(redirect.headers.get("location")!).pathname;
        expect(destino).toBe("/");

        // Segundo salto: "/" es ruta pública → pasa sin redirigir (no bucle).
        const aterrizaje = await proxy(requestConSesion("/", token));
        expect(aterrizaje.status).toBe(200);
    });
});

// SPEC-286 (002-PI-186 · I-136): la línea "/consulta" en PUBLIC_ROUTES apuntaba
// a una página que no existe (la consulta pública vive en el home "/"). Al
// quitarla, el proxy la trata como ruta privada y sin sesión redirige a /login.
// La API /api/consulta sigue siendo pública (línea aparte en PUBLIC_ROUTES) y no
// se ve afectada.
describe("PUBLIC_ROUTES — SPEC-286 (I-136) quitar /consulta", () => {
    function requestAnonima(pathname: string): NextRequest {
        return new NextRequest(`http://localhost:5005${pathname}`);
    }

    it("anónimo NO alcanza /consulta (redirige a /login, 307)", async () => {
        const res = await proxy(requestAnonima("/consulta"));
        expect(res.status, "anónimo → /consulta redirige a login").toBe(307);
        expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    });
});

// SPEC-426 (orden CEO 23:0x) · PROFESIONAL en lista blanca del proxy con
// candado bidireccional. Molde SPEC-319 (COMITE_CONVIVENCIA). Cierra el hueco
// que el barrido arch:check destapó en el #332 (SPEC-424): sin esta lista,
// PROFESIONAL podía pegarle a ~290 rutas fuera de su superficie (`/api/padre/**`,
// `/api/colegio/**`, `/api/config/parametros/**`, `/api/interno/**`,
// `/api/reportes/procesar`) — cada handler validaba rol pero no la puerta.
describe("SPEC-426 · PROFESIONAL con lista blanca", () => {
    describe("predicado esDestinoPermitidoPorRol — lo listado pasa", () => {
        it("permite su superficie propia (dashboard + APIs + verificación)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/profesional")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/profesional/agenda")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/perfil-profesional/verificacion")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/perfil-profesional/completar")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/panel")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/perfil")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/franjas")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/solicitudes")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/verificacion/reenviar")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/autorizacion")).toBe(true);
        });

        it("permite sesión + perfil compartidos (I-25, C-9, SPEC-203)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/me")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/cambiar-password")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/auth/cambiar-password")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/auth/logout")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/consentimiento")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/consentimiento")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/perfil")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/notificaciones")).toBe(true);
        });

        it("permite el árbol público de solo lectura (SPEC-118 · D-37)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard-publico")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/seguimiento")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/consulta")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/estadisticas-publicas")).toBe(true);
        });
    });

    describe("predicado esDestinoPermitidoPorRol — todo lo demás cae", () => {
        it("NO puede entrar al área del padre (candado bidireccional)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/padre")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/padre/circulo-confianza")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/padre/citas")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/padre/perfil")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/padre/hijos")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/mis-reportes")).toBe(false);
        });

        it("NO puede entrar al módulo colegio (candado bidireccional)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/colegio")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/colegio/cursos")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/colegio/rector")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/colegio/alumnos")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/colegio/comite")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/colegio/comite/casos")).toBe(false);
        });

        it("NO puede entrar al área interna ni ADMIN-only", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/admin")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/admin/verificacion")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/admin/colegios")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/admin/profesionales")).toBe(false);
        });

        it("NO puede tocar internos / parámetros / reportes (el hueco ancho de #332)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/interno/expediente/abc/transicionar")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/reportes/procesar")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/config/parametros")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/config/parametros/publicos")).toBe(false);
        });

        it("NO puede crear reportes desde su cuenta institucional (misma regla que otros roles institucionales)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/reportar")).toBe(false);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/reportes")).toBe(false);
        });
    });

    describe("proxy en runtime — API cerrada devuelve 403, página cerrada redirige al panel", () => {
        it("/api/padre/citas → 403 (no redirect)", async () => {
            const res = await proxy(requestConSesion("/api/padre/citas", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(403);
        });

        it("/api/colegio/rector → 403", async () => {
            const res = await proxy(requestConSesion("/api/colegio/rector", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(403);
        });

        it("/api/reportes/procesar → 403 (cierra el hueco de #332)", async () => {
            const res = await proxy(requestConSesion("/api/reportes/procesar", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(403);
        });

        it("/dashboard/padre → redirige al panel del PROFESIONAL", async () => {
            const res = await proxy(requestConSesion("/dashboard/padre", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(307);
            expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard/profesional");
        });

        it("su panel aterriza sin segundo rebote", async () => {
            const res = await proxy(requestConSesion("/dashboard/profesional", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(200);
        });

        it("su API propia pasa (200), aunque el handler todavía valide rol después", async () => {
            const res = await proxy(requestConSesion("/api/profesional/panel", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(200);
        });
    });

    describe("otros roles quedan como estaban en las rutas del profesional", () => {
        it("ADMIN sigue viendo /api/admin/** (no rompimos la lista negra)", () => {
            expect(esDestinoPermitidoPorRol("ADMIN", "/api/admin/profesionales")).toBe(true);
        });
    });
});

// SPEC-426 · I-312 (Jelkin vivo 04-09) · candado bidireccional del PARENT
// entrando a áreas de otros roles. Antes cualquier `/dashboard/profesional/**`
// (link compartido, menú ajeno, redirect viejo) dejaba pasar al padre hasta el
// layout, que lanzaba `verifyAuth("PROFESIONAL")` con 403 en pantalla — sin
// vuelta a lo suyo. Lección I-299: cada rol vuelve a su área, nunca a un
// error. Este bloque prueba ambos lados en predicado y en runtime.
describe("SPEC-426 · I-312 · PARENT redirect en áreas ajenas (nunca error)", () => {
    describe("predicado esDestinoPermitidoPorRol", () => {
        it("PARENT ya NO puede entrar a /dashboard/profesional/** — false explícito", () => {
            expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/profesional")).toBe(false);
            expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/profesional/agenda")).toBe(false);
        });

        it("PARENT no puede entrar a /api/profesional/**", () => {
            expect(esDestinoPermitidoPorRol("PARENT", "/api/profesional/panel")).toBe(false);
            expect(esDestinoPermitidoPorRol("PARENT", "/api/profesional/perfil")).toBe(false);
        });

        it("PARENT tampoco puede entrar al área colegio o al comité de convivencia", () => {
            expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/colegio")).toBe(false);
            expect(esDestinoPermitidoPorRol("PARENT", "/api/colegio/rector")).toBe(false);
            expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/colegio/comite")).toBe(false);
            expect(esDestinoPermitidoPorRol("PARENT", "/api/colegio/comite/casos")).toBe(false);
        });

        it("PARENT sigue viendo lo suyo (contraprueba de no exceso)", () => {
            expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/padre")).toBe(true);
            expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/padre/expedientes")).toBe(true);
            expect(esDestinoPermitidoPorRol("PARENT", "/mis-reportes")).toBe(true);
            expect(esDestinoPermitidoPorRol("PARENT", "/api/padre/perfil")).toBe(true);
            expect(esDestinoPermitidoPorRol("PARENT", "/reportar")).toBe(true);
            expect(esDestinoPermitidoPorRol("PARENT", "/api/notificaciones")).toBe(true);
        });

        it("PROFESIONAL sigue entrando a lo suyo (contraprueba del lado del profesional)", () => {
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/profesional")).toBe(true);
            expect(esDestinoPermitidoPorRol("PROFESIONAL", "/api/profesional/panel")).toBe(true);
        });
    });

    describe("runtime proxy", () => {
        it("PARENT en /dashboard/profesional → 307 a /dashboard/padre (no error)", async () => {
            const res = await proxy(requestConSesion("/dashboard/profesional", await tokenParaRol("PARENT")));
            expect(res.status).toBe(307);
            expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard/padre");
        });

        it("PARENT en /dashboard/profesional/agenda → 307 a /dashboard/padre", async () => {
            const res = await proxy(requestConSesion("/dashboard/profesional/agenda", await tokenParaRol("PARENT")));
            expect(res.status).toBe(307);
            expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard/padre");
        });

        it("PARENT en /api/profesional/panel → 403 JSON (no HTML de error)", async () => {
            const res = await proxy(requestConSesion("/api/profesional/panel", await tokenParaRol("PARENT")));
            expect(res.status).toBe(403);
            expect(res.headers.get("content-type")).toContain("application/json");
        });

        it("PARENT en /dashboard/colegio → 307 a /dashboard/padre (mismo criterio, otro rol)", async () => {
            const res = await proxy(requestConSesion("/dashboard/colegio", await tokenParaRol("PARENT")));
            expect(res.status).toBe(307);
            expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard/padre");
        });

        // Contraprueba dura: si mañana alguien retira el guard nuevo, el padre
        // vuelve a llegar hasta el layout y este test cae con status 200.
        it("PARENT en su propia área NO se rebota (contraprueba)", async () => {
            const res = await proxy(requestConSesion("/dashboard/padre", await tokenParaRol("PARENT")));
            expect(res.status).toBe(200);
        });

        // Simetría con SPEC-426 · el candado del PROFESIONAL entrando a lo del
        // padre sigue vivo (no lo hemos roto por accidente).
        it("PROFESIONAL en /dashboard/padre → 307 a /dashboard/profesional (contraprueba de simetría)", async () => {
            const res = await proxy(requestConSesion("/dashboard/padre", await tokenParaRol("PROFESIONAL")));
            expect(res.status).toBe(307);
            expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard/profesional");
        });
    });
});
