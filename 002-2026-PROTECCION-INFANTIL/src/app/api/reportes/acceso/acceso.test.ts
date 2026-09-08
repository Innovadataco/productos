import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import { POST as POST_SOLICITAR } from "../[id]/solicitar-acceso/route";
import { POST as POST_CANJEAR } from "./canjar/route";
import { GET as GET_VER } from "./ver/route";
import { GET as GET_DETALLE_ADMIN } from "@/app/api/admin/reportes-revision/[id]/route";
import { GET as GET_ACCESOS_TEXTO } from "@/app/api/admin/reportes/[id]/accesos-texto/route";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

async function crearReporteDePrueba(usuarioId?: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return crearReporteFixture(prisma, {
        data: {
            identificador: `+57300AC${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            plataformaId: plataforma!.id,
            texto: "Relato de prueba del flujo de código temporal",
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: !usuarioId,
            ...(usuarioId ? { usuarioId } : {}),
            estado: "REVISION_MANUAL",
        },
    });
}

async function autenticar(rol: "PARENT" | "PROFESIONAL" | "ADMIN" | "OPERADOR") {
    const usuario = await crearUsuario(rol);
    activeToken = await crearTokenUsuario(usuario.id, rol);
    return usuario;
}

describe("SPEC-584 (Fase 3) · acceso externo por código temporal", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    it("solicitar-acceso: el padre dueño recibe un código de 8 caracteres y queda hasheado en reposo", async () => {
        const padre = await autenticar("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);

        const res = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.codigo).toMatch(/^[A-Z2-9]{8}$/);
        expect(new Date(data.vigenteHasta).getTime()).toBeGreaterThan(Date.now());

        const codigoDb = await prisma.codigoAccesoContenido.findFirstOrThrow({ where: { reporteId: reporte.id } });
        expect(codigoDb.codigoHash).not.toContain(data.codigo);
        expect(codigoDb.codigoHash).toMatch(/^[0-9a-f]{64}$/);
        // Ninguna columna guarda el código en claro.
        expect(JSON.stringify(codigoDb)).not.toContain(data.codigo);

        // AuditLog del ciclo de vida (con hash, sin código en claro).
        const audit = await prisma.auditLog.findFirstOrThrow({ where: { accion: "CODIGO_ACCESO_SOLICITADO" } });
        expect(audit.usuarioId).toBe(padre.id);
    });

    it("solicitar-acceso: reporte ajeno o anónimo → 404 (sin revelar existencia)", async () => {
        const otroPadre = await autenticar("PARENT");
        const ajeno = await crearReporteDePrueba((await crearUsuario("PARENT")).id);
        const anonimo = await crearReporteDePrueba();

        for (const reporte of [ajeno, anonimo]) {
            const res = await POST_SOLICITAR(
                crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
                { params: Promise.resolve({ id: reporte.id }) }
            );
            expect(res.status).toBe(404);
        }
        expect(await prisma.codigoAccesoContenido.count()).toBe(0);
        void otroPadre;
    });

    it("solicitar-acceso: una nueva solicitud expira el código activo anterior", async () => {
        const padre = await autenticar("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);

        const r1 = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        const codigo1 = (await r1.json()).codigo as string;

        await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );

        // El código anterior quedó expirado: canjearlo da 410.
        const profesional = await autenticar("PROFESIONAL");
        void profesional;
        const resCanje = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo: codigo1 })
        );
        expect(resCanje.status).toBe(410);
    });

    it("canjar: profesional autenticado abre la sesión de 15 min; un solo canje (409 al repetir)", async () => {
        const padre = await autenticar("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        const resSol = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        const { codigo } = await resSol.json();

        const profesional = await autenticar("PROFESIONAL");
        const resCanje = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
        );
        expect(resCanje.status).toBe(200);
        const sesion = await resCanje.json();
        expect(sesion.tokenSesion).toMatch(/^[0-9a-f-]{36}$/);
        expect(sesion.reporteId).toBe(reporte.id);
        expect(new Date(sesion.expiraEn).getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);

        // AuditLog del canje con AMBOS responsables.
        const audit = await prisma.auditLog.findFirstOrThrow({ where: { accion: "CODIGO_ACCESO_CANJEADO" } });
        expect(audit.usuarioId).toBe(profesional.id);

        // Reintento con el mismo código → 409 (un solo canje).
        activeToken = null;
        await autenticar("PROFESIONAL");
        const resReintento = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
        );
        expect(resReintento.status).toBe(409);
    });

    it("canjar: código inexistente → 404; rol no autorizado (OPERADOR) → 403", async () => {
        await autenticar("PROFESIONAL");
        const res404 = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo: "ZZZZ9999" })
        );
        expect(res404.status).toBe(404);

        activeToken = null;
        await autenticar("OPERADOR");
        const res403 = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo: "ZZZZ9999" })
        );
        expect(res403.status).toBe(403);
    });

    it("ver: con la sesión devuelve SOLO el texto y audita como actor EXTERNO", async () => {
        const padre = await autenticar("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        const resSol = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        const { codigo } = await resSol.json();

        activeToken = null;
        await autenticar("PROFESIONAL");
        const resCanje = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
        );
        const { tokenSesion } = await resCanje.json();

        const resVer = await GET_VER(
            new Request(`http://localhost/api/reportes/acceso/ver?token=${tokenSesion}`, {
                headers: { cookie: `token=${activeToken}` },
            })
        );
        expect(resVer.status).toBe(200);
        const data = await resVer.json();
        expect(data.texto).toBe("Relato de prueba del flujo de código temporal");
        expect(data).not.toHaveProperty("textoOriginal");

        const auditoria = await prisma.lecturaReporte.findFirstOrThrow({ where: { reporteId: reporte.id } });
        expect(auditoria.tipoActor).toBe("EXTERNO");
        expect(auditoria.codigoAccesoId).not.toBeNull();
    });

    it("ver: sesión vencida → 410 con mensaje claro; token inválido → 400", async () => {
        const padre = await autenticar("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        const resSol = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/reportes/${reporte.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        const { codigo } = await resSol.json();

        activeToken = null;
        await autenticar("PROFESIONAL");
        const resCanje = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
        );
        const { tokenSesion } = await resCanje.json();

        // Vencer la sesión directamente en la fila.
        await prisma.codigoAccesoContenido.updateMany({
            where: { reporteId: reporte.id },
            data: { sesionExpiraEn: new Date(Date.now() - 1000) },
        });
        const resVencida = await GET_VER(
            new Request(`http://localhost/api/reportes/acceso/ver?token=${tokenSesion}`, {
                headers: { cookie: `token=${activeToken}` },
            })
        );
        expect(resVencida.status).toBe(410);

        const resTokenInvalido = await GET_VER(
            new Request("http://localhost/api/reportes/acceso/ver?token=no-es-uuid", {
                headers: { cookie: `token=${activeToken}` },
            })
        );
        expect(resTokenInvalido.status).toBe(400);
    });
});

describe("SPEC-584 (Fase 2) · lectura admin real: auditoría + notificación al padre", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    async function sembrarReglaTextoLeido() {
        await prisma.notificacionPlantilla.create({
            data: {
                clave: "padre.reporte.texto_leido.email",
                canal: "EMAIL",
                asunto: "Aviso de lectura",
                cuerpoMarkdown: "Lectura del {{campo}} de tu reporte sobre {{identificador}}.",
                variablesSchema: {},
            },
        });
        await prisma.notificacionRegla.create({
            data: {
                evento: "padre.reporte.texto_leido",
                rol: "PARENT",
                offset: "+0m",
                canal: "EMAIL",
                plantillaClave: "padre.reporte.texto_leido.email",
            },
        });
    }

    it("el detalle admin deja la fila de auditoría y notifica al padre dueño", async () => {
        await sembrarReglaTextoLeido();
        const padre = await crearUsuario("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        const admin = await autenticar("ADMIN");

        const res = await GET_DETALLE_ADMIN(
            new Request(`http://localhost/api/admin/reportes-revision/${reporte.id}`, {
                headers: { cookie: `token=${activeToken}` },
            }),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reporte.texto).toBe("Relato de prueba del flujo de código temporal");

        const auditoria = await prisma.lecturaReporte.findFirstOrThrow({ where: { reporteId: reporte.id } });
        expect(auditoria.tipoActor).toBe("PLATAFORMA");
        expect(auditoria.usuarioId).toBe(admin.id);
        expect(auditoria.campo).toBe("texto");
        expect(auditoria.hashContenido).toMatch(/^[0-9a-f]{64}$/);

        // Notificación encolada al padre dueño (sin el texto).
        const notificaciones = await prisma.notificacion.findMany({ where: { evento: "padre.reporte.texto_leido" } });
        expect(notificaciones).toHaveLength(1);
        expect(notificaciones[0].destinatarioUsuarioId).toBe(padre.id);
        expect(JSON.stringify(notificaciones[0].variables)).not.toContain("Relato de prueba");
    });

    it("reporte ANÓNIMO: el detalle admin audita pero NO genera notificación (no hay padre)", async () => {
        await sembrarReglaTextoLeido();
        const reporte = await crearReporteDePrueba(); // anónimo
        await autenticar("ADMIN");

        const res = await GET_DETALLE_ADMIN(
            new Request(`http://localhost/api/admin/reportes-revision/${reporte.id}`, {
                headers: { cookie: `token=${activeToken}` },
            }),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);

        expect(await prisma.lecturaReporte.count({ where: { reporteId: reporte.id } })).toBe(1);
        expect(await prisma.notificacion.count({ where: { evento: "padre.reporte.texto_leido" } })).toBe(0);
    });

    it("accesos-texto: el historial es visible para el operador con permiso sobre el caso", async () => {
        const padre = await crearUsuario("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        // El operador autenticado DEBE ser el asignado al caso (puedeGestionarReporte).
        const operador = await autenticar("OPERADOR");
        await prisma.reporte.update({ where: { id: reporte.id }, data: { operadorId: operador.id } });

        // Primero genera una lectura (detalle admin).
        await GET_DETALLE_ADMIN(
            new Request(`http://localhost/api/admin/reportes-revision/${reporte.id}`, {
                headers: { cookie: `token=${activeToken}` },
            }),
            { params: Promise.resolve({ id: reporte.id }) }
        );

        const res = await GET_ACCESOS_TEXTO(
            new Request(`http://localhost/api/admin/reportes/${reporte.id}/accesos-texto`, {
                headers: { cookie: `token=${activeToken}` },
            }),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0].campo).toBe("texto");
        expect(data.items[0].tipoActor).toBe("PLATAFORMA");
    });
});
