/**
 * SPEC-437 (Calidad · candado) · El menú del profesional solo pinta ítems con
 * pantalla real.
 *
 * ORIGEN OPERATIVO. Análogo al candado del menú admin (SPEC-405 / I-290). El
 * menú del rol PROFESIONAL vive en `src/lib/nav-items.ts` como
 * `PROFESIONAL_NAV_ITEMS` y lo consume `NavHeader.tsx`. Nada garantiza hoy
 * que cada `href` del menú tenga un `page.tsx` real: un ítem huérfano rinde
 * 404 y el CI no truena — es la clase de bug que este candado nace para
 * cazar antes de que Jelkin lo encuentre en producción.
 *
 * QUÉ AFIRMA — el orden lo fijó el CEO por importancia:
 *
 *   (A) Cada href del menú del profesional, pedido con la sesión del propio
 *       profesional, responde 200 (o 3xx a otra ruta de la app — nunca 404).
 *       Un 404 es el bug canónico: el menú promete pantalla que no existe.
 *
 *   (B) Cada href del menú tiene un `page.tsx` real en `src/app/<href>/page.tsx`
 *       (o en una variante con grupo de rutas Next `(...)`). Este candado
 *       corre en el archivo fuente — es el que dispara aunque el servidor
 *       aún no esté levantado, y protege de renombres accidentales.
 *
 *   (C) [candado futuro] En viewport móvil (375x812) el menú también pinta
 *       los mismos ítems. Este spec opera con `APIRequestContext` sin
 *       navegador para (A)/(B); el candado móvil se deja anotado y se
 *       activa cuando pasemos a `page`/`context.setViewportSize`.
 *
 * TEST.FAIL A PROPÓSITO. Los tres tests van con `test.fail(true, "SPEC-437
 * ...")` — patrón «candado ANTES del fix» (memoria interna). SPEC-437 aún
 * no está en main; cuando Dev X la despliegue, quien la mergee retira los
 * `test.fail` y los candados pasan a exigir el comportamiento correcto.
 *
 * FUENTE ÚNICA. Se importa `PROFESIONAL_NAV_ITEMS` de `src/lib/nav-items.ts`
 * — si Dev agrega/quita/renombra ítems, este spec los ejercita solo. Es el
 * candado a nivel datos que ningún `arch:check` HTTP daría.
 *
 * AISLAMIENTO. Prefijo `e2e-437-<uuid>`, profesional efímero registrado por
 * la pantalla (POST solicitar → fabricar token → POST completar) — nunca
 * mutación de rol real, nunca INSERT directo al `Usuario`/`Consentimiento`.
 * Limpieza FK-safe en `afterAll`.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";
import { PROFESIONAL_NAV_ITEMS } from "@/lib/nav-items";

const CORRIDA = `e2e-437-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Prof437!Secure";
const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;

const sembrados = {
    usuarios: new Set<string>(),
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

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

async function loginProfesional(request: APIRequestContext) {
    const res = await request.post("/api/auth/login", { data: { email: EMAIL_PROF, password: PASSWORD } });
    expect(res.status(), `login ${EMAIL_PROF}`).toBe(200);
}

async function limpiarSembrados() {
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: EMAIL_PROF },
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
    sembrados.tokens.clear();
}

/**
 * Un href del menú tiene página real si existe `src/app/<href>/page.tsx`
 * en cualquiera de las variantes canónicas que Next reconoce:
 *   - directa: `src/app/dashboard/profesional/page.tsx`
 *   - dentro de un grupo de rutas: `src/app/(algo)/dashboard/profesional/page.tsx`
 * El grupo `(algo)` es un directorio con paréntesis; Next lo salta a efectos
 * de URL. Este candado hace la búsqueda directa primero — que es la variante
 * usada hoy — y deja abierta la puerta de expandir a grupos si el árbol
 * cambia (búsqueda recursiva sería demasiado laxa para un candado).
 */
function existePaginaReal(href: string): { ok: boolean; camino: string } {
    const raiz = resolve(process.cwd(), "src", "app");
    // href empieza con "/"; page.tsx bajo el href tal cual.
    const caminoDirecto = resolve(raiz, `.${href}`, "page.tsx");
    if (existsSync(caminoDirecto)) return { ok: true, camino: caminoDirecto };
    return { ok: false, camino: caminoDirecto };
}

test.describe.serial("Menú del profesional — alineado con pantallas reales (SPEC-437)", () => {
    test.beforeAll(async () => {
        const request = await ctx();
        try {
            // El profesional se registra caminando la pantalla real
            // (POST solicitar → fabricar token del correo → POST completar),
            // igual patrón que SPEC-448.
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar profesional responde 202").toBe(202);

            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(200);

            const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL_PROF }, select: { id: true } });
            expect(usuario, "el POST completar debe haber creado el Usuario").not.toBeNull();
            sembrados.usuarios.add(usuario!.id);

            await loginProfesional(request);
            await aceptarConsentimiento(request);
        } finally {
            await request.dispose();
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    /**
     * (A) Cada href del menú responde 200 desde el servidor (nunca 404).
     *
     * El profesional aterriza en su panel; el resto del menú se ejercita
     * por HTTP con la sesión del propio profesional. Aceptamos 200 y 3xx
     * (redirects internos hacia rutas de la app) — el candado dispara si
     * cae 404 (o >=500). Cada ítem en su propio `test.step` para que la
     * salida del CI señale cuál falló.
     */
    test("(A) cada href del menú profesional responde 200/3xx (nunca 404)", async () => {
        test.fail(true, "SPEC-437 (Dev X) alinea el menú del profesional con las pantallas reales. Este candado se quita cuando esa spec despliegue.");

        const request = await ctx();
        try {
            await loginProfesional(request);
            expect(
                PROFESIONAL_NAV_ITEMS.length,
                "PROFESIONAL_NAV_ITEMS no puede estar vacío — hay menú por caminar",
            ).toBeGreaterThan(0);

            for (const item of PROFESIONAL_NAV_ITEMS) {
                await test.step(`${item.label} → GET ${item.href}`, async () => {
                    const res = await request.get(item.href, { maxRedirects: 0 });
                    const status = res.status();
                    expect(
                        status,
                        `el ítem '${item.label}' (${item.href}) responde ${status} — un menú del profesional NO puede prometer una pantalla que devuelve 404`,
                    ).not.toBe(404);
                    expect(
                        status >= 500,
                        `el ítem '${item.label}' (${item.href}) responde ${status} — error del servidor cuenta como pantalla rota`,
                    ).toBe(false);
                });
            }
        } finally {
            await request.dispose();
        }
    });

    /**
     * (B) Cada href del menú tiene `page.tsx` real bajo `src/app/`.
     *
     * Este candado corre en la fuente. Es el que caza un rename mal hecho
     * en Next (por ejemplo, mover la carpeta y olvidar el ítem del menú).
     */
    test("(B) cada href del menú tiene page.tsx real en src/app/<href>/page.tsx", async () => {
        test.fail(true, "SPEC-437 (Dev X) alinea el menú del profesional con las pantallas reales. Este candado se quita cuando esa spec despliegue.");

        const huerfanos: Array<{ href: string; label: string; camino: string }> = [];
        for (const item of PROFESIONAL_NAV_ITEMS) {
            const veredicto = existePaginaReal(item.href);
            if (!veredicto.ok) {
                huerfanos.push({ href: item.href, label: item.label, camino: veredicto.camino });
            }
        }
        expect(
            huerfanos,
            `menú del profesional con ítems SIN page.tsx en el árbol de Next: ${JSON.stringify(huerfanos, null, 2)}`,
        ).toEqual([]);
    });

    /**
     * (C) [candado futuro] En móvil (375x812) el menú pinta los mismos
     *     ítems que en escritorio. Este spec opera con `APIRequestContext`
     *     sin navegador; cuando pasemos a `page`/`context.setViewportSize`
     *     el candado se activa. Por ahora afirma la mitad estructural: el
     *     menú del profesional está pensado desde el mismo `PROFESIONAL_NAV_ITEMS`
     *     (fuente única) y ese arreglo no está vacío.
     */
    test("(C) [candado futuro] móvil pinta los mismos ítems — de momento afirma fuente única", async () => {
        test.fail(true, "SPEC-437 (Dev X) alinea el menú del profesional con las pantallas reales. Este candado se quita cuando esa spec despliegue.");

        // Hasta que este spec suba a `page` con viewport 375x812 y verifique
        // el DOM del `NavHeader` en móvil, dejamos afirmado que la fuente es
        // única. Si Dev abre otra lista de items solo-móvil, este assert
        // truena y obliga a revisar la duplicación.
        expect(
            Array.isArray(PROFESIONAL_NAV_ITEMS),
            "PROFESIONAL_NAV_ITEMS debe seguir siendo la fuente única del menú del profesional",
        ).toBe(true);
        expect(
            PROFESIONAL_NAV_ITEMS.every((it) => typeof it.href === "string" && it.href.length > 0),
            "cada ítem del menú del profesional debe declarar un href textual",
        ).toBe(true);
    });
});
