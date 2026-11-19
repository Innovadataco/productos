/**
 * SPEC-927 (Calidad) · JOURNEY CORE #3 — el COMITÉ DE CONVIVENCIA del colegio recibe un caso,
 * lo trabaja y lo cierra con firma.
 *
 * QUÉ PROTEGE (por la pantalla de cada rol):
 *   (1) El RECTOR crea la cuenta del comité («Enviar invitación») y documenta un INTEGRANTE
 *       (`/dashboard/colegio/comite/integrantes`).
 *   (2) El COMITÉ activa su cuenta con el token de la invitación (`POST /api/auth/activar`,
 *       el mismo que usa `/activar`; el token se lee de la BD = «llegó el correo») y su bandeja
 *       arranca VACÍA («No hay casos escalados.»).
 *   (3) Una ALERTA real de estudiante (identificador → reporte → motor; ver el fixture
 *       `alerta-colegio-real`) aparece en la bandeja del rector; el rector la ESCALA con motivo
 *       (el botón del modal está bloqueado sin motivo). La alerta queda «Escalada» y nace la
 *       solicitud PENDIENTE.
 *   (4) El comité ve el caso («Revisar y cerrar»), registra una NOTA y lo CIERRA con decisión
 *       documentada y FIRMA de un integrante activo (SPEC-319 §2.4: «Cerrar caso» bloqueado sin
 *       firmante). Solicitud RESUELTA con ese firmante; la alerta pasa a «Gestionada».
 *   (5) El rector ve su alerta «Gestionada».
 *
 * CONTROLES:
 *   - Bandeja del comité VACÍA antes de escalar → el caso que aparece después es el escalado.
 *   - SEPARACIÓN DE ROLES: el rector NO puede cerrar el caso (`POST …/resolver` con su sesión →
 *     403). Lo que el rector VE en «Casos comité» no se afirma (contrato sin decidir, ver paso 4).
 *   - «Escalar» sin motivo y «Cerrar caso» sin firmante → deshabilitados.
 *
 * AISLAMIENTO. Corrida por `randomUUID`. Escrituras por UI/endpoints reales; Prisma solo LEE
 * (más el puente declarado del fixture de alerta). Limpieza profunda en `afterAll` que AFIRMA el
 * colegio borrado. Arnés con guardia SPEC-770 (BD `*_test`); NUNCA contra prod.
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { disposeBoss } from "@/lib/queue";
import { crearColegioOnboarded, type ColegioOnboarded } from "./fixtures/colegio-onboarded";
import { limpiarColegioProfundo } from "./fixtures/colegio-limpieza-profunda";
import { generarAlertaDeEstudiante } from "./fixtures/alerta-colegio-real";

const CORRIDA = randomUUID().slice(0, 8);
const PASSWORD_RECTOR = "RectorSpec927!Secure";
const PASSWORD_COMITE = "ComiteSpec927Secure1";
const EMAIL_COMITE = `comite-927-${CORRIDA}@e2e.local`;
const INTEGRANTE = { nombres: "Lucía", apellidos: `Orientadora ${CORRIDA}` };
const MOTIVO = `Corrida ${CORRIDA}: el estudiante es señalado en un reporte de amenazas; pedimos acompañamiento del comité.`;
const NOTA = `Corrida ${CORRIDA}: citamos a la familia y al estudiante para el jueves.`;
const RESOLUCION = `Corrida ${CORRIDA}: se acuerda plan de acompañamiento con orientación y seguimiento quincenal.`;

const colegiosCreados: ColegioOnboarded[] = [];
const reportesCreados: string[] = [];

function baseURL(): string {
    return test.info().project.use.baseURL ?? "http://localhost:5005";
}

/** La tarjeta de UNA alerta en la bandeja del rector, por su id (la casilla lleva el id). */
function tarjetaAlerta(page: Page, alertaId: string) {
    return page
        .getByRole("checkbox", { name: `Seleccionar alerta ${alertaId}`, exact: true })
        .locator("xpath=ancestor::div[contains(@class,'border-l-4')][1]");
}

test.describe.serial("SPEC-927 · journey core #3: comité de convivencia — escalar, trabajar y cerrar con firma", () => {
    test.afterAll(async () => {
        for (const colegio of colegiosCreados) {
            const { colegioBorrado } = await limpiarColegioProfundo(colegio, reportesCreados);
            expect(colegioBorrado, `limpieza: el colegio ${colegio.colegioId} debe quedar borrado`).toBe(true);
        }
        colegiosCreados.length = 0;
        reportesCreados.length = 0;
        await disposeBoss().catch(() => undefined);
    });

    test("el rector escala una alerta; el comité la anota y la cierra firmada; el rector la ve gestionada", async ({ page, browser }) => {
        test.setTimeout(240_000);

        const colegio = await test.step("0 · colegio onboarded completo (endpoints reales)", async () => {
            const c = await crearColegioOnboarded({
                request: page.request,
                email: `rector-927-${CORRIDA}@e2e.local`,
                password: PASSWORD_RECTOR,
                corrida: `927-${CORRIDA}`,
            });
            colegiosCreados.push(c);
            return c;
        });

        await test.step("1 · el rector crea la cuenta del comité y documenta un integrante", async () => {
            await page.goto("/dashboard/colegio/comite");
            await page.waitForURL(/\/dashboard\/colegio\/comite\/integrantes$/);
            await expect(page.getByRole("heading", { name: "Crear cuenta del comité" })).toBeVisible();
            await page.getByLabel("Email institucional").fill(EMAIL_COMITE);
            await page.getByRole("button", { name: "Enviar invitación" }).click();
            await expect(page.getByText("Invitación enviada por email")).toBeVisible();

            // DEFECTO conocido (reportado por Calidad 19-11): la página decide si mostrar la lista de
            // integrantes con la cuenta leída en el SERVIDOR; al crearla desde el cliente, el
            // formulario de integrantes NO aparece hasta recargar. El journey recarga (lo que hoy hace
            // el rector) y verifica que AHÍ sí aparece. Cuando se arregle, quitar el reload.
            await expect(page.getByRole("button", { name: "Agregar integrante" })).toHaveCount(0);
            await page.reload();
            await page.getByPlaceholder("Nombres", { exact: true }).fill(INTEGRANTE.nombres);
            await page.getByPlaceholder("Apellidos", { exact: true }).fill(INTEGRANTE.apellidos);
            await page.getByPlaceholder("Número de identificación", { exact: true }).fill(`5${Date.now() % 1_000_000_000}`);
            await page.getByPlaceholder("Email", { exact: true }).fill(`lucia-927-${CORRIDA}@e2e.local`);
            await page.getByPlaceholder("Cargo (p. ej. Rector, Psicólogo)").fill("Orientadora escolar");
            await page.getByRole("button", { name: "Agregar integrante" }).click();
            await expect(page.getByText(INTEGRANTE.apellidos, { exact: false }).first()).toBeVisible();

            const cuenta = await prisma.usuario.findFirst({
                where: { comiteColegioId: colegio.colegioId, rol: "COMITE_CONVIVENCIA" },
                select: { email: true, estadoActivacion: true },
            });
            expect(cuenta, "BD: la cuenta del comité existe").toEqual({ email: EMAIL_COMITE, estadoActivacion: "INVITADO" });
        });

        const comiteCtx = await browser.newContext({ baseURL: baseURL() });
        const comite = await comiteCtx.newPage();
        try {
            await test.step("2 · el comité activa su cuenta con la invitación y su bandeja arranca vacía", async () => {
                const cuenta = await prisma.usuario.findFirstOrThrow({
                    where: { comiteColegioId: colegio.colegioId, rol: "COMITE_CONVIVENCIA" },
                    select: { tokenInvitacion: true },
                });
                expect(cuenta.tokenInvitacion, "la invitación trae token").toBeTruthy();
                const activar = await comiteCtx.request.post("/api/auth/activar", {
                    data: { token: cuenta.tokenInvitacion, password: PASSWORD_COMITE },
                });
                expect(activar.status(), `activar comité · body=${await activar.text()}`).toBe(200);

                await comite.goto("/dashboard/colegio/comite/casos");
                await expect(comite.getByRole("heading", { name: "Casos escalados al comité" })).toBeVisible();
                await expect(comite.getByText("No hay casos escalados.")).toBeVisible();
            });

            const { alertaId } = await test.step("3 · llega una alerta real y el rector la escala con motivo", async () => {
                const alerta = await generarAlertaDeEstudiante({
                    rector: page.request,
                    colegioId: colegio.colegioId,
                    corrida: `927${CORRIDA}`,
                    baseURL: baseURL(),
                });
                reportesCreados.push(alerta.reporteId);

                await page.goto("/dashboard/colegio/alertas");
                const tarjeta = tarjetaAlerta(page, alerta.alertaId);
                await expect(tarjeta.getByText("Nueva", { exact: true })).toBeVisible();
                await tarjeta.getByRole("button", { name: "Escalar al Comité" }).click();

                const modal = page.getByRole("dialog", { name: "Escalar al Comité de Convivencia" });
                const confirmar = modal.getByRole("button", { name: "Escalar al Comité" });
                await expect(confirmar, "sin motivo no se escala").toBeDisabled();
                await modal.locator("#motivo-escalamiento").fill(MOTIVO);
                await expect(confirmar).toBeEnabled();
                await confirmar.click();
                await expect(modal).toBeHidden();
                await expect(tarjeta.getByText("Escalada", { exact: true })).toBeVisible();

                const fila = await prisma.alertaColegio.findUniqueOrThrow({ where: { id: alerta.alertaId }, select: { estado: true } });
                expect(fila.estado, "BD: alerta escalada").toBe("escalada");
                const solicitud = await prisma.solicitudComite.findUniqueOrThrow({
                    where: { alertaColegioId: alerta.alertaId },
                    select: { estado: true, motivo: true },
                });
                expect(solicitud, "BD: solicitud PENDIENTE con el motivo").toEqual({ estado: "PENDIENTE", motivo: MOTIVO });
                return alerta;
            });

            const solicitud = await prisma.solicitudComite.findUniqueOrThrow({
                where: { alertaColegioId: alertaId },
                select: { id: true, numero: true },
            });

            await test.step("4 · separación de roles: el rector NO puede cerrar el caso", async () => {
                const intento = await page.request.post(`/api/colegio/comite/solicitudes/${solicitud.id}/resolver`, {
                    data: { resolucion: "intento del rector", integranteFirmanteId: "x" },
                });
                expect(intento.status(), "rector → resolver = 403").toBe(403);
                // NO se afirma qué VE el rector en «Casos comité»: hoy la página lo admite (solo
                // lectura) pero la API del caso exige COMITE_CONVIVENCIA → «Permisos insuficientes».
                // Contrato sin decidir (reportado por Calidad 19-11); este journey no lo fija.
            });

            await test.step("5 · el comité ve el caso, registra una nota y lo cierra con firma", async () => {
                await comite.goto("/dashboard/colegio/comite/casos");
                const item = comite.getByRole("listitem").filter({ hasText: solicitud.numero });
                await expect(item).toHaveCount(1);
                await expect(item.getByText("PENDIENTE", { exact: false })).toBeVisible();
                await item.getByRole("link", { name: "Revisar y cerrar" }).click();
                await comite.waitForURL(new RegExp(`/dashboard/colegio/comite/casos/${solicitud.id}$`));

                await expect(comite.getByText("Aún no hay notas.")).toBeVisible();
                await comite.getByPlaceholder("Registrar lo actuado…").fill(NOTA);
                await comite.getByRole("button", { name: "Agregar nota" }).click();
                await expect(comite.getByText(NOTA)).toBeVisible();

                await expect(comite.getByRole("heading", { name: "Cerrar caso con decisión" })).toBeVisible();
                await comite.getByPlaceholder("Escriba la decisión documentada del comité…").fill(RESOLUCION);
                const cerrar = comite.getByRole("button", { name: "Cerrar caso" });
                await expect(cerrar, "sin firmante no se cierra (SPEC-319)").toBeDisabled();
                await comite.getByLabel("Integrante que firma el cierre").selectOption({ label: `${INTEGRANTE.nombres} ${INTEGRANTE.apellidos}` });
                await expect(cerrar).toBeEnabled();
                await cerrar.click();

                await expect(comite.getByRole("heading", { name: "Cerrar caso con decisión" })).toHaveCount(0);
                await expect(comite.getByText(RESOLUCION)).toBeVisible();

                const integrante = await prisma.integranteComite.findFirstOrThrow({
                    where: { comite: { comiteColegioId: colegio.colegioId }, apellidos: INTEGRANTE.apellidos },
                    select: { id: true },
                });
                const cerrada = await prisma.solicitudComite.findUniqueOrThrow({
                    where: { id: solicitud.id },
                    select: { estado: true, resolucion: true, integranteFirmanteId: true },
                });
                expect(cerrada, "BD: solicitud RESUELTA, con la decisión y su firmante").toEqual({
                    estado: "RESUELTA",
                    resolucion: RESOLUCION,
                    integranteFirmanteId: integrante.id,
                });
                const notas = await prisma.notaSeguimiento.count({ where: { colegioId: colegio.colegioId, texto: NOTA } });
                expect(notas, "BD: la nota quedó registrada").toBe(1);
            });

            await test.step("6 · el rector ve su alerta «Gestionada»", async () => {
                await page.goto("/dashboard/colegio/alertas");
                await expect(tarjetaAlerta(page, alertaId).getByText("Gestionada", { exact: true })).toBeVisible();
                const fila = await prisma.alertaColegio.findUniqueOrThrow({ where: { id: alertaId }, select: { estado: true } });
                expect(fila.estado, "BD: alerta gestionada").toBe("gestionada");
            });
        } finally {
            await comiteCtx.close();
        }
    });
});
