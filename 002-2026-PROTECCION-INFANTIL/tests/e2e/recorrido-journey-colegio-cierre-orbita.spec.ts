/**
 * SPEC-969 (Calidad) · JOURNEY — CIERRE del camino del colegio (SPEC-962) + mapa ÓRBITA (SPEC-965/968).
 * Pedido de Jelkin vía CEO (20-11, deploy d30b9735).
 *
 * QUÉ PROTEGE. La promesa de activación del colegio: el rector recorre el alta, TERMINA y entra a su
 * panel; el correo «su cuenta está lista» le llega UNA sola vez, y solo cuando CIERRA el camino —
 * nunca al aceptar la Política (el defecto de prod del Colegio 41, SPEC-962). Encadena las piezas
 * REALES por sus endpoints/acciones de servidor:
 *   (1) ACEPTAR la Política (Paso 1) NO manda el correo de bienvenida → 0 correos.
 *   (2) «Terminar» (Paso 5) dispara la SERVER ACTION `accionCompletarCaminoColegio`
 *       (`completarCaminoColegio`): compare-and-set sobre `Colegio.bienvenidaEnviadaEn` → encola la
 *       bienvenida UNA vez y deja al rector DIRECTO en /dashboard/colegio → 1 correo + aterrizaje.
 *   (3) Un 2.º «Terminar» y un GET directo a /camino/colegio/listo (enlace viejo / back / refresh)
 *       caen en `count === 0` del compare-and-set → NO reenvían → sigue en 1 correo.
 *   (4) El mapa Órbita (/dashboard/colegio/mapa) pinta la CAPA 1 (cursos del colegio) y, al abrir un
 *       curso, la CAPA 2 (detalle del curso: estudiantes de mirada + «resto: N en calma»).
 *
 * QUÉ CUENTA «1 correo». La FILA de `Notificacion` con `canal = EMAIL` y `evento =
 * colegio.bienvenida_rector` dirigida al rector. La crea `programar` (motor, SPEC-201) de forma
 * SÍNCRONA dentro de la acción, por la regla sembrada `obligatoria` (seed.ts: evento →
 * plantilla `colegio.bienvenida_rector.email`). El ENVÍO real por Resend es async best-effort y NO
 * se ejercita acá: el observable determinista es la fila encolada.
 *
 * CONTROL POSITIVO (para que el verde no sea vacío). El Paso 1 afirma 0 correos tras ACEPTAR: si
 * alguien re-cableara el envío al aceptar (revertir SPEC-962, el defecto del Colegio 41), ese 0 pasa
 * a ≥1 y el journey se pone ROJO. (Mutación de verificación aplicada en local por Calidad; no se
 * commitea.)
 *
 * AISLAMIENTO. Corrida por `randomUUID`. El colegio se arma por el fixture REAL (endpoints del alta).
 * Prisma solo LEE para afirmar los conteos; la limpieza FK-safe (`limpiarColegioOnboarded`) y el
 * borrado de las notificaciones del rector corren en `afterAll`. Corre en el arnés (guardia SPEC-770:
 * BD `*_test`); NUNCA contra prod.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { disposeBoss } from "@/lib/queue";
import { crearColegioOnboarded, limpiarColegioOnboarded, type ColegioOnboarded } from "./fixtures/colegio-onboarded";

const CORRIDA = randomUUID().slice(0, 8);
const PASSWORD_RECTOR = "RectorSpec969Cierre!Secure";
const EVENTO_BIENVENIDA = "colegio.bienvenida_rector";

const colegiosCreados: ColegioOnboarded[] = [];

/** Correos de bienvenida ENCOLADOS (fila EMAIL) para ese rector. */
async function correosBienvenida(rectorUsuarioId: string): Promise<number> {
    return prisma.notificacion.count({
        where: { evento: EVENTO_BIENVENIDA, destinatarioUsuarioId: rectorUsuarioId, canal: "EMAIL" },
    });
}

test.describe.serial("SPEC-969 · journey: cierre del camino del colegio (1 correo, aterriza, idempotente) + mapa Órbita", () => {
    test.afterAll(async () => {
        for (const c of colegiosCreados) {
            await prisma.notificacion.deleteMany({ where: { destinatarioUsuarioId: c.rectorUsuarioId } }).catch(() => undefined);
            await limpiarColegioOnboarded(c).catch(() => undefined);
        }
        colegiosCreados.length = 0;
        // El motor encola el envío en pg-boss desde ESTE proceso: se cierra para no colgar el worker.
        await disposeBoss().catch(() => undefined);
    });

    test("aceptar → 0; Terminar → 1 y aterriza en el panel; 2.º Terminar y GET /listo → siguen en 1; el mapa muestra capa 1 y capa 2", async ({ page }) => {
        test.setTimeout(180_000);

        const colegio = await test.step("1 · colegio onboarded (incluye ACEPTAR la Política) → 0 correos de bienvenida", async () => {
            const c = await crearColegioOnboarded({
                request: page.request,
                email: `rector-969-${CORRIDA}@e2e.local`,
                password: PASSWORD_RECTOR,
                corrida: `969-${CORRIDA}`,
            });
            colegiosCreados.push(c);
            expect(
                await correosBienvenida(c.rectorUsuarioId),
                "ACEPTAR la Política NO manda el correo de bienvenida (SPEC-962)",
            ).toBe(0);
            return c;
        });

        await test.step("2 · «Terminar» (server action) → encola 1 correo y aterriza DIRECTO en /dashboard/colegio", async () => {
            await page.goto("/camino/colegio/estudiantes");
            const terminar = page.getByRole("button", { name: "Terminar" });
            await expect(terminar, "el Paso 5 ofrece «Terminar» (hay ≥1 estudiante)").toBeEnabled();
            await terminar.click();
            await page.waitForURL("**/dashboard/colegio");
            expect(new URL(page.url()).pathname, "el cierre aterriza directo en el panel del colegio").toBe("/dashboard/colegio");
            await expect
                .poll(() => correosBienvenida(colegio.rectorUsuarioId), {
                    message: "el CIERRE encola exactamente 1 correo de bienvenida",
                    timeout: 10_000,
                })
                .toBe(1);
        });

        await test.step("3 · 2.º «Terminar» + GET directo a /listo → NO reenvían (idempotente, sigue en 1)", async () => {
            // 2.º Terminar: el botón sigue presente (camino completo no rebota el Paso 5); la acción
            // vuelve a correr y cae en `ya_completado` → sin encolar. Se pulsa SIEMPRE (no condicional)
            // para EJERCER de verdad la idempotencia del 2.º cierre.
            await page.goto("/camino/colegio/estudiantes");
            const terminar = page.getByRole("button", { name: "Terminar" });
            await expect(terminar, "el Paso 5 sigue ofreciendo «Terminar» tras el 1.er cierre").toBeEnabled();
            await terminar.click();
            await page.waitForURL("**/dashboard/colegio");
            // GET directo a /listo (enlace viejo / back / refresh): redirige al panel, SIN encolar.
            await page.goto("/camino/colegio/listo");
            await page.waitForURL("**/dashboard/colegio");
            expect(new URL(page.url()).pathname, "el GET a /listo redirige al panel").toBe("/dashboard/colegio");
            expect(
                await correosBienvenida(colegio.rectorUsuarioId),
                "ni el 2.º Terminar ni el GET /listo reenvían el correo",
            ).toBe(1);
        });

        await test.step("4 · mapa Órbita: capa 1 (cursos) y, al abrir un curso, capa 2 (detalle)", async () => {
            await page.goto("/dashboard/colegio/mapa");
            await expect(
                page.getByRole("heading", { name: "Mapa de protección del colegio" }),
                "el mapa carga",
            ).toBeVisible();
            // CAPA 1: la lista equivalente de cursos (teclado / lector) con ≥1 curso.
            await expect(page.getByText(/— cursos \(\d+\)/), "capa 1: lista de cursos del colegio").toBeVisible();
            const primerCurso = page.getByRole("button", { name: /^Curso / }).first();
            await expect(primerCurso, "capa 1: al menos un curso abrible").toBeVisible();

            // CAPA 2: abrir el curso → detalle (volver + «resto: N en calma»).
            await primerCurso.click();
            await expect(
                page.getByRole("button", { name: /Volver al colegio/ }),
                "capa 2: el curso quedó abierto",
            ).toBeVisible();
            await expect(
                page.getByText(/Resto:\s*\d+\s+estudiantes?\s+en calma/),
                "capa 2: el detalle del curso muestra el resto en calma",
            ).toBeVisible();
        });
    });
});
