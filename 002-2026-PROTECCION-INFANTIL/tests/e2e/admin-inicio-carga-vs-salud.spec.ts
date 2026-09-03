/**
 * I-271 · Candado de la partición CARGA vs SALUD del Inicio del administrador.
 *
 * El CEO verificó en `948c798b` que la señal «comité vencidos» reportaba **88**
 * cuando 89 de 90 eran demo. Diagnóstico ratificado por CEO 03-09 06:35:
 *
 *   · CARGA OPERATIVA — «¿hay cola sin atender?». El demo NO hay que atenderlo,
 *     así que se EXCLUYE: `senalComiteVencido`, `senalReportesHuerfanos`,
 *     `senalVigenciasPorVencer`.
 *   · SALUD DEL SISTEMA — «¿algo está roto?». Acá el demo SÍ cuenta, porque la
 *     falla es real aunque la dispare un dato de prueba:
 *     `senalCorreosFallidos`, `senalAnalisisRachaFallida`. Fue la señal de
 *     correos la que destapó I-280 (03-09) — filtrarla por demo hubiera dejado
 *     ciegos ante 9.600 correos fallidos reales.
 *
 * Este spec afirma **las dos mitades**:
 *   1. CARGA sobre demo puro NO dispara `comite_vencido` / `reportes_huerfanos`.
 *   2. CARGA sobre datos reales SÍ dispara `comite_vencido` (candado no-regresivo
 *      del arreglo — si el fix silencia también lo real, el bug es peor que
 *      I-271).
 *   3. SALUD sobre destinatarios demo SÍ dispara `correos_fallidos_volumen`
 *      (candado no-regresivo del arreglo — si el fix filtra demo también en
 *      salud, se pierde la señal que destapó I-280).
 *
 * `vigencias_por_vencer` queda fuera de este spec por costo de fixture (Colegio
 * exige Pais/Ciudad/Tenant + representante legal completo); el candado del
 * comportamiento se cubrirá con test unitario en `inicio-admin.test.ts` (fuera
 * de la cancha de Calidad; nota al Dev en el PR).
 *
 * Estrategia de fixtures: **diferencial** — mide señales antes de sembrar,
 * siembra un lote acotado, mide después, y compara variaciones. Evita depender
 * del estado inicial de la BD y funciona en paralelo con otros specs.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const ADMIN_EMAIL = "e2e-i271-admin@proteccion.local";
const ADMIN_PASSWORD = "Admin123!Secure";

const CORRIDA = `e2e-i271-${randomUUID().slice(0, 8)}`;
const PREFIJO_MOTIVO = `${CORRIDA}-motivo`;
const PREFIJO_TEXTO = `${CORRIDA}-texto`;
const PREFIJO_ERROR = `${CORRIDA}-error`;

const HACE_50H = new Date(Date.now() - 50 * 60 * 60 * 1000);
const HACE_26H = new Date(Date.now() - 26 * 60 * 60 * 1000);

const sembrados = {
    solicitudComite: new Set<string>(),
    reporte: new Set<string>(),
    notificacion: new Set<string>(),
};

async function asegurarAdmin() {
    await prisma.usuario.upsert({
        where: { email: ADMIN_EMAIL },
        update: {},
        create: {
            email: ADMIN_EMAIL,
            nombre: "Admin E2E I-271",
            passwordHash: await hashPassword(ADMIN_PASSWORD),
            rol: "ADMIN" as RolUsuario,
            estado: "activo",
        },
    });
}

async function loginAdmin(page: import("@playwright/test").Page) {
    const res = await page.request.post("/api/auth/login", {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.status(), "login admin").toBe(200);
}

async function obtenerPlataforma(): Promise<{ id: string }> {
    const p = await prisma.plataforma.findFirst({ select: { id: true } });
    if (!p) throw new Error("No hay Plataforma sembrada (corre `prisma db seed`)");
    return p;
}

async function marcarDemo(entidad: string, entidadId: string, notas: string) {
    await prisma.demoMarcado.upsert({
        where: { entidad_entidadId: { entidad, entidadId } },
        update: {},
        create: {
            entidad,
            entidadId,
            metadata: { corrida: CORRIDA, script: "admin-inicio-carga-vs-salud", notas },
        },
    });
}

async function getSenales(page: import("@playwright/test").Page): Promise<Record<string, string>> {
    const res = await page.request.get("/api/admin/inicio/senales");
    expect(res.status(), "GET /api/admin/inicio/senales").toBe(200);
    const body = (await res.json()) as { alertas: Array<{ id: string; texto: string }> };
    return Object.fromEntries(body.alertas.map((a) => [a.id, a.texto]));
}

/** Extrae el primer número del texto — todas las señales llevan el conteo al inicio. */
function conteoDelTexto(texto: string | undefined): number {
    if (!texto) return 0;
    const m = texto.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
}

async function sembrarSolicitudComitePendienteVieja(esDemo: boolean, sufijo: string, plataformaId: string) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `${CORRIDA}-id-${sufijo}`,
            plataformaId,
            texto: `${PREFIJO_TEXTO}-comite-${sufijo}: reporte apoyo del spec i-271`,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-I271-${sufijo.toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            estado: "CLASIFICADO",
            creadoEn: HACE_50H,
        },
    });
    sembrados.reporte.add(reporte.id);
    if (esDemo) await marcarDemo("Reporte", reporte.id, `apoyo-comite-${sufijo}`);
    const solicitud = await prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero: `SC-I271-${sufijo.toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            estado: "PENDIENTE",
            motivo: `${PREFIJO_MOTIVO}-comite-${sufijo}`,
            creadoEn: HACE_50H,
        },
    });
    sembrados.solicitudComite.add(solicitud.id);
    if (esDemo) await marcarDemo("SolicitudComite", solicitud.id, `comite-vencido-${sufijo}`);
    return solicitud;
}

async function sembrarReporteHuerfanoViejo(esDemo: boolean, sufijo: string, plataformaId: string) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `${CORRIDA}-idH-${sufijo}`,
            plataformaId,
            texto: `${PREFIJO_TEXTO}-huerfano-${sufijo}: reporte spec i-271`,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-I271H-${sufijo.toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            estado: "REVISION_MANUAL",
            operadorId: null,
            creadoEn: HACE_26H,
        },
    });
    sembrados.reporte.add(reporte.id);
    if (esDemo) await marcarDemo("Reporte", reporte.id, `huerfano-${sufijo}`);
    return reporte;
}

async function sembrarNotificacionFallidaReciente(esDemo: boolean, sufijo: string) {
    const notif = await prisma.notificacion.create({
        data: {
            evento: "spec.i271",
            destinatarioEmail: esDemo
                ? `demo-e2e-i271-${sufijo}@proteccion.local`
                : `real-e2e-i271-${sufijo}@proteccion.local`,
            plantillaClave: "e2e.i271.fallida",
            canal: "EMAIL",
            variables: {},
            estado: "FALLIDA",
            ultimoError: `${PREFIJO_ERROR}-${sufijo}: fallo simulado del spec`,
        },
    });
    sembrados.notificacion.add(notif.id);
    if (esDemo) await marcarDemo("Notificacion", notif.id, `correo-fallido-${sufijo}`);
    return notif;
}

async function limpiarSembrados() {
    const idsSC = [...sembrados.solicitudComite];
    const idsRep = [...sembrados.reporte];
    const idsNotif = [...sembrados.notificacion];
    for (const [entidad, ids] of [
        ["SolicitudComite", idsSC],
        ["Reporte", idsRep],
        ["Notificacion", idsNotif],
    ] as const) {
        if (ids.length === 0) continue;
        await prisma.demoMarcado.deleteMany({ where: { entidad, entidadId: { in: ids } } });
    }
    if (idsSC.length > 0) await prisma.solicitudComite.deleteMany({ where: { id: { in: idsSC } } });
    if (idsRep.length > 0) await prisma.reporte.deleteMany({ where: { id: { in: idsRep } } });
    if (idsNotif.length > 0) await prisma.notificacion.deleteMany({ where: { id: { in: idsNotif } } });
    for (const s of Object.values(sembrados)) s.clear();
}

test.describe.serial("Inicio admin · partición CARGA vs SALUD (I-271)", () => {
    let plataformaId: string;

    test.beforeAll(async () => {
        await asegurarAdmin();
        plataformaId = (await obtenerPlataforma()).id;
    });
    test.afterAll(async () => {
        await limpiarSembrados();
    });

    // SPEC-393 · I-271 todavía viva en `948c798b` (fuente: `senalComiteVencido`
    // en `inicio-admin.ts:171-183` cuenta `SolicitudComite.PENDIENTE` sin JOIN
    // con DemoMarcado). `test.fail` documenta el defecto y "se da vuelta sola"
    // cuando llegue el arreglo: pasar entonces se reporta como "unexpected
    // pass" — señal explícita de que el candado ya lo cubre el código.
    test("CARGA sobre demo puro NO sube comite_vencido ni reportes_huerfanos", async ({ page }) => {
        test.fail(true, "I-271 · SPEC-393: pendiente de arreglo — la señal cuenta demo hoy");
        await loginAdmin(page);
        const antes = await getSenales(page);
        const conteoAntes = {
            comite: conteoDelTexto(antes["comite_vencido"]),
            huerfanos: conteoDelTexto(antes["reportes_huerfanos"]),
        };

        for (let i = 0; i < 5; i++) await sembrarSolicitudComitePendienteVieja(true, `demo${i}`, plataformaId);
        for (let i = 0; i < 3; i++) await sembrarReporteHuerfanoViejo(true, `demo${i}`, plataformaId);

        const despues = await getSenales(page);
        expect(conteoDelTexto(despues["comite_vencido"]), "comite_vencido no debe subir por demo").toBe(
            conteoAntes.comite
        );
        expect(conteoDelTexto(despues["reportes_huerfanos"]), "reportes_huerfanos no debe subir por demo").toBe(
            conteoAntes.huerfanos
        );
    });

    test("CARGA sobre datos reales SÍ sube comite_vencido (candado no-regresivo)", async ({ page }) => {
        await loginAdmin(page);
        const antes = conteoDelTexto((await getSenales(page))["comite_vencido"]);
        await sembrarSolicitudComitePendienteVieja(false, "real", plataformaId);
        const despues = conteoDelTexto((await getSenales(page))["comite_vencido"]);
        expect(despues, "comite_vencido debe subir en 1 con 1 solicitud real vencida").toBe(antes + 1);
    });

    test("SALUD sobre destinatarios demo SÍ dispara correos_fallidos_volumen (candado no-regresivo)", async ({
        page,
    }) => {
        await loginAdmin(page);
        // Umbral por defecto = 5. Sembramos 6 fallidas todas demo.
        for (let i = 0; i < 6; i++) await sembrarNotificacionFallidaReciente(true, `salud${i}`);
        const senales = await getSenales(page);
        // La señal puede llegar como `correos_fallidos_volumen` (media) o `correos_no_salen`
        // (alta, si el `ultimoError` matchea el patrón de cuota — no es nuestro caso).
        const alerta = senales["correos_fallidos_volumen"] ?? senales["correos_no_salen"];
        expect(alerta, "SALUD debe reportar correos fallidos aunque los destinatarios sean demo").toBeDefined();
    });
});
