/**
 * SPEC-926 (Calidad) · JOURNEY CORE #2 — colegio: onboarding → curso → materia → estudiante.
 *
 * QUÉ PROTEGE. El camino con el que un colegio queda operando, de punta a punta y por la
 * pantalla del rector:
 *   (1) ONBOARDING por los endpoints reales (fixture SPEC-775) hasta tener rector + plan +
 *       profesor. El `completar` siembra 11 cursos SIN materias. El camino queda pendiente en
 *       «estudiantes» (`derivarPasoPendienteColegio`).
 *   (2) LISTA DE CURSOS (`/dashboard/colegio/cursos`): cada curso sembrado muestra el aviso
 *       ámbar «Sin materias» (SPEC-914) — el rector ve qué le falta.
 *   (3) MATERIA desde el escritorio del curso: el curso arranca vacío («Este curso aún no tiene
 *       materias»); el rector CREA una materia nueva (se autoselecciona); «Asignar» sigue
 *       BLOQUEADO hasta elegir el profesor a cargo (SPEC-379: toda materia lleva profesor); al
 *       elegirlo, asigna. La materia queda en la tabla del curso con su profesor, y en la BD
 *       como `CursoMateria` activa con ese `profesorId`.
 *   (4) La LISTA refleja la asignación: ESE curso pasa a «1 materia» y los demás siguen en
 *       «Sin materias» (el conteo es por curso, no global).
 *   (5) ESTUDIANTE con ACUDIENTE desde el modal «Agregar estudiante» (documento obligatorio,
 *       SPEC-910): aparece en «Estudiantes del curso»; en la BD queda en ESE curso con su
 *       acudiente; y el camino del colegio queda COMPLETO (`derivarPasoPendienteColegio = null`).
 *
 * CONTROLES (para que el verde no sea vacío):
 *   - Antes de asignar: «Sin materias» en el curso + estado vacío + botón «Asignar»
 *     deshabilitado → la aserción posterior («1 materia») no puede pasar por un curso que ya
 *     tuviera materias.
 *   - Camino en «estudiantes» ANTES del modal y `null` DESPUÉS → el paso lo cierra la UI.
 *
 * AISLAMIENTO. Corrida por `randomUUID`. Toda escritura es por la UI o los endpoints reales;
 * Prisma solo LEE para afirmar (y el fixture crea el token de registro, «llegó el correo»).
 * Limpieza profunda FK-safe en `afterAll` (`limpiarColegioProfundo`), que AFIRMA que el colegio
 * quedó borrado. Corre en el arnés (guardia SPEC-770: BD `*_test`); NUNCA contra prod.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { crearColegioOnboarded, type ColegioOnboarded } from "./fixtures/colegio-onboarded";
import { limpiarColegioProfundo } from "./fixtures/colegio-limpieza-profunda";

const CORRIDA = randomUUID().slice(0, 8);
const PASSWORD_RECTOR = "RectorSpec926!Secure";

const colegiosCreados: ColegioOnboarded[] = [];

test.describe.serial("SPEC-926 · journey core #2: colegio onboarding → curso → materia → estudiante", () => {
    test.afterAll(async () => {
        for (const colegio of colegiosCreados) {
            const { colegioBorrado } = await limpiarColegioProfundo(colegio);
            expect(colegioBorrado, `limpieza: el colegio ${colegio.colegioId} debe quedar borrado (sin filas hijas vivas)`).toBe(true);
        }
        colegiosCreados.length = 0;
    });

    test("el rector asigna una materia con profesor y agrega un estudiante con acudiente; el camino queda completo", async ({ page }) => {
        test.setTimeout(180_000);

        const colegio = await test.step("1 · onboarding real hasta el profesor: el camino queda en «estudiantes»", async () => {
            const c = await crearColegioOnboarded({
                request: page.request,
                email: `rector-926-${CORRIDA}@e2e.local`,
                password: PASSWORD_RECTOR,
                corrida: `926-${CORRIDA}`,
                hasta: "profesores",
            });
            colegiosCreados.push(c);
            expect(await derivarPasoPendienteColegio(c.rectorUsuarioId), "camino pendiente en estudiantes").toBe("estudiantes");
            const cursosSinMaterias = await prisma.curso.count({
                where: { colegioId: c.colegioId, estado: "activo", CursoMateria: { none: {} } },
            });
            expect(cursosSinMaterias, "el completar siembra cursos activos SIN materias").toBeGreaterThanOrEqual(2);
            return c;
        });

        const profesor = await prisma.profesor.findFirstOrThrow({
            where: { colegioId: colegio.colegioId, estado: "activo" },
            select: { id: true, nombre: true, apellidos: true },
        });
        const etiquetaProfesor = `${profesor.nombre} ${profesor.apellidos}`;
        const nombreMateria = `Robótica ${CORRIDA}`;
        const apellidosAlumno = `Journey ${CORRIDA}`;

        const { cursoNombre, otroCursoNombre } = await test.step("2 · la lista de cursos marca «Sin materias» en cada curso sembrado", async () => {
            await page.goto("/dashboard/colegio/cursos");
            const tabla = page.getByRole("table");
            await expect(tabla.getByRole("columnheader", { name: "Materias" })).toBeVisible();
            const filas = tabla.locator("tbody tr");
            await expect(filas.first()).toBeVisible();
            expect(await filas.count(), "al menos dos cursos en la lista").toBeGreaterThanOrEqual(2);

            const primero = (await filas.nth(0).locator("td").first().innerText()).trim();
            const segundo = (await filas.nth(1).locator("td").first().innerText()).trim();
            expect(primero.length > 0 && segundo.length > 0 && primero !== segundo, "dos cursos distintos").toBe(true);
            for (const fila of [filas.nth(0), filas.nth(1)]) {
                await expect(fila.getByText("Sin materias", { exact: true }), "badge ámbar SPEC-914").toBeVisible();
            }
            return { cursoNombre: primero, otroCursoNombre: segundo };
        });

        const cursoId = await test.step("3 · en el escritorio del curso: crear materia, «Asignar» bloqueado sin profesor, asignar con profesor", async () => {
            await page.getByRole("button", { name: cursoNombre, exact: true }).click();
            await page.waitForURL(/\/dashboard\/colegio\/cursos\/[^/]+$/);
            const id = new URL(page.url()).pathname.split("/").pop()!;

            const seccion = page.getByRole("region", { name: "Materias del curso" });
            await expect(seccion.getByText("Este curso aún no tiene materias")).toBeVisible();
            const asignar = seccion.getByRole("button", { name: "Asignar", exact: true });
            await expect(asignar, "sin materia ni profesor no se puede asignar").toBeDisabled();

            await seccion.getByLabel("¿No está en la lista? Cree una materia nueva").fill(nombreMateria);
            await seccion.getByRole("button", { name: "Crear materia" }).click();
            await expect(page.getByText(`Materia "${nombreMateria}" creada`)).toBeVisible();

            // La materia recién creada queda autoseleccionada; sin profesor, sigue bloqueado.
            const selectMateria = seccion.getByLabel("Materia", { exact: true });
            await expect(selectMateria.locator("option:checked")).toHaveText(nombreMateria);
            await expect(asignar, "materia sin profesor → bloqueado (SPEC-379)").toBeDisabled();
            await expect(seccion.getByText("Toda materia debe llevar un profesor a cargo.", { exact: false })).toBeVisible();

            await seccion.getByLabel("Profesor a cargo", { exact: true }).selectOption({ label: etiquetaProfesor });
            await expect(asignar).toBeEnabled();
            await asignar.click();
            await expect(page.getByText("Materia asignada al curso")).toBeVisible();

            const filaMateria = seccion.locator("tbody tr").filter({ hasText: nombreMateria });
            await expect(filaMateria).toHaveCount(1);
            await expect(filaMateria.getByText(etiquetaProfesor)).toBeVisible();

            const asignaciones = await prisma.cursoMateria.findMany({
                where: { cursoId: id, estado: "activo" },
                select: { profesorId: true, materia: { select: { nombre: true } } },
            });
            expect(asignaciones, "BD: una asignación activa, con ese profesor").toEqual([
                { profesorId: profesor.id, materia: { nombre: nombreMateria } },
            ]);
            return id;
        });

        await test.step("4 · la lista refleja la asignación: ese curso «1 materia», el otro sigue «Sin materias»", async () => {
            await page.goto("/dashboard/colegio/cursos");
            const filas = page.getByRole("table").locator("tbody tr");
            const filaCurso = filas.filter({ has: page.getByRole("button", { name: cursoNombre, exact: true }) });
            const filaOtro = filas.filter({ has: page.getByRole("button", { name: otroCursoNombre, exact: true }) });
            await expect(filaCurso.getByText("1 materia", { exact: true })).toBeVisible();
            await expect(filaCurso.getByText("Sin materias", { exact: true })).toHaveCount(0);
            await expect(filaOtro.getByText("Sin materias", { exact: true })).toBeVisible();
        });

        await test.step("5 · agregar estudiante con acudiente: aparece en el curso y el camino queda completo", async () => {
            await page.goto(`/dashboard/colegio/cursos/${cursoId}`);
            await expect(page.getByText("Este curso aún no tiene estudiantes")).toBeVisible();
            expect(await derivarPasoPendienteColegio(colegio.rectorUsuarioId), "antes del modal: falta el estudiante").toBe("estudiantes");

            await page.getByRole("button", { name: "+ Agregar estudiante" }).first().click();
            const modal = page.getByRole("dialog", { name: "Agregar estudiante" });
            await expect(modal).toBeVisible();
            await modal.getByLabel("Nombre del estudiante").fill("Valentina");
            await modal.getByLabel("Apellidos").fill(apellidosAlumno);
            const tipoDoc = modal.getByLabel("Tipo de documento");
            await expect(tipoDoc.locator("option[value='TI']")).toHaveCount(1);
            await tipoDoc.selectOption("TI");
            await modal.getByLabel("Número de documento").fill(`9${Date.now() % 1_000_000_000}`);
            await modal.getByRole("button", { name: "+ Agregar acudiente (opcional)" }).click();
            await modal.getByLabel("Nombre del acudiente").fill("Marta Acudiente");
            await modal.getByLabel("Relación del acudiente").fill("Madre");
            await modal.getByLabel("Teléfono del acudiente").fill("3009260000");
            await modal.getByRole("button", { name: "Agregar", exact: true }).click();

            await expect(page.getByText("Estudiante agregado.")).toBeVisible();
            const seccionEstudiantes = page.getByRole("region", { name: "Estudiantes del curso" });
            await expect(seccionEstudiantes.getByText(apellidosAlumno, { exact: false })).toBeVisible();

            const estudiante = await prisma.estudiante.findFirst({
                where: { colegioId: colegio.colegioId, apellidos: apellidosAlumno },
                select: { cursoId: true, estado: true, _count: { select: { acudientes: true } } },
            });
            expect(estudiante, "BD: el estudiante existe").not.toBeNull();
            expect(estudiante!.cursoId, "BD: quedó en ESE curso").toBe(cursoId);
            expect(estudiante!.estado, "BD: activo").toBe("activo");
            expect(estudiante!._count.acudientes, "BD: con su acudiente").toBe(1);

            expect(await derivarPasoPendienteColegio(colegio.rectorUsuarioId), "camino COMPLETO tras agregar el estudiante").toBeNull();
        });
    });
});
