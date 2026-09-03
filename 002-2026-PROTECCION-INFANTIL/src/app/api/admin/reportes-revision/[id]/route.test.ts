import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
} from "@/lib/reporte-test-utils";
import { encryptParameter } from "@/lib/param-encryption";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

async function crearReporteDePrueba({ operadorId }: { operadorId?: string } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Mi hija María estudia en el colegio San José y su teléfono es 3001234567.";
    const textoAnonimizado = "Mi hija [NOMBRE] estudia en [COLEGIO] y su teléfono es [TELEFONO].";
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: textoAnonimizado,
            textoOriginal: encryptParameter(textoOriginal),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REQUIERE_ANONIMIZACION",
            numeroSeguimiento: `RPT-${Date.now()}`,
            operadorId: operadorId ?? null,
        },
    });
}

describe("GET /api/admin/reportes-revision/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("no expone textoOriginal ni datos del denunciante al operador, pero sí puedeRevelarOriginal (SPEC-263)", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteDePrueba({ operadorId: operador.id });
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reporte).toBeDefined();
        expect(body.reporte.textoOriginal).toBeUndefined();
        expect(body.reporte.usuarioId).toBeUndefined();
        expect(body.reporte.usuario).toBeUndefined();
        // SPEC-263 (002-PI-164): el operador ahora tiene puedeRevelarOriginal=true
        // via expediente_revelar_original; el texto solo se entrega por el endpoint
        // POST /api/admin/reportes/:id/revelar-original (auditado con AuditLog).
        expect(body.puedeRevelarOriginal).toBe(true);
    });

    it("indica al admin que puede revelar el original", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteDePrueba();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reporte.textoOriginal).toBeUndefined();
        expect(body.puedeRevelarOriginal).toBe(true);
    });

    it("bloquea a operador no asignado", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteDePrueba();
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    // ── SPEC-384 · I-278 · el comité TAMBIÉN entra por acá ─────────────────
    // En prod, COMITE_VALIDACION tiene `comite_bandeja` activo pero NO
    // `bandeja_reportes` (I-274 · separación de poderes con el operador). El
    // guardia antes exigía `bandeja_reportes` para todos y cortaba al comité
    // con 403. Ahora enruta el módulo por rol.
    async function desactivarBandejaReportesParaComite() {
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "bandeja_reportes" } });
        expect(modulo, "el módulo debería estar sembrado").not.toBeNull();
        await prisma.permisoModulo.upsert({
            where: { rol_moduloId: { rol: "COMITE_VALIDACION", moduloId: modulo!.id } },
            update: { activo: false },
            create: { rol: "COMITE_VALIDACION", moduloId: modulo!.id, activo: false },
        });
    }

    it("SPEC-384/I-278: comité asignado al caso obtiene 200 aunque bandeja_reportes esté DESACTIVADO", async () => {
        await desactivarBandejaReportesParaComite();
        const comite = await crearUsuario("COMITE_VALIDACION");
        const reporte = await crearReporteDePrueba();
        // La rama de route.ts:51 autoriza al comité DUEÑO de la solicitud.
        await prisma.reporte.update({ where: { id: reporte.id }, data: { comiteId: comite.id } });
        activeToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status, "el comité entra por comite_bandeja, no por bandeja_reportes").toBe(200);
        const body = await res.json();
        expect(body.reporte).toBeDefined();
        expect(body.puedeRevelarOriginal).toBe(true);
    });

    it("SPEC-384/I-278: comité con OTRO caso sigue en 403 (autorización fina por comiteId se mantiene)", async () => {
        await desactivarBandejaReportesParaComite();
        const comite = await crearUsuario("COMITE_VALIDACION");
        const otroComite = await crearUsuario(
            "COMITE_VALIDACION",
            `otro-comite-${Date.now()}@test.local`
        );
        const reporte = await crearReporteDePrueba();
        await prisma.reporte.update({ where: { id: reporte.id }, data: { comiteId: otroComite.id } });
        activeToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status, "el comité sin el caso propio queda en 403 por la rama de comiteId").toBe(403);
        const body = await res.json();
        // Que el mensaje sea el de la autorización fina (no el de módulo) — así
        // sabemos que llegamos a route.ts:51, no que assertModulo cortó antes.
        expect(body.error.message.toLowerCase()).toContain("caso");
    });
});
