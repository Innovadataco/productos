/**
 * SPEC-295 (002-PI-196 · cierra I-146) — E2E: padre autenticado reporta desde
 * `/dashboard/padre/reportar` y el `Reporte` queda con `usuarioId != null`
 * y `origenRol = "PARENT"` en BD.
 *
 * Reutiliza el patrón de registro de `reportes.spec.ts` (registra un usuario
 * PARENT via API, hace login, navega al panel, llena el wizard).
 *
 * Ajustes por specs posteriores (main, 2026-09):
 *  - SPEC-340 (A-68 §2.1) retiró el banner «Reportando como» — ya no se aserte.
 *  - SPEC-438 endureció fecha/hora del hecho: control de día + hora + a.m./p.m.
 *  - SPEC-591: paso inicial «¿A quién va dirigido?» — el reporte autenticado del
 *    padre va OBLIGATORIAMENTE atado a una ficha activa de «A quién protego»
 *    (se crea por API y se elige en el wizard).
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

        // SPEC-591: sin ficha activa el wizard no deja avanzar (paso «¿A quién
        // va dirigido?» vacío). Se crea la ficha por API como haría el padre.
        const ficha = await request.post("/api/padre/hijos", {
            data: { nombre: "Valeria", apellidos: "Pérez" },
        });
        expect(ficha.status()).toBe(201);

        // Ir a la página real del padre.
        const respuesta = await page.goto("/dashboard/padre/reportar", { waitUntil: "commit" });
        expect(respuesta?.status(), "página debe cargar sin redirect").toBe(200);

        // Formulario real (no PlaceholderPadre).
        await expect(page.getByText("Reportar una situación")).toBeVisible();

        // Paso 1 (SPEC-591): elegir la ficha del menor protegido.
        await page.getByRole("option", { name: /Valeria/ }).click();
        await page.getByRole("button", { name: /Siguiente/i }).click();

        // Paso 2: identificador único + plataforma (WhatsApp por default).
        const identificador = `+57300E2E${Date.now()}`;
        await page.getByLabel(/La cuenta/i).fill(identificador);
        await page.getByLabel("Plataforma").first().selectOption({ label: "WhatsApp" });
        await page.getByRole("button", { name: /Siguiente/i }).click();

        // Paso 3: País + Ciudad (buscador con debounce) + fecha/hora + texto.
        const paises = await request.get("/api/paises");
        const paisesBody = await paises.json();
        const colombia = paisesBody.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
        expect(colombia).toBeDefined();
        await page.getByLabel("País").selectOption(colombia.id);

        await page.getByLabel("Ciudad").fill("Bogotá");
        const opcionBogota = page.getByRole("option", { name: /Bogotá/ });
        await expect(opcionBogota).toBeVisible();
        await opcionBogota.click();

        // SPEC-438: día + hora + meridiano (control reemplazó al datetime-local).
        await page.getByLabel("Día del incidente").fill("2026-07-10");
        await page.getByLabel("Hora del incidente").selectOption("3");
        await page.getByLabel("a.m. o p.m.").selectOption("pm");

        // Texto largo suficiente para pasar el min_text_length.
        const textoLargo =
            "Este es un reporte de prueba SPEC-295 para verificar que el padre autenticado puede reportar desde su panel. " +
            new Date().toISOString();
        await page.getByPlaceholder("Describe la conducta observada").fill(textoLargo);

        await page.getByRole("button", { name: /Siguiente/i }).click();

        // Paso 4: confirmar y enviar.
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: /Enviar reporte/i }).click();

        // Redirect a /dashboard/padre/mis-reportes (SPEC-295 FR-002).
        await page.waitForURL(/\/dashboard\/padre\/mis-reportes/, { timeout: 10_000 });
        expect(page.url()).toContain("/dashboard/padre/mis-reportes");

        // Verificar en BD: usuarioId != null, origenRol = 'PARENT' y atado a la ficha.
        const reporte = await prisma.reporte.findFirst({
            where: { identificador },
            orderBy: { creadoEn: "desc" },
        });
        expect(reporte, "reporte debe existir en BD").not.toBeNull();
        expect(reporte?.usuarioId, "usuarioId debe estar poblado").not.toBeNull();
        expect(reporte?.origenRol, "origenRol debe ser 'PARENT'").toBe("PARENT");
        expect(reporte?.hijoId, "hijoId debe estar poblado (SPEC-591)").not.toBeNull();
    });
});
