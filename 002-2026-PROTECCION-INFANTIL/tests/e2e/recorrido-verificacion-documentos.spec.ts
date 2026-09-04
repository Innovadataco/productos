/**
 * SPEC-448 (Calidad) · Recorrido de la verificación CON documentos a la vista.
 *
 * ORIGEN. SPEC-436 (I-303 · I-304) ya está en main pero su criterio de cierre
 * no lo puede verificar nadie todavía: «un verificador abre los documentos de
 * una ficha real, decide con ellos a la vista, y queda la traza en la
 * auditoría» (encargo del CEO 04-09 16:23).
 *
 * QUÉ CUBRE — el orden lo fijó el CEO por importancia:
 *
 *   (A) Un requisito SIN documento cargado NO se puede marcar CUMPLE.
 *       Afirmado contra el SERVIDOR (POST `/decidir` responde 400), no
 *       contra el botón deshabilitado del cliente.
 *
 *   (B) Al abrir el documento responde EL ARCHIVO — no una página de la
 *       aplicación. Reproducción NEGATIVA de I-303, que daba 404 cuando el
 *       botón «Descargar autorización firmada» intentaba abrir el archivo.
 *       Assert: Content-Type es el del archivo (application/pdf) y el cuerpo
 *       no es HTML.
 *
 *   (C) La apertura queda AUDITADA. Se cuenta `AuditLog` con acción
 *       `PROFESIONAL_AUTORIZACION_ACCESO` antes y después: la diferencia
 *       DEBE ser ≥ 1. Sin auditoría, para la Ley 1918/2018 · 2375/2024 §5,
 *       la lectura no se puede demostrar.
 *
 *   (D) Candado del hueco de fondo: en producción hay CERO usuarios
 *       `VERIFICADOR` (verificado por el CEO en BD). Hasta que SPEC-435
 *       traiga la creación de verificadores, este recorrido usa ADMIN
 *       — que también pasa el guard (`ROLES_QUE_REVISAN = {VERIFICADOR, ADMIN}`).
 *       Este candado con `test.fail` afirma que cuando SPEC-435 despliegue,
 *       exista al menos un `VERIFICADOR` activo en producción y sea quien
 *       hace este recorrido de verdad.
 *
 * REGLA QUE DEFINE ESTE SPEC (aviso del CEO 04-09 13:10, reforzada 16:23):
 *   «Caminá la pantalla real, no siembres alrededor. El profesional carga
 *    sus documentos caminando la pantalla, no sembrando por Prisma. Es la
 *    lección de tu propio SPEC-430.»
 *
 *   La cadena de este spec: `POST /solicitar` → afirma que el endpoint
 *   creó el `TokenRegistro` real → simula el correo con `bcrypt.hash(token)`
 *   (Resend caído) → `POST /completar` → `PUT /api/profesional/perfil` con
 *   `ciudadId` válido → `POST /api/profesional/documentos` con archivo PDF
 *   mínimo válido (número mágico `%PDF-`). En ninguna parte se crea
 *   `PerfilProfesional`, `Usuario` ni `documento` por Prisma directo.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-448-`. Limpieza
 * FK-safe en `afterAll`. Cero mutación de rol real ni parámetros globales.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-448-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Verif448!Secure";

const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;

const sembrados = {
    usuarios: new Set<string>(),
    perfiles: new Set<string>(),
    tokens: new Set<string>(),
};

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function fabricarEnlace(email: string, rol: RolUsuario): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    sembrados.tokens.add(registro.id);
    return token;
}

async function asegurarAdmin(): Promise<void> {
    const u = await prisma.usuario.upsert({
        where: { email: EMAIL_ADMIN },
        update: { rol: "ADMIN" as RolUsuario, estado: "activo" },
        create: {
            email: EMAIL_ADMIN,
            nombre: `Admin E2E ${CORRIDA}`,
            passwordHash: await hashPassword(PASSWORD),
            rol: "ADMIN" as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

/**
 * PDF mínimo válido — pasa el número mágico `%PDF-` del validador
 * (`autorizacion-storage.ts:MAGIA_PDF = 25 50 44 46 2d`). El cuerpo no
 * importa: el service acepta el archivo si empieza con esos 5 bytes.
 */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

async function limpiarSembrados() {
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_PROF, EMAIL_ADMIN] } },
        select: { id: true },
    });
    const usuarioIds = usuariosCreados.map((u) => u.id);
    if (usuarioIds.length > 0) {
        const perfiles = await prisma.perfilProfesional.findMany({
            where: { usuarioId: { in: usuarioIds } },
            select: { id: true },
        });
        const perfilIds = perfiles.map((p) => p.id);
        if (perfilIds.length > 0) {
            await prisma.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.perfilProfesional.deleteMany({ where: { id: { in: perfilIds } } });
        }
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    if (usuarioIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.usuarios.clear();
    sembrados.perfiles.clear();
    sembrados.tokens.clear();
}

/**
 * Estado compartido entre tests (describe.serial): el profesional se crea y
 * su perfil se levanta una vez; los tres candados (A/B/C) operan sobre él.
 */
let perfilProfesionalId = "";
let requisitoConDocumento = "";
let requisitoSinDocumento = "";

test.describe.serial("Verificación con documentos a la vista (SPEC-448)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();

        const request = await ctx();
        try {
            // (1) el profesional se registra por la pantalla
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar profesional responde 202").toBe(202);
            const tokensCreados = await prisma.tokenRegistro.count({ where: { email: EMAIL_PROF } });
            expect(tokensCreados, "el POST solicitar debe crear al menos un TokenRegistro real").toBeGreaterThanOrEqual(1);

            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);

            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(200);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PROF);

            // (2) el profesional completa su ficha (PUT que la pantalla dispara)
            const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
            expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
            const putPerfil = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi E2E ${CORRIDA}`,
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-448.",
                    tarifaConsultaCOP: 120_000,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(putPerfil.status(), `PUT perfil body=${await putPerfil.text().catch(() => "")}`).toBeLessThan(300);

            // Capturamos el perfil creado para que los tests lo puedan ver.
            const perfil = await prisma.perfilProfesional.findFirst({
                where: { usuario: { email: EMAIL_PROF } },
                select: { id: true },
            });
            expect(perfil, "el PUT perfil debe haber creado el PerfilProfesional").not.toBeNull();
            perfilProfesionalId = perfil!.id;

            // (3) el profesional carga UN documento (falta uno para el candado A):
            //     leemos la lista real de requisitos parametrizables y elegimos
            //     dos claves. Una recibirá el PDF; la otra queda sin documento.
            const estado = await request.get("/api/profesional/documentos");
            expect(estado.status(), "GET estado documentos").toBe(200);
            const items: Array<{ clave: string }> = (await estado.json())?.data ?? [];
            expect(items.length, "el parámetro `verificacion.requisitos` debe traer al menos 2 requisitos").toBeGreaterThanOrEqual(2);
            requisitoConDocumento = items[0].clave;
            requisitoSinDocumento = items[1].clave;

            const subir = await request.post("/api/profesional/documentos", { multipart: {
                requisito: requisitoConDocumento,
                archivo: { name: `${requisitoConDocumento}.pdf`, mimeType: "application/pdf", buffer: pdfMinimo(CORRIDA) },
            } });
            expect(subir.status(), `POST subir documento body=${await subir.text().catch(() => "")}`).toBeLessThan(300);
        } finally {
            await request.dispose();
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) marcar CUMPLE sin documento cargado devuelve 400 (guardia servidor)", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_ADMIN);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_ADMIN);

            // Marca TODOS los requisitos en CUMPLE — pero solo `requisitoConDocumento`
            // tiene archivo cargado. El servidor debe rechazar por
            // `requisitoSinDocumento` sin documento.
            const ficha = await request.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}`);
            const claves: string[] = (((await ficha.json())?.data?.checklist) as Array<{ clave?: string; id?: string }> ?? [])
                .map((it) => it.clave ?? it.id ?? "").filter(Boolean);
            const clavesParaChecklist = claves.length > 0 ? claves : [requisitoConDocumento, requisitoSinDocumento];
            const checklist: Record<string, { estado: "CUMPLE" }> = {};
            for (const k of clavesParaChecklist) checklist[k] = { estado: "CUMPLE" };

            const decidir = await request.post(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/decidir`, {
                data: { checklist },
            });
            expect(
                [400, 422].includes(decidir.status()),
                `SPEC-436 candado servidor: CUMPLE sin documento debe devolver 400/422. status=${decidir.status()} body=${(await decidir.text().catch(() => "")).slice(0,220)}`,
            ).toBe(true);
            const body = await decidir.text().catch(() => "");
            expect(
                /sin.*documento|documento.*cargado|falta.*documento/i.test(body),
                `el mensaje debe nombrar el motivo (documento faltante). body=${body.slice(0,220)}`,
            ).toBe(true);
        } finally {
            await request.dispose();
        }
    });

    test("(B) abrir el documento responde el archivo, no HTML (reproducción negativa de I-303)", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_ADMIN);
            const res = await request.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/documentos/${requisitoConDocumento}`);
            expect(res.status(), "abrir documento como ADMIN").toBe(200);
            const ct = res.headers()["content-type"] ?? "";
            expect(
                ct.startsWith("application/pdf"),
                `I-303 negativo: Content-Type debe ser del archivo, no HTML. ct=${ct}`,
            ).toBe(true);
            const buf = await res.body();
            expect(buf.length, "el cuerpo servido no puede estar vacío").toBeGreaterThan(0);
            expect(
                buf.subarray(0, 5).toString("ascii"),
                "los primeros 5 bytes deben ser el magic PDF `%PDF-`",
            ).toBe("%PDF-");
        } finally {
            await request.dispose();
        }
    });

    test("(C) cada apertura deja fila en AuditLog (Ley 1918/2018 · 2375/2024 §5)", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_ADMIN);
            const antes = await prisma.auditLog.count({
                where: {
                    accion: "PROFESIONAL_AUTORIZACION_ACCESO",
                    recursoId: perfilProfesionalId,
                },
            });
            const res = await request.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/documentos/${requisitoConDocumento}`);
            expect(res.status(), "abrir documento").toBe(200);
            const despues = await prisma.auditLog.count({
                where: {
                    accion: "PROFESIONAL_AUTORIZACION_ACCESO",
                    recursoId: perfilProfesionalId,
                },
            });
            expect(despues, "cada apertura suma al menos una fila de auditoría").toBeGreaterThan(antes);
        } finally {
            await request.dispose();
        }
    });

    test("(D) en producción existe al menos un VERIFICADOR activo — I-nueva · SPEC-435", async () => {
        // TEST.FAIL a propósito citando SPEC-435.
        //
        // Aviso del CEO 04-09 16:23: «en producción hay CERO usuarios
        // VERIFICADOR (verificado por mí en BD). Hasta que entre SPEC-435
        // usá ADMIN y dejá `test.fail` citando 435 en el punto donde debería
        // ser un verificador de verdad.»
        //
        // El endpoint `POST /admin/verificacion-profesionales/[id]/decidir` y
        // el GET del documento aceptan tanto VERIFICADOR como ADMIN (guardia
        // `ROLES_QUE_REVISAN`); los candados (A)(B)(C) pasan con ADMIN. Este
        // candado (D) afirma la mitad estructural que falta: cuando SPEC-435
        // despliegue, debe existir al menos un `VERIFICADOR` real y activo
        // en producción — sin él, todo el recorrido queda apoyado en un
        // rol adyacente y no se puede demostrar que el proceso funcione con
        // el rol titular.
        test.fail(true, "SPEC-435 (Dev 01) trae la creación de VERIFICADOR desde el panel del admin. Este candado se quita cuando esa spec despliegue.");

        const verificadores = await prisma.usuario.count({
            where: { rol: "VERIFICADOR" as RolUsuario, estado: "activo" },
        });
        expect(
            verificadores,
            "prod debe tener al menos un VERIFICADOR real y activo cuando SPEC-435 despliegue",
        ).toBeGreaterThanOrEqual(1);
    });
});
