/**
 * SPEC-114 · Journey padre — el rol principal del producto:
 * registro → camino de INTERFAZ a /reportar (I-38) → reportar autenticado y anónimo →
 * Mis reportes → Círculo de Confianza con varios identificadores → seguimiento →
 * cambiar contraseña → RPT nunca en URL (D-11). Cierra en BD (§9).
 * SPEC-133 (fase 2): apelación del titular (multipart + evidencia PDF) →
 * alertas por email (suscribir/listar/cancelar) → recuperar contraseña
 * (solicitar → validar → restablecer → login con la nueva). Todo cierra en BD (§9).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

// SPEC-133: la radicación de apelaciones persiste la evidencia (PDF) cifrada en disco;
// el storage va a un tmpdir por corrida (patrón de apelaciones/route.test.ts).
const storageDirApelaciones = mkdtempSync(path.join(tmpdir(), "apelaciones-e2e-"));
process.env.APELACIONES_STORAGE_DIR = storageDirApelaciones;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

/** PDF mínimo en ASCII puro: el body multipart se serializa como texto (patrón del repo). */
function pdfString(size: number): string {
    const head = "%PDF-1.4\n";
    return head + "A".repeat(Math.max(0, size - head.length));
}

/** Request multipart/form-data real para POST /api/apelaciones (contrato del handler). */
function crearRequestApelacion(opts: { identificador: string; plataformaId: string; motivo: string }): Request {
    const boundary = `----apelacione2e${Math.random().toString(36).slice(2)}`;
    const pushField = (parts: string[], name: string, value: string) => {
        parts.push(`--${boundary}`, `Content-Disposition: form-data; name="${name}"`, "", value);
    };
    const parts: string[] = [];
    pushField(parts, "identificador", opts.identificador);
    pushField(parts, "plataformaId", opts.plataformaId);
    pushField(parts, "motivo", opts.motivo);
    parts.push(
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"documento\"; filename=\"evidencia.pdf\"",
        "Content-Type: application/pdf",
        "",
        pdfString(2048),
        `--${boundary}--`,
        ""
    );
    return new Request("http://localhost:5005/api/apelaciones", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: parts.join("\r\n"),
    });
}

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

describe(`SPEC-114 · padre (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        // SPEC-133: resetDatabase (util compartido) no limpia AlertaSuscripcion ni
        // TokenRecuperacion (hueco del util, reportado); sin esto, el delete de
        // usuarios del reset viola las FK de las filas que crean estos bloques (O-4:
        // se resuelve en el journey, sin tocar src/lib fuera del test).
        await prisma.alertaSuscripcion.deleteMany();
        await prisma.tokenRecuperacion.deleteMany();
        await sembrarBase();
        limpiarJar();
    });

    afterAll(() => {
        rmSync(storageDirApelaciones, { recursive: true, force: true });
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

    it("apelación del titular: radica con evidencia PDF, queda RECIBIDA en BD y aparece en Mis apelaciones (§9)", async () => {
        const datos = datosCiclo(CICLO);
        const sesion = await entrarComo("PARENT", `e2e-c${CICLO}-padre-apel@test.local`, "ClaveE2E-2026");
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const motivo = "Soy el titular de esta línea y los reportes registrados no corresponden.";

        jar.set("token", { name: "token", value: sesion.token });
        const { POST: apelacionesPOST } = await import("@/app/api/apelaciones/route");
        const res = await apelacionesPOST(
            crearRequestApelacion({ identificador: datos.identificadorComun, plataformaId: plataforma.id, motivo })
        );
        expect(res.status, "radicar la apelación con PDF válido debe funcionar").toBe(201);
        const { apelacion } = (await res.json()) as { apelacion: { id: string; numero: string; estado: string } };
        expect(apelacion.estado).toBe("RECIBIDA");

        // §9: la apelación existe en BD con su motivo, estado y evidencia cifrada
        const enBd = await prisma.apelacion.findUnique({ where: { id: apelacion.id }, include: { documentos: true } });
        expect(enBd, "§9: la apelación debe persistirse").not.toBeNull();
        expect(enBd!.usuarioId).toBe(sesion.usuarioId);
        expect(enBd!.estado, "§9: estado inicial RECIBIDA").toBe("RECIBIDA");
        expect(enBd!.motivo, "§9: el motivo se conserva íntegro").toBe(motivo);
        expect(enBd!.documentos, "§9: la evidencia queda registrada").toHaveLength(1);

        // Mis apelaciones: el padre ve la suya (sin contenido de reportes)
        const { GET: miasGET } = await import("@/app/api/apelaciones/mias/route");
        const mias = await miasGET(
            new Request("http://localhost:5005/api/apelaciones/mias?page=1&pageSize=10", {
                headers: { cookie: `token=${sesion.token}` },
            })
        );
        expect(mias.status).toBe(200);
        const miasBody = (await mias.json()) as { items?: { numero: string }[] };
        expect(
            (miasBody.items ?? []).some((a) => a.numero === apelacion.numero),
            "la apelación radicada debe aparecer en Mis apelaciones"
        ).toBe(true);
    });

    it("alertas por email: suscribir a un identificador visible, listar y cancelar (§9 en BD)", async () => {
        const datos = datosCiclo(CICLO);
        const sesion = await entrarComo("PARENT", `e2e-c${CICLO}-padre-alert@test.local`, "ClaveE2E-2026");
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // El handler exige identificador visible públicamente (AlertaService): se siembra directo
        await prisma.identificadorReportado.create({
            data: {
                identificador: datos.identificadorVarios,
                plataformaId: plataforma.id,
                totalReportes: 5,
                reportesAutenticados: 3,
                reportesAnonimos: 2,
                esVisiblePublicamente: true,
            },
        });

        jar.set("token", { name: "token", value: sesion.token });
        const { POST: suscribirPOST } = await import("@/app/api/alertas/suscribir/route");
        const resSub = await suscribirPOST(
            new Request("http://localhost:5005/api/alertas/suscribir", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${sesion.token}` },
                body: JSON.stringify({ identificador: datos.identificadorVarios, plataformaId: plataforma.id }),
            })
        );
        expect(resSub.status, "suscribirse a un identificador visible debe funcionar").toBe(201);
        const { suscripcion } = (await resSub.json()) as { suscripcion: { id: string } };

        // §9: la suscripción existe y está activa
        const enBd = await prisma.alertaSuscripcion.findUnique({ where: { id: suscripcion.id } });
        expect(enBd, "§9: la suscripción debe persistirse").not.toBeNull();
        expect(enBd!.usuarioId).toBe(sesion.usuarioId);
        expect(enBd!.activa, "§9: la suscripción nace activa").toBe(true);

        // Lista de suscripciones del padre
        const { GET: alertasGET } = await import("@/app/api/alertas/route");
        const lista = await alertasGET();
        expect(lista.status).toBe(200);
        const listaBody = (await lista.json()) as { suscripciones?: { id: string }[] };
        expect(
            (listaBody.suscripciones ?? []).some((s) => s.id === suscripcion.id),
            "la suscripción debe aparecer en el listado"
        ).toBe(true);

        // Cancelar por el camino real (DELETE /api/alertas/:id)
        const { DELETE: alertaDELETE } = await import("@/app/api/alertas/[id]/route");
        const resDel = await alertaDELETE(new Request(`http://localhost:5005/api/alertas/${suscripcion.id}`, { method: "DELETE" }), {
            params: Promise.resolve({ id: suscripcion.id }),
        });
        expect(resDel.status, "cancelar la propia suscripción debe funcionar").toBe(200);

        // §9: la suscripción queda inactiva (la cancelación desactiva, no borra)
        const trasCancelar = await prisma.alertaSuscripcion.findUnique({ where: { id: suscripcion.id } });
        expect(trasCancelar, "§9: la fila se conserva (baja lógica)").not.toBeNull();
        expect(trasCancelar!.activa, "§9: la suscripción queda inactiva tras cancelar").toBe(false);
    });

    it("recuperar contraseña: solicitar → validar → restablecer, y entra con la nueva (§9)", async () => {
        const email = `e2e-c${CICLO}-padre-rec@test.local`;
        const sesion = await entrarComo("PARENT", email, "ClaveE2E-2026");
        const antes = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!.passwordHash;

        // Solicitar: sin Resend en el entorno de test, la ruta expone devToken (patrón devCode del registro)
        const { POST: solicitarPOST } = await import("@/app/api/auth/recuperar/solicitar/route");
        const resSol = await solicitarPOST(
            new Request("http://localhost:5005/api/auth/recuperar/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })
        );
        expect(resSol.status, "solicitar la recuperación debe funcionar").toBe(200);
        const { devToken } = (await resSol.json()) as { devToken?: string };
        expect(devToken, "sin email configurado debe exponerse devToken").toBeTruthy();

        // §9 intermedio: el token quedó persistido (hash) y sin usar
        const tokenRow = await prisma.tokenRecuperacion.findFirst({ where: { email }, orderBy: { creadoEn: "desc" } });
        expect(tokenRow, "§9: el token de recuperación debe persistirse").not.toBeNull();
        expect(tokenRow!.usado).toBe(false);

        // Validar el token recibido
        const { GET: validarGET } = await import("@/app/api/auth/recuperar/validar/route");
        const resVal = await validarGET(
            new Request(`http://localhost:5005/api/auth/recuperar/validar?token=${encodeURIComponent(devToken!)}`)
        );
        expect(resVal.status, "el token recién emitido debe ser válido").toBe(200);

        // Restablecer con la contraseña nueva
        const { POST: restablecerPOST } = await import("@/app/api/auth/recuperar/restablecer/route");
        const resRest = await restablecerPOST(
            new Request("http://localhost:5005/api/auth/recuperar/restablecer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: devToken, password: "ClaveE2E-2027" }),
            })
        );
        expect(resRest.status, "restablecer con token válido debe funcionar").toBe(200);

        // §9: el hash cambió, es bcrypt y el token quedó consumido
        const despues = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!;
        expect(despues.passwordHash, "§9: el hash debe cambiar").not.toBe(antes);
        verificarHashBcrypt(despues.passwordHash, "ClaveE2E-2027");
        const tokenTrasUso = await prisma.tokenRecuperacion.findUnique({ where: { id: tokenRow!.id } });
        expect(tokenTrasUso!.usado, "§9: el token queda marcado como usado").toBe(true);

        // §9: el login REAL funciona con la nueva y ya no con la vieja
        const { POST: loginPOST } = await import("@/app/api/auth/login/route");
        const loginNuevo = await loginPOST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: "ClaveE2E-2027" }),
            })
        );
        expect(loginNuevo.status, "debe entrar con la contraseña restablecida").toBe(200);
        const loginViejo = await loginPOST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: "ClaveE2E-2026" }),
            })
        );
        expect(loginViejo.status, "la contraseña anterior debe quedar muerta").toBe(401);
    });

    it("el número RPT nunca aparece en la barra de direcciones (D-11)", () => {
        const { container } = render(<DashboardUsuarioClient />);
        const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? "");
        for (const href of hrefs) {
            expect(href, "ningún href debe contener el número RPT").not.toMatch(/RPT-[A-Z0-9]+/i);
        }
    });
});
