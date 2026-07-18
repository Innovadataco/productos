import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as GETPendientes } from "./route";
import { POST as POSTAsignar } from "../[id]/asignar/route";
import { POST as POSTResolver } from "../[id]/resolver/route";
import { POST as POSTEscalar } from "../../reportes/[id]/escalar/route";
import { GET as GETDetalle } from "../../reportes-revision/[id]/route";
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

describe("Flujo de comité de validación", () => {
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

    it("operador escala caso, comité lo ve, se asigna y resuelve", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id, esComite: false },
        });
        const comite = await crearComite(admin.id);
        const reporte = await crearReporteDePrueba({ operadorId: operador.id });

        // Operador escala
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const resEscalar = await POSTEscalar(
            new Request(
                `http://localhost:5005/api/admin/reportes/${reporte!.id}/escalar`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({ motivo: "Caso ambiguo, necesita segunda opinión" }),
                }
            ),
            { params: Promise.resolve({ id: reporte!.id }) }
        );
        expect(resEscalar.status).toBe(201);
        const bodyEscalar = await resEscalar.json();
        expect(bodyEscalar.numero).toMatch(/^SOL-[A-F0-9]{8}$/);
        expect(bodyEscalar.estado).toBe("PENDIENTE");

        const reporteEscalado = await prisma.reporte.findUnique({ where: { id: reporte!.id } });
        expect(reporteEscalado?.operadorId).toBeNull();
        expect(reporteEscalado?.comiteId).toBeNull();
        expect(reporteEscalado?.estado).toBe("REVISION_MANUAL");

        // Comité ve pendientes
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const resPendientes = await GETPendientes(
            new Request("http://localhost:5005/api/admin/comite/pendientes", {
                headers: { cookie: `token=${mockToken}` },
            })
        );
        expect(resPendientes.status).toBe(200);
        const bodyPendientes = await resPendientes.json();
        expect(bodyPendientes.solicitudes).toHaveLength(1);
        const solicitud = bodyPendientes.solicitudes[0];

        // Comité se asigna
        const resAsignar = await POSTAsignar(
            new Request(
                `http://localhost:5005/api/admin/comite/${solicitud.id}/asignar`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({}),
                }
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );
        expect(resAsignar.status).toBe(200);
        const bodyAsignar = await resAsignar.json();
        expect(bodyAsignar.estado).toBe("ASIGNADA");
        expect(bodyAsignar.comiteId).toBe(comite.id);

        const reporteAsignado = await prisma.reporte.findUnique({ where: { id: reporte!.id } });
        expect(reporteAsignado?.comiteId).toBe(comite.id);

        // Comité resuelve clasificando
        const resResolver = await POSTResolver(
            new Request(
                `http://localhost:5005/api/admin/comite/${solicitud.id}/resolver`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                    body: JSON.stringify({
                        accion: "CLASIFICAR",
                        categoria: "SOLICITUD_ENCUENTRO",
                        resolucion: "El contenido es claramente una solicitud de encuentro",
                    }),
                }
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );
        expect(resResolver.status).toBe(200);
        const bodyResolver = await resResolver.json();
        expect(bodyResolver.estado).toBe("RESUELTA");
        expect(bodyResolver.reporte.estado).toBe("CLASIFICADO");

        const solicitudResuelta = await prisma.solicitudComite.findUnique({ where: { id: solicitud.id } });
        expect(solicitudResuelta?.estado).toBe("RESUELTA");
        expect(solicitudResuelta?.resolucion).toBe("El contenido es claramente una solicitud de encuentro");
    });

    it("comité no ve datos del denunciante en detalle de reporte", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearComite(admin.id);
        const reporte = await crearReporteDePrueba();
        await prisma.solicitudComite.create({
            data: {
                reporteId: reporte!.id,
                numero: "SOL-TEST01",
                estado: "ASIGNADA",
                comiteId: comite.id,
                motivo: "Test",
            },
        });
        await prisma.reporte.update({ where: { id: reporte!.id }, data: { comiteId: comite.id } });

        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const res = await GETDetalle(
            new Request(
                `http://localhost:5005/api/admin/reportes-revision/${reporte!.id}`,
                { headers: { cookie: `token=${mockToken}` } }
            ),
            { params: Promise.resolve({ id: reporte!.id }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reporte).toBeDefined();
        expect(body.reporte.textoOriginal).toBeUndefined();
        expect(body.reporte.usuarioId).toBeUndefined();
        expect(body.reporte.usuario).toBeUndefined();
        expect(body.puedeRevelarOriginal).toBe(false);
    });
});
