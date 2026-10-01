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
import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

const padresCreados: PadreOnboarded[] = [];

test.describe("SPEC-295 · padre autenticado puede reportar (I-146)", () => {
    test.afterAll(async () => {
        for (const p of padresCreados) await limpiarPadreOnboarded(p);
        padresCreados.length = 0;
    });

    test("PARENT logueado → /dashboard/padre/reportar → envía → BD origenRol=PARENT", async ({
        page,
        request,
    }) => {
        const email = `padre-spec295-${Date.now()}@example.com`;
        // SPEC-809: el padre se crea por el flujo de ENLACE (crearPadreOnboarded), NO por el código con
        // devCode (que solo llega si el correo FALLA al salir). crearPadreOnboarded hace registro por
        // enlace + consentimiento + datos + hijo + freemium: el wizard de reporte deja avanzar y el paso
        // «¿A quién va dirigido?» ya tiene la ficha del onboarding («Menor E2E»).
        // Se usa `page.request` (NO el fixture `request`): comparte las cookies del navegador, así la
        // `page` queda AUTENTICADA y /dashboard/padre/reportar no rebota a login.
        const padre = await crearPadreOnboarded({ request: page.request, email, password: "TestPass123" });
        padresCreados.push(padre);

        // Ir a la página real del padre.
        const respuesta = await page.goto("/dashboard/padre/reportar", { waitUntil: "commit" });
        expect(respuesta?.status(), "página debe cargar sin redirect").toBe(200);

        // Formulario real (no PlaceholderPadre).
        await expect(page.getByText("Reportar una situación")).toBeVisible();

        // Paso 1 (SPEC-591): elegir la ficha del menor protegido (la que creó crearPadreOnboarded).
        await page.getByRole("option", { name: /Menor E2E/ }).click();
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
        // Se acota al listbox «Resultados de ciudades»: sin acotar, un `option` suelto «Bogotá…» también
        // casa con la opción «Bogotá D.C.» del <select> de Departamento (strict-mode violation).
        const opcionBogota = page.getByRole("listbox", { name: "Resultados de ciudades" }).getByRole("option", { name: /Bogotá/i });
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

        // Tras enviar, el padre aterriza en /mis-reportes (antes /dashboard/padre/mis-reportes; la ruta
        // se acortó). Se afirma el pathname exacto.
        await page.waitForURL(/\/mis-reportes/, { timeout: 10_000 });
        expect(new URL(page.url()).pathname).toBe("/mis-reportes");

        // Verificar en BD: usuarioId != null, origenRol = 'PARENT' y atado a la ficha.
        // La escritura NORMALIZA el identificador (lowercase); se consulta por la forma normalizada, no
        // por el valor crudo tecleado (si no, findFirst no lo encuentra).
        const reporte = await prisma.reporte.findFirst({
            where: { identificador: normalizarIdentificador(identificador) },
            orderBy: { creadoEn: "desc" },
        });
        expect(reporte, "reporte debe existir en BD").not.toBeNull();
        expect(reporte?.usuarioId, "usuarioId debe estar poblado").not.toBeNull();
        expect(reporte?.origenRol, "origenRol debe ser 'PARENT'").toBe("PARENT");
        expect(reporte?.hijoId, "hijoId debe estar poblado (SPEC-591)").not.toBeNull();
    });
});
