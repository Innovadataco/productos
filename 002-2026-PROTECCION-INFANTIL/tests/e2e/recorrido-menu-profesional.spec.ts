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
 * SPEC-437 (#359) YA está en main y desplegada — los tests afirman el
 * comportamiento bueno (aviso CEO tras el merge de #359). El menú viene
 * de la fuente única `PROFESIONAL_NAV_ITEMS`, así que el candado prueba
 * lo que Dev realmente cablea, no una lista hardcodeada.
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
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";

const CORRIDA = `e2e-437-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Menu437!Secure";
const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
// SPEC-691 (posterior a SPEC-437): `/dashboard/profesional` exige profesional
// HABILITADO; un no-habilitado es redirigido al onboarding. La barra solo existe
// para quien llega al panel → el titular habilita a EMAIL_PROF por el flujo real,
// y EMAIL_BORRADOR queda en BORRADOR para el candado INVERSO (conducta: redirige).
const EMAIL_BORRADOR = `${CORRIDA}-borrador@proteccion.local`;

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
let profesional: ProfesionalVisible | undefined;

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

/** Limpia el profesional BORRADOR del candado inverso (el HABILITADO lo limpia su
 *  propio fixture, `limpiarProfesionalVisible`). FK-safe: perfil → auditoría → usuario. */
async function limpiarSembrados() {
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: EMAIL_BORRADOR },
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

/** Extrae el HTML del panel del profesional, con sesión ya iniciada.
 *  Lección de método: un 200 tras seguir el redirect NO dice en qué pantalla estoy
 *  («no encontré el elemento» y «estoy en otra pantalla» se ven igual). Antes de
 *  buscar la barra, afirmo que NO me redirigió al onboarding — si no, un BORRADOR
 *  pasaría el status y fallaría el contenido, ocultando la causa. */
async function htmlPanel(request: APIRequestContext, userAgent: string): Promise<string> {
    const res = await request.get("/dashboard/profesional", {
        headers: { "user-agent": userAgent },
    });
    expect(res.status(), `GET /dashboard/profesional con UA=${userAgent}`).toBe(200);
    expect(res.url(), "el habilitado debe quedar EN el panel, no redirigido al onboarding")
        .not.toContain("/perfil-profesional/completar");
    return res.text();
}

const UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

test.describe.serial("Menú del profesional — barra lateral + móvil (SPEC-437 candado)", () => {
    test.beforeAll(async () => {
        // (1) Profesional HABILITADO por el flujo real (builder reutilizable) → su panel
        // renderiza la barra. Un `estado=ACTIVO` a mano no basta ni evita el redirect:
        // la compuerta SPEC-691 exige verificación vigente, que el builder produce.
        const reqProf = await ctx();
        try {
            profesional = await crearProfesionalVisible({
                request: reqProf,
                email: EMAIL_PROF,
                password: PASSWORD,
                corrida: CORRIDA,
                conFranja: false,
            });
        } finally {
            await reqProf.dispose();
        }

        // (2) Profesional en BORRADOR (solo registro) para el candado INVERSO.
        const reqB = await ctx();
        try {
            const solicitar = await reqB.post("/api/auth/registro-profesional/solicitar", { data: { email: EMAIL_BORRADOR } });
            expect(solicitar.status(), "solicitar BORRADOR 202").toBe(202);
            const token = await fabricarEnlace(EMAIL_BORRADOR, "PROFESIONAL" as RolUsuario);
            const completar = await reqB.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar BORRADOR body=${await completar.text().catch(() => "")}`).toBe(201);
        } finally {
            await reqB.dispose();
        }
    });

    test.afterAll(async () => {
        if (profesional) await limpiarProfesionalVisible(profesional);
        await limpiarSembrados();
    });

    /**
     * (A · CONTRATO DE DISEÑO) FORMA-CONTRATO-BARRA-LATERAL-PROFESIONAL v1.0: el discriminador
     * es el ESTADO `habilitado`, NO el módulo. Un VERIFICADO (habilitado) ve «Mi perfil» (su
     * autoedición), «Calendario» (aunque NO tenga franjas), «Casos» e «Inicio» — y NUNCA
     * «Mi ficha» (la entrada del PORTERO, excluyente por estado con «Mi perfil» — ver (B)).
     *
     * SPEC-802 (CERRADO · se retiró el `test.fail`): el menú se deriva de `habilitado`, que ANTES
     * llegaba del `fetch("/api/me")` del CLIENTE (AuthContext). En el SSR `profesional===undefined` →
     * `entradasProfesional` caía a PORTERO: la barra AFIRMABA «portero» antes de saber (defecto de
     * DISPLAY — un display que no sabe no debe afirmar). SPEC-802 lo resolvió EN EL SERVIDOR: el layout
     * del profesional calcula `habilitado` (misma fuente que /api/me) y lo pasa como prop a
     * NavLateral/BarraInferior, así que el SSR ya trae el menú del verificado.
     *
     * Este candado lee el STRING del SSR (`request.get().text()`), que nunca corre el fetch del cliente.
     * Era `test.fail` porque el SSR pintaba portero; un fix SOLO client-side lo habría dejado rojo. Que
     * ahora PASE en verde es la prueba de que el arreglo fue server-side (el criterio de salida
     * autoexigido del radicado de SPEC-802). La compuerta de ruta sigue fail-closed (otro candado);
     * esto afirma el DISPLAY.
     */
    test("(A · contrato) el VERIFICADO ve «Mi perfil»+«Calendario»+«Casos»+«Inicio», NUNCA «Mi ficha»", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_PROF);
            const html = await htmlPanel(request, UA_DESKTOP);
            for (const label of ["Inicio", "Casos", "Calendario", "Mi perfil"]) {
                expect(html.includes(label), `el verificado debe ver '${label}' por estado habilitado (contrato Diseño)`).toBe(true);
            }
            expect(html.includes("Mi ficha"), "el verificado NO ve «Mi ficha» (es la cara del portero)").toBe(false);
        } finally {
            await request.dispose();
        }
    });

    /**
     * (B · CONTRATO) «Mi ficha» y «Mi perfil» son estado-EXCLUSIVAS (Diseño): en ningún estado
     * se ven las dos a la vez. La costura pinta la que NO toca por estado (lo vigila (A)); que
     * se vean las DOS sería un defecto peor y distinto — este candado lo cierra.
     */
    test("(B · contrato) nunca «Mi ficha» y «Mi perfil» a la vez (excluyentes por estado)", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_PROF);
            const html = await htmlPanel(request, UA_DESKTOP);
            expect(
                html.includes("Mi ficha") && html.includes("Mi perfil"),
                "«Mi ficha» y «Mi perfil» son caras excluyentes por estado — nunca juntas",
            ).toBe(false);
        } finally {
            await request.dispose();
        }
    });

    test("(C) el menú NO pinta ningún ítem de padre / operador / comité (I-299)", async () => {

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

    /**
     * (D · INVERSO) Candado de CONDUCTA de la compuerta SPEC-691 — hoy nadie lo vigila.
     * Un profesional en BORRADOR (no habilitado) NO debe ver la barra: `/dashboard/profesional`
     * lo REDIRIGE a completar su ficha. Afirma la REDIRECCIÓN (dónde aterriza), no la mera
     * ausencia de un label — si alguien quita la compuerta, el BORRADOR se quedaría en el
     * panel y este candado cae. Control positivo: sin el redirect, `res.url()` sería el panel.
     */
    test("(D · inverso + compuerta de servidor) el BORRADOR es redirigido; la compuerta vive en el servidor", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_BORRADOR);
            const res = await request.get("/dashboard/profesional", { headers: { "user-agent": UA_DESKTOP } });
            expect(res.status(), "GET /dashboard/profesional (BORRADOR)").toBe(200);
            // CONDUCTA: aterriza en el onboarding, no en el panel.
            expect(
                res.url(),
                "un profesional NO habilitado debe ser redirigido a /perfil-profesional/completar (compuerta SPEC-691)",
            ).toContain("/perfil-profesional/completar");
            // Nada operativo para el portero (contrato Diseño): ni Casos, ni Calendario, ni Mi perfil.
            const html = await res.text();
            for (const op of ["Casos", "Calendario", "Mi perfil"]) {
                expect(html.includes(op), `el portero NO ve '${op}' (nada operativo, contrato Diseño)`).toBe(false);
            }
            // La compuerta es del SERVIDOR, no del menú (dev-esconder-menu-no-cierra-pantalla):
            // navegar DIRECTO a una pantalla operativa también lo bloquea — no se queda en ella.
            for (const ruta of ["/dashboard/profesional/calendario", "/dashboard/profesional/mi-perfil"]) {
                const r = await request.get(ruta, { headers: { "user-agent": UA_DESKTOP } });
                expect(
                    r.url(),
                    `el portero que navega directo a ${ruta} debe ser bloqueado por el servidor (no quedarse en la pantalla)`,
                ).not.toContain(ruta);
            }
        } finally {
            await request.dispose();
        }
    });
});
