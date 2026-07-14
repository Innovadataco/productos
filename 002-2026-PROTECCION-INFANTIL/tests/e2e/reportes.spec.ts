import { test, expect, type APIRequestContext } from "@playwright/test";

async function registrarUsuario(
    request: APIRequestContext,
    email: string,
    password: string,
    nombre: string
) {
    const solicitar = await request.post("/api/auth/verificar/solicitar", {
        data: { email },
    });
    expect(solicitar.status()).toBe(202);
    const { devCode } = await solicitar.json();
    expect(devCode).toBeDefined();

    const validar = await request.post("/api/auth/verificar/validar", {
        data: { email, codigo: devCode },
    });
    expect(validar.status()).toBe(200);
    const { token } = await validar.json();

    const completar = await request.post("/api/auth/verificar/completar", {
        data: { token, password, nombre },
    });
    expect(completar.status()).toBe(201);

    const login = await request.post("/api/auth/login", {
        data: { email, password },
    });
    expect(login.status()).toBe(200);
}

async function obtenerColombiaBogota(request: APIRequestContext) {
    const paisesRes = await request.get("/api/paises");
    const paisesBody = await paisesRes.json();
    const colombia = paisesBody.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
    expect(colombia).toBeDefined();

    const ciudadesRes = await request.get(`/api/ciudades?paisId=${colombia.id}`);
    const ciudadesBody = await ciudadesRes.json();
    const bogota = ciudadesBody.ciudades.find((c: { nombre: string }) => c.nombre === "Bogotá");
    expect(bogota).toBeDefined();

    return { paisId: colombia.id, ciudadId: bogota.id };
}

test.describe("Flujo de reportes comunitarios", () => {
    test("usuario anónimo crea un reporte desde el wizard y recibe número de seguimiento", async ({ page, request }) => {
        const { paisId, ciudadId } = await obtenerColombiaBogota(request);
        const identificador = `+57300E2E${Date.now()}`;

        await page.goto("/reportar");
        await page.getByLabel("Número, nick o usuario").fill(identificador);
        await expect(page.getByLabel("Plataforma").locator("option[value='whatsapp']")).toBeAttached();
        await page.getByLabel("Plataforma").selectOption("whatsapp");
        await page.getByRole("button", { name: "Siguiente" }).click();

        await page.getByLabel("País").selectOption(paisId);
        await page.getByLabel("Ciudad").selectOption(ciudadId);
        await page.getByLabel("Fecha del incidente").fill("2026-07-10");
        await page.getByRole("button", { name: "Siguiente" }).click();

        const descripcion = "Este usuario contactó a mi hija ofreciéndole regalos de forma insistente.";
        await page.getByPlaceholder("Describe la conducta observada").fill(descripcion);
        await page.getByRole("button", { name: "Siguiente" }).click();

        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Enviar reporte" }).click();

        await expect(page.getByText("Reporte recibido")).toBeVisible();
        await expect(page.getByText(/RPT-[A-Z0-9]+/)).toBeVisible();

        const numero = await page.locator("code").textContent();
        expect(numero).toMatch(/RPT-[A-Z0-9]+/);

        await page.goto(`/seguimiento?numero=${numero}`);
        await expect(page.getByText("Recibido")).toBeVisible();
        await expect(page.getByText(identificador)).toBeVisible();
    });

    test("usuario autenticado no puede reportar el mismo identificador dos veces en 30 días", async ({ request }) => {
        const email = `e2e-parent-${Date.now()}@example.com`;
        await registrarUsuario(request, email, "TestPass123", "Parent E2E");

        const { paisId, ciudadId } = await obtenerColombiaBogota(request);
        const identificador = `+57300DUP${Date.now()}`;

        const body = {
            identificador,
            plataforma: "whatsapp",
            texto: "Usuario sospechoso contactando a menores.",
            fechaIncidente: "2026-07-10T10:00:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId,
            ciudadId,
        };

        const primer = await request.post("/api/reportes", { data: body });
        expect(primer.status()).toBe(201);

        const segundo = await request.post("/api/reportes", { data: body });
        expect(segundo.status()).toBe(429);
        const json = await segundo.json();
        expect(json.error.code).toBe("DUPLICATE_REPORT");
        expect(json.error.message).toContain("Ya reportaste este identificador");
    });
});
