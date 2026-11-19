/**
 * SPEC-928 (Calidad) · JOURNEY CORE #4 — profesional y citas, POR LA PANTALLA de los tres roles.
 *
 * El ciclo por API ya lo cubre `recorrido-ciclo-cita-padre.spec.ts` (SPEC-447). Este journey lo
 * camina por la UI, que es donde el usuario puede quedarse trabado aunque la API responda bien:
 *   (1) PROFESIONAL visible por su camino real (fixture SPEC-775: registro → perfil → documentos →
 *       autorización → aprobación con checklist), con una franja +7 días publicada.
 *   (2) PADRE onboarded (fixture) lo encuentra en el DIRECTORIO y abre su ficha. La ficha no
 *       muestra el teléfono ni el correo del profesional (H-2).
 *   (3) Sin presentación, la reserva está BLOQUEADA y la pantalla manda a «Mi perfil»; con la
 *       presentación guardada (`PATCH /api/padre/perfil`, el endpoint de Mi perfil), el padre
 *       elige una franja de la rejilla, «Solicitar la cita» → modal «Confirmar solicitud» →
 *       queda en su panel de la cita: «Pendiente de pago» (SIN_CONFIRMAR).
 *   (4) El PROFESIONAL ve la solicitud en su panel, SIN botón «Confirmar» mientras el pago no
 *       está aprobado (SPEC «SolicitudAcciones»: los botones solo en PAGADA_PENDIENTE).
 *   (5) PAGO — PUENTE DECLARADO: la pasarela no está conectada («Tu pago está en proceso de
 *       validación»); hoy lo aprueba un ADMIN (`POST /api/admin/pagos/cita/[id]/activar`). El journey
 *       usa el admin efímero del fixture para eso. → PAGADA_PENDIENTE; el padre ve «Esperando
 *       confirmación del profesional».
 *   (6) El profesional pulsa «Confirmar» en su panel → CONFIRMADA; el padre ve «Cita confirmada».
 *       Tras confirmar, el contacto del profesional SIGUE sin viajar al padre (SPEC-754).
 *
 * CONTROLES:
 *   - «Solicitar la cita» deshabilitado sin presentación y sin franja elegida.
 *   - Sin «Confirmar» para el profesional antes del pago.
 *   - H-2 / SPEC-754: el teléfono y el correo del profesional no aparecen en NINGUNA pantalla del
 *     padre (ficha, panel de espera, panel confirmado).
 *   - Montos contra la BD: `montoConsulta` = precio estándar del parámetro (SPEC-428). I-450 RESUELTO por
 *     SPEC-934: el modal y el panel muestran el TOTAL = `montoTotal` (precio estándar + servicio de la red),
 *     con «Total a pagar» como cifra grande (`[data-testid="desglose-total"]`). El rótulo del panel sigue el
 *     estado del pago (SPEC-934 `etiquetaMontoCita`): pendiente «Total a pagar» / aprobado «Monto pagado».
 *
 * AISLAMIENTO. Corrida por `randomUUID`. Escrituras por UI/endpoints reales; Prisma solo LEE (más el
 * admin efímero que crea el fixture). Limpieza en `afterAll` que AFIRMA que no quedan las cuentas.
 * Arnés con guardia SPEC-770 (BD `*_test`); NUNCA contra prod.
 */
import { test, expect, request as playwrightRequest, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";

const CORRIDA = `e2e-928-${randomUUID().slice(0, 8)}`;
const PASSWORD_PROF = "ProfSpec928!Secure";
const PASSWORD_PADRE = "TestPass123";
const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const TELEFONO_PROF = "3009280928";
const PRESENTACION = `Corrida ${CORRIDA}: mi hija de 12 años recibe mensajes de un adulto que no conocemos.`;

let profesional: ProfesionalVisible | null = null;
let padre: PadreOnboarded | null = null;

function baseURL(): string {
    return test.info().project.use.baseURL ?? "http://localhost:5005";
}

/** Solo los dígitos de una cifra en pantalla («$ 55.000» → "55000"). */
function digitos(texto: string): string {
    return texto.replace(/\D/g, "");
}

test.describe.serial("SPEC-928 · journey core #4: el padre agenda con un profesional y la cita se confirma (UI de los 3 roles)", () => {
    test.afterAll(async () => {
        const usuarios = [...(profesional?._limpieza.usuarios ?? []), ...(padre?._limpieza.usuarios ?? [])];
        if (profesional) await limpiarProfesionalVisible(profesional);
        if (padre) await limpiarPadreOnboarded(padre);
        const vivos = usuarios.length ? await prisma.usuario.count({ where: { id: { in: usuarios } } }) : 0;
        expect(vivos, "limpieza: no quedan cuentas de la corrida (profesional, admin, padre)").toBe(0);
        profesional = null;
        padre = null;
    });

    test("directorio → ficha → reserva → pago → el profesional confirma → el padre ve la cita confirmada", async ({ page, browser }) => {
        test.setTimeout(240_000);
        let profCtx: BrowserContext | null = null;
        try {
            profCtx = await browser.newContext({ baseURL: baseURL() });

            const prof = await test.step("1 · profesional visible por su camino real, con una franja publicada", async () => {
                const p = await crearProfesionalVisible({
                    request: profCtx!.request,
                    email: EMAIL_PROF,
                    password: PASSWORD_PROF,
                    corrida: CORRIDA,
                    telefono: TELEFONO_PROF,
                });
                profesional = p;
                expect(p.franjaId, "el fixture publicó una franja").toBeTruthy();
                return p;
            });
            const nombreProf = `Psi E2E ${CORRIDA}`;

            await test.step("2 · el padre lo encuentra en el directorio y abre su ficha (sin contacto: H-2)", async () => {
                padre = await crearPadreOnboarded({
                    request: page.request,
                    email: `${CORRIDA}-padre@proteccion.local`,
                    password: PASSWORD_PADRE,
                });
                await page.goto("/dashboard/padre/profesionales/directorio");
                const tarjeta = page.getByRole("link", { name: `Ver perfil de ${nombreProf}` });
                await expect(tarjeta).toBeVisible();
                await tarjeta.click();
                await page.waitForURL(new RegExp(`/dashboard/padre/profesionales/${prof.perfilId}`));
                await expect(page.getByText(nombreProf).first()).toBeVisible();
                await expect(page.locator("body"), "H-2: la ficha no muestra el teléfono").not.toContainText(TELEFONO_PROF);
                await expect(page.locator("body"), "H-2: la ficha no muestra el correo").not.toContainText(EMAIL_PROF);
            });

            const reservar = page.locator("section[aria-labelledby='reservar']");
            const solicitar = reservar.getByRole("button", { name: "Solicitar la cita" });

            const { citaId, totalModal } = await test.step("3 · sin presentación no se reserva; con ella, elige franja y solicita", async () => {
                // El bloque de la franja (rango «HH:MM–HH:MM» + «Virtual»); NO los toggles «Día/Semana»,
                // que también llevan aria-pressed.
                const franja = reservar.locator("button[aria-pressed]").filter({ hasText: "Virtual" }).first();

                // Control AISLADO de la presentación: CON la franja ya elegida, sin presentación sigue
                // bloqueado. (Si se afirma antes de elegir franja, el bloqueo lo explica la franja y el
                // control es vacío — una mutación que quitó la exigencia de presentación pasó verde así.)
                await expect(reservar.getByText("Aún no tienes una presentación.")).toBeVisible();
                await expect(reservar.getByRole("link", { name: "Complétala en Mi perfil" })).toBeVisible();
                await franja.click();
                await expect(reservar.getByText("Elegiste:", { exact: false })).toBeVisible();
                await expect(solicitar, "franja elegida pero SIN presentación → bloqueado").toBeDisabled();

                const perfil = await page.request.patch("/api/padre/perfil", { data: { presentacionEstandar: PRESENTACION } });
                expect(perfil.status(), `presentación en Mi perfil · body=${await perfil.text()}`).toBeLessThan(300);
                await page.reload();
                await expect(reservar.getByText(PRESENTACION, { exact: false })).toBeVisible();
                // Control AISLADO de la franja: con presentación y sin franja (el reload la soltó) → bloqueado.
                await expect(solicitar, "presentación lista pero SIN franja → bloqueado").toBeDisabled();

                await expect(franja).toBeVisible();
                await franja.click();
                await expect(franja).toHaveAttribute("aria-pressed", "true");
                await expect(reservar.getByText("Elegiste:", { exact: false })).toBeVisible();
                await expect(solicitar).toBeEnabled();
                await solicitar.click();

                const modal = page.getByRole("dialog", { name: "Confirmar solicitud" });
                await expect(modal).toBeVisible();
                // SPEC-934: el total es la cifra grande del desglose (dt «Total a pagar» + dd testid).
                const total = await modal.getByTestId("desglose-total").innerText();
                await modal.getByRole("button", { name: "Confirmar solicitud" }).click();
                await page.waitForURL(/\/dashboard\/padre\/citas\/[^/]+$/);
                const id = new URL(page.url()).pathname.split("/").pop()!;
                return { citaId: id, totalModal: total };
            });

            const cita = await prisma.solicitudCita.findUniqueOrThrow({
                where: { id: citaId },
                select: { estado: true, profesionalId: true, franjaId: true, montoConsulta: true, montoTotal: true },
            });

            await test.step("3b · la cita quedó SIN_CONFIRMAR, con el precio estándar y su franja; el padre la ve «Pendiente de pago»", async () => {
                // Misma clave que `src/lib/profesional/cita/precio-primera-cita.ts` (la siembra el seed).
                const precio = await prisma.parametroSistema.findUniqueOrThrow({
                    where: { clave: "profesional.cita.precio_estandar_primera_cita_cop" },
                    select: { valor: true },
                });
                expect(cita.estado).toBe("SIN_CONFIRMAR");
                expect(cita.profesionalId).toBe(prof.perfilId);
                expect(cita.franjaId).toBe(prof.franjaId);
                expect(cita.montoConsulta, "SPEC-428: 1ª cita al precio estándar").toBe(Number(precio.valor));
                expect(digitos(totalModal), "SPEC-934 (I-450 resuelto): el modal muestra el TOTAL = montoTotal (estándar + servicio)").toBe(String(cita.montoTotal));

                await expect(page.getByText("Pendiente de pago")).toBeVisible();
                // SPEC-934 `etiquetaMontoCita`: con el pago AÚN pendiente (SIN_CONFIRMAR) el panel rotula «Total a
                // pagar» (no «Monto pagado»); el monto es el TOTAL de la fila, en el dd del desglose (testid).
                await expect(page.getByText("Total a pagar")).toBeVisible();
                const montoPanel = await page.getByTestId("desglose-total").innerText();
                expect(digitos(montoPanel), "el panel muestra el montoTotal de la fila").toBe(String(cita.montoTotal));
                console.log(`[SPEC-928 · I-450 resuelto] modal/panel total=${totalModal}/${montoPanel} · montoConsulta=${cita.montoConsulta} · montoTotal=${cita.montoTotal}`);
                await expect(page.locator("body"), "H-2: el panel no muestra el teléfono").not.toContainText(TELEFONO_PROF);
                await expect(page.locator("body"), "H-2: el panel no muestra el correo").not.toContainText(EMAIL_PROF);
            });

            const profPage = await profCtx.newPage();
            // El ítem de ESTA solicitud en «Solicitudes de primera cita» (el profesional es nuevo: es la única).
            const bloqueSolicitudes = profPage.getByRole("listitem").filter({ hasText: "Padre E2E" }).filter({ hasText: "Pidió" });

            await test.step("4 · el profesional ve la solicitud, SIN «Confirmar» mientras el pago no está aprobado", async () => {
                await profPage.goto("/dashboard/profesional");
                await expect(profPage.getByRole("heading", { name: "Solicitudes de primera cita" })).toBeVisible();
                await expect(bloqueSolicitudes.getByText("Esta familia reservó esta hora.", { exact: false })).toBeVisible();
                await expect(bloqueSolicitudes.getByRole("button", { name: "Confirmar" }), "sin pago aprobado no hay Confirmar").toHaveCount(0);
            });

            await test.step("5 · pago (puente declarado: lo aprueba el admin) → el padre ve «Esperando confirmación»", async () => {
                const admin = await playwrightRequest.newContext({ baseURL: baseURL() });
                try {
                    const login = await admin.post("/api/auth/login", {
                        data: { email: `${CORRIDA}-verificador@proteccion.local`, password: PASSWORD_PROF },
                    });
                    expect(login.status(), `login admin · body=${await login.text()}`).toBe(200);
                    const activar = await admin.post(`/api/admin/pagos/cita/${citaId}/activar`, { data: {} });
                    expect(activar.status(), `activar pago · body=${await activar.text()}`).toBeLessThan(300);
                } finally {
                    await admin.dispose();
                }
                const fila = await prisma.solicitudCita.findUniqueOrThrow({ where: { id: citaId }, select: { estado: true } });
                expect(fila.estado).toBe("PAGADA_PENDIENTE");
                await page.reload();
                await expect(page.getByText("Esperando confirmación del profesional")).toBeVisible();
            });

            await test.step("6 · el profesional confirma en su panel → el padre ve «Cita confirmada», sin contacto (SPEC-754)", async () => {
                await profPage.reload();
                const confirmar = bloqueSolicitudes.getByRole("button", { name: "Confirmar", exact: true });
                await expect(confirmar).toBeVisible();
                await confirmar.click();
                await expect
                    .poll(async () => (await prisma.solicitudCita.findUniqueOrThrow({ where: { id: citaId }, select: { estado: true } })).estado, {
                        message: "la cita queda CONFIRMADA",
                        timeout: 10_000,
                    })
                    .toBe("CONFIRMADA");

                await page.reload();
                await expect(page.getByText("Cita confirmada")).toBeVisible();
                await expect(page.locator("body"), "SPEC-754: tras confirmar, sin teléfono").not.toContainText(TELEFONO_PROF);
                await expect(page.locator("body"), "SPEC-754: tras confirmar, sin correo").not.toContainText(EMAIL_PROF);
            });
        } finally {
            await profCtx?.close();
        }
    });
});
