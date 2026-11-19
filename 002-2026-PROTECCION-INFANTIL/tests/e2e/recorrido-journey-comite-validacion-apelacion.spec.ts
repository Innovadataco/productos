/**
 * SPEC-936 (Calidad) · JOURNEY CORE #5 — COMITÉ DE VALIDACIÓN de la plataforma: el titular de un
 * identificador APELA (Ley 1581) y el comité lo resuelve; el efecto se ve en la consulta pública.
 *
 * QUÉ PROTEGE, por la pantalla de cada rol:
 *   (1) Un identificador con un reporte APROBADO aparece en la consulta pública («1 reporte»).
 *       Origen real: reporte anónimo (`POST /api/reportes`) → un OPERADOR lo clasifica por su endpoint
 *       (`…/reportes-revision/[id]/clasificar`). PUENTE DECLARADO (el motor IA no corre en el arnés): el
 *       reporte se deja en REVISION_MANUAL asignado al operador, el estado que deja el motor.
 *   (2) El TITULAR (cuenta real de padre, fixture) radica la apelación en `/dashboard/apelaciones` con
 *       motivo y PDF de evidencia → «Apelación radicada con el número …»; queda RECIBIDA y aparece en
 *       «Mis apelaciones». Apelar NO oculta nada por sí solo: la consulta sigue en «1 reporte».
 *   (3) Un integrante del COMITÉ DE VALIDACIÓN la ve en su bandeja (`/dashboard/admin/comite/apelaciones`),
 *       la «Revisa», la TOMA («Tomar caso» → EN_REVISION, asignada a él) y la RESUELVE: «Aceptar»,
 *       «Quitar la visibilidad pública», da de baja el reporte por falso y escribe la motivación.
 *   (4) Efecto: apelación ACEPTADA con su motivación; el reporte queda dado de baja (REPORTE_FALSO); la
 *       consulta pública vuelve a «Sin reportes registrados»; el titular ve la respuesta en «Mis apelaciones».
 *
 * CONTROLES:
 *   - Antes de resolver (apelación radicada), la consulta SIGUE mostrando el reporte → el «Sin reportes»
 *     posterior es efecto de la resolución, no de radicar.
 *   - Sin tomar el caso no aparece el formulario de resolución (solo el asignado resuelve).
 *
 * LO QUE ESTE JOURNEY NO AFIRMA (I-451, reportado por Calidad 19-11): si se acepta marcando solo
 * «Quitar la visibilidad pública» (sin dar de baja reportes), la consulta pública DIRECTA sigue
 * mostrando el identificador — `ConsultaPublicaService.resumen` no lee `ocultoPorComiteEn`, que solo
 * apaga el listado del tablero (`visibleEnDashboard`). Contrato a decidir; por eso acá se usa la baja.
 *
 * ANDAMIAJE: el OPERADOR y el integrante del COMITÉ DE VALIDACIÓN se crean por Prisma (no hay endpoint
 * de alta de cuentas COMITE_VALIDACION; mismo patrón que el admin efímero de `profesional-visible`). El
 * SUJETO (el titular que apela) entra por su fixture real. Limpieza FK-safe en `afterAll` que AFIRMA que
 * no quedan cuentas ni apelaciones, y borra el PDF cifrado del disco. Arnés con guardia SPEC-770.
 */
import { test, expect, request as playwrightRequest, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = randomUUID().slice(0, 8);
const IDENTIFICADOR = `+57300936${Date.now() % 10_000}`;
const CATEGORIA = "OFRECIMIENTO_REGALOS";
const PASSWORD_ANDAMIAJE = "AndamiajeSpec936!Secure";
const MOTIVO = `Corrida ${CORRIDA}: esta línea es mía desde 2019 y nunca he contactado a ningún menor; adjunto el certificado del operador.`;
const MOTIVACION = `Corrida ${CORRIDA}: el titular acredita la línea; el reporte no se sostiene. Se da de baja por falso.`;

const reportesCreados: string[] = [];
const cuentasAndamiaje: string[] = [];
let titular: PadreOnboarded | null = null;

function baseURL(): string {
    return test.info().project.use.baseURL ?? "http://localhost:5005";
}

async function consultarEnHome(page: Page, identificador: string): Promise<void> {
    await page.goto("/");
    await page.getByPlaceholder("Ej: +573001234567").fill(identificador);
    await page.getByRole("button", { name: "Buscar" }).click();
}

async function crearCuenta(rol: RolUsuario, etiqueta: string): Promise<{ id: string; email: string }> {
    const email = `${etiqueta}-spec936-${CORRIDA}@proteccion.local`;
    const u = await prisma.usuario.create({
        data: { email, nombre: `${etiqueta} E2E ${CORRIDA}`, passwordHash: await hashPassword(PASSWORD_ANDAMIAJE), rol, estado: "activo" },
        select: { id: true },
    });
    cuentasAndamiaje.push(u.id);
    return { id: u.id, email };
}

/** PDF mínimo válido (número mágico `%PDF-`), como el de `profesional-visible`. */
function pdfMinimo(): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E SPEC-936 ${CORRIDA}\n%%EOF\n`, "utf8");
}

test.describe.serial("SPEC-936 · journey core #5: el titular apela y el comité de validación resuelve", () => {
    test.afterAll(async () => {
        const idNorm = normalizarIdentificador(IDENTIFICADOR);
        const apelaciones = await prisma.apelacion.findMany({
            where: { identificador: idNorm },
            select: { id: true, documentos: { select: { rutaArchivo: true } } },
        });
        for (const a of apelaciones) for (const d of a.documentos) await unlink(d.rutaArchivo).catch(() => undefined);
        await prisma.apelacion.deleteMany({ where: { id: { in: apelaciones.map((a) => a.id) } } });
        if (reportesCreados.length) await prisma.reporte.deleteMany({ where: { id: { in: reportesCreados } } });
        await prisma.identificadorReportado.deleteMany({ where: { identificador: idNorm } });
        const usuarios = [...cuentasAndamiaje, ...(titular?._limpieza.usuarios ?? [])];
        if (cuentasAndamiaje.length) {
            await prisma.auditLog.deleteMany({ where: { usuarioId: { in: cuentasAndamiaje } } });
            await prisma.usuario.deleteMany({ where: { id: { in: cuentasAndamiaje } } });
        }
        if (titular) await limpiarPadreOnboarded(titular);
        expect(await prisma.usuario.count({ where: { id: { in: usuarios } } }), "limpieza: no quedan cuentas de la corrida").toBe(0);
        expect(await prisma.apelacion.count({ where: { identificador: idNorm } }), "limpieza: no quedan apelaciones").toBe(0);
    });

    test("apelación radicada → el comité la toma y la acepta → la consulta pública queda sin reportes", async ({ page, browser }) => {
        test.setTimeout(240_000);
        const idNorm = normalizarIdentificador(IDENTIFICADOR);
        const anonimo = await browser.newContext({ baseURL: baseURL() });
        let comiteCtx: BrowserContext | null = null;
        try {
            const consulta = await anonimo.newPage();

            const { reporteId, plataformaId } = await test.step("1 · un reporte aprobado por un operador aparece en la consulta pública", async () => {
                const api = anonimo.request;
                const paises = await (await api.get("/api/paises")).json();
                const colombia = paises.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
                const ciudades = await (await api.get(`/api/ciudades?paisId=${colombia.id}`)).json();
                const bogota = ciudades.ciudades.find((c: { nombre: string }) => c.nombre === "Bogotá");
                const res = await api.post("/api/reportes", {
                    data: {
                        identificador: IDENTIFICADOR,
                        plataforma: "whatsapp",
                        texto: `Corrida ${CORRIDA}: este número le ofrece regalos a mi hijo a cambio de que le mande mensajes en secreto.`,
                        fechaIncidente: "2026-07-10T15:00:00Z",
                        ciudad: "Bogotá",
                        pais: "Colombia",
                        paisId: colombia.id,
                        ciudadId: bogota.id,
                    },
                });
                const texto = await res.text();
                expect(res.status(), `reporte anónimo · body=${texto}`).toBe(201);
                const id = (JSON.parse(texto) as { reporte: { id: string } }).reporte.id;
                reportesCreados.push(id);

                const operador = await crearCuenta("OPERADOR" as RolUsuario, "operador");
                // PUENTE DECLARADO: el ruteo que hace el motor (revisión manual asignada al operador).
                await prisma.reporte.update({ where: { id }, data: { estado: "REVISION_MANUAL", operadorId: operador.id } });
                const op = await playwrightRequest.newContext({ baseURL: baseURL() });
                try {
                    expect((await op.post("/api/auth/login", { data: { email: operador.email, password: PASSWORD_ANDAMIAJE } })).status()).toBe(200);
                    const clasif = await op.post(`/api/admin/reportes-revision/${id}/clasificar`, {
                        data: { categoria: CATEGORIA, nota: "Clasificación manual del operador en el journey SPEC-936." },
                    });
                    expect(clasif.status(), `clasificar · body=${await clasif.text()}`).toBe(200);
                } finally {
                    await op.dispose();
                }

                await consultarEnHome(consulta, IDENTIFICADOR);
                await expect(consulta.getByText("1 reporte", { exact: true })).toBeVisible();
                const fila = await prisma.reporte.findUniqueOrThrow({ where: { id }, select: { plataformaId: true } });
                return { reporteId: id, plataformaId: fila.plataformaId! };
            });

            const numero = await test.step("2 · el titular radica la apelación con motivo y PDF; apelar no oculta nada", async () => {
                titular = await crearPadreOnboarded({
                    request: page.request,
                    email: `titular-spec936-${CORRIDA}@proteccion.local`,
                    password: "TestPass123",
                });
                await page.goto("/dashboard/apelaciones");
                await expect(page.getByRole("heading", { name: "Apelar un identificador" })).toBeVisible();
                await page.getByLabel("Identificador (número, nick o perfil)").fill(IDENTIFICADOR);
                await page.getByLabel("Plataforma").selectOption(plataformaId);
                await page.getByLabel("Motivo de la apelación").fill(MOTIVO);
                await page.getByLabel("Documento de evidencia (PDF, máximo 5 MB)").setInputFiles({
                    name: `certificado-linea-${CORRIDA}.pdf`,
                    mimeType: "application/pdf",
                    buffer: pdfMinimo(),
                });
                await page.getByRole("button", { name: "Radicar apelación" }).click();
                const aviso = page.getByText(/Apelación radicada con el número/);
                await expect(aviso).toBeVisible();

                const apelacion = await prisma.apelacion.findFirstOrThrow({
                    where: { identificador: idNorm, usuarioId: titular.usuarioId },
                    select: { numero: true, estado: true, _count: { select: { documentos: true } } },
                });
                expect(apelacion.estado, "BD: apelación RECIBIDA").toBe("RECIBIDA");
                expect(apelacion._count.documentos, "BD: con su documento de evidencia").toBe(1);
                await expect(aviso).toContainText(apelacion.numero);

                // Control: radicar NO oculta (lo dice la propia pantalla del titular).
                await consultarEnHome(consulta, IDENTIFICADOR);
                await expect(consulta.getByText("1 reporte", { exact: true }), "apelar no oculta nada por sí solo").toBeVisible();
                return apelacion.numero;
            });

            const comite = await crearCuenta("COMITE_VALIDACION" as RolUsuario, "comite");
            comiteCtx = await browser.newContext({ baseURL: baseURL() });
            const cpage = await comiteCtx.newPage();

            await test.step("3 · el comité la ve en su bandeja, la revisa y la TOMA", async () => {
                expect((await comiteCtx!.request.post("/api/auth/login", { data: { email: comite.email, password: PASSWORD_ANDAMIAJE } })).status()).toBe(200);
                await cpage.goto("/dashboard/admin/comite/apelaciones");
                const fila = cpage.locator("tbody tr").filter({ hasText: numero });
                await expect(fila).toHaveCount(1);
                await fila.getByRole("button", { name: "Revisar" }).click();
                await expect(cpage.getByText(MOTIVO)).toBeVisible();
                await expect(cpage.getByRole("heading", { name: "Resolver el caso" }), "sin tomar no se resuelve").toHaveCount(0);
                await cpage.getByRole("button", { name: "Tomar caso" }).click();
                await expect(cpage.getByRole("heading", { name: "Resolver el caso" })).toBeVisible();
                const fila2 = await prisma.apelacion.findFirstOrThrow({ where: { numero }, select: { estado: true, comiteId: true } });
                expect(fila2, "BD: EN_REVISION, asignada a este integrante").toEqual({ estado: "EN_REVISION", comiteId: comite.id });
            });

            await test.step("4 · la acepta: quita visibilidad, da de baja el reporte por falso y motiva", async () => {
                await cpage.getByLabel("Aceptar", { exact: true }).check();
                await cpage.getByLabel("Quitar la visibilidad pública del identificador").check();
                await cpage.locator("label").filter({ hasText: CATEGORIA }).getByRole("checkbox").check();
                await cpage.getByLabel("Motivación escrita (obligatoria)").fill(MOTIVACION);
                await cpage.getByRole("button", { name: "Resolver apelación" }).click();
                await expect(cpage.getByText("Se quitó la visibilidad pública del identificador.")).toBeVisible();

                const resuelta = await prisma.apelacion.findFirstOrThrow({
                    where: { numero },
                    select: { estado: true, decision: true, quitoVisibilidad: true, motivacionResolucion: true },
                });
                expect(resuelta).toEqual({ estado: "ACEPTADA", decision: "ACEPTADA", quitoVisibilidad: true, motivacionResolucion: MOTIVACION });
                const rep = await prisma.reporte.findUniqueOrThrow({ where: { id: reporteId }, select: { eliminado: true } });
                expect(rep.eliminado, "BD: el reporte quedó dado de baja").toBe(true);
            });

            await test.step("5 · efecto: la consulta pública queda sin reportes y el titular ve la respuesta", async () => {
                await consultarEnHome(consulta, IDENTIFICADOR);
                await expect(consulta.getByText(/Sin reportes registrados/)).toBeVisible();
                await expect(consulta.getByText("1 reporte", { exact: true })).toHaveCount(0);

                await page.goto("/dashboard/apelaciones");
                const mias = page.locator("section[aria-labelledby='mis-apelaciones-title']");
                await expect(mias.getByText(numero)).toBeVisible();
                await expect(mias.getByText(MOTIVACION, { exact: false })).toBeVisible();
            });
        } finally {
            await comiteCtx?.close();
            await anonimo.close();
        }
    });
});
