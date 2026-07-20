import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as POSTResolver } from "./route";
import { POST as POSTAsignar } from "../asignar/route";
import { POST as POSTEscalar } from "../../../reportes/[id]/escalar/route";
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

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearReporteDePrueba({ operadorId }: { operadorId?: string } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Mi hija María estudia en el colegio San José y su teléfono es 3001234567.";
    const textoAnonimizado = "Mi hija [NOMBRE] estudia en [COLEGIO] y su teléfono es [TELEFONO].";
    const reporte = await prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: textoAnonimizado,
            textoOriginal: encryptParameter(textoOriginal),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REVISION_MANUAL",
            numeroSeguimiento: `RPT-${Date.now()}`,
            operadorId,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "SOLICITUD_ENCUENTRO",
            confianza: 0.85,
            modeloUsado: "test",
            latenciaMs: 100,
        },
    });
    return prisma.reporte.findUnique({ where: { id: reporte.id }, include: { clasificacion: true } });
}

async function crearComite(adminId: string) {
    const comite = await crearUsuario("COMITE_VALIDACION", `comite-${Date.now()}@test.com`);
    await prisma.perfilOperador.create({
        data: { usuarioId: comite.id, creadoPorId: adminId, esComite: true },
    });
    return comite;
}

describe("POST /api/admin/comite/[id]/resolver", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function escalarYAsignar() {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id, esComite: false },
        });
        const comite = await crearComite(admin.id);
        const reporte = await crearReporteDePrueba({ operadorId: operador.id });

        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const resEscalar = await POSTEscalar(
            new Request(
                `http://localhost:5005/api/admin/reportes/${reporte!.id}/escalar`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({ motivo: "Caso ambiguo" }),
                }
            ),
            { params: Promise.resolve({ id: reporte!.id }) }
        );
        expect(resEscalar.status).toBe(201);
        const bodyEscalar = await resEscalar.json();

        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const resAsignar = await POSTAsignar(
            new Request(
                `http://localhost:5005/api/admin/comite/${bodyEscalar.solicitudId}/asignar`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({}),
                }
            ),
            { params: Promise.resolve({ id: bodyEscalar.solicitudId }) }
        );
        expect(resAsignar.status).toBe(200);

        return { admin, comite, reporte, solicitudId: bodyEscalar.solicitudId };
    }

    it("resuelve siempre en CORREGIDO y actualiza la clasificación", async () => {
        const { comite, solicitudId } = await escalarYAsignar();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await POSTResolver(
            new Request(
                `http://localhost:5005/api/admin/comite/${solicitudId}/resolver`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({
                        categoria: "OFRECIMIENTO_REGALOS",
                        resolucion: "Revisado por el comité",
                    }),
                }
            ),
            { params: Promise.resolve({ id: solicitudId }) }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("RESUELTA");
        expect(body.reporte.estado).toBe("CORREGIDO");
        expect(body.reporte.categoria).toBe("OFRECIMIENTO_REGALOS");

        const correccion = await prisma.correccionAdmin.findFirst({
            where: { clasificacion: { reporteId: body.reporte.id } },
        });
        expect(correccion).not.toBeNull();
        expect(correccion?.categoriaCorregida).toBe("OFRECIMIENTO_REGALOS");

        const transicion = await prisma.transicionReporte.findFirst({
            where: { reporteId: body.reporte.id, estadoNuevo: "CORREGIDO" },
        });
        expect(transicion).not.toBeNull();
        expect(transicion?.responsableTipo).toBe("COMITE");
    });

    it("rechaza sin categoría", async () => {
        const { comite, solicitudId } = await escalarYAsignar();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await POSTResolver(
            new Request(
                `http://localhost:5005/api/admin/comite/${solicitudId}/resolver`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({ resolucion: "Sin categoría" }),
                }
            ),
            { params: Promise.resolve({ id: solicitudId }) }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("Datos inválidos");
    });

    it("rechaza resolver una solicitud no asignada", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearComite(admin.id);
        const reporte = await crearReporteDePrueba();
        const solicitud = await prisma.solicitudComite.create({
            data: {
                reporteId: reporte!.id,
                numero: "SOL-TEST02",
                estado: "PENDIENTE",
                motivo: "Test",
            },
        });

        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const res = await POSTResolver(
            new Request(
                `http://localhost:5005/api/admin/comite/${solicitud.id}/resolver`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({ categoria: "OTRO" }),
                }
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(409);
    });
});
