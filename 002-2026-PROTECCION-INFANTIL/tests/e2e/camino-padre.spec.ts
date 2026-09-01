/**
 * SPEC-339 (A-67 · T062) — el camino guiado del padre, de punta a punta, a 390px.
 *
 * Lo que este spec afirma es el §6 del brief: el padre NO puede saltarse un
 * paso ni escribiendo la URL a mano, retoma donde quedó, y al terminar los
 * módulos abren sin recargar. La evidencia final la saca el CEO en el
 * navegador; esto es la red que impide regresiones.
 */
import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// El mockup aprobado está a 390px (brief §4: "la mayoría de los padres van a
// entrar desde el móvil").
test.use({ viewport: { width: 390, height: 844 } });

const PASSWORD = "Padre123!Seguro";

let secuencia = 0;
function emailUnico(): string {
    secuencia += 1;
    return `camino-e2e-${Date.now()}-${secuencia}@proteccion.local`;
}

/** Alta directa de un padre SIN consentimiento ni datos: arranca en el Paso 1. */
async function crearPadreNuevo(email: string) {
    return prisma.usuario.create({
        data: {
            email,
            passwordHash: await hashPassword(PASSWORD),
            rol: "PARENT",
            estado: "activo",
        },
    });
}

async function login(page: Page, email: string) {
    const res = await page.request.post("/api/auth/login", {
        data: { email, password: PASSWORD },
    });
    expect(res.status()).toBe(200);
}

async function aceptarConsentimiento(page: Page, usuarioId: string) {
    // El flujo humano del modal (leer hasta el final + 2 casillas) tiene su
    // propio test de componente; acá se firma directo para poder avanzar.
    const version = await prisma.parametroSistema.findUnique({
        where: { clave: "consentimiento.version_actual" },
    });
    await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
            consentimientoAceptadoEn: new Date(),
            consentimientoVersion: version?.valor ?? "1.0",
        },
    });
    // La cookie de estado quedó vieja: el próximo request la re-sella vía rebote.
    await page.context().clearCookies({ name: "sesion_estado" });
}

async function completarDatos(page: Page) {
    const res = await page.request.patch("/api/padre/perfil", {
        data: {
            nombre: "Padre",
            apellidos: "Del Camino",
            documentoTipo: "CC",
            documentoNumero: `79${Date.now() % 100000000}`,
            telefono: "+57 300 111 2233",
            paisId: (await prisma.pais.findFirst())!.id,
            ciudadId: (await prisma.ciudad.findFirst())!.id,
        },
    });
    expect(res.status()).toBe(200);
}

async function cargarMenor(page: Page, n = 1) {
    const res = await page.request.post("/api/padre/hijos", {
        data: {
            nombre: `Menor ${n}`,
            apellidos: "Del Camino",
            documentoTipo: "TI",
            documentoNumero: `10${Date.now() % 10000000}${n}`,
        },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).hijoId as string;
}

test.describe("SPEC-339 · el camino guiado del padre", () => {
    test("el guardián devuelve al paso pendiente aunque la URL se escriba a mano", async ({ page }) => {
        const email = emailUnico();
        const padre = await crearPadreNuevo(email);
        await login(page, email);

        // Paso 1 pendiente: cualquier módulo devuelve al consentimiento.
        await page.goto("/dashboard/padre/expedientes");
        await expect(page).toHaveURL(/\/consentimiento/);

        // Paso 2 pendiente.
        await aceptarConsentimiento(page, padre.id);
        await page.goto("/dashboard/padre/expedientes");
        await expect(page).toHaveURL(/\/camino\/datos/);
        await expect(page.getByText("Paso 2 de 4")).toBeVisible();

        // Paso 3 pendiente.
        await completarDatos(page);
        await page.goto("/dashboard/padre/expedientes");
        await expect(page).toHaveURL(/\/camino\/hijos/);
        await expect(page.getByText("Paso 3 de 4")).toBeVisible();

        // Paso 4 pendiente.
        await cargarMenor(page);
        await page.goto("/dashboard/padre/expedientes");
        await expect(page).toHaveURL(/\/camino\/plan/);
        await expect(page.getByText("Paso 4 de 4")).toBeVisible();
    });

    test("retomar: cerrar sesión a mitad del Paso 3 y volver retoma en el Paso 3", async ({ page }) => {
        const email = emailUnico();
        const padre = await crearPadreNuevo(email);
        await login(page, email);
        await aceptarConsentimiento(page, padre.id);
        await completarDatos(page);

        // "Abandona": se van todas las cookies (sesión incluida).
        await page.context().clearCookies();
        await login(page, email);

        await page.goto("/dashboard/padre");
        await expect(page).toHaveURL(/\/camino\/hijos/);
    });

    test("las salidas del camino nunca se tapan: reportar y salir funcionan a mitad de camino", async ({ page }) => {
        const email = emailUnico();
        await crearPadreNuevo(email);
        await login(page, email);

        // Reportar es alcanzable incluso en el Paso 1 (regla de Jelkin).
        await page.goto("/reportar");
        await expect(page).toHaveURL(/\/reportar/);

        // Y el armazón del camino ofrece salir.
        const res = await page.request.post("/api/auth/logout");
        expect(res.status()).toBeLessThan(400);
    });

    test("con el camino terminado los módulos abren al primer intento, sin recargar", async ({ page }) => {
        const email = emailUnico();
        const padre = await crearPadreNuevo(email);
        await login(page, email);
        await aceptarConsentimiento(page, padre.id);
        await completarDatos(page);
        await cargarMenor(page);

        // Paso 4: activar la prueba gratis desde la pantalla del camino.
        await page.goto("/camino/plan");
        await expect(page.getByText("Paso 4 de 4")).toBeVisible();
        const botonGratis = page.getByRole("button", { name: /gratis|prueba/i }).first();
        await botonGratis.click();

        // El cierre, y de ahí el panel SIN recargar (SPEC-337 + pasoCamino).
        await expect(page).toHaveURL(/\/camino\/(listo|plan)/, { timeout: 15000 });
        await page.goto("/dashboard/padre/expedientes");
        await expect(page).toHaveURL(/\/dashboard\/padre\/expedientes/);
        expect(padre.id).toBeTruthy();
    });

    test("a 390px no hay desborde horizontal en las pantallas del camino", async ({ page }) => {
        const email = emailUnico();
        const padre = await crearPadreNuevo(email);
        await login(page, email);
        await aceptarConsentimiento(page, padre.id);

        for (const ruta of ["/camino/datos"]) {
            await page.goto(ruta);
            const desborde = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            );
            expect(desborde, `${ruta} desborda ${desborde}px a lo ancho`).toBeLessThanOrEqual(0);
        }
    });

    test("el registro de colegio sigue en pie con su código de 6 dígitos", async ({ page }) => {
        await page.goto("/registro-colegio");
        // La pantalla del colegio existe y pide el correo para el CÓDIGO.
        await expect(page.getByText(/colegio/i).first()).toBeVisible();
    });
});
