/**
 * SPEC-295 (002-PI-196 · cierra I-146) — E2E: padre autenticado reporta desde
 * `/dashboard/padre/reportar` y el `Reporte` queda con `usuarioId != null`
 * y `origenRol = "PARENT"` en BD.
 *
 * Reutiliza el patrón de registro de `reportes.spec.ts` (registra un usuario
 * PARENT via API, hace login, navega al panel, llena el wizard).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "@/lib/prisma";

async function registrarPadre(
    request: APIRequestContext,
    email: string,
    password: string,
    nombre: string,
): Promise<void> {
    const solicitar = await request.post("/api/auth/verificar/solicitar", { data: { email } });
    expect(solicitar.status()).toBe(202);
    const { devCode } = await solicitar.json();

    const validar = await request.post("/api/auth/verificar/validar", {
        data: { email, codigo: devCode },
    });
    expect(validar.status()).toBe(200);
    const { token } = await validar.json();

    const completar = await request.post("/api/auth/verificar/completar", {
        data: { token, password, nombre },
    });
    expect(completar.status()).toBe(201);

    const login = await request.post("/api/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
}

test.describe("SPEC-295 · padre autenticado puede reportar (I-146)", () => {
    test("PARENT logueado → /dashboard/padre/reportar → envía → BD origenRol=PARENT", async ({
        page,
        request,
    }) => {
        const email = `padre-spec295-${Date.now()}@example.com`;
        const password = "TestPass123";
        await registrarPadre(request, email, password, "Padre SPEC-295");

        // Aceptar consentimiento vía API para evitar el guardián.
        await request.post("/api/consentimiento/aceptar").catch(() => undefined);

        // Ir a la página real del padre.
        const respuesta = await page.goto("/dashboard/padre/reportar", { waitUntil: "commit" });
        expect(respuesta?.status(), "página debe cargar sin redirect").toBe(200);

        // Formulario real (no PlaceholderPadre).
        await expect(page.getByText("Reportar una situación")).toBeVisible();
        // Banner de identidad (SPEC-295 FR-002).
        await expect(page.getByText("Reportando como")).toBeVisible();
        await expect(page.getByText("Padre SPEC-295")).toBeVisible();

        // Llenar identificador único.
        const identificador = `+57300E2E${Date.now()}`;
        await page.getByLabel("Identificador").fill(identificador);
        // Elegir plataforma (WhatsApp por default).
        await page.getByLabel(/plataforma/i).first().selectOption({ label: "WhatsApp" });

        // Continuar al paso 2.
        await page.getByRole("button", { name: /Siguiente/i }).click();

        // País/Ciudad + texto.
        const paises = await request.get("/api/paises");
        const paisesBody = await paises.json();
        const colombia = paisesBody.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
        expect(colombia).toBeDefined();
        await page.getByLabel(/país/i).selectOption(colombia.id);

        const ciudades = await request.get(`/api/ciudades?paisId=${colombia.id}`);
        const ciudadesBody = await ciudades.json();
        const bogota = ciudadesBody.ciudades.find((c: { nombre: string }) => c.nombre === "Bogotá");
        await page.getByLabel(/ciudad/i).selectOption(bogota.id);

        // Texto largo suficiente para pasar el min_text_length.
        const textoLargo =
            "Este es un reporte de prueba SPEC-295 para verificar que el padre autenticado puede reportar desde su panel. " +
            new Date().toISOString();
        await page.getByLabel(/describe/i).fill(textoLargo);

        await page.getByRole("button", { name: /Siguiente/i }).click();

        // Paso 3: enviar.
        await page.getByRole("button", { name: /Enviar/i }).click();

        // Redirect a /dashboard/padre/mis-reportes (SPEC-295 FR-002).
        await page.waitForURL(/\/dashboard\/padre\/mis-reportes/, { timeout: 10_000 });
        expect(page.url()).toContain("/dashboard/padre/mis-reportes");

        // Verificar en BD: usuarioId != null AND origenRol = 'PARENT'.
        const reporte = await prisma.reporte.findFirst({
            where: { identificador },
            orderBy: { creadoEn: "desc" },
        });
        expect(reporte, "reporte debe existir en BD").not.toBeNull();
        expect(reporte?.usuarioId, "usuarioId debe estar poblado").not.toBeNull();
        expect(reporte?.origenRol, "origenRol debe ser 'PARENT'").toBe("PARENT");
    });
});
