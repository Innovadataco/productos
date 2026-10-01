/**
 * SPEC-340 (A-68 · T036) — el hilo del padre, de punta a punta, a 390px.
 *
 * El §6 del brief: reportar con día y hora → la tarjeta de la cadena → evento
 * con campos fijos → crear el expediente por botón → PDF con sello → nada se
 * cierra nunca. La evidencia final la saca el CEO; esto impide regresiones.
 */
import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

test.use({ viewport: { width: 390, height: 844 } });

const PASSWORD = "Padre123!Seguro";

let secuencia = 0;
function emailUnico(): string {
    secuencia += 1;
    return `hilo-e2e-${Date.now()}-${secuencia}@proteccion.local`;
}

/** Padre con el camino de A-67 TERMINADO (para llegar a los módulos). */
async function crearPadreCompleto(email: string) {
    const pais = await prisma.pais.findFirstOrThrow();
    const ciudad = await prisma.ciudad.findFirstOrThrow();
    const version = await prisma.parametroSistema.findUnique({ where: { clave: "consentimiento.version_actual" } });
    const padre = await prisma.usuario.create({
        data: {
            email,
            passwordHash: await hashPassword(PASSWORD),
            rol: "PARENT",
            estado: "activo",
            nombre: "Padre",
            apellidos: "Del Hilo",
            documentoTipo: "CC",
            documentoNumero: `79${Date.now() % 100000000}`,
            telefono: "+57 300 555 0101",
            paisId: pais.id,
            ciudadId: ciudad.id,
            consentimientoAceptadoEn: new Date(),
            consentimientoVersion: version?.valor ?? "1.0",
        },
    });
    // SPEC-591: el reporte autenticado del padre EXIGE una ficha activa de
    // «A quién protego» — el setup ya la crea; solo falta devolver su id.
    const hijo = await prisma.hijo.create({
        data: {
            usuarioId: padre.id,
            nombre: "Menor",
            apellidos: "Del Hilo",
            estado: "activo",
        },
    });
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });
    const plan = await prisma.plan.findFirst({ where: { esFreemium: true } });
    if (plan) {
        await prisma.suscripcion.create({
            data: {
                tipoTitular: "PADRE",
                usuarioId: padre.id,
                estado: "ACTIVA",
                planActualId: plan.id,
                fechaInicio: new Date(),
                fechaFin: new Date(Date.now() + 30 * 86400000),
                codigoReferidoPropio: `hilo-${Date.now()}-${secuencia}`,
                esFreemium: true,
            },
        });
    }
    void admin;
    return { padre, hijoId: hijo.id };
}

async function login(page: Page, email: string) {
    const res = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status()).toBe(200);
}

async function reportar(page: Page, identificador: string, hijoId: string) {
    const res = await page.request.post("/api/reportes", {
        data: {
            identificador,
            plataforma: "whatsapp",
            texto: "Un adulto contacta a la menor con insistencia pidiendo fotos personales cada noche.",
            fechaIncidente: "2026-08-25T21:30:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
            // SPEC-591: el reporte autenticado del padre va atado a una ficha activa.
            hijoId,
        },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).reporte.id as string;
}

test.describe("SPEC-340 · Mis reportes y el expediente", () => {
    test("la tarjeta de la cadena: contadores, evento con campos fijos y texto tapado", async ({ page }) => {
        const email = emailUnico();
        const { padre, hijoId } = await crearPadreCompleto(email);
        await login(page, email);
        const r1 = await reportar(page, `+5730055${Date.now() % 100000}`, hijoId);

        // Evento por la ruta con herencia.
        const resEv = await page.request.post(`/api/reportes/${r1}/evento`, {
            data: { texto: "Volvió a escribirle desde otra cuenta nueva, ya con amenazas.", fechaIncidente: "2026-08-27T22:15:00Z" },
        });
        expect(resEv.status()).toBe(201);

        await page.goto("/mis-reportes");
        await expect(page.getByText(/2 eventos tuyos/)).toBeVisible();

        // El texto NO está en el HTML (viaja solo con step-up).
        const html = await page.content();
        expect(html).not.toContain("insistencia pidiendo fotos");

        await page.getByRole("button", { name: /Ver los eventos/i }).first().click();
        await expect(page.getByText(/Revelar texto/).first()).toBeVisible();
        await expect(page.getByText(/Agregar otro evento/i).first()).toBeVisible();
        expect(padre.id).toBeTruthy();
    });

    test("el expediente se abre desde el botón y muestra la historia + informes", async ({ page }) => {
        const email = emailUnico();
        const { hijoId } = await crearPadreCompleto(email);
        await login(page, email);
        const r1 = await reportar(page, `+5730066${Date.now() % 100000}`, hijoId);

        // SPEC-604: el expediente YA nació con el PRIMER reporte del padre (en POST /api/reportes, misma
        // tx) — ya no nace en este botón. Por eso este POST es IDEMPOTENTE: devuelve 200 (ya existe) en
        // vez de 201 (creado). Se aceptan ambos: el contrato es «existe el expediente de esta cadena»,
        // no el código de estado (antes exigía 201 y rompía con el cambio de SPEC-604).
        const resExp = await page.request.post("/api/padre/expedientes", { data: { reportePrincipalId: r1 } });
        expect([200, 201]).toContain(resExp.status());
        const { expedienteId } = await resExp.json();

        await page.goto(`/dashboard/padre/expedientes/${expedienteId}`);
        // SPEC-605 (pantalla madre del expediente, ExpedienteMadreClient): la página se rediseñó en 5
        // bloques. El copy viejo («hecho documentado», «siempre abierto», «La historia, en orden»,
        // «Reproducir la historia», «Generar informe») y el listado «Informe #N» se RETIRARON. Se afirman
        // anclas robustas del rediseño: el bloque de la línea de tiempo (por id) y el botón de descarga.
        await expect(page.locator("#bloque-timeline")).toBeVisible();
        // El informe es un enlace <a> al endpoint PDF (SPEC-738, descarga directa), no un botón: se
        // ancla por el HREF (robusto al copy), no por el rótulo.
        await expect(page.locator('a[href$="/pdf"]')).toBeVisible();

        // Prohibidos (brief §1 · presunción de inocencia): sin cerrar/resuelto/puntaje.
        const cuerpo = (await page.textContent("body")) ?? "";
        expect(cuerpo).not.toMatch(/\bresuelto\b/i);
        expect(cuerpo).not.toMatch(/caso terminado/i);

        // El PDF con sello se genera y queda REGISTRADO (InformePadre.numeroSecuencial=1) — ésa es la
        // prueba de conducta, no un listado «Informe #1» en pantalla (retirado en el rediseño SPEC-605).
        const resPdf = await page.request.get(`/api/padre/expedientes/${expedienteId}/pdf`);
        expect(resPdf.status()).toBe(200);
        const registro = await prisma.informePadre.findFirst({ where: { expedienteId } });
        expect(registro?.numeroSecuencial).toBe(1);
    });

    test("390px: sin desborde horizontal en Mis reportes ni en el expediente", async ({ page }) => {
        const email = emailUnico();
        const { hijoId } = await crearPadreCompleto(email);
        await login(page, email);
        const r1 = await reportar(page, `+5730077${Date.now() % 100000}`, hijoId);
        const { expedienteId } = await (await page.request.post("/api/padre/expedientes", { data: { reportePrincipalId: r1 } })).json();

        for (const ruta of ["/mis-reportes", `/dashboard/padre/expedientes/${expedienteId}`]) {
            await page.goto(ruta);
            const desborde = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            );
            expect(desborde, `${ruta} desborda ${desborde}px`).toBeLessThanOrEqual(0);
        }
    });
});
