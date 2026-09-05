/**
 * SPEC-435 (Calidad) · Recorrido del ALTA de un VERIFICADOR desde el panel del admin.
 *
 * CONTRATO CANDADO ANTES DEL FIX (memoria `calidad-candado-antes-del-fix.md`).
 * Encargo del CEO 04-09: cubrir la creación de un VERIFICADOR desde el panel
 * del admin en cuatro direcciones (A + credencial-no-por-correo, B, C — aviso CEO 20:0x
 * cada test — el candado se retira cuando SPEC-435 despliegue.
 *
 * QUÉ CUBRE — el orden fija el recorrido de negocio del CEO:
 *
 *   (A) Un ADMIN llama al endpoint que crea la cuenta VERIFICADOR
 *       (`POST /api/admin/verificadores` — convención espejo de
 *       `/api/admin/colegios` y `/api/admin/profesionales`, patrón operadores).
 *       Debe devolver 201 con `passwordTemporal: string` en la respuesta —
 *       mismo contrato Jelkin de SPEC-421/423 (memoria
 *       `pi-restablecer-vs-reenviar-credenciales.md`): la clave viaja SIEMPRE
 *       en el body del alta; el correo es cortesía. Un admin sin conexión al
 *       proveedor de correo (I-283) debe poder seguir dando de alta.
 *
 *   (B) El VERIFICADOR recién creado hace login con la temporal, cambia
 *       password (viene con `debeCambiarPassword=true` — Jelkin vivo 04-09),
 *       y entra a `/dashboard/admin/verificacion` (200). Este es SU módulo
 *       (`admin_verificacion_profesionales`, seed
 *       `prisma/seed-modulos-grants.ts:58`). Assert 200 + que la respuesta NO
 *       sea la pantalla `SinAccesoModulo`.
 *
 *   (C) El VERIFICADOR no puede acceder a módulos ajenos — barrido corto de
 *       tres puertas cerradas por diseño (SPEC-435 lección I-278/I-299: un
 *       rol, una persona, un trabajo):
 *         · `GET /api/admin/reportes-revision` → 403 (bandeja_reportes)
 *         · `GET /api/admin/comite/solicitudes` → 403 (comite_bandeja)
 *         · `GET /api/admin/colegios`           → 403 (colegios_gestion)
 *       Ninguno de esos tres módulos está en `CLAVES_POR_ROL.VERIFICADOR`.
 *
 * REGLAS DURAS (encargo del CEO):
 *   · El VERIFICADOR se crea por el ENDPOINT del admin, nunca por Prisma
 *     directo. El admin efímero SÍ se siembra por Prisma (patrón operadores
 *     — el ADMIN ya trae `verificadores_admin` por seed).
 *   · Aceptación de consentimiento por endpoint real
 *     (`POST /api/consentimiento/aceptar` con `POLITICA_DATOS`) — nunca
 *     insertar `audit_consentimientos` a mano
 *     (memoria `calidad-audit-consentimientos-nunca-forjar.md`).
 *   · Password local hardcodeada en la constante `PASSWORD` del spec.
 *   · Corrida por `randomUUID`, prefijo `e2e-435-`. Limpieza FK-safe en
 *     `afterAll`. Cero mutación de rol real ni parámetros globales.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-435-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Verif435!Secure";
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;
const EMAIL_VERIF = `${CORRIDA}-verif@proteccion.local`;

const CANDADO_MSG =
    "SPEC-435 (Dev 01) trae la creación de VERIFICADOR desde el panel. Este candado se quita cuando esa spec despliegue.";

const sembrados = {
    usuarios: new Set<string>(),
};

// Estado compartido entre tests (describe.serial): el alta del test (A)
// alimenta la temporal y el id que consumen (B) y (C).
let verificadorId = "";
let passwordTemporal = "";
let passwordNueva = "";

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
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

async function limpiarSembrados() {
    // El VERIFICADOR se crea por endpoint (no lo sembramos por Prisma), pero
    // igual lo cazamos por email para borrarlo en el afterAll.
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_ADMIN, EMAIL_VERIF] } },
        select: { id: true },
    });
    const usuarioIds = usuariosCreados.map((u) => u.id);
    if (usuarioIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.auditConsentimiento.deleteMany({ where: { usuarioId: { in: usuarioIds } } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.usuarios.clear();
}

test.describe.serial("Alta de VERIFICADOR desde el panel del admin (SPEC-435)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    /**
     * (A) El endpoint del admin crea el VERIFICADOR y devuelve `passwordTemporal`
     *     en la respuesta (contrato Jelkin SPEC-421/423 · memoria
     *     `pi-restablecer-vs-reenviar-credenciales.md`).
     */
    test("(A) POST /api/admin/verificadores crea la cuenta y devuelve passwordTemporal", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_ADMIN, PASSWORD);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_ADMIN, PASSWORD);

            // Contrato Jelkin: la credencial viaja en la respuesta, NO por correo.
            // Contar notificaciones al VERIFICADOR antes/después del POST — debe
            // seguir en 0. Si suma una fila, el alta está mandando correo con la
            // temporal (viola el contrato de la casa · pi-restablecer-vs-reenviar).
            const notifsAntes = await prisma.notificacion.count({
                where: { destinatarioEmail: EMAIL_VERIF },
            });

            const res = await request.post("/api/admin/verificadores", {
                data: { email: EMAIL_VERIF, nombre: `Verif E2E ${CORRIDA}` },
            });
            const status = res.status();
            const body = await res.text().catch(() => "");
            expect(
                [200, 201].includes(status),
                `POST /api/admin/verificadores debe devolver 200/201; status=${status} body=${body.slice(0, 240)}`,
            ).toBe(true);

            const json = JSON.parse(body) as {
                verificador?: { id?: string; email?: string };
                passwordTemporal?: string;
            };
            expect(
                typeof json.passwordTemporal === "string" && json.passwordTemporal.length > 0,
                `contrato Jelkin: 'passwordTemporal: string' viaja SIEMPRE en la respuesta del alta. body=${body.slice(0, 240)}`,
            ).toBe(true);
            expect(json.verificador?.id, "el body debe traer el id del verificador creado").toBeTruthy();
            expect(json.verificador?.email, "el email creado debe coincidir con el pedido").toBe(EMAIL_VERIF);

            verificadorId = json.verificador!.id!;
            passwordTemporal = json.passwordTemporal!;

            // Post-condición del contrato: NO se envía correo con la temporal.
            const notifsDespues = await prisma.notificacion.count({
                where: { destinatarioEmail: EMAIL_VERIF },
            });
            expect(
                notifsDespues,
                `contrato Jelkin: crear VERIFICADOR NO manda correo con la temporal. notif antes=${notifsAntes} después=${notifsDespues}`,
            ).toBe(notifsAntes);
        } finally {
            await request.dispose();
        }
    });

    /**
     * (B) El VERIFICADOR entra con la temporal, cambia password y accede a su
     *     único módulo (`/dashboard/admin/verificacion`). Debe llegar a la
     *     página REAL — no a `SinAccesoModulo`, que también devuelve 200.
     */
    test("(B) el VERIFICADOR entra con la temporal, cambia password y llega a /dashboard/admin/verificacion", async () => {
        expect(passwordTemporal, "el test (A) debe haber capturado passwordTemporal").not.toBe("");
        const request = await ctx();
        try {
            await login(request, EMAIL_VERIF, passwordTemporal);

            // Contrato Jelkin: cuenta nueva viene con `debeCambiarPassword=true`.
            // El VERIFICADOR cambia por una nueva por `/api/auth/cambiar-password`.
            passwordNueva = `Verif435-Nueva!${CORRIDA.slice(-4)}`;
            const cambio = await request.post("/api/auth/cambiar-password", {
                data: { passwordActual: passwordTemporal, passwordNueva },
            });
            const cambioBody = await cambio.text().catch(() => "");
            expect(
                cambio.status(),
                `cambiar-password debe cerrar con 200 con la temporal como actual. body=${cambioBody.slice(0, 240)}`,
            ).toBe(200);

            // Nueva sesión con la nueva clave — la temporal ya está invalidada.
            await login(request, EMAIL_VERIF, passwordNueva);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_VERIF, passwordNueva);

            const res = await request.get("/dashboard/admin/verificacion");
            expect(res.status(), "/dashboard/admin/verificacion debe responder 200 al VERIFICADOR").toBe(200);
            const html = await res.text();
            expect(
                html.includes("Sin acceso a este módulo"),
                "el VERIFICADOR debe llegar a la página REAL, no al fallback `SinAccesoModulo` (que también es 200)",
            ).toBe(false);
        } finally {
            await request.dispose();
        }
    });

    /**
     * (C) El VERIFICADOR no puede acceder a módulos ajenos. Barrido de tres
     *     puertas — reportes-revision, comité/solicitudes, colegios — ninguna
     *     de las claves de módulo asociadas está en
     *     `CLAVES_POR_ROL.VERIFICADOR` (`prisma/seed-modulos-grants.ts:58`).
     */
    test("(C) el VERIFICADOR recibe 403 al llamar módulos ajenos (reportes-revision · comite/solicitudes · colegios)", async () => {
        expect(passwordNueva, "el test (B) debe haber fijado la nueva password").not.toBe("");
        const request = await ctx();
        try {
            await login(request, EMAIL_VERIF, passwordNueva);

            const rutasProhibidas: Array<{ url: string; modulo: string }> = [
                { url: "/api/admin/reportes-revision", modulo: "bandeja_reportes" },
                { url: "/api/admin/comite/solicitudes", modulo: "comite_bandeja" },
                { url: "/api/admin/colegios", modulo: "colegios_gestion" },
            ];

            for (const { url, modulo } of rutasProhibidas) {
                const res = await request.get(url);
                const body = await res.text().catch(() => "");
                expect(
                    res.status(),
                    `VERIFICADOR llamando ${url} (módulo '${modulo}') debe recibir 403; devolvió ${res.status()} body=${body.slice(0, 200)}`,
                ).toBe(403);
            }
        } finally {
            await request.dispose();
        }
    });
});
