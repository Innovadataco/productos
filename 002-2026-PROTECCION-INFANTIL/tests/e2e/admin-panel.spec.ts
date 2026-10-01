import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

const ADMIN_EMAIL = "admin@proteccion.local";
const ADMIN_PASSWORD = "Admin123!Secure";

async function asegurarAdmin() {
    try {
        await prisma.usuario.upsert({
            where: { email: ADMIN_EMAIL },
            update: {},
            create: {
                email: ADMIN_EMAIL,
                nombre: "Administrador E2E",
                passwordHash: await hashPassword(ADMIN_PASSWORD),
                rol: "ADMIN",
                estado: "activo",
            },
        });
    } catch (error) {
        // Race condition tolerada: otro worker paralelo ya creó el admin
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes("Unique constraint")) {
            throw error;
        }
    }
}

async function obtenerPlataformaWhatsApp() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");
    return plataforma;
}

async function crearReporteAdmin(estado: EstadoReporte, categoria: CategoriaConducta, opciones: { contienePii?: boolean; esAnonimo?: boolean; identificador?: string } = {}) {
    const plataforma = await obtenerPlataformaWhatsApp();
    const identificador = opciones.identificador || `+57300ADMIN${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const numeroSeguimiento = `RPT-ADM-${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 8)}`;

    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "Texto de prueba para panel de administración con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: opciones.esAnonimo ?? true,
            numeroSeguimiento,
            estado,
        },
    });

    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.85,
            contienePii: opciones.contienePii ?? false,
            piiDetectada: opciones.contienePii ? ["dato"] : [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });

    return { reporte, plataforma };
}

async function loginAdmin(page: import("@playwright/test").Page) {
    const res = await page.request.post("/api/auth/login", {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    await page.goto("/dashboard/admin");
}

test.describe("Panel de administración", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
    });

    // Limpieza: esta suite siembra reportes (RPT-ADM-*) y un usuario «denegado» por corrida. Sin esto
    // la BD acumula entre corridas y, con el patrón de cascada de esta suite, un residuo viejo se
    // diagnostica como defecto nuevo. El admin es un fixture upsert estable: no se borra.
    test.afterAll(async () => {
        const reportes = await prisma.reporte.findMany({
            where: { numeroSeguimiento: { startsWith: "RPT-ADM-" } },
            select: { id: true },
        });
        const ids = reportes.map((r) => r.id);
        if (ids.length > 0) {
            await prisma.clasificacionIA.deleteMany({ where: { reporteId: { in: ids } } }).catch(() => undefined);
            await prisma.reporte.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
        }
        await prisma.usuario.deleteMany({ where: { email: { startsWith: "e2e-admin-denied-" } } }).catch(() => undefined);
    });
    test("admin puede iniciar sesión y ver la bandeja de reportes", async ({ page }) => {
        await loginAdmin(page);
        // SPEC-404 (I-290): la bandeja tiene URL propia `/dashboard/admin/bandeja`; la raíz
        // `/dashboard/admin` ahora redirige a Inicio si el admin tiene el módulo inicio_admin.
        await page.goto("/dashboard/admin/bandeja");

        await expect(page.getByRole("heading", { name: "Bandeja de reportes" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Aplicar filtros" })).toBeVisible();
        await expect(page.locator("table")).toBeVisible();
    });

    test("admin puede filtrar reportes por estado", async ({ page }) => {
        const { reporte } = await crearReporteAdmin("REVISION_MANUAL", "OFRECIMIENTO_REGALOS");
        await crearReporteAdmin("POSIBLE_SPAM", "OTRO");

        await loginAdmin(page);
        await page.goto("/dashboard/admin/bandeja"); // SPEC-404 (I-290): URL propia de la bandeja

        await page.getByLabel("Estado").selectOption("REVISION_MANUAL");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();

        await expect(page.getByText(reporte.numeroSeguimiento!)).toBeVisible();
        await expect(page.getByText("POSIBLE_SPAM")).not.toBeVisible();
    });

    test("admin puede corregir la clasificación de un reporte", async ({ page }) => {
        const { reporte } = await crearReporteAdmin("CLASIFICADO", "OFRECIMIENTO_REGALOS");

        await loginAdmin(page);
        await page.goto("/dashboard/admin/bandeja"); // SPEC-404 (I-290): URL propia de la bandeja

        await page.getByLabel("Estado").selectOption("CLASIFICADO");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();

        const fila = page.locator("tr", { hasText: reporte.numeroSeguimiento! });
        await fila.getByRole("button", { name: "Ver detalle" }).click();

        const modal = page.locator("div").filter({ hasText: "Detalle del reporte" }).first();
        await expect(modal).toBeVisible();

        const selectCorreccion = page.getByTestId("select-correccion-categoria");
        await selectCorreccion.selectOption("SUPLANTACION_IDENTIDAD");
        await expect(selectCorreccion).toHaveValue("SUPLANTACION_IDENTIDAD");
        await page.getByRole("button", { name: "Corregir clasificación" }).click();

        await expect(page.getByText("Clasificación corregida correctamente")).toBeVisible();
        await expect(page.getByText("Corrección registrada")).toBeVisible();
        await expect(page.getByText("Categoría corregida: Suplantación de identidad")).toBeVisible();

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CORREGIDO");
    });

    /**
     * SPEC-807 (CERRADO · se retiró el `fixme` — SPEC-820): la anonimización se ABORTABA cuando Ollama
     * estaba AUSENTE bajo la carga del suite — y «Ollama ausente» es un estado REAL de producción (Ollama
     * remoto en una Mac que puede dormir / reiniciarse / perder el túnel), no un artefacto del entorno.
     * SPEC-807 (#802) hizo robusto el camino sin-Ollama: el best-effort del dataset NO bloquea la
     * petición y distingue transporte de rechazo, así que el PATCH /anonimizar ya no queda sin respuesta
     * ni escupe `Error: aborted`. CRITERIO DE SALIDA CUMPLIDO (las pruebas DEBEN pasar con Ollama ausente,
     * sin stub — decisión CEO): se quita el `fixme`. El cuerpo afirma el EFECTO (la fila sale del filtro +
     * la BD queda CLASIFICADO) y debe quedar verde.
     */
    test("admin puede anonimizar manualmente un reporte con PII", async ({ page }) => {
        const { reporte } = await crearReporteAdmin("REQUIERE_ANONIMIZACION", "OFRECIMIENTO_REGALOS", { contienePii: true });

        await loginAdmin(page);
        await page.goto("/dashboard/admin/bandeja"); // SPEC-404 (I-290): URL propia de la bandeja

        await page.getByLabel("Estado").selectOption("REQUIERE_ANONIMIZACION");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();

        const fila = page.locator("tr", { hasText: reporte.numeroSeguimiento! });
        await fila.getByRole("button", { name: "Ver detalle" }).click();

        // El textarea de la sección «Anonimizar reporte» (AccionesReporte) no tiene id/label; se ancla
        // por el ENCABEZADO de la sección (hermano directo), no por su valor pre-cargado: un textarea
        // CONTROLADO no expone su `value` como texto del DOM, por eso el filtro por hasText no casaba.
        const textarea = page.getByRole("heading", { name: "Anonimizar reporte" }).locator("xpath=following-sibling::textarea");
        await textarea.fill("Texto anonimizado de prueba con suficientes caracteres para superar el mínimo.");
        // Asegura que el textarea CONTROLADO recibió el valor (React actualizó su estado) antes de enviar.
        await expect(textarea).toHaveValue(/Texto anonimizado de prueba/);

        // Se espera la RESPUESTA real del endpoint (diagnóstico + robustez): si la UI no dispara el
        // PATCH, waitForResponse revienta claro; si responde ≠200, se ve el estado real, no un timeout
        // genérico de "la fila no se fue".
        const [resp] = await Promise.all([
            page.waitForResponse((r) => r.url().includes(`/api/admin/reportes/${reporte.id}/anonimizar`) && r.request().method() === "PATCH"),
            page.getByRole("button", { name: "Confirmar anonimización" }).click(),
        ]);
        expect(resp.status(), "la anonimización debe responder 200").toBe(200);

        // EFECTO (behavior, más fuerte que el toast transitorio): el reporte queda CLASIFICADO.
        await expect
            .poll(async () => (await prisma.reporte.findUnique({ where: { id: reporte.id }, select: { estado: true } }))?.estado, {
                message: "el reporte debe quedar CLASIFICADO tras anonimizar",
            })
            .toBe("CLASIFICADO");
    });

    test("admin ve métricas de la cola de procesamiento en el dashboard", async ({ page }) => {
        await loginAdmin(page);
        await page.goto("/dashboard/admin/estadisticas");

        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
        // La página de estadísticas pinta las métricas de la cola en DOS lugares (la sección del
        // AdminDashboard y el WidgetCola de monitoreo): «Cola de procesamiento», «En cola»,
        // «Estancados»… aparecen 2 veces. Se ancla a la SECCIÓN del dashboard por su id
        // (aria-labelledby="worker-title") y se afirman las métricas DENTRO de ella — robusto al
        // segundo widget y al copy (antes rompía por strict-mode al haber 2 coincidencias).
        const seccionCola = page.locator('section[aria-labelledby="worker-title"]');
        await expect(seccionCola).toBeVisible();
        await expect(seccionCola.getByText("En cola")).toBeVisible();
        await expect(seccionCola.getByText("Estancados")).toBeVisible();
        await expect(seccionCola.getByText("Latencia promedio (ms)")).toBeVisible();
        await expect(seccionCola.getByText("Tasa de éxito")).toBeVisible();
    });

    test("usuario no-admin no puede acceder al panel admin", async ({ page }) => {
        const email = `e2e-admin-denied-${crypto.randomUUID()}@example.com`;
        await prisma.usuario.create({
            data: {
                email,
                nombre: "Usuario Denegado",
                passwordHash: await hashPassword("TestPass123"),
                rol: "PARENT",
                estado: "activo",
            },
        });

        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill("TestPass123");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();

        await expect(page).toHaveURL(/\/(mis-reportes)?/);

        await page.goto("/dashboard/admin");
        await expect(page).not.toHaveURL("/dashboard/admin");
    });
});
