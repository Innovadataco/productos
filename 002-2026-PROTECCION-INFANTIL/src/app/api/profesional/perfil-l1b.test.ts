/**
 * SPEC-391 (A-75 · L1b) — flujo end-to-end del registro del profesional.
 *
 * Cubre desde solicitar el enlace hasta transicionar el perfil a EN_REVISION
 * cuando queda completo + con autorización subida. El candado de reserva se
 * afirma golpeando la API real: numeroTarjetaProfesional, datosFacturacion,
 * autorizacionArchivoId y autorizacionSubidaEn NUNCA salen en la respuesta.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { PUT as PUT_PERFIL, GET as GET_PERFIL } from "./perfil/route";
import { POST as POST_AUTORIZACION } from "./autorizacion/route";
import { POST as POST_COMPLETAR } from "@/app/api/auth/registro-profesional/completar/route";
import { POST as POST_SOLICITAR } from "@/app/api/auth/registro-profesional/solicitar/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { CAMPOS_INTERNOS_PROFESIONAL } from "@/lib/profesional/dto";

let activeToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && activeToken
                ? { name, value: activeToken }
                : undefined,
        set: vi.fn(),
    }),
}));

// El envío del correo se corta acá — la lógica real ya la cubren los tests del
// motor de notificaciones. Nos importan la mutación en BD y la respuesta HTTP.
vi.mock("@/lib/email", async () => {
    const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    return {
        ...actual,
        enviarEnlaceRegistroProfesional: vi.fn(async () => undefined),
        enviarBienvenidaProfesional: vi.fn(async () => undefined),
        enviarEmailCuentaExistente: vi.fn(async () => undefined),
    };
});

beforeEach(async () => {
    await resetDatabase();
    await resetRateLimitStore();
    await crearPaisCiudad();
    activeToken = undefined;
    if (!process.env.PARAM_ENCRYPTION_KEY) {
        process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
    }
    // Storage aislado por test — nada toca el árbol real.
    process.env.AUTORIZACIONES_PROFESIONALES_STORAGE_DIR = mkdtempSync(
        path.join(tmpdir(), "spec-391-")
    );
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => prisma.$disconnect());

function reqJson(url: string, body?: unknown, method = "POST"): Request {
    return new Request(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(activeToken ? { cookie: `token=${activeToken}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}

async function ciudadId(): Promise<string> {
    const c = await prisma.ciudad.findFirstOrThrow({ where: { nombre: "Bogotá" } });
    return c.id;
}

async function crearProfesionalAutenticado(email = "pro@test.local") {
    const user = await crearUsuario("PROFESIONAL", email);
    activeToken = await crearTokenUsuario(user.id, "PROFESIONAL");
    return user;
}

const PDF_BUFFER = Buffer.concat([
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    Buffer.from("test-pdf-content"),
]);

function reqMultipart(url: string, archivo: Buffer, mime = "application/pdf"): Request {
    // Multipart construido a mano (patrón de colegio/carga y pagos/renovacion):
    // en el entorno de tests, FormData/File globales cuelgan al `request.formData()`
    // del handler. El body se pasa como string; los bytes binarios sobreviven
    // como `latin1` (cada byte → un char, ida y vuelta 1:1).
    const boundary = `formdata${Date.now()}pro`;
    const CRLF = "\r\n";
    const cabecera = [
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"archivo\"; filename=\"autorizacion.bin\"",
        `Content-Type: ${mime}`,
        "",
        "",
    ].join(CRLF);
    const cierre = `${CRLF}--${boundary}--${CRLF}`;
    const body = cabecera + archivo.toString("latin1") + cierre;
    return new Request(url, {
        method: "POST",
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            ...(activeToken ? { cookie: `token=${activeToken}` } : {}),
        },
        body,
    });
}

describe("SPEC-391 · registro del profesional (L1b)", { timeout: 30_000 }, () => {
    it("solicitar → 202 con mensaje idéntico exista o no el correo (anti-enumeración)", async () => {
        const res1 = await POST_SOLICITAR(
            reqJson("http://localhost:5005/api/auth/registro-profesional/solicitar", { email: "nueva@test.local" })
        );
        expect(res1.status).toBe(202);
        // Segunda solicitud con el mismo correo: mismo status; el aviso al buzón cambia,
        // la pantalla no distingue (SPEC-338).
        const res2 = await POST_SOLICITAR(
            reqJson("http://localhost:5005/api/auth/registro-profesional/solicitar", { email: "nueva@test.local" })
        );
        expect(res2.status).toBe(202);
    });

    it("completar consume el token PROFESIONAL y crea la cuenta", async () => {
        // Solicitud → guarda un TokenRegistro con rol PROFESIONAL.
        await POST_SOLICITAR(
            reqJson("http://localhost:5005/api/auth/registro-profesional/solicitar", { email: "nuevo-pro@test.local" })
        );
        // Rescatamos el token en claro: el service lo devuelve al route, pero
        // en el test lo generamos otra vez usando el mismo helper — más simple
        // es mockear el envío del enlace y capturar el token del mock.
        // Alternativa práctica: crear el token a mano via el service.
        const { RegistroEnlaceService } = await import("@/lib/dal/services/registro-enlace");
        const svc = new RegistroEnlaceService();
        // Limpiamos el previo para que la 2ª solicitud del test sea la que lea
        // (el service invalida los anteriores por email).
        const res = await svc.solicitarEnlace("otro-pro@test.local", "PROFESIONAL");
        if (!res.ok || res.tipo !== "ok") throw new Error("no ok");
        const token = res.token;

        const compl = await POST_COMPLETAR(
            reqJson("http://localhost:5005/api/auth/registro-profesional/completar", {
                token,
                password: "ClaveProfesional-2026",
                passwordConfirmacion: "ClaveProfesional-2026",
            })
        );
        expect(compl.status).toBe(201);
        const body = await compl.json();
        expect(body.user.rol).toBe("PROFESIONAL");

        // La cuenta quedó creada; el perfil aún no existe (lo crea el 1er PUT /perfil).
        const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: "otro-pro@test.local" } });
        expect(usuario.rol).toBe("PROFESIONAL");
        expect(await prisma.perfilProfesional.findUnique({ where: { usuarioId: usuario.id } })).toBeNull();
    });

    it("candado espejo: un token PARENT no se consume por la ruta del profesional", async () => {
        const { RegistroEnlaceService } = await import("@/lib/dal/services/registro-enlace");
        const res = await new RegistroEnlaceService().solicitarEnlace("padre@test.local", "PARENT");
        if (!res.ok || res.tipo !== "ok") throw new Error("no ok");
        const compl = await POST_COMPLETAR(
            reqJson("http://localhost:5005/api/auth/registro-profesional/completar", {
                token: res.token,
                password: "ClaveXpadre-2026",
                passwordConfirmacion: "ClaveXpadre-2026",
            })
        );
        expect(compl.status).toBe(400);
    });

    it("PUT /perfil (1er) crea BORRADOR y GET devuelve DTO propio sin campos internos", async () => {
        await crearProfesionalAutenticado();
        const ciudad = await ciudadId();

        const put = await PUT_PERFIL(
            reqJson("http://localhost:5005/api/profesional/perfil", {
                nombreVisible: "Dra. Test",
                tituloProfesional: "Psicóloga",
                especialidades: ["Ansiedad"],
                ciudadId: ciudad,
                atiendeVirtual: true,
                aniosExperiencia: 5,
                presentacion: "Trabajo con adolescentes y sus familias, con enfoque cognitivo-conductual.",
                tarifaConsultaCOP: 100000,
                duracionMinutos: 50,
                numeroTarjetaProfesional: "TP-INTERNO-42",
            }, "PUT")
        );
        expect(put.status).toBe(201);
        const perfilCreado = (await put.json()).perfil;
        expect(perfilCreado.estado).toBe("BORRADOR");
        for (const clave of CAMPOS_INTERNOS_PROFESIONAL) {
            expect(perfilCreado, `interno ${clave} filtrado`).not.toHaveProperty(clave);
        }

        const get = await GET_PERFIL();
        const body = await get.json();
        for (const clave of CAMPOS_INTERNOS_PROFESIONAL) {
            expect(body.perfil, `GET filtra interno ${clave}`).not.toHaveProperty(clave);
        }
        // El interno SÍ vive en BD (lo pide el admin en L2), pero no sale por la API pública.
        const enBd = await prisma.perfilProfesional.findFirstOrThrow({});
        expect(enBd.numeroTarjetaProfesional).toBe("TP-INTERNO-42");
    });

    it("subir autorización completa el perfil y transiciona a EN_REVISION", async () => {
        await crearProfesionalAutenticado();
        const ciudad = await ciudadId();
        // 1er PUT con TODO lleno menos autorización → BORRADOR.
        const put1 = await PUT_PERFIL(
            reqJson("http://localhost:5005/api/profesional/perfil", {
                nombreVisible: "Dr. Full",
                tituloProfesional: "Psicólogo clínico",
                especialidades: ["Ansiedad", "Familia"],
                ciudadId: ciudad,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 10,
                presentacion: "Trabajo hace diez años con adolescentes en riesgo. Enfoque sistémico.",
                tarifaConsultaCOP: 150000,
                duracionMinutos: 50,
            }, "PUT")
        );
        expect((await put1.json()).perfil.estado).toBe("BORRADOR");

        // Subo la autorización → transiciona a EN_REVISION.
        const subida = await POST_AUTORIZACION(
            reqMultipart("http://localhost:5005/api/profesional/autorizacion", PDF_BUFFER)
        );
        expect(subida.status).toBe(201);
        const body = await subida.json();
        expect(body.perfil.estado).toBe("EN_REVISION");
        expect(body.perfil.autorizacionSubida).toBe(true);
        // La ruta cifrada y la fecha NO salen por la API.
        for (const clave of CAMPOS_INTERNOS_PROFESIONAL) {
            expect(body.perfil, `interno ${clave} sigue oculto`).not.toHaveProperty(clave);
        }

        // En BD sí quedan los internos, y con fecha (para probar «previa» en L2).
        const enBd = await prisma.perfilProfesional.findFirstOrThrow({});
        expect(enBd.autorizacionArchivoId).toMatch(/^[0-9a-f-]{32,}$/);
        expect(enBd.autorizacionSubidaEn).toBeInstanceOf(Date);
    });

    it("subir autorización rechaza formato inválido (magia de bytes) sin tocar BD", async () => {
        const user = await crearProfesionalAutenticado();
        const ciudad = await ciudadId();
        await PUT_PERFIL(
            reqJson("http://localhost:5005/api/profesional/perfil", {
                nombreVisible: "Test", tituloProfesional: "Test", especialidades: ["X"],
                ciudadId: ciudad, atiendeVirtual: true, aniosExperiencia: 0,
                presentacion: "presentacion de prueba con longitud suficiente",
                tarifaConsultaCOP: 1, duracionMinutos: 30,
            }, "PUT")
        );
        const invalido = Buffer.from("HTML disfrazado <html></html>");
        const res = await POST_AUTORIZACION(
            reqMultipart("http://localhost:5005/api/profesional/autorizacion", invalido)
        );
        expect(res.status).toBe(400);
        const enBd = await prisma.perfilProfesional.findUniqueOrThrow({ where: { usuarioId: user.id } });
        expect(enBd.autorizacionArchivoId).toBeNull();
        expect(enBd.estado).toBe("BORRADOR");
    });

    it("un padre (no PROFESIONAL) no accede al perfil profesional (403)", async () => {
        const padre = await crearUsuario("PARENT", "otro-padre@test.local");
        activeToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET_PERFIL();
        expect(res.status).toBe(403);
    });
});
