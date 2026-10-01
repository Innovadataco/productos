/**
 * SPEC-574 (Calidad) · El OPERADOR clasifica un reporte CON SU PROPIO ROL (no ADMIN prestado).
 *
 * EL HUECO (gemelo de SPEC-822, invertido): el único candado de «Asignar clasificación» era de RENDER
 * (`orden-foco-acciones.candado` monta la card con props, SIN login), y el panel admin entra como ADMIN.
 * Así el camino del OPERADOR nunca se ejerció. Un rol prestado no solo tapa cobertura: puede tapar que la
 * función NO exista para su dueño. Acá se entra COMO operador y se prueba que SÍ existe — y, lo que más
 * importa, se distingue cuál de los DOS 403 del endpoint dispara (`clasificar/route.ts`):
 *   · por-PERMISO: módulo (`assertModulo "bandeja_reportes"`) o rol (`!OPERADOR`) → «Permisos insuficientes».
 *   · por-CASO: el operador NO está asignado al reporte (`puedeGestionarReporte` → `operadorId === user.id`)
 *     → «No tiene permiso para gestionar este caso».
 * Si el recorrido no distingue cuál disparó, no probó NADA del operador (la trampa que marcó el CEO): un
 * 403 por falta de módulo/rol se leería como «el operador no puede clasificar», que es falso.
 *
 * El operador tiene el módulo `bandeja_reportes` por el seed (`seed-modulos-grants`: la revocación de
 * SPEC-266 fue a COMITE, no a OPERADOR). Por eso el happy path (ASIGNADO → 200) prueba que módulo + rol
 * pasan, y entonces el 403 del reporte NO asignado solo puede ser el por-CASO.
 *
 * API directa (sin pantalla): el RENDER ya lo cubre `orden-foco-acciones.candado`; acá se prueba el
 * CONTRATO del servidor con el rol TITULAR. Reportes REVISION_MANUAL SIN clasificación (clasificables).
 * Aislamiento: corrida por `randomUUID`, prefijo `RPT-574-`. Limpieza FK-safe en afterAll. Solo
 * `tests/e2e/**`; la guardia SPEC-770 del globalSetup garantiza BD `*_test`.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-574-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Operador574!Secure";
const OPERADOR_EMAIL = `${CORRIDA}-operador@proteccion.local`;

let operadorId = "";
const reportesCreados: string[] = [];

async function asegurarOperador(): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email: OPERADOR_EMAIL },
        update: { rol: "OPERADOR" as RolUsuario, estado: "activo" },
        create: {
            email: OPERADOR_EMAIL,
            nombre: `Operador E2E ${CORRIDA}`,
            passwordHash: await hashPassword(PASSWORD),
            rol: "OPERADOR" as RolUsuario,
            estado: "activo",
        },
        select: { id: true },
    });
    return u.id;
}

async function obtenerPlataforma(): Promise<string> {
    const p = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" }, select: { id: true } });
    if (!p) throw new Error("[SPEC-574] la BD de prueba no tiene la plataforma whatsapp sembrada");
    return p.id;
}

/** Reporte REVISION_MANUAL SIN clasificación (clasificable), opcionalmente ASIGNADO a un operador. */
async function crearReporteClasificable(opts: { operadorId?: string } = {}): Promise<string> {
    const plataformaId = await obtenerPlataforma();
    const numeroSeguimiento = `RPT-574-${randomUUID().replace(/-/g, "").toUpperCase().slice(0, 8)}`;
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `+57300OP574${randomUUID().replace(/-/g, "").slice(0, 8)}`,
            plataformaId,
            texto: "Texto de prueba SPEC-574 para la clasificación manual del operador, con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento,
            estado: "REVISION_MANUAL",
            ...(opts.operadorId ? { operadorId: opts.operadorId } : {}),
        },
    });
    reportesCreados.push(reporte.id);
    return reporte.id;
}

async function login(ctx: APIRequestContext, email: string) {
    const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function clasificar(ctx: APIRequestContext, reporteId: string) {
    return ctx.post(`/api/admin/reportes-revision/${reporteId}/clasificar`, {
        data: { categoria: "OFRECIMIENTO_REGALOS", nota: "Clasificación del operador para el recorrido SPEC-574 (nota auditable)." },
    });
}

test.describe.serial("SPEC-574 · el operador clasifica con su propio rol (no ADMIN prestado)", () => {
    test.beforeAll(async () => {
        operadorId = await asegurarOperador();
    });

    test.afterAll(async () => {
        // FK-safe: borrar los reportes CASCADEA ClasificacionIA (Cascade) → CorreccionAdmin (Cascade), así
        // que el operador (al que CorreccionAdmin.adminId apunta con Restrict) queda sin referencias y se
        // puede borrar. auditLog.usuarioId es opcional → SetNull, no bloquea. (ContenidoReporte queda
        // huérfano por el Restrict del lado del reporte — mismo leak aceptado que admin-panel.spec.)
        if (reportesCreados.length > 0) {
            await prisma.reporte
                .deleteMany({ where: { id: { in: reportesCreados } } })
                .catch((e) => console.warn("[SPEC-574] limpieza de reportes falló:", e));
        }
        await prisma.usuario
            .deleteMany({ where: { email: OPERADOR_EMAIL } })
            .catch((e) => console.warn("[SPEC-574] limpieza del operador falló:", e));
    });

    test("(A) el operador clasifica un reporte ASIGNADO a él → 200 (la función existe para su dueño)", async () => {
        // ASIGNADO: `operadorId = operador.id`. Pasa las cuatro compuertas (sesión → módulo bandeja_reportes
        // → rol OPERADOR → puedeGestionarReporte con el caso suyo). Un 200 prueba que el operador —con SU
        // rol, sin ADMIN prestado— SÍ puede clasificar: la función existe para su dueño.
        const reporteId = await crearReporteClasificable({ operadorId });
        const ctx = await playwrightRequest.newContext();
        try {
            await login(ctx, OPERADOR_EMAIL);
            const res = await clasificar(ctx, reporteId);
            expect(
                res.status(),
                `el operador ASIGNADO debe poder clasificar (200). body=${(await res.text().catch(() => "")).slice(0, 220)}`,
            ).toBe(200);
        } finally {
            await ctx.dispose();
        }
    });

    test("(B) discriminador · el operador NO asignado → 403 POR-CASO, no por-permiso", async () => {
        // NO asignado (operadorId null). El operador tiene módulo + rol (lo probó (A) con 200), así que este
        // 403 solo puede ser el por-CASO (`puedeGestionarReporte`). Se afirma el MENSAJE del caso, no solo el
        // status: un 403 por módulo/rol («Permisos insuficientes») significaría otra cosa — que el operador
        // no puede clasificar NADA— y el recorrido no habría probado el candado por-caso.
        const reporteId = await crearReporteClasificable();
        const ctx = await playwrightRequest.newContext();
        try {
            await login(ctx, OPERADOR_EMAIL);
            const res = await clasificar(ctx, reporteId);
            expect(res.status(), "el operador NO asignado recibe 403").toBe(403);
            const msg = (await res.json().catch(() => ({})))?.error?.message ?? "";
            expect(
                msg,
                `el 403 debe ser el POR-CASO («gestionar este caso»), NO el por-permiso («Permisos insuficientes»). msg="${msg}"`,
            ).toContain("gestionar este caso");
        } finally {
            await ctx.dispose();
        }
    });
});
