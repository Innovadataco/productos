import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { POST } from "./route";
import { POST as POST_CORRECCIONES } from "@/app/api/admin/correcciones/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

/**
 * SPEC-557 (I-345) · CANDADO de deshacer una confirmación de clasificación.
 *
 * EL CORAZÓN (exigencia del CEO): el candado MUERE si el deshacer deja el reporte
 * VISIBLE. Un clic perdido puede volver público el reporte de un menor; deshacer
 * tiene que sacarlo de público. Además: revierte a REVISION_MANUAL, borra la fila
 * de confirmación (para NO gastar la única corrección) y respeta la precondición
 * de ESTADO (no de reloj).
 */
let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("POST /api/admin/reportes-revision/[id]/deshacer-confirmacion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    // Estado POST-confirmación: reporte CLASIFICADO + fila `confirmada` + agregado
    // VISIBLE (lo peligroso: la denuncia del menor quedó pública tras el clic).
    async function setupConfirmadoYVisible(over: { estado?: string; confirmada?: boolean } = {}) {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        const identificador = "+57300DESHACER";
        const reporte = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                usuarioId: usuario.id,
                texto: "Mensaje ofreciendo regalos a cambio de fotos.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-DESH001",
                estado: (over.estado ?? "CLASIFICADO") as never,
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
                confianza: 0.8,
                contienePii: false,
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        await prisma.correccionAdmin.create({
            data: {
                clasificacionId: clasificacion.id,
                categoriaOriginal: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
                categoriaCorregida: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
                adminId: usuario.id,
                confirmada: over.confirmada ?? true,
            },
        });
        // El agregado quedó VISIBLE por la confirmación.
        await prisma.identificadorReportado.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                totalReportes: 1,
                reportesAutenticados: 1,
                reportesAprobados: 1,
                autenticadosAprobados: 1,
                esVisiblePublicamente: true,
            },
        });
        return { reporte, clasificacion, identificador, plataformaId: plataforma!.id };
    }

    function req(reporteId: string) {
        return new Request(`http://localhost:5005/api/admin/reportes-revision/${reporteId}/deshacer-confirmacion`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: mockToken ? `token=${mockToken}` : "" },
        });
    }

    it("CORAZÓN: deshacer SACA de público, revierte a REVISION_MANUAL y borra la fila", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte, clasificacion, identificador, plataformaId } = await setupConfirmadoYVisible();

        const res = await POST(req(reporte.id), { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        expect((await res.json()).estado).toBe("REVISION_MANUAL");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");

        // EL CORAZÓN: el reporte del menor ya NO es visible públicamente.
        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId } },
        });
        expect(agregado?.esVisiblePublicamente).toBe(false);

        // La fila de confirmación se borró (libera el slot @unique).
        const fila = await prisma.correccionAdmin.findUnique({ where: { clasificacionId: clasificacion.id } });
        expect(fila).toBeNull();
    });

    it("NO gasta la única corrección: tras deshacer, corregir la clasificación funciona", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupConfirmadoYVisible();

        await POST(req(reporte.id), { params: Promise.resolve({ id: reporte.id }) });

        // Ahora una corrección real debe pasar (el slot quedó libre).
        const corrReq = new Request("http://localhost:5005/api/admin/correcciones", {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: `token=${mockToken}` },
            body: JSON.stringify({ reporteId: reporte.id, categoriaCorregida: "EXTORSION" }),
        });
        const corrRes = await POST_CORRECCIONES(corrReq);
        expect(corrRes.status).toBe(200);
    });

    it("(c) precondición de ESTADO: si el reporte ya no está CLASIFICADO, 409", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupConfirmadoYVisible({ estado: "CORREGIDO" });

        const res = await POST(req(reporte.id), { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(409);
    });

    it("(a) NO deshace una corrección (confirmada:false): 409", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupConfirmadoYVisible({ confirmada: false });

        const res = await POST(req(reporte.id), { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(409);
    });

    it("rechaza si el usuario no es operador ni admin (403)", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const { reporte } = await setupConfirmadoYVisible();

        const res = await POST(req(reporte.id), { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    it("(b) decisión CEO: NO restringe al operador asignado — el endpoint no llama puedeGestionarReporte", () => {
        // El fix tiene que estar disponible para CUALQUIERA con el módulo, no solo
        // quien confirmó (si cierra sesión, el reporte no puede quedar atascado ni
        // público). La responsabilidad la cubre la auditoría (la transición registra
        // responsableId). Muere si alguien reintroduce la puerta de asignación.
        const src = fs.readFileSync(path.join(__dirname, "route.ts"), "utf-8");
        expect(src).not.toMatch(/puedeGestionarReporte\s*\(/);
    });
});
