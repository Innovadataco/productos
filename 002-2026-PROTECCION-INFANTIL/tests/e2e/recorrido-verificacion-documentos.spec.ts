/**
 * SPEC-448 (Calidad) · Recorrido de la verificación CON documentos a la vista.
 * SPEC-822 (Calidad) · El revisor de (A)(B)(C) es el VERIFICADOR TITULAR, no ADMIN prestado.
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
 *   (D) CONTROL DE ROL (SPEC-822 — «el criterio de 822 aplicado a 822»).
 *       (A)(B)(C) las camina un VERIFICADOR, pero ADMIN también pasa el guard
 *       (`ROLES_QUE_REVISAN = {VERIFICADOR, ADMIN}`): verdearían con CUALQUIERA
 *       de los dos → por sí solas prueban el GUARD, no el ROL. El discriminador:
 *       el VERIFICADOR está CONFINADO a su módulo (`admin_verificacion_profesionales`)
 *       y recibe 403 en un módulo que solo el ADMIN tiene (`/api/admin/colegios`,
 *       `colegios_gestion` — ya probado por `recorrido-alta-verificador`); el ADMIN
 *       NO está confinado (no-403). (A)(B)(C) y (D) comparten la MISMA cuenta de
 *       revisor: si alguien la cambiara por ADMIN, (D) vería 200 donde exige 403 y
 *       el recorrido CAERÍA. Eso es lo que lo vuelve una prueba del rol.
 *
 * CÓMO ENTRA EL VERIFICADOR (SPEC-822 · veredicto del CEO). NO por una cuenta
 * persistente con clave estable: #816 sembró una, pero NADA del arnés e2e la
 * siembra (el seeder es manual, `globalSetup` solo guarda la BD `_test`, y
 * `.env.test` no trae `E2E_VERIFICADOR_*`) — cablear una cuenta COMPARTIDA al
 * arnés SERÍA I-439 por construcción. #816 quedó reclasificada como fixture de
 * ENTORNO (verificación manual contra el entorno de larga vida + el invariante
 * «≥1 verificador activo» del post-deploy, que hoy da 0). Acá el recorrido es
 * AUTOCONTENIDO: un admin EFÍMERO crea el verificador por el ENDPOINT real
 * (`POST /api/admin/verificadores` — crear un interno ES una acción de admin,
 * patrón que el CEO fijó para operador/comité), el server DEVUELVE la temporal
 * (Calidad nunca escribe ni lee una credencial) y el verificador la cambia por
 * `/api/auth/cambiar-password`. Cero estado compartido entre corridas — lo
 * OPUESTO a I-439.
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
 *   `PerfilProfesional`, `Usuario`, `documento` ni el VERIFICADOR por Prisma directo.
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
// Clave LOCAL y efímera del admin aprovisionador (patrón operadores: el ADMIN de
// prueba se siembra por Prisma y se borra en la corrida). NO es una credencial
// persistente. La del VERIFICADOR NO se escribe acá: la DEVUELVE el endpoint del alta.
const PASSWORD = "Verif448!Secure";

const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;
const EMAIL_VERIF = `${CORRIDA}-verif@proteccion.local`;

// Módulo que SOLO el admin tiene (`colegios_gestion`); el VERIFICADOR recibe 403.
// Es el discriminador de rol del candado (D).
const MODULO_SOLO_ADMIN = "/api/admin/colegios";

const sembrados = {
    usuarios: new Set<string>(),
    perfiles: new Set<string>(),
    tokens: new Set<string>(),
};

// Revisor del recorrido (SPEC-822): el VERIFICADOR titular. Se llena en beforeAll
// con la cuenta que crea el PROPIO recorrido y la clave que el server devuelve
// (luego cambiada por el verificador). (A)(B)(C) y (D) entran con ESTAS variables.
let verificadorEmail = "";
let verificadorPassword = "";

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
        update: { rol: "ADMIN" as RolUsuario, estado: "activo", debeCambiarPassword: false },
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

async function login(request: APIRequestContext, email: string, password: string) {
    const res = await request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

/**
 * SPEC-822: aprovisiona el VERIFICADOR TITULAR por el camino REAL. El alta la hace
 * un ADMIN efímero por el ENDPOINT (`POST /api/admin/verificadores`, patrón de
 * `recorrido-alta-verificador`): crear un interno ES una acción de admin. El server
 * DEVUELVE la temporal (Calidad no la escribe) y el verificador la cambia por una
 * nueva (viene con `debeCambiarPassword=true`). Deja email + clave ya cambiada y
 * el consentimiento aceptado por el endpoint real (nunca forjado). Idempotencia del
 * admin: `asegurarAdmin` ya lo dejó listo antes de llamar a esta función.
 */
async function aprovisionarVerificador(): Promise<{ email: string; password: string }> {
    let passwordTemporal = "";
    const reqAdmin = await ctx();
    try {
        await login(reqAdmin, EMAIL_ADMIN, PASSWORD);
        await aceptarConsentimiento(reqAdmin);
        await login(reqAdmin, EMAIL_ADMIN, PASSWORD);
        const alta = await reqAdmin.post("/api/admin/verificadores", {
            data: { email: EMAIL_VERIF, nombre: `Verif E2E ${CORRIDA}` },
        });
        const altaBody = await alta.text().catch(() => "");
        expect(
            [200, 201].includes(alta.status()),
            `alta de VERIFICADOR debe devolver 200/201. status=${alta.status()} body=${altaBody.slice(0, 220)}`,
        ).toBe(true);
        const json = JSON.parse(altaBody) as { verificador?: { id?: string }; passwordTemporal?: string };
        expect(
            typeof json.passwordTemporal === "string" && json.passwordTemporal.length > 0,
            `el server DEVUELVE la temporal (Calidad no la escribe). body=${altaBody.slice(0, 220)}`,
        ).toBe(true);
        passwordTemporal = json.passwordTemporal!;
    } finally {
        await reqAdmin.dispose();
    }

    // El verificador entra con la temporal, la cambia y acepta el consentimiento por
    // el endpoint real. La clave nueva se arma local (no es la de ninguna cuenta real).
    const passwordNueva = `Verif448-Nueva!${CORRIDA.slice(-4)}`;
    const reqVerif = await ctx();
    try {
        await login(reqVerif, EMAIL_VERIF, passwordTemporal);
        const cambio = await reqVerif.post("/api/auth/cambiar-password", {
            data: { passwordActual: passwordTemporal, passwordNueva },
        });
        expect(
            cambio.status(),
            `cambiar-password del verificador debe cerrar 200. body=${(await cambio.text().catch(() => "")).slice(0, 220)}`,
        ).toBe(200);
        await login(reqVerif, EMAIL_VERIF, passwordNueva);
        await aceptarConsentimiento(reqVerif);
    } finally {
        await reqVerif.dispose();
    }

    const creado = await prisma.usuario.findUnique({ where: { email: EMAIL_VERIF }, select: { id: true, rol: true } });
    expect(creado?.rol, "la cuenta creada por el endpoint es VERIFICADOR").toBe("VERIFICADOR");
    sembrados.usuarios.add(creado!.id);
    return { email: EMAIL_VERIF, password: passwordNueva };
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
        where: { email: { in: [EMAIL_PROF, EMAIL_ADMIN, EMAIL_VERIF] } },
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
        // El verificador y el admin aceptaron consentimiento por el endpoint real;
        // se borra la fila para no dejar rastro de la corrida (FK-safe, no bloquea).
        await prisma.auditConsentimiento.deleteMany({ where: { usuarioId: { in: usuarioIds } } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.usuarios.clear();
    sembrados.perfiles.clear();
    sembrados.tokens.clear();
}

/**
 * Estado compartido entre tests (describe.serial): el profesional se crea y
 * su perfil se levanta una vez; los candados (A/B/C) operan sobre él, y el
 * revisor (VERIFICADOR) se aprovisiona en beforeAll.
 */
let perfilProfesionalId = "";
let requisitoConDocumento = "";
let requisitoSinDocumento = "";

test.describe.serial("Verificación con documentos a la vista — revisor VERIFICADOR titular (SPEC-448 · SPEC-822)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
        const verif = await aprovisionarVerificador();
        verificadorEmail = verif.email;
        verificadorPassword = verif.password;

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
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(201);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PROF, PASSWORD);

            // (2) el profesional completa su ficha (PUT que la pantalla dispara)
            const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
            expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
            const putPerfil = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi E2E ${CORRIDA}`,
                    profesion: "psicologo",
                    areasAtencion: ["ansiedad"],
                    rangoEtario: ["12-17"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-448.",
                    // Sin tarifa: un profesional no habilitado no puede fijarla (route.ts:166,
                    // SPEC-685). Este recorrido verifica documentos con el perfil EN_REVISION
                    // (nunca llega a ACTIVO), así que la tarifa no aplica.
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
            // Revisor TITULAR: el VERIFICADOR (SPEC-822), no ADMIN. Ya aceptó el
            // consentimiento en beforeAll, así que basta con iniciar sesión.
            await login(request, verificadorEmail, verificadorPassword);

            // Marca TODOS los requisitos en CUMPLE — pero solo `requisitoConDocumento`
            // tiene archivo cargado. El servidor debe rechazar por
            // `requisitoSinDocumento` sin documento.
            const ficha = await request.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}`);
            // La ficha devuelve `checklist` como Record<clave, item> (objeto), no array (SPEC-408).
            const claves: string[] = Object.keys(((await ficha.json())?.data?.checklist) ?? {});
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
            await login(request, verificadorEmail, verificadorPassword);
            const res = await request.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/documentos/${requisitoConDocumento}`);
            expect(res.status(), "abrir documento como VERIFICADOR").toBe(200);
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
            await login(request, verificadorEmail, verificadorPassword);
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

    // (D) CONTROL DE ROL (SPEC-822) — des-aparcada del `test.fixme` que esperaba una
    // cuenta persistente de Datos; ahora entra con el VERIFICADOR que el PROPIO
    // recorrido crea. Prueba que el revisor de (A)(B)(C) es el VERIFICADOR, no ADMIN:
    // si fuera ADMIN, este candado vería 200 donde exige 403 y el recorrido CAERÍA.
    test("(D) control de rol — el revisor es el VERIFICADOR, no ADMIN prestado (SPEC-822)", async () => {
        // El VERIFICADOR está CONFINADO a su módulo: un módulo de ADMIN le da 403.
        // Es la MISMA cuenta que camina (A)(B)(C); cambiarla por ADMIN rompería esto.
        const reqVerif = await ctx();
        try {
            await login(reqVerif, verificadorEmail, verificadorPassword);
            const res = await reqVerif.get(MODULO_SOLO_ADMIN);
            expect(
                res.status(),
                `SPEC-822: el VERIFICADOR está confinado a su módulo → ${MODULO_SOLO_ADMIN} debe dar 403. ` +
                    "Si diera 200, el revisor de (A)(B)(C) sería ADMIN y el recorrido probaría el guard, no el rol. " +
                    `status=${res.status()} body=${(await res.text().catch(() => "")).slice(0, 180)}`,
            ).toBe(403);
        } finally {
            await reqVerif.dispose();
        }

        // Remoción del discriminador (control positivo): el MISMO sondeo como ADMIN
        // NO está confinado. Prueba que el 403 de arriba es del ROL (no un 403
        // universal del endpoint) y que (A)(B)(C) caerían si se entrara como ADMIN.
        const reqAdmin = await ctx();
        try {
            await login(reqAdmin, EMAIL_ADMIN, PASSWORD);
            const res = await reqAdmin.get(MODULO_SOLO_ADMIN);
            expect(
                res.status(),
                `control positivo: el ADMIN NO está confinado en ${MODULO_SOLO_ADMIN} (debe dar 200, no 403). ` +
                    `status=${res.status()} body=${(await res.text().catch(() => "")).slice(0, 180)}`,
            ).toBe(200);
        } finally {
            await reqAdmin.dispose();
        }
    });
});
