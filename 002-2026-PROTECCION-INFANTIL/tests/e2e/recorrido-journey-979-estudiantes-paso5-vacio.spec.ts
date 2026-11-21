/**
 * SPEC-979 (I-460) · JOURNEY — el paso 5 del camino del colegio NO se bloquea a sí mismo.
 * Hallazgo de Jelk en prod (799c8880, 20-11): en /camino/colegio/estudiantes aparecía «No pudimos
 * cargar la lista de estudiantes.» sobre «Aún no ha agregado estudiantes.».
 *
 * CAUSA (reproducida en vivo, no supuesta): un colegio con CERO estudiantes está parado EN el paso
 * «estudiantes», y el guardián del camino (`middleware.ts`, rama CAMINO_INCOMPLETO) le devolvía
 * 403 a `GET /api/colegio/estudiantes` (SPEC-931) — la MISMA lista que el paso inline (SPEC-956)
 * necesita para renderizar su «Lista actual». El handler SIEMPRE respondió 200 + []: el 403 lo
 * ponía el muro, antes del handler. Por eso SOLO fallaba con 0 estudiantes y desaparecía al sumar
 * el primero (el camino cierra → el muro se levanta). Arreglo: eximir esa lista del camino y de
 * vigencia (guardias.ts), como ya lo están /cursos y /profesores.
 *
 * QUÉ PROTEGE ESTE JOURNEY (end-to-end, por el navegador REAL, contra el middleware REAL):
 *   (1) Paso 5 con 0 estudiantes → `GET /api/colegio/estudiantes` responde 200 (NO 403), la pantalla
 *       muestra el estado vacío «Aún no ha agregado estudiantes.» y NO el aviso de error.
 *   (2) Tras agregar el primero, la lista lo muestra y sigue sin aviso (la recuperación que Jelk vio).
 *
 * CONTROL POSITIVO (para que el verde no sea vacío): el observable es el STATUS 200 del GET en el
 * estado de 0 estudiantes. Revertir cualquiera de las dos exenciones de guardias.ts devuelve el 403
 * y el paso (1) se pone ROJO — es el defecto exacto que este journey existe para cazar.
 *
 * AISLAMIENTO: colegio por el fixture REAL (`hasta: "profesores"` = paso 5 sin estudiantes), corrida
 * por randomUUID, limpieza FK-safe en afterAll. Corre en el arnés (guardia SPEC-770: BD `*_test`).
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { crearColegioOnboarded, limpiarColegioOnboarded, type ColegioOnboarded } from "./fixtures/colegio-onboarded";

const CORRIDA = randomUUID().slice(0, 8);
const creados: ColegioOnboarded[] = [];

test.afterAll(async () => {
    for (const c of creados) await limpiarColegioOnboarded(c).catch(() => undefined);
    creados.length = 0;
});

test("SPEC-979 · paso 5 con 0 estudiantes: la lista carga (200) sin aviso de error; al sumar el primero sigue sin aviso", async ({ page }) => {
    test.setTimeout(180_000);

    const colegio = await test.step("1 · colegio onboarded hasta el paso 5 (0 estudiantes)", async () => {
        const c = await crearColegioOnboarded({
            request: page.request,
            email: `rector-979-${CORRIDA}@e2e.local`,
            password: "Rector979Paso5!Secure",
            corrida: `979-${CORRIDA}`,
            hasta: "profesores", // ← deja el camino parado en el paso «estudiantes», con 0 alumnos
        });
        creados.push(c);
        return c;
    });

    await test.step("2 · la lista del paso 5 responde 200 (no 403) y la pantalla NO muestra el aviso de error", async () => {
        const [resLista] = await Promise.all([
            page.waitForResponse((r) => r.url().includes("/api/colegio/estudiantes")),
            page.goto("/camino/colegio/estudiantes"),
        ]);
        expect(
            resLista.status(),
            "GET /api/colegio/estudiantes con 0 estudiantes debe ser 200 (el muro del camino ya no lo tapa)",
        ).toBe(200);

        await expect(
            page.getByText("Aún no ha agregado estudiantes."),
            "el estado vacío se muestra",
        ).toBeVisible();
        await expect(
            page.getByText("No pudimos cargar la lista de estudiantes."),
            "NO debe aparecer el aviso de error sobre la lista vacía (el defecto de Jelk)",
        ).toHaveCount(0);
    });

    await test.step("3 · al agregar el primer estudiante, la lista lo muestra y sigue sin aviso", async () => {
        // Se agrega por el MISMO endpoint que usa el formulario inline del paso (POST alumnos del curso).
        const curso = await page.request.get("/api/colegio/cursos");
        expect(curso.status(), "la lista de cursos del paso carga").toBe(200);
        const cursos = (await curso.json()).cursos as Array<{ id: string }>;
        expect(cursos.length, "el completar sembró cursos").toBeGreaterThan(0);

        const alta = await page.request.post(`/api/colegio/cursos/${cursos[0].id}/alumnos`, {
            data: { nombre: "Alumno 979", apellidos: `Prueba ${CORRIDA}`, documentoTipo: "CC", documentoNumero: `9${(Date.now() % 1_000_000_000).toString().padStart(9, "0")}` },
        });
        expect(alta.status(), `alta de estudiante body=${await alta.text().catch(() => "")}`).toBeLessThan(300);

        await page.reload();
        await expect(page.getByText("Alumno 979 Prueba", { exact: false }), "la lista muestra al estudiante recién agregado").toBeVisible();
        await expect(
            page.getByText("No pudimos cargar la lista de estudiantes."),
            "sigue sin aviso de error con la lista ya poblada",
        ).toHaveCount(0);
    });
});
