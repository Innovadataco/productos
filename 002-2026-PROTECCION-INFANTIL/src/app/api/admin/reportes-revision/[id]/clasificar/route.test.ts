/**
 * A-70 · B2 — el operador SÍ puede clasificar.
 *
 * Repro de Jelkin: reporte en REVISION_MANUAL sin `ClasificacionIA` (cayó al
 * limbo antes de que el motor lo clasificara). Antes de este endpoint el caso
 * quedaba atascado para siempre: `/confirmar` daba 400 y `/api/admin/correcciones`
 * daba 409, ambos por la misma razón — exigían una clasificación que no existía.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { POST as POSTConfirmar } from "../confirmar/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("POST /api/admin/reportes-revision/[id]/clasificar (A-70 · B2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    /**
     * El caso de Jelkin: REVISION_MANUAL y SIN clasificación.
     * `operadorId` porque la regla vigente (`puedeGestionarReporte`) da al
     * OPERADOR solo los casos asignados a él; el admin puede con cualquiera.
     */
    async function reporteAtascado(operadorId?: string) {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        return prisma.reporte.create({
            data: {
                identificador: "+57300ATASCADO",
                plataformaId: plataforma!.id,
                usuarioId: usuario.id,
                texto: "Ráfaga de 4 eventos el mismo día.",
                fechaIncidente: new Date("2026-08-30T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-ATASCA1",
                estado: "REVISION_MANUAL",
                ...(operadorId ? { operadorId } : {}),
            },
        });
    }

    function req(reporteId: string, body: unknown, token?: string) {
        return new Request(`http://localhost:5005/api/admin/reportes-revision/${reporteId}/clasificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: token ? `token=${token}` : "" },
            body: JSON.stringify(body),
        });
    }

    it("el caso de Jelkin SIN el fix quedaba atascado: /confirmar responde 400", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await reporteAtascado();

        const res = await POSTConfirmar(
            new Request("http://localhost:5005/x", { method: "POST", headers: { Cookie: `token=${mockToken}` } }),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status, "esta es la puerta cerrada que motivó B2").toBe(400);
        const body = await res.json();
        expect(body.error.message).toMatch(/no tiene clasificación/i);
    });

    it("OPERADOR clasifica el reporte atascado: crea la clasificación y pasa a CLASIFICADO", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const reporte = await reporteAtascado(operador.id);

        const res = await POST(
            req(reporte.id, { categoria: "CIBERACOSO", nota: "Ráfaga sostenida contra el mismo menor." }, mockToken),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.categoria).toBe("CIBERACOSO");
        expect(body.estado).toBe("CLASIFICADO");
        expect(body.origen).toBe("manual");

        // Assert fuerte: la clasificación EXISTE y queda marcada como humana.
        const clasificacion = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(clasificacion, "el caso deja de estar atascado").not.toBeNull();
        expect(clasificacion!.categoria).toBe("CIBERACOSO");
        expect(clasificacion!.modeloUsado, "queda la huella de que NO salió del motor").toBe("manual:operador");

        // El reporte salió del limbo.
        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado!.estado).toBe("CLASIFICADO");
    });

    it("la nota queda auditada con quién clasificó y por qué", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const reporte = await reporteAtascado(operador.id);

        await POST(
            req(reporte.id, { categoria: "EXTORSION", nota: "Pide dinero a cambio de no difundir." }, mockToken),
            { params: Promise.resolve({ id: reporte.id }) }
        );

        const clasificacion = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        const correccion = await prisma.correccionAdmin.findUnique({
            where: { clasificacionId: clasificacion!.id },
        });
        expect(correccion, "la decisión humana deja registro").not.toBeNull();
        expect(correccion!.adminId).toBe(operador.id);
        expect(correccion!.motivo).toBe("Pide dinero a cambio de no difundir.");

        const audit = await prisma.auditLog.findFirst({
            where: { tipoRecurso: "Reporte", recursoId: reporte.id, accion: "CASO_CONFIRMADO" },
            orderBy: { creadoEn: "desc" },
        });
        expect(audit, "queda en la bitácora de auditoría").not.toBeNull();
        expect(audit!.usuarioId).toBe(operador.id);
        expect(String(audit!.valorNuevo)).toContain("manual");
    });

    it("nota vacía o muy corta → 400 con el motivo (la decisión debe explicarse)", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const reporte = await reporteAtascado(operador.id);

        const res = await POST(
            req(reporte.id, { categoria: "CIBERACOSO", nota: "ok" }, mockToken),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toMatch(/criterio/i);

        const clasificacion = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(clasificacion, "sin nota válida no se clasifica").toBeNull();
    });

    it("categoría fuera del catálogo → 400", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const reporte = await reporteAtascado(operador.id);

        const res = await POST(
            req(reporte.id, { categoria: "INVENTADA", nota: "una nota suficientemente larga" }, mockToken),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(400);
    });

    it("si YA hay clasificación → 409 y remite a corrección (no la pisa en silencio)", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const reporte = await reporteAtascado(operador.id);
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OTRO",
                confianza: 0.7,
                contienePii: false,
                modeloUsado: "ornith:9b",
                latenciaMs: 900,
            },
        });

        const res = await POST(
            req(reporte.id, { categoria: "CIBERACOSO", nota: "quiero cambiarla desde acá" }, mockToken),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(409);

        const clasificacion = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(clasificacion!.categoria, "la del motor queda intacta").toBe("OTRO");
    });

    it("PARENT no puede clasificar (403)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const reporte = await reporteAtascado();

        const res = await POST(
            req(reporte.id, { categoria: "CIBERACOSO", nota: "una nota suficientemente larga" }, mockToken),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(403);
    });
});
