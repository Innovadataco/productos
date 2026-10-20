import { describe, it, expect, beforeEach, vi } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearPlataforma,
    crearPaisCiudad,
} from "@/lib/reporte-test-utils";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

/** resetDatabase otorga TODOS los módulos a TODOS los roles: para probar el gating hay que quitar el módulo explícitamente. */
async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

async function crearReporteConOriginalCifrado(propiedad: { operadorId?: string; comiteId?: string } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Mi hija María estudia en el colegio San José y su teléfono es 3001234567.";
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `+57300TEST${Date.now() % 1000}`,
            plataformaId: plataforma!.id,
            texto: "Texto anonimizado de prueba para el reporte de validación.",
            // S-C: el original va EN PLANO al fixture; el factory lo cifra con la DEK por denuncia.
            textoOriginal,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REQUIERE_ANONIMIZACION",
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
    });
    // SPEC-891: asignar pertenencia (operador dueño / comité del caso escalado) para probar el gate 3-vías.
    if (propiedad.operadorId || propiedad.comiteId) {
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: {
                ...(propiedad.operadorId ? { operadorId: propiedad.operadorId } : {}),
                ...(propiedad.comiteId ? { comiteId: propiedad.comiteId } : {}),
            },
        });
    }
    return reporte;
}

describe("POST /api/admin/reportes/[id]/revelar-original", () => {
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

    it("permite a ADMIN revelar el texto original y deja audit log", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteConOriginalCifrado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.textoOriginal).toContain("María");
        expect(body.textoOriginal).toContain("3001234567");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "TEXTO_ORIGINAL_REVELADO", recursoId: reporte.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
    });

    it("bloquea a OPERADOR sin el módulo expediente_revelar_original", async () => {
        const operador = await crearUsuario("OPERADOR");
        await revocarModulo("OPERADOR", "expediente_revelar_original");
        const reporte = await crearReporteConOriginalCifrado();
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    it("permite a OPERADOR DUEÑO con el módulo expediente_revelar_original otorgado", async () => {
        // Spec 096-US5: el acceso lo gobierna el módulo, no el rol duro. SPEC-891: además debe ser el DUEÑO.
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteConOriginalCifrado({ operadorId: operador.id });
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.textoOriginal).toContain("María");
    });

    it("devuelve 404 si el reporte no existe", async () => {
        // S-C (D-116/D-117): TODO reporte tiene su original sellado al alta (write-once), así que ya
        // no existe «reporte sin texto original». El único 404 del endpoint es reporte inexistente.
        const admin = await crearUsuario("ADMIN");
        const idInexistente = "cm00000000000000000000000";
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${idInexistente}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: idInexistente }) });
        expect(res.status).toBe(404);
    });
});

/**
 * CANDADO · SPEC-891 (IDOR · pertenencia por reporte) — revelar-original descifra el textoOriginal.
 * El módulo `expediente_revelar_original` lo tienen OPERADOR y COMITE; sin pertenencia, cualquiera descifra
 * el relato de CUALQUIER reporte. Control positivo en las 3 ramas: dueño pasa, ajeno 403, ADMIN pasa. Si se
 * quita el chequeo 3-vías, las ramas «ajeno → 403» pasan a 200 y el candado muere con el defecto.
 */
describe("POST /api/admin/reportes/[id]/revelar-original · SPEC-891 pertenencia (IDOR)", () => {
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

    async function revelar(reporteId: string, userId: string, rol: RolUsuario) {
        activeToken = await crearTokenUsuario(userId, rol);
        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporteId}/revelar-original`,
            {},
            activeToken
        );
        return POST(req, { params: Promise.resolve({ id: reporteId }) });
    }

    it("OPERADOR dueño (operadorId) → 200", async () => {
        const dueno = await crearUsuario("OPERADOR");
        const reporte = await crearReporteConOriginalCifrado({ operadorId: dueno.id });
        expect((await revelar(reporte.id, dueno.id, "OPERADOR")).status).toBe(200);
    });

    it("OPERADOR NO dueño (cross-tenant) → 403", async () => {
        const dueno = await crearUsuario("OPERADOR");
        const ajeno = await crearUsuario("OPERADOR");
        const reporte = await crearReporteConOriginalCifrado({ operadorId: dueno.id });
        expect((await revelar(reporte.id, ajeno.id, "OPERADOR")).status).toBe(403);
    });

    it("COMITE dueño del caso escalado (comiteId) → 200", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const reporte = await crearReporteConOriginalCifrado({ comiteId: comite.id });
        expect((await revelar(reporte.id, comite.id, "COMITE_VALIDACION")).status).toBe(200);
    });

    it("COMITE de OTRO caso escalado → 403", async () => {
        const dueno = await crearUsuario("COMITE_VALIDACION");
        const ajeno = await crearUsuario("COMITE_VALIDACION");
        const reporte = await crearReporteConOriginalCifrado({ comiteId: dueno.id });
        expect((await revelar(reporte.id, ajeno.id, "COMITE_VALIDACION")).status).toBe(403);
    });

    it("ADMIN → 200 (ve todo por diseño)", async () => {
        const admin = await crearUsuario("ADMIN");
        const dueno = await crearUsuario("OPERADOR");
        const reporte = await crearReporteConOriginalCifrado({ operadorId: dueno.id });
        expect((await revelar(reporte.id, admin.id, "ADMIN")).status).toBe(200);
    });
});
