/**
 * SPEC-437 (Calidad) · Recorrido del menú del profesional — la barra lateral
 * nueva + el menú móvil.
 *
 * ORIGEN. Aviso del CEO 04-09 19:4x tras revisión del recorrido anterior:
 * el spec previo afirmaba los 3 ítems del encabezado (`PROFESIONAL_NAV_ITEMS`)
 * que ya existían — eso NO cubre lo que SPEC-437 (#359) arregla, que es:
 *
 *   · Una BARRA LATERAL con 6 módulos concedibles:
 *     Inicio · Citaciones · Casos · Calendario · Mi ficha · Verificación.
 *   · «Citaciones» y «Casos» como PÁGINAS PROPIAS (no eran ítems antes).
 *   · El MENÚ MÓVIL — hoy dejaba al psicólogo sin forma de volver al panel.
 *   · Cero ítems de padre/operador/comité (I-299 reforzada).
 *
 * Afirmar los 3 ítems viejos era el «candado de palabras»: pasa verde sin
 * tocar lo que 437 arregla ([[ceo-candado-vigila-conducta-no-palabras]]).
 * Este spec afirma **la conducta nueva**.
 *
 * TODOS LOS TESTS CON `test.fail`. SPEC-437 (#359) aún no despliega. Cuando
 * entre, Playwright reporta "unexpected pass" y Dev X quita los candados
 * como parte de esa spec — no antes, aunque el HTML de hoy ya contenga
 * alguno de los ítems por casualidad.
 *
 * AISLAMIENTO. Prefijo `e2e-437-<uuid>`, cero mutación de rol real,
 * limpieza FK-safe en `afterAll`. Aceptación del consentimiento por el
 * flujo real (`POST /api/consentimiento/aceptar`).
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-437-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Menu437!Secure";
const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;

/**
 * Los 6 ítems que SPEC-437 (#359) construye en la barra lateral. Las URLs
 * de referencia son la convención del proyecto (`/dashboard/profesional/*`
 * para área de trabajo, `/perfil-profesional/*` para configurar la ficha).
 * Si #359 elige otras URLs, el spec truena con el nombre exacto — que es
 * lo que uno quiere.
 */
const ITEMS_LATERAL = [
    { label: "Inicio",       href: "/dashboard/profesional" },
    { label: "Citaciones",   href: "/dashboard/profesional/citaciones" },
    { label: "Casos",        href: "/dashboard/profesional/casos" },
    { label: "Calendario",   href: "/dashboard/profesional/calendario" },
    { label: "Mi ficha",     href: "/perfil-profesional/completar" },
    { label: "Verificación", href: "/perfil-profesional/verificacion" },
] as const;

/** Ítems que NUNCA deben aparecer — son de otros roles (I-299 reforzada). */
const ITEMS_AJENOS = [
    "Mis reportes",         // padre
    "Círculo",              // padre
    "A quién vigilo",       // padre
    "Suscripción",          // padre
    "Bandeja de reportes",  // operador
    "Comité",               // comité de validación
    "Colegios",             // admin
    "Padres",               // admin
] as const;

const sembrados = { usuarios: new Set<string>(), tokens: new Set<string>() };

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

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

async function limpiarSembrados() {
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: EMAIL_PROF },
        select: { id: true },
    });
    const ids = usuariosCreados.map((u) => u.id);
    if (ids.length > 0) {
        await prisma.perfilProfesional.deleteMany({ where: { usuarioId: { in: ids } } });
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    if (ids.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: ids } } });
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    }
    sembrados.usuarios.clear();
    sembrados.tokens.clear();
}

/** Extrae el HTML del panel del profesional, con sesión ya iniciada. */
async function htmlPanel(request: APIRequestContext, userAgent: string): Promise<string> {
    const res = await request.get("/dashboard/profesional", {
        headers: { "user-agent": userAgent },
    });
    expect(res.status(), `GET /dashboard/profesional con UA=${userAgent}`).toBe(200);
    return res.text();
}

const UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

test.describe.serial("Menú del profesional — barra lateral + móvil (SPEC-437 candado)", () => {
    test.beforeAll(async () => {
        // Registro por la pantalla (patrón SPEC-448 · fabricarEnlace).
        const request = await ctx();
        try {
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar 202").toBe(202);
            const tokensCreados = await prisma.tokenRegistro.count({ where: { email: EMAIL_PROF } });
            expect(tokensCreados, "el POST solicitar debe crear al menos un TokenRegistro real").toBeGreaterThanOrEqual(1);

            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar body=${await completar.text().catch(() => "")}`).toBe(200);
            await aceptarConsentimiento(request);
        } finally {
            await request.dispose();
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) la barra lateral pinta los 6 ítems concedibles del profesional", async () => {
        test.fail(true, "SPEC-437 (Dev X · #359) construye la barra lateral con 6 módulos. Este candado se quita cuando esa spec despliegue.");

        const request = await ctx();
        try {
            await login(request, EMAIL_PROF);
            const html = await htmlPanel(request, UA_DESKTOP);
            // Cada label del menú debe aparecer en el HTML del panel.
            for (const item of ITEMS_LATERAL) {
                expect(
                    html.includes(item.label),
                    `barra lateral debe pintar '${item.label}' (href esperado ${item.href}). HTML sin ese label significa que #359 aún no lo cablea.`,
                ).toBe(true);
            }
            // Y ningún href debe apuntar a una pantalla inexistente: cada
            // href del menú debe tener page.tsx real que responda distinto de 404.
            for (const item of ITEMS_LATERAL) {
                const res = await request.get(item.href, { maxRedirects: 0 });
                expect(
                    res.status() !== 404,
                    `href '${item.href}' del ítem '${item.label}' NO puede ser 404 — sería un enlace a pantalla inexistente. status=${res.status()}`,
                ).toBe(true);
            }
        } finally {
            await request.dispose();
        }
    });

    test("(B) el menú móvil da los mismos accesos y permite volver al panel", async () => {
        test.fail(true, "SPEC-437 (Dev X · #359) trae el menú móvil que hoy dejaba al psicólogo sin retorno al panel.");

        const request = await ctx();
        try {
            await login(request, EMAIL_PROF);
            const html = await htmlPanel(request, UA_MOBILE);
            // El HTML server-side es el mismo bajo desktop y móvil (Next.js);
            // las diferencias se dan por CSS media queries. El candado es
            // ESTRUCTURAL: en el HTML aparecen los 6 ítems Y hay marcadores
            // del componente móvil (típicamente hamburger + drawer + link al
            // panel para volver).
            for (const item of ITEMS_LATERAL) {
                expect(
                    html.includes(item.label),
                    `menú móvil debe listar '${item.label}' (mismo que desktop). HTML sin ese label = móvil no lo cablea.`,
                ).toBe(true);
            }
            // Marcador del retorno al panel — un link a `/dashboard/profesional`
            // o un botón con label "Panel" / "Volver al panel" / similar debe
            // existir en el HTML móvil (hueco que Dev 02 cazó: sin él, el
            // psicólogo queda encerrado en la subruta).
            const marcadorRetorno =
                html.includes("Volver al panel") ||
                html.includes("Panel") ||
                /href="\/dashboard\/profesional"[^/]/i.test(html);
            expect(
                marcadorRetorno,
                "menú móvil debe tener un retorno al panel (label 'Panel'/'Volver al panel' o link a /dashboard/profesional). Sin él, el psicólogo queda encerrado.",
            ).toBe(true);
        } finally {
            await request.dispose();
        }
    });

    test("(C) el menú NO pinta ningún ítem de padre / operador / comité (I-299)", async () => {
        test.fail(true, "SPEC-437 (Dev X · #359) refuerza I-299: el profesional NO ve el menú de otros roles.");

        const request = await ctx();
        try {
            await login(request, EMAIL_PROF);
            const htmlDesktop = await htmlPanel(request, UA_DESKTOP);
            const htmlMobile  = await htmlPanel(request, UA_MOBILE);
            for (const ajeno of ITEMS_AJENOS) {
                expect(
                    htmlDesktop.includes(ajeno),
                    `desktop: '${ajeno}' NO puede aparecer en el menú del profesional (es de otro rol).`,
                ).toBe(false);
                expect(
                    htmlMobile.includes(ajeno),
                    `móvil: '${ajeno}' NO puede aparecer en el menú del profesional (es de otro rol).`,
                ).toBe(false);
            }
        } finally {
            await request.dispose();
        }
    });
});
