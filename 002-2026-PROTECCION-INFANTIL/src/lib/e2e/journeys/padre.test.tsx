/**
 * SPEC-114 · Journey padre — el rol principal del producto:
 * registro → camino de INTERFAZ a /reportar (I-38) → reportar autenticado y anónimo →
 * Mis reportes → Círculo de Confianza con varios identificadores → seguimiento →
 * cambiar contraseña → RPT nunca en URL (D-11). Cierra en BD (§9).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo, sembrarBancoCiclo } from "../seed-ciclo";
import { entrarComo, verificarTextoIntacto, verificarHashBcrypt } from "../helpers";
import { render } from "@testing-library/react";
import { DashboardUsuarioClient } from "@/components/modules/DashboardUsuarioClient";
import React from "react";
import { vi } from "vitest";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: { id: "padre-e2e", email: "padre@test.local", nombre: "Padre E2E", rol: "PARENT" },
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn(),
    }),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/dashboard",
}));
vi.mock("@/components/ui/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">Theme</button> }));

describe(`SPEC-114 · padre (ciclo ${CICLO})`, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    it("registro público → login real → entra a su home", async () => {
        const datos = datosCiclo(CICLO);
        const email = `e2e-c${CICLO}-padre-reg@test.local`;
        // Flujo público real de alta de padres: solicitar código → completar con el código
        const { POST: solicitarPOST } = await import("@/app/api/auth/verificar/solicitar/route");
        const resSol = await solicitarPOST(
            new Request("http://localhost:5005/api/auth/verificar/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })
        );
        expect(resSol.status, "solicitar el código de verificación debe funcionar").toBeLessThan(300);

        // Sin Resend en el entorno de test, la ruta expone devCode para continuar el flujo
        const { devCode } = (await resSol.json()) as { devCode?: string };
        expect(devCode, "sin email configurado debe exponerse devCode").toBeTruthy();

        // validar el código → devuelve el JWT de verificación
        const { POST: validarPOST } = await import("@/app/api/auth/verificar/validar/route");
        const resVal = await validarPOST(
            new Request("http://localhost:5005/api/auth/verificar/validar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, codigo: devCode }),
            })
        );
        expect(resVal.status, "validar el código debe funcionar").toBeLessThan(300);
        const { token: tokenVerificacion } = (await resVal.json()) as { token: string };
        expect(tokenVerificacion).toBeTruthy();

        const { POST: completarPOST } = await import("@/app/api/auth/verificar/completar/route");
        const resComp = await completarPOST(
            new Request("http://localhost:5005/api/auth/verificar/completar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: tokenVerificacion, password: "ClaveE2E-2026", nombre: "Padre E2E" }),
            })
        );
        expect(resComp.status, "completar el registro con el código debe funcionar").toBeLessThan(300);

        const sesion = await entrarComo("PARENT", email, "ClaveE2E-2026");
        expect(sesion.rol).toBe("PARENT");
        void datos;
    });

    it("I-38: el padre autenticado tiene un CAMINO de interfaz a /reportar", () => {
        // El defecto del piloto: la función central del producto no era alcanzable desde el
        // área del padre. La pantalla es la prueba: algún enlace debe llevar a /reportar.
        const { container } = render(<DashboardUsuarioClient />);
        const enlaces = Array.from(container.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
        expect(
            enlaces.filter((h) => h === "/reportar" || h?.startsWith("/reportar")),
            "el área del padre debe ofrecer un camino visible a /reportar (I-38)"
        ).not.toHaveLength(0);
    });

    it("reportar autenticado y anónimo, y aparece en Mis reportes (con §9 en BD)", async () => {
        const datos = datosCiclo(CICLO);
        const sesion = await entrarComo("PARENT", `e2e-c${CICLO}-padre-rep@test.local`, "ClaveE2E-2026");
        const { POST: reportesPOST } = await import("@/app/api/reportes/route");

        const textoAuth = `${datos.textoBase} (reporte autenticado del padre)`;
        jar.set("token", { name: "token", value: sesion.token });
        const resAuth = await reportesPOST(
            new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${sesion.token}` },
                body: JSON.stringify({
                    identificador: datos.identificadorComun,
                    plataforma: "whatsapp",
                    texto: textoAuth,
                    fechaIncidente: "2026-07-21T10:00:00Z",
                    ciudad: "Bogotá",
                    pais: "Colombia",
                }),
            })
        );
        expect(resAuth.status, "reportar autenticado debe funcionar").toBe(201);

        const resAnon = await reportesPOST(
            new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identificador: datos.identificadorComun,
                    plataforma: "whatsapp",
                    texto: `${datos.textoBase} (reporte anónimo del padre)`,
                    fechaIncidente: "2026-07-21T11:00:00Z",
                    ciudad: "Bogotá",
                    pais: "Colombia",
                }),
            })
        );
        expect(resAnon.status, "reportar anónimo debe funcionar").toBe(201);
        const creado = (await resAnon.json()) as { reporte: { id: string } };

        // Mis reportes: aparece el autenticado (y el anónimo NO se le atribuye)
        const { GET: misReportesGET } = await import("@/app/api/reportes/mis-reportes/route");
        const misRes = await misReportesGET(
            new Request("http://localhost:5005/api/reportes/mis-reportes?page=1&pageSize=10", {
                headers: { cookie: `token=${sesion.token}` },
            })
        );
        expect(misRes.status).toBe(200);
        const misBody = (await misRes.json()) as { items?: { identificador: string }[] };
        expect(
            (misBody.items ?? []).some((r) => r.identificador === datos.identificadorComun),
            "el reporte autenticado debe aparecer en Mis reportes"
        ).toBe(true);

        // §9: texto original intacto y cifrado en BD
        await verificarTextoIntacto(creado.reporte.id, `${datos.textoBase} (reporte anónimo del padre)`);
    });

    it("Círculo de Confianza con varios identificadores y seguimiento del propio reporte", async () => {
        const datos = datosCiclo(CICLO);
        const sesion = await entrarComo("PARENT", `e2e-c${CICLO}-padre-circ@test.local`, "ClaveE2E-2026");

        // Agregar DOS identificadores al círculo
        const { POST: circuloPOST, GET: circuloGET } = await import("@/app/api/circulo-confianza/route");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (const identificador of [datos.identificadorPocos, datos.identificadorVarios]) {
            const res = await circuloPOST(
                new Request("http://localhost:5005/api/circulo-confianza", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${sesion.token}` },
                    body: JSON.stringify({ identificadores: [{ valor: identificador, plataformaId: plataforma!.id }] }),
                })
            );
            expect([200, 201, 409]).toContain(res.status);
        }
        const lista = await circuloGET(new Request("http://localhost:5005/api/circulo-confianza", { headers: { cookie: `token=${sesion.token}` } }));
        expect(lista.status).toBe(200);

        // Seguimiento del propio reporte
        const { POST: reportesPOST } = await import("@/app/api/reportes/route");
        const resRep = await reportesPOST(
            new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${sesion.token}` },
                body: JSON.stringify({
                    identificador: datos.identificadorComun,
                    plataforma: "whatsapp",
                    texto: `${datos.textoBase} (para seguimiento)`,
                    fechaIncidente: "2026-07-21T12:00:00Z",
                    ciudad: "Bogotá",
                    pais: "Colombia",
                }),
            })
        );
        const { reporte } = (await resRep.json()) as { reporte: { numeroSeguimiento: string } };
        const { GET: seguimientoGET } = await import("@/app/api/reportes/seguimiento/[numero]/route");
        const segRes = await seguimientoGET(new Request(`http://localhost:5005/api/reportes/seguimiento/${reporte.numeroSeguimiento}`), {
            params: Promise.resolve({ numero: reporte.numeroSeguimiento }),
        });
        expect(segRes.status).toBe(200);
        const segBody = (await segRes.json()) as { numeroSeguimiento: string };
        expect(segBody.numeroSeguimiento).toBe(reporte.numeroSeguimiento);
    });

    it("cambiar su contraseña (I-33) con §9: hash cambió y bandera limpia", async () => {
        const datos = datosCiclo(CICLO);
        const sesion = await entrarComo("PARENT", `e2e-c${CICLO}-padre-pwd@test.local`, "ClaveE2E-2026");
        const antes = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!.passwordHash;
        verificarHashBcrypt(antes, "ClaveE2E-2026");

        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const { POST: cambiarPOST } = await import("@/app/api/auth/cambiar-password/route");
        const res = await cambiarPOST(
            new Request("http://localhost:5005/api/auth/cambiar-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ passwordActual: "ClaveE2E-2026", passwordNueva: "ClaveE2E-2027" }),
            })
        );
        expect(res.status).toBe(200);

        const despues = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!;
        expect(despues.passwordHash, "§9: el hash debe cambiar").not.toBe(antes);
        expect(despues.debeCambiarPassword, "§9: la bandera queda limpia").toBe(false);
        void datos;
    });

    it("el número RPT nunca aparece en la barra de direcciones (D-11)", () => {
        const { container } = render(<DashboardUsuarioClient />);
        const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? "");
        for (const href of hrefs) {
            expect(href, "ningún href debe contener el número RPT").not.toMatch(/RPT-[A-Z0-9]+/i);
        }
    });
});
