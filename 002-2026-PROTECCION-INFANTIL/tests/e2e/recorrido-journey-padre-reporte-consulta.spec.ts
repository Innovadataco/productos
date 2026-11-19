/**
 * SPEC-925 (Calidad · JOURNEY CORE #1) — PADRE → REPORTE → REVISIÓN HUMANA → CONSULTA PÚBLICA.
 *
 * Candado de regresión del valor central, de punta a punta: un padre reporta una cuenta por el wizard
 * real; mientras nadie lo revisó, la consulta pública NO lo muestra; un operador lo clasifica con SU rol
 * por el endpoint real; y RECIÉN ahí la consulta pública de esa cuenta lo cuenta («1 reporte», la
 * categoría, el país), sin score ni veredicto de riesgo.
 *
 * POR QUÉ UN JOURNEY Y NO OTRO TEST DE PIEZA: cada eslabón ya tenía su spec suelto
 * (`padre-reporta-autenticado` · `recorrido-operador-clasifica` · `consulta`), pero ninguno los
 * encadenaba. Lo que este spec vigila es la CADENA: si el reporte no queda atado al padre, si la
 * clasificación manual no lo aprueba, si la consulta no lo cuenta —o si cuenta lo NO revisado—, se
 * pone rojo en el eslabón que se rompió (cada uno es un `test.step` con nombre).
 *
 * PUENTE DECLARADO (no se finge el motor): el `webServer` del harness levanta solo `npm run dev`, NO los
 * workers del motor IA. En producción el motor deja el reporte de baja confianza en REVISION_MANUAL
 * asignado a un operador; acá ese ruteo se hace explícito con un UPDATE sobre la BD de PRUEBA
 * (estado=REVISION_MANUAL + operadorId) — exactamente el estado que el motor deja. Desde ahí todo es
 * real: login del operador, `POST /api/admin/reportes-revision/[id]/clasificar` (compuertas de módulo,
 * rol y pertenencia SPEC-891), `recalcularYGuardarScoreSiReporteReal` (SPEC-863) y la consulta pública
 * (`whereReporteAprobado` + exclusión de simulacro).
 *
 * CONTROLES: el paso negativo NO es un «0» trivial — espera la señal POSITIVA de que la consulta resolvió
 * vacía («Sin reportes registrados») antes de afirmar que no hay «1 reporte»; y el positivo corre sobre el
 * MISMO identificador. Cada estado se confirma por DOS vías (pantalla + API).
 *
 * Aislamiento: identificador y cuentas únicos por corrida (randomUUID); contexto PROPIO por rol (el
 * anónimo que consulta y el operador no comparten la sesión del padre). Limpieza FK-safe en afterAll,
 * incluido el agregado `IdentificadorReportado` que crea la clasificación (I-446/I-447: un spec no deja
 * filas que polucionen a otro). Solo `tests/e2e/**`; la guardia SPEC-770 del globalSetup garantiza BD de
 * prueba.
 */
import { test, expect, request as playwrightRequest, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";
import type { RolUsuario } from "@prisma/client";

const CATEGORIA = "OFRECIMIENTO_REGALOS";
const ETIQUETA_CATEGORIA = "Ofrecimiento de regalos";
const PASSWORD_OPERADOR = "OperadorSpec925!Secure";

// Rastreo por ARRAYS (no una variable suelta): con los `retries` de CI cada intento crea sus propias
// filas, y el afterAll tiene que limpiar TODAS, no solo las del último intento.
const padresCreados: PadreOnboarded[] = [];
const reportesCreados: string[] = [];
const operadoresCreados: string[] = [];
const identificadoresCreados: string[] = [];

function baseURL(): string {
    return (test.info().project.use.baseURL as string | undefined) ?? "http://localhost:5005";
}

/** Consulta pública desde la home, como la hace cualquier visitante. */
async function consultarEnHome(page: Page, identificador: string): Promise<void> {
    await page.goto("/");
    await page.getByPlaceholder("Ej: +573001234567").fill(identificador);
    await page.getByRole("button", { name: "Buscar" }).click();
}

test.describe("SPEC-925 · journey core #1: padre → reporte → revisión humana → consulta pública", () => {
    test.afterAll(async () => {
        // FK-safe (mismo orden que padre-reporta-autenticado y recorrido-operador-clasifica):
        // 1) los reportes primero — CASCADEAN ClasificacionIA → CorreccionAdmin (que apunta al operador con
        //    Restrict) y liberan `reporte.hijoId` (que bloquea borrar la ficha del padre);
        // 2) el agregado `IdentificadorReportado` que creó la clasificación (no cuelga de Reporte por FK:
        //    hay que borrarlo explícito o queda huérfano — la clase de I-446);
        // 3) el operador; 4) el padre (su fixture borra suscripción, hijo, auditoría, tokens y usuario).
        if (reportesCreados.length > 0) {
            await prisma.reporte
                .deleteMany({ where: { id: { in: reportesCreados } } })
                .catch((e) => console.warn("[SPEC-925] limpieza de reportes falló:", e));
        }
        if (identificadoresCreados.length > 0) {
            await prisma.identificadorReportado
                .deleteMany({ where: { identificador: { in: identificadoresCreados } } })
                .catch((e) => console.warn("[SPEC-925] limpieza del agregado falló:", e));
        }
        if (operadoresCreados.length > 0) {
            await prisma.usuario
                .deleteMany({ where: { id: { in: operadoresCreados } } })
                .catch((e) => console.warn("[SPEC-925] limpieza del operador falló:", e));
        }
        for (const p of padresCreados) await limpiarPadreOnboarded(p);
        padresCreados.length = 0;
    });

    test("el reporte del padre llega a la consulta pública SOLO después de la revisión humana", async ({
        page,
        request,
        browser,
    }) => {
        const corrida = randomUUID().replace(/-/g, "").slice(0, 10);
        // Identificador ÚNICO de esta corrida: ninguna otra fila lo comparte, así que la consulta solo puede
        // contar ESTE reporte (el «1 reporte» de abajo no puede venir de otro spec).
        const identificador = `+57300J925${corrida}`;
        const idNorm = normalizarIdentificador(identificador);
        identificadoresCreados.push(idNorm);

        // Visitante ANÓNIMO en su propio contexto: la consulta pública se mira como la ve cualquiera, no con
        // la sesión del padre (el autenticado recibe más detalle — sería otra superficie).
        const anonCtx = await browser.newContext({ baseURL: baseURL() });
        const anon = await anonCtx.newPage();

        try {
            let reporteId = "";
            let plataformaId = "";

            await test.step("1 · el padre (onboarded por endpoints reales) reporta la cuenta por el wizard", async () => {
                // `page.request` (no el fixture `request`): comparte las cookies del navegador, así la `page`
                // queda AUTENTICADA como el padre y el wizard no rebota a login.
                const padre = await crearPadreOnboarded({
                    request: page.request,
                    email: `padre-spec925-${corrida}@example.com`,
                    password: "TestPass123",
                });
                padresCreados.push(padre);

                const respuesta = await page.goto("/dashboard/padre/reportar", { waitUntil: "commit" });
                expect(respuesta?.status(), "el wizard del padre carga sin redirect").toBe(200);
                await expect(page.getByText("Reportar una situación")).toBeVisible();

                // Paso 1 (SPEC-591): la ficha del menor que dejó el onboarding.
                await page.getByRole("option", { name: /Menor E2E/ }).click();
                await page.getByRole("button", { name: /Siguiente/i }).click();

                // Paso 2: la cuenta + la plataforma.
                await page.getByLabel(/La cuenta/i).fill(identificador);
                await page.getByLabel("Plataforma").first().selectOption({ label: "WhatsApp" });
                await page.getByRole("button", { name: /Siguiente/i }).click();

                // Paso 3: país + ciudad + día/hora/meridiano (SPEC-368/438) + relato.
                const paises = await (await request.get("/api/paises")).json();
                const colombia = paises.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
                expect(colombia, "el catálogo de países tiene Colombia").toBeDefined();
                await page.getByLabel("País").selectOption(colombia.id);
                await page.getByLabel("Ciudad").fill("Bogotá");
                // Acotado al listbox de ciudades: una opción «Bogotá…» suelta también casa con el <select> de
                // Departamento (strict-mode violation).
                const opcionBogota = page
                    .getByRole("listbox", { name: "Resultados de ciudades" })
                    .getByRole("option", { name: /Bogotá/i });
                await expect(opcionBogota).toBeVisible();
                await opcionBogota.click();
                await page.getByLabel("Día del incidente").fill("2026-07-10");
                await page.getByLabel("Hora del incidente").selectOption("3");
                await page.getByLabel("a.m. o p.m.").selectOption("pm");
                await page
                    .getByPlaceholder("Describe la conducta observada")
                    .fill(
                        `Un adulto le escribe a mi hija por WhatsApp ofreciéndole regalos a cambio de fotos. Recorrido SPEC-925 ${corrida}.`,
                    );
                await page.getByRole("button", { name: /Siguiente/i }).click();

                // Paso 4: confirmar y enviar.
                await page.getByRole("checkbox").check();
                await page.getByRole("button", { name: /Enviar reporte/i }).click();
                await page.waitForURL(/\/mis-reportes/, { timeout: 15_000 });

                // BD: el reporte existe, atado al padre (no anónimo) y a su ficha. La escritura NORMALIZA el
                // identificador: se busca por la forma normalizada.
                const r = await prisma.reporte.findFirst({ where: { identificador: idNorm }, orderBy: { creadoEn: "desc" } });
                expect(r, "el reporte del padre quedó en BD").not.toBeNull();
                reportesCreados.push(r!.id);
                expect(r!.usuarioId, "atado al padre que reportó").toBe(padre.usuarioId);
                expect(r!.origenRol, "origen PARENT").toBe("PARENT");
                expect(r!.hijoId, "atado a la ficha del menor (SPEC-591)").not.toBeNull();
                reporteId = r!.id;
                plataformaId = r!.plataformaId;
            });

            await test.step("2 · sin revisión, la consulta pública NO lo muestra (lo no revisado no se publica)", async () => {
                await consultarEnHome(anon, identificador);
                // Señal POSITIVA de que la consulta RESOLVIÓ vacía — sin ella, «no hay 1 reporte» pasaría en falso
                // antes de que llegue la respuesta.
                await expect(anon.getByText(/Sin reportes registrados/)).toBeVisible();
                await expect(anon.getByText("1 reporte", { exact: true })).toHaveCount(0);

                // 2ª vía: el contrato de la API (el DTO viaja sin envolver).
                const api = await anonCtx.request.post("/api/consulta", { data: { identificador } });
                expect(api.status(), "la consulta pública responde").toBe(200);
                expect((await api.json()).tieneReportes, "la API tampoco lo cuenta antes de revisarlo").toBe(false);
            });

            await test.step("3 · un operador lo clasifica con SU rol por el endpoint real", async () => {
                const email = `operador-spec925-${corrida}@proteccion.local`;
                const operador = await prisma.usuario.create({
                    data: {
                        email,
                        nombre: `Operador E2E SPEC-925 ${corrida}`,
                        passwordHash: await hashPassword(PASSWORD_OPERADOR),
                        rol: "OPERADOR" as RolUsuario,
                        estado: "activo",
                    },
                    select: { id: true },
                });
                operadoresCreados.push(operador.id);

                // PUENTE DECLARADO: el ruteo que hace el motor (que no corre en el harness) — revisión manual
                // asignada a este operador. Es el único estado que se fija a mano; lo demás es real.
                await prisma.reporte.update({
                    where: { id: reporteId },
                    data: { estado: "REVISION_MANUAL", operadorId: operador.id },
                });

                // Contexto de API PROPIO del operador: no hereda la sesión del padre del navegador.
                const opCtx = await playwrightRequest.newContext({ baseURL: baseURL() });
                try {
                    const login = await opCtx.post("/api/auth/login", { data: { email, password: PASSWORD_OPERADOR } });
                    expect(login.status(), "login del operador").toBe(200);
                    const res = await opCtx.post(`/api/admin/reportes-revision/${reporteId}/clasificar`, {
                        data: {
                            categoria: CATEGORIA,
                            nota: "Clasificación manual del operador en el journey SPEC-925 (nota auditable).",
                        },
                    });
                    expect(
                        res.status(),
                        `el operador ASIGNADO clasifica (200). body=${(await res.text().catch(() => "")).slice(0, 220)}`,
                    ).toBe(200);
                } finally {
                    await opCtx.dispose();
                }

                // BD: aprobado (CLASIFICADO + categoría con riesgo) y el agregado público se recalculó para un
                // reporte REAL (la contracara de SPEC-863: un simulacro NO lo mueve; un reporte real, sí).
                const r = await prisma.reporte.findUnique({
                    where: { id: reporteId },
                    select: { estado: true, clasificacion: { select: { categoria: true } } },
                });
                expect(r?.estado, "la clasificación manual lo aprueba").toBe("CLASIFICADO");
                expect(r?.clasificacion?.categoria).toBe(CATEGORIA);
                const agregado = await prisma.identificadorReportado.findUnique({
                    where: { identificador_plataformaId: { identificador: idNorm, plataformaId } },
                    select: { reportesAprobados: true },
                });
                expect(agregado?.reportesAprobados, "el reporte real del padre SÍ mueve el agregado").toBe(1);
            });

            await test.step("4 · ya revisado, la consulta pública lo cuenta — sin score ni veredicto de riesgo", async () => {
                await consultarEnHome(anon, identificador);
                await expect(anon.getByText(idNorm)).toBeVisible();
                await expect(anon.getByText("1 reporte", { exact: true })).toBeVisible();
                await expect(anon.getByText(/Autenticados:\s*1/)).toBeVisible();
                // El anónimo ve el rollup por PAÍS (la ciudad es solo del autenticado).
                await expect(anon.getByText("Colombia").first()).toBeVisible();
                await expect(anon.getByText(ETIQUETA_CATEGORIA)).toBeVisible();
                // Candado de constitución (la IA clasifica CONDUCTAS, no personas): ni score ni nivel de riesgo.
                await expect(anon.getByText(/score/i)).toHaveCount(0);
                await expect(anon.getByText(/Riesgo (BAJO|MEDIO|ALTO|CR[ÍI]TICO)/i)).toHaveCount(0);

                // 2ª vía: la API cuenta exactamente ESTE reporte.
                const dto = await (await anonCtx.request.post("/api/consulta", { data: { identificador } })).json();
                expect(dto.tieneReportes).toBe(true);
                expect(dto.totalReportes).toBe(1);
            });
        } finally {
            await anonCtx.close();
        }
    });
});
