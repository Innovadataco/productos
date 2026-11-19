/**
 * SPEC-942 (Calidad) · JOURNEY CORE #6 — el COMITÉ DE VALIDACIÓN decide sobre el expediente
 * CONSOLIDADO por IA: corregir · aprobar (con quórum) · devolver. Es el corazón del producto
 * (la IA consolida; un humano del comité decide si el informe es accionable).
 *
 * FLUJO, por la pantalla del comité (`/dashboard/admin/comite/consolidacion/[expedienteId]`,
 * `ConsolidacionClient`) + los endpoints reales:
 *   - El informe arranca `PENDIENTE_COMITE` (lo que deja el motor de IA — ver PUENTE).
 *   - Un miembro CORRIGE el resumen con motivo → `CORREGIDO` (sigue accionable).
 *   - Dos miembros DISTINTOS APRUEBAN («Aprobar informe») → al 2º voto se alcanza el quórum
 *     (`padre.comite.miembros_minimos_aprobacion` = 2) → `APROBADO`, y el Expediente transiciona a
 *     `EN_APROBACION_PADRE` (SPEC-236: el informe se vuelve accionable para el padre).
 *   - En OTRO expediente, un miembro DEVUELVE con motivo → `DEVUELTO` (no accionable; exige nueva
 *     consolidación).
 *
 * PUENTE DECLARADO (el motor de IA no corre en el arnés): se planta por Prisma el estado que el
 * motor deja — un `Expediente` con un `InformeConsolidado` `PENDIENTE_COMITE`. Desde ahí TODO es
 * real: sesión del miembro, UI de corregir/aprobar/devolver, endpoints, transición del expediente.
 * Los dos miembros `COMITE_VALIDACION` son andamiaje por Prisma (no hay endpoint de alta de esas
 * cuentas); la UI es por-sesión, así que el 2º voto del quórum se emite por API (misma acción real).
 *
 * CONTROLES:
 *   - Antes de actuar, `PENDIENTE_COMITE` → el `APROBADO` es efecto de los DOS votos, no del estado.
 *   - Con UN solo voto NO pasa a `APROBADO` (el quórum de 2 se cumple de verdad).
 *   - `DEVUELTO` → un voto de aprobación posterior es rechazado (409): no se aprueba lo devuelto.
 *
 * AISLAMIENTO. Corrida por `randomUUID`. Prisma siembra el andamiaje y LEE para afirmar; la decisión
 * va por UI/endpoints. Limpieza FK-safe en `afterAll` que AFIRMA 0 expedientes y 0 cuentas de la
 * corrida, y cierra pg-boss (aprobar publica un evento). Guardia SPEC-770 (BD `*_test`); nunca prod.
 */
import { test, expect, request as playwrightRequest, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { disposeBoss } from "@/lib/queue";
import { Prisma, type RolUsuario } from "@prisma/client";

const CORRIDA = randomUUID().slice(0, 8);
const PASSWORD = "Spec942Consolidacion!Secure";
const RESUMEN_IA = `Resumen consolidado por IA (corrida ${CORRIDA}): patrón de contacto reiterado con el menor.`;
const RESUMEN_CORREGIDO = `Corrección del comité (${CORRIDA}): se precisa el período y se retira una inferencia no sustentada.`;
const MOTIVO_CORRECCION = `El borrador de IA afirmaba más de lo que el expediente sostiene (${CORRIDA}).`;
const MOTIVO_DEVOLUCION = `Faltan los soportes del período señalado; devolver para nueva consolidación (${CORRIDA}).`;

const expedientesCreados: string[] = [];
const cuentas: string[] = [];

function baseURL(): string {
    return test.info().project.use.baseURL ?? "http://localhost:5005";
}

async function crearCuenta(rol: RolUsuario, etiqueta: string): Promise<{ id: string; email: string }> {
    const email = `${etiqueta}-spec942-${CORRIDA}@proteccion.local`;
    const u = await prisma.usuario.create({
        data: { email, nombre: `${etiqueta} E2E ${CORRIDA}`, passwordHash: await hashPassword(PASSWORD), rol, estado: "activo" },
        select: { id: true },
    });
    cuentas.push(u.id);
    return { id: u.id, email };
}

/** Planta el estado que deja el motor de IA: Expediente + InformeConsolidado PENDIENTE_COMITE. */
async function plantarConsolidado(padreId: string, suffix: string): Promise<string> {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300942${suffix}`,
            fechaApertura: new Date(),
            // El motor deja el expediente en PENDIENTE_COMITE mientras el comité revisa el informe;
            // la aprobación con quórum lo transiciona a EN_APROBACION_PADRE (FR-005 · SPEC-236).
            estado: "PENDIENTE_COMITE",
        },
        select: { id: true },
    });
    expedientesCreados.push(expediente.id);
    await prisma.informeConsolidado.create({
        data: {
            expedienteId: expediente.id,
            versionSecuencial: 1,
            scoreValor: 0.5,
            scoreGravedad: "AMARILLO",
            categoriasDetectadasJson: [] as Prisma.InputJsonValue,
            resumenTextoGenerado: RESUMEN_IA,
            estadoAprobacion: "PENDIENTE_COMITE",
        },
    });
    return expediente.id;
}

async function estadoInforme(expedienteId: string): Promise<string> {
    const i = await prisma.informeConsolidado.findFirstOrThrow({
        where: { expedienteId },
        orderBy: { versionSecuencial: "desc" },
        select: { estadoAprobacion: true },
    });
    return i.estadoAprobacion;
}

test.describe.serial("SPEC-942 · journey core #6: el comité de validación corrige, aprueba (quórum) y devuelve el expediente consolidado", () => {
    test.afterAll(async () => {
        if (expedientesCreados.length > 0) {
            // FK-safe: hijos del Expediente (el InformeConsolidado + los Restrict que pudiera dejar la
            // transición) ANTES del Expediente; luego las cuentas.
            await prisma.informeConsolidado.deleteMany({ where: { expedienteId: { in: expedientesCreados } } });
            await prisma.eventoExpediente.deleteMany({ where: { expedienteId: { in: expedientesCreados } } });
            await prisma.informePadre.deleteMany({ where: { expedienteId: { in: expedientesCreados } } });
            await prisma.patronExpediente.deleteMany({ where: { expedienteId: { in: expedientesCreados } } });
            await prisma.aclaracionExpediente.deleteMany({ where: { expedienteId: { in: expedientesCreados } } });
            await prisma.expediente.deleteMany({ where: { id: { in: expedientesCreados } } });
        }
        if (cuentas.length > 0) {
            await prisma.auditLog.deleteMany({ where: { usuarioId: { in: cuentas } } });
            await prisma.usuario.deleteMany({ where: { id: { in: cuentas } } });
        }
        expect(await prisma.expediente.count({ where: { id: { in: expedientesCreados } } }), "0 expedientes de la corrida").toBe(0);
        expect(await prisma.usuario.count({ where: { id: { in: cuentas } } }), "0 cuentas de la corrida").toBe(0);
        expedientesCreados.length = 0;
        cuentas.length = 0;
        await disposeBoss().catch(() => undefined);
    });

    test("corrige con motivo, aprueba con dos miembros (quórum) → APROBADO + expediente accionable; y devuelve otro → DEVUELTO", async ({ browser }) => {
        test.setTimeout(240_000);

        const padre = await crearCuenta("PARENT" as RolUsuario, "padre");
        const miembro1 = await crearCuenta("COMITE_VALIDACION" as RolUsuario, "comite1");
        const miembro2 = await crearCuenta("COMITE_VALIDACION" as RolUsuario, "comite2");

        const expA = await test.step("1 · puente: el motor deja un informe consolidado PENDIENTE_COMITE", async () => {
            const id = await plantarConsolidado(padre.id, `A${CORRIDA.slice(0, 3)}`);
            expect(await estadoInforme(id), "arranca PENDIENTE_COMITE").toBe("PENDIENTE_COMITE");
            return id;
        });
        const expB = await plantarConsolidado(padre.id, `B${CORRIDA.slice(0, 3)}`);

        const ctx1: BrowserContext = await browser.newContext({ baseURL: baseURL() });
        try {
            const page = await ctx1.newPage();
            expect((await ctx1.request.post("/api/auth/login", { data: { email: miembro1.email, password: PASSWORD } })).status(), "login miembro 1").toBe(200);

            await test.step("2 · el miembro abre el expediente consolidado y puede actuar", async () => {
                await page.goto(`/dashboard/admin/comite/consolidacion/${expA}`);
                await expect(page.getByText("Acciones del comité")).toBeVisible();
                await expect(page.getByLabel("Resumen consolidado")).toHaveValue(new RegExp(CORRIDA));
            });

            await test.step("3 · CORRIGE el resumen con motivo → CORREGIDO", async () => {
                // El textarea es controlado (useState(resumenInicial) en ConsolidacionResumenEditor).
                // Si el fill corre ANTES de que React hidrate con el valor del servidor, el texto
                // escrito se CONCATENA con el inicial (CI 19-11 run 44584198583: se guardó
                // "CORREGIDO"+"IA" → flaky). Esperar a que el campo se ASIENTE exactamente en el valor
                // IA garantiza que el fill reemplaza sobre el estado ya hidratado; y re-verificar el
                // valor antes de enviar cierra la carrera por completo (SPEC-945).
                const resumen = page.getByLabel("Resumen consolidado");
                await expect(resumen).toHaveValue(RESUMEN_IA);
                await resumen.fill(RESUMEN_CORREGIDO);
                await expect(resumen).toHaveValue(RESUMEN_CORREGIDO);
                await page.getByLabel("Motivo de la corrección").fill(MOTIVO_CORRECCION);
                await page.getByRole("button", { name: "Corregir resumen" }).click();
                await expect
                    .poll(() => estadoInforme(expA), { message: "el informe queda CORREGIDO", timeout: 10_000 })
                    .toBe("CORREGIDO");
                const informe = await prisma.informeConsolidado.findFirstOrThrow({ where: { expedienteId: expA }, select: { resumenTextoGenerado: true } });
                expect(informe.resumenTextoGenerado, "el texto corregido quedó guardado").toBe(RESUMEN_CORREGIDO);
            });

            await test.step("4 · APRUEBA (1º voto): aún NO alcanza el quórum de 2", async () => {
                await page.reload();
                await page.getByRole("button", { name: "Aprobar informe" }).click();
                await expect
                    .poll(async () => {
                        const i = await prisma.informeConsolidado.findFirstOrThrow({ where: { expedienteId: expA }, select: { aprobadoPorMiembrosJson: true } });
                        return Array.isArray(i.aprobadoPorMiembrosJson) ? (i.aprobadoPorMiembrosJson as unknown[]).length : 0;
                    }, { message: "quedó registrado 1 voto", timeout: 10_000 })
                    .toBe(1);
                expect(await estadoInforme(expA), "con 1 voto NO es APROBADO (quórum 2)").not.toBe("APROBADO");
            });

            await test.step("5 · 2º voto de un miembro DISTINTO (quórum) → APROBADO + expediente EN_APROBACION_PADRE", async () => {
                const api2 = await playwrightRequest.newContext({ baseURL: baseURL() });
                try {
                    expect((await api2.post("/api/auth/login", { data: { email: miembro2.email, password: PASSWORD } })).status(), "login miembro 2").toBe(200);
                    const res = await api2.post(`/api/admin/comite/consolidacion/${expA}/aprobar`, { data: {} });
                    expect(res.status(), `2º voto · body=${await res.text()}`).toBe(200);
                } finally {
                    await api2.dispose();
                }
                expect(await estadoInforme(expA), "con 2 miembros distintos → APROBADO").toBe("APROBADO");
                const exp = await prisma.expediente.findUniqueOrThrow({ where: { id: expA }, select: { estado: true } });
                expect(exp.estado, "el expediente se vuelve accionable para el padre (SPEC-236)").toBe("EN_APROBACION_PADRE");
            });

            await test.step("6 · en otro expediente DEVUELVE con motivo → DEVUELTO; aprobar lo devuelto es rechazado", async () => {
                await page.goto(`/dashboard/admin/comite/consolidacion/${expB}`);
                await expect(page.getByText("Acciones del comité")).toBeVisible();
                await page.getByRole("button", { name: "Devolver", exact: true }).click();
                await page.getByLabel("Motivo de la devolución").fill(MOTIVO_DEVOLUCION);
                await page.getByRole("button", { name: "Confirmar devolución" }).click();
                await expect
                    .poll(() => estadoInforme(expB), { message: "el informe queda DEVUELTO", timeout: 10_000 })
                    .toBe("DEVUELTO");
                const informe = await prisma.informeConsolidado.findFirstOrThrow({ where: { expedienteId: expB }, select: { motivoDevolucion: true } });
                expect(informe.motivoDevolucion, "la devolución guarda su motivo").toBe(MOTIVO_DEVOLUCION);

                // Control: lo DEVUELTO no admite aprobación hasta una nueva consolidación.
                const api2 = await playwrightRequest.newContext({ baseURL: baseURL() });
                try {
                    await api2.post("/api/auth/login", { data: { email: miembro2.email, password: PASSWORD } });
                    const res = await api2.post(`/api/admin/comite/consolidacion/${expB}/aprobar`, { data: {} });
                    expect(res.status(), "aprobar un informe DEVUELTO → 409").toBe(409);
                } finally {
                    await api2.dispose();
                }
            });
        } finally {
            await ctx1.close();
        }
    });
});
