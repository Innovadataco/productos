import { test, expect, type APIRequestContext } from "@playwright/test";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import { prisma } from "@/lib/prisma";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

// SPEC-809: los padres de los tests autenticados se crean por el flujo de ENLACE, NO por el código del
// colegio con `devCode` (ese campo solo llega cuando el correo FALLA al salir → medía una falla del
// mailer, no el registro). El test de OFERTA necesita un padre que PUEDE reportar (crea un hijo), y
// crear un hijo exige el camino (consentimiento+datos): por eso usa `crearPadreOnboarded` (familia), no
// el helper fino `registrarPadre` —medido: un padre recién registrado da 403 en /api/padre/hijos—. El
// helper fino queda para quien solo necesita una CUENTA (password-reset). Ambos van por ENLACE.
const padresCreados: PadreOnboarded[] = [];

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
    test.afterAll(async () => {
        for (const p of padresCreados) await limpiarPadreOnboarded(p);
        padresCreados.length = 0;
    });

    test("usuario anónimo crea un reporte desde el wizard y recibe número de seguimiento", async ({ page, request }) => {
        // Solo paisId: la ciudad se elige por el combobox de búsqueda (abajo), no por id.
        const { paisId } = await obtenerColombiaBogota(request);
        const identificador = `+57300E2E${Date.now()}`;

        await page.goto("/reportar");
        // Paso 1: identificador (rótulo renombrado identificador→cuenta) + plataforma.
        await page.getByLabel("La cuenta (número o usuario)").fill(identificador);
        await expect(page.getByLabel("Plataforma").locator("option[value='whatsapp']")).toBeAttached();
        await page.getByLabel("Plataforma").selectOption("whatsapp");
        await page.getByRole("button", { name: "Siguiente" }).click();

        // Paso 2: país (select) + ciudad (combobox de búsqueda CiudadSearchSelect, SPEC-115, ya no un
        // <select>) + fecha (control custom día + hora 1-12 + a.m./p.m., FechaHoraIncidente, A-74, ya no
        // un input datetime). El endpoint de búsqueda responde (medido): se escribe y se elige del listbox.
        await page.getByLabel("País").selectOption(paisId);
        const ciudad = page.getByRole("combobox", { name: "Ciudad" });
        await expect(ciudad).toBeEnabled();
        await ciudad.fill("Bogotá");
        // Se elige la opción DENTRO del listbox «Resultados de ciudades»: sin acotar, un `option` suelto
        // «Bogotá…» también casa con la opción «Bogotá D.C.» del <select> de Departamento (antes en el
        // DOM) y el click caía ahí (no estable) → timeout. Acotado al listbox, toma la ciudad real.
        await page.getByRole("listbox", { name: "Resultados de ciudades" }).getByRole("option", { name: /Bogotá/i }).first().click();
        await page.getByLabel("Día del incidente").fill("2026-07-10");
        await page.getByLabel("Hora del incidente").selectOption("10");
        await page.getByLabel("a.m. o p.m.").selectOption("am");

        // La descripción vive en el MISMO paso que país/ciudad/fecha (ReporteStepDetalle agrupa todo
        // «Detalles del incidente»); el «Siguiente» queda DESHABILITADO hasta ≥20 chars. Por eso se
        // llena ANTES del único «Siguiente» (antes eran dos pasos y dos «Siguiente»).
        const descripcion = "Este usuario contactó a mi hija ofreciéndole regalos de forma insistente.";
        await page.getByPlaceholder("Describe la conducta observada").fill(descripcion);
        await page.getByRole("button", { name: "Siguiente" }).click();

        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Enviar reporte" }).click();

        // Confirmación: el encabezado cambió de copy («Hemos recibido tu reporte»); se afirma la SEÑAL
        // robusta de éxito —el número RPT y el enlace a seguimiento (por rol)— no la frase.
        await expect(page.getByRole("link", { name: /Ver estado del reporte/i })).toBeVisible();
        await expect(page.getByText(/RPT-[A-Z0-9]+/)).toBeVisible();

        const numero = await page.locator("code").textContent();
        expect(numero).toMatch(/RPT-[A-Z0-9]+/);

        await page.goto(`/seguimiento?numero=${numero}`);
        await expect(page.getByText(/Recibido|En procesamiento|Procesado|En revisión/)).toBeVisible();
        // La escritura NORMALIZA el identificador (lowercase); el seguimiento muestra esa forma. Se afirma
        // la NORMALIZADA, no la cruda tecleada.
        await expect(page.getByText(normalizarIdentificador(identificador))).toBeVisible();
    });

    // SPEC-323 (T008/US1): el 2º reporte del padre recibe oferta, no bloqueo (candado 26).
    test("usuario autenticado recibe oferta de vinculación al reportar el mismo identificador dos veces en 30 días", async ({ request }) => {
        const email = `e2e-parent-${Date.now()}@example.com`;
        const padre = await crearPadreOnboarded({ request, email, password: "TestPass123" });
        padresCreados.push(padre);

        // SPEC-591: el reporte autenticado del padre EXIGE una ficha activa de «A quién protego».
        // `crearPadreOnboarded` ya creó un hijo (Paso 3): se REÚSA (crear uno nuevo acá da 400 —
        // validación/límite de freemium). Viaja en hijoId.
        const hijo = await prisma.hijo.findFirst({ where: { usuarioId: padre.usuarioId }, select: { id: true } });
        expect(hijo, "crearPadreOnboarded debe haber creado un hijo").not.toBeNull();
        const hijoId = hijo!.id;

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
            hijoId,
        };

        const primer = await request.post("/api/reportes", { data: body });
        expect(primer.status()).toBe(201);
        const primerJson = await primer.json();
        expect(primerJson.reporte.id).toBeTruthy();

        // 2º intento sin reportePrevioId → oferta (200), no bloqueo (429).
        const segundo = await request.post("/api/reportes", { data: body });
        expect(segundo.status()).toBe(200);
        const segundoJson = await segundo.json();
        expect(segundoJson.oferta).toBe(true);
        expect(segundoJson.reporteExistenteId).toBe(primerJson.reporte.id);
        expect(segundoJson.identificador).toBe(identificador);
    });

    // Contrato VIGENTE (medido · SPEC-808 reescribe el comentario del producto): el anónimo NO se
    // bloquea al reportar el mismo identificador dos veces. El dedup DUPLICATE_REPORT es
    // AUTENTICADO-ONLY a propósito (reporte-creation.ts: `if (usuarioId)`): para un anónimo no hay
    // «vos», así que dos reportes del mismo identificador son indistinguibles de DOS personas distintas
    // reportando la misma cuenta — justo la señal que el producto existe para recoger. Bloquearlo
    // suprimiría el dato. Antes este test exigía 429 DUPLICATE_REPORT (contrato RETIRADO).
    // NOTA (nivel-mal): el 2º reporte queda marcado soft POSIBLE_SPAM/REVISION_MANUAL
    // (report_identificador soft), pero ese marcado lo apaga DISABLE_RATE_LIMIT en e2e → esa mitad se
    // cubre en unit/integración (donde se controla el límite soft), no en este recorrido.
    test("usuario anónimo NO es bloqueado al reportar el mismo identificador dos veces (son señal, no duplicado)", async ({ request }) => {
        const { paisId, ciudadId } = await obtenerColombiaBogota(request);
        const identificador = `+57300ANON${Date.now()}`;

        const body = {
            identificador,
            plataforma: "whatsapp",
            texto: "Contacto sospechoso con menores.",
            fechaIncidente: "2026-07-10T10:00:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId,
            ciudadId,
        };

        const primer = await request.post("/api/reportes", { data: body });
        expect(primer.status()).toBe(201);

        // El 2º reporte anónimo del MISMO identificador ENTRA (201), no se bloquea.
        const segundo = await request.post("/api/reportes", { data: body });
        expect(segundo.status()).toBe(201);
    });
});
