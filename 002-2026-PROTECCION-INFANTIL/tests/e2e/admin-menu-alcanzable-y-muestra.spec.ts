/**
 * ADMIN MENU · alcanzable Y muestra lo prometido (SPEC-405 · candado de I-290).
 *
 * ORIGEN OPERATIVO. Jelkin cazó en producción el 03-09 que la "Bandeja de
 * reportes" del menú del admin era inalcanzable: el ítem apuntaba a
 * /dashboard/admin y esa raíz redirigía a /dashboard/admin/inicio para todo
 * admin con el módulo `inicio_admin`. El CI decía CUMPLE porque `arch:check (d)`
 * mide "href responde 200" — y 200 sí respondía, la Inicio. Un ítem del menú
 * redirigiendo al href de OTRO ítem del menú es un enlace MUERTO y este spec
 * es el candado que lo caza.
 *
 * TEST.FAIL RETIRADO. SPEC-404 (Dev 01) desplegó el arreglo: bandeja en URL
 * propia + "volver" apuntando ahí. Los dos tests corren ahora afirmando el
 * comportamiento correcto — si el bug reincide, truenan de verdad.
 *
 * DOS COSAS QUE ESTE SPEC ASEGURA, LAS DOS AL MISMO TIEMPO:
 *   1) Cada ítem del menú del admin lleva a UNA URL que sigue perteneciendo
 *      a ese ítem (no rebota al href de un ítem distinto).
 *   2) La página final muestra CONTENIDO propio del ítem — al menos el label
 *      del ítem visible en algún lugar de la página (h1, breadcrumb o título).
 *      Un 200 vacío o un 200 de "Sin acceso" no cuenta.
 *
 * FUENTE ÚNICA. Este spec importa `ADMIN_NAV_ITEMS` de `src/lib/nav-items.ts`.
 * Si Dev agrega un ítem al menú, este spec lo prueba automáticamente sin
 * tocar el spec — la próxima corrida caza el faltante. Es el candado a nivel
 * datos que `arch:check (d)` a nivel HTTP no puede dar.
 *
 * AISLAMIENTO. Igual que C12 (SPEC-393): admin efímero con UUID por corrida,
 * NUNCA mutamos el rol real ADMIN. Los módulos se activan sobre un rol
 * dedicado `E2E_MENU_ADMIN_ROL_<uuid>` y el spec limpia todo al final.
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";

const CORRIDA = `e2e-menu-${randomUUID().slice(0, 8)}`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const ADMIN_PASSWORD = "Admin123!Secure";
const ROL_TEST = `E2E_MENU_ADMIN_ROL_${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

const sembrados = {
    usuarios: new Set<string>(),
    permisosRolTest: new Set<string>(),
};

async function asegurarUsuario(email: string, rol: string, password: string, nombre: string): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol: rol as RolUsuario, estado: "activo" },
        create: {
            email,
            nombre,
            passwordHash: await hashPassword(password),
            rol: rol as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

async function moduloIdPorClave(clave: string): Promise<string> {
    const m = await prisma.moduloPermisible.findUnique({ where: { clave } });
    expect(m, `módulo '${clave}' debe existir en el catálogo (corre prisma db seed)`).not.toBeNull();
    return m!.id;
}

async function activarModuloEnRolTest(clave: string) {
    const moduloId = await moduloIdPorClave(clave);
    const p = await prisma.permisoModulo.upsert({
        where: { rol_moduloId: { rol: ROL_TEST, moduloId } },
        update: { activo: true },
        create: { rol: ROL_TEST, moduloId, activo: true },
    });
    sembrados.permisosRolTest.add(p.id);
}

async function login(page: Page, email: string, password: string) {
    const res = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function limpiarSembrados() {
    const idsU = [...sembrados.usuarios];
    if (sembrados.permisosRolTest.size > 0) {
        await prisma.permisoModulo.deleteMany({ where: { rol: ROL_TEST } });
    }
    if (idsU.length > 0) await prisma.usuario.deleteMany({ where: { id: { in: idsU } } });
    sembrados.usuarios.clear();
    sembrados.permisosRolTest.clear();
}

/** Otros hrefs del menú, sin el propio. Sirven para el candado de "no rebotó a otro ítem". */
function hrefsAjenos(propio: string): string[] {
    return ADMIN_NAV_ITEMS.map((n) => n.href).filter((h) => h !== propio);
}

/**
 * El ítem "cae en su propio destino" si la URL final:
 *   - empieza con el href propio (permite sub-rutas: /comite → /comite/apelaciones), Y
 *   - NO empieza con el href de otro ítem del menú (candado I-290 puro).
 * Casos borde:
 *   - Si el href del propio ítem es una subcadena del ajeno (o al revés),
 *     el candado se apoya en la longitud: gana el prefijo más largo.
 */
function urlFinalPerteneceAlItem(pathnameFinal: string, itemHref: string): { ok: boolean; motivo: string } {
    const empiezaPropio = pathnameFinal === itemHref || pathnameFinal.startsWith(itemHref + "/");
    if (!empiezaPropio) {
        return { ok: false, motivo: `URL final '${pathnameFinal}' no empieza con href propio '${itemHref}'` };
    }
    for (const ajeno of hrefsAjenos(itemHref)) {
        const empiezaAjeno = pathnameFinal === ajeno || pathnameFinal.startsWith(ajeno + "/");
        if (empiezaAjeno && ajeno.length > itemHref.length) {
            return { ok: false, motivo: `URL final '${pathnameFinal}' pertenece al ítem hermano '${ajeno}' — enlace muerto` };
        }
    }
    return { ok: true, motivo: "" };
}

test.describe.serial("Menú del admin — alcanzable y muestra lo prometido (SPEC-404 candado)", () => {
    test.beforeAll(async () => {
        await asegurarUsuario(ADMIN_EMAIL, "ADMIN", ADMIN_PASSWORD, "Admin E2E Menú");
        // Activamos TODOS los módulos referenciados por el menú, sobre el rol
        // efímero. El admin real igual usa el rol "ADMIN" — pero la lectura
        // del catálogo en dev/pruebas no distingue rol para admin. Si en el
        // futuro el catálogo por rol se endurece, cambiamos a activar sobre
        // ADMIN dentro del propio spec y restauramos al final (con la misma
        // técnica de snapshot que C12 usa).
        for (const item of ADMIN_NAV_ITEMS) {
            await activarModuloEnRolTest(item.modulo);
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    /**
     * (A) I-290 candado dedicado.
     *
     * Admin con `inicio_admin` + `bandeja_reportes`. Click en "Bandeja de
     * reportes" del menú DEBE llevar a una URL cuyo pathname NO empieza con
     * `/dashboard/admin/inicio` — es decir, no rebota. Y la página final DEBE
     * mostrar contenido propio de la Bandeja (tabla o encabezado).
     *
     * SPEC-404 decisión del CEO: la bandeja pasa a URL propia
     * `/dashboard/admin/bandeja`. El candado abajo NO codifica la URL de
     * destino; verifica el comportamiento: "no rebotó a Inicio". Si SPEC-404
     * elige otra URL, el spec sigue pasando; si el bug reincide (rebote a
     * Inicio), truena.
     */
    test("(A) I-290 · click en 'Bandeja de reportes' NO rebota a Inicio", async ({ page }) => {
        // SPEC-404 aplicó el fix (Dev 01): bandeja tiene URL propia y el
        // ítem del menú apunta ahí. Quitado el `test.fail` — el candado
        // ahora afirma el comportamiento correcto, no la falla histórica.
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        await page.goto("/dashboard/admin/inicio");
        // Click sobre el ítem del menú por label — mismo camino que Jelkin.
        const enlace = page.getByRole("link", { name: "Bandeja de reportes", exact: true });
        await expect(enlace, "el ítem 'Bandeja de reportes' debe existir en el menú").toBeVisible();
        await enlace.click();
        await page.waitForLoadState("networkidle");
        const pathnameFinal = new URL(page.url()).pathname;
        expect(
            pathnameFinal.startsWith("/dashboard/admin/inicio"),
            `I-290 reincidencia: el click a 'Bandeja de reportes' terminó en '${pathnameFinal}' (rebote al Inicio del admin)`
        ).toBe(false);
        // Y muestra contenido propio de la bandeja: un encabezado que la nombre.
        await expect(
            page.locator("main"),
            "la página final del click 'Bandeja de reportes' debe mostrar la bandeja (no un skeleton vacío)"
        ).toContainText(/bandeja|reportes/i);
    });

    /**
     * (B) Barrido completo — el CANDADO nuevo que el CI no tenía.
     *
     * Por cada ítem del menú:
     *   1) hago click en el label,
     *   2) verifico que la URL final pertenece al propio ítem (no al de un
     *      hermano) — esto es el candado que Jelkin nombró explícitamente en
     *      la ficha,
     *   3) verifico que la página final muestra el label del ítem en algún
     *      lugar (h1, título o breadcrumb).
     *
     * `test.step` por ítem para que la salida del CI enumere cuál falló.
     */
    test("(B) cada ítem del menú admin cae en su destino y muestra su etiqueta", async ({ page }) => {
        // SPEC-404 aplicó el fix (Dev 01): la fila "Bandeja de reportes"
        // apunta a `/dashboard/admin/bandeja` y el barrido verifica que
        // ningún ítem rebote al href de otro. Quitado el `test.fail`.
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        // Aterrizaje conocido — desde Inicio se ve el menú entero.
        await page.goto("/dashboard/admin/inicio");
        for (const item of ADMIN_NAV_ITEMS) {
            await test.step(`${item.label} → ${item.href}`, async () => {
                // Volvemos al Inicio entre clicks para que el menú esté siempre visible
                // (algunas páginas ocultan el nav en breakpoints angostos).
                await page.goto("/dashboard/admin/inicio");
                const enlace = page.getByRole("link", { name: item.label, exact: true }).first();
                await expect(
                    enlace,
                    `el menú del admin debe listar el ítem '${item.label}'`
                ).toBeVisible();
                await enlace.click();
                await page.waitForLoadState("networkidle");
                const pathnameFinal = new URL(page.url()).pathname;

                const veredicto = urlFinalPerteneceAlItem(pathnameFinal, item.href);
                expect(veredicto.ok, veredicto.motivo).toBe(true);

                // Muestra el label del ítem en algún lugar del main
                // — aceptamos label exacto o su primera palabra (algunos
                // encabezados abrevian: "Anti-abuso" → "Anti-abuso operativo",
                // "Sugerencias" → "Sugerencias del motor").
                const primeraPalabra = item.label.split(/\s+/)[0];
                await expect(
                    page.locator("main"),
                    `la página del ítem '${item.label}' no muestra su etiqueta ni la primera palabra ('${primeraPalabra}') — probable renderizado vacío o 'Sin acceso'`
                ).toContainText(new RegExp(primeraPalabra, "i"));
            });
        }
    });
});
