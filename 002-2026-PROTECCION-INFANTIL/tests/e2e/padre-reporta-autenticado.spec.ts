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
        // FK-safe: los reportes del padre (el de SPEC-295 y el previo de SPEC-808) se borran ANTES
        // de que limpiarPadreOnboarded borre su hijo (reporte.hijoId) y su usuario.
        const ids = padresCreados.map((p) => p.usuarioId);
        if (ids.length > 0) {
            await prisma.reporte.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
        }
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

    /**
     * SPEC-808 (extensión de Calidad) · el PADRE que reporta un DUPLICADO recibe la TARJETA de
     * vinculación (la «oferta» 200), NO una acusación. El dedup autenticado (mismo usuario +
     * identificador en 30 d) existe SOLO para el autenticado; al PARENT le devuelve 200 con la oferta
     * (al no-PARENT, 429; al anónimo nunca —dos personas reportando la misma cuenta es la señal que el
     * producto recoge—). Se camina la tarjeta: el mensaje NO acusa, están las TRES salidas, y «Ver mi
     * reporte» LLEVA al reporte real (owner-gated, muestra ESE reporte) — la exigencia del CEO: una
     * salida que no lleva a ningún lado es peor que una salida menos.
     *
     * Es el camino del PADRE (0,24% de los reportes; el 99,76% anónimo NO pasa por acá). El reporte
     * PREVIO se siembra por el endpoint real como el padre (no por Prisma) para que el dedup real lo vea.
     */
    test("PARENT reporta un DUPLICADO → tarjeta de vinculación sin acusación, y «Ver mi reporte» lleva al reporte real (SPEC-808)", async ({
        page,
        request,
    }) => {
        const email = `padre-spec808-${Date.now()}@example.com`;
        const padre = await crearPadreOnboarded({ request: page.request, email, password: "TestPass123" });
        padresCreados.push(padre);

        // Reporte PREVIO (A): por el endpoint real, como el padre (page.request comparte la sesión del
        // navegador). El dedup autenticado lo encontrará cuando el wizard envíe el mismo identificador.
        const identificador = `+57300DUP${Date.now()}`;
        const hijo = await prisma.hijo.findFirst({ where: { usuarioId: padre.usuarioId }, select: { id: true } });
        expect(hijo, "el onboarding dejó una ficha de menor").not.toBeNull();
        const ciudad = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá" }, select: { id: true, nombre: true, paisId: true } });
        expect(ciudad, "la BD de prueba tiene Bogotá").not.toBeNull();
        const pais = await prisma.pais.findUnique({ where: { id: ciudad!.paisId }, select: { nombre: true } });

        const previo = await page.request.post("/api/reportes", {
            data: {
                identificador,
                plataforma: "whatsapp",
                texto: "Reporte PREVIO SPEC-808 del padre, con texto suficiente para pasar el mínimo del parámetro.",
                fechaIncidente: "2026-07-10T15:00:00.000Z",
                ciudad: ciudad!.nombre,
                pais: pais?.nombre ?? "Colombia",
                ciudadId: ciudad!.id,
                paisId: ciudad!.paisId,
                hijoId: hijo!.id,
            },
        });
        expect(previo.status(), `reporte previo (A) body=${(await previo.text().catch(() => "")).slice(0, 220)}`).toBeLessThan(300);

        const reporteA = await prisma.reporte.findFirst({
            where: { identificador: normalizarIdentificador(identificador), usuarioId: padre.usuarioId },
            orderBy: { creadoEn: "desc" },
            select: { id: true, numeroSeguimiento: true },
        });
        expect(reporteA, "el reporte previo quedó en BD").not.toBeNull();

        // El padre envía un DUPLICADO por el wizard REAL (mismo identificador, misma ficha).
        await page.goto("/dashboard/padre/reportar", { waitUntil: "commit" });
        await expect(page.getByText("Reportar una situación")).toBeVisible();
        await page.getByRole("option", { name: /Menor E2E/ }).click();
        await page.getByRole("button", { name: /Siguiente/i }).click();
        await page.getByLabel(/La cuenta/i).fill(identificador);
        await page.getByLabel("Plataforma").first().selectOption({ label: "WhatsApp" });
        await page.getByRole("button", { name: /Siguiente/i }).click();
        const paises = await request.get("/api/paises");
        const colombia = (await paises.json()).paises.find((p: { nombre: string }) => p.nombre === "Colombia");
        expect(colombia).toBeDefined();
        await page.getByLabel("País").selectOption(colombia.id);
        await page.getByLabel("Ciudad").fill("Bogotá");
        await page.getByRole("listbox", { name: "Resultados de ciudades" }).getByRole("option", { name: /Bogotá/i }).click();
        await page.getByLabel("Día del incidente").fill("2026-07-10");
        await page.getByLabel("Hora del incidente").selectOption("3");
        await page.getByLabel("a.m. o p.m.").selectOption("pm");
        await page
            .getByPlaceholder("Describe la conducta observada")
            .fill("Reporte DUPLICADO SPEC-808: mismo identificador — debe disparar la oferta de vinculación. " + new Date().toISOString());
        await page.getByRole("button", { name: /Siguiente/i }).click();
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: /Enviar reporte/i }).click();

        // La TARJETA de vinculación (oferta), NO el aterrizaje en /mis-reportes.
        await expect(page.getByText("Ya tienes un reporte sobre esta cuenta"), "se pinta la tarjeta de vinculación tras la oferta").toBeVisible();
        // El mensaje NO acusa: la vieja cadena que reprochaba el acto repetido NO aparece.
        await expect(page.getByText(/Ya reportaste este identificador/i), "SPEC-808: el mensaje NO acusa del acto repetido").toHaveCount(0);
        // Las TRES salidas existen (ninguna es un callejón).
        await expect(page.getByRole("button", { name: /Sumar algo nuevo/i }), "salida «Sumar»").toBeVisible();
        const verMiReporte = page.getByRole("link", { name: /Ver mi reporte/i });
        await expect(verMiReporte, "salida «Ver mi reporte»").toBeVisible();
        await expect(page.getByRole("link", { name: /^Listo$/i }), "salida «Listo»").toBeVisible();
        // «Ver mi reporte» apunta al reporte REAL (owner-gated), no a un callejón.
        await expect(verMiReporte, "«Ver mi reporte» enlaza al reporte previo concreto").toHaveAttribute(
            "href",
            `/dashboard/mis-reportes/${reporteA!.id}`,
        );

        // Y LLEVA de verdad a una pantalla que muestra ESE reporte.
        await verMiReporte.click();
        await page.waitForURL(new RegExp(`mis-reportes/${reporteA!.id}`), { timeout: 10_000 });
        expect(new URL(page.url()).pathname, "la URL final apunta al reporte previo").toContain(reporteA!.id);
        expect(reporteA!.numeroSeguimiento, "el reporte previo tiene número de seguimiento").toBeTruthy();
        await expect(
            page.getByText(reporteA!.numeroSeguimiento!),
            "la pantalla muestra ESE reporte (su número de seguimiento), no un callejón",
        ).toBeVisible();
    });
});
