/**
 * SPEC-605 · GET /api/padre/expedientes/[id]/estado — «Consultar estado».
 *
 * El botón de la cabecera de la pantalla madre pega acá y trae el estado
 * FRESCO: eventos propios en cola del motor → EN_PROCESO; todos clasificados
 * → PROCESADO. Boundary: 401 sin sesión, 403 otros roles, 404 expedientes
 * ajenos. Candado gemelo de SPEC-340: esta subruta NO es el GET [id] borrado
 * (expone solo estados y fechas, jamás texto).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function llamar(id: string) {
    return GET(new Request(`http://localhost:5005/api/padre/expedientes/${id}/estado`), {
        params: Promise.resolve({ id }),
    });
}

describe("GET /api/padre/expedientes/[id]/estado", () => {
    beforeEach(async () => {
        mockToken = undefined;
        await resetDatabase();
    });

    it("devuelve EN_PROCESO con eventos en cola y PROCESADO cuando todos terminaron", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-api-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await prisma.expediente.create({
            data: {
                padreUsuarioId: padre.id,
                identificadorReportado: "cuenta_api_605",
                fechaApertura: new Date(),
                estado: "ACTIVO",
            },
        });
        const reporte = await prisma.$transaction((tx) =>
            crearReporteConTexto(tx, {
                texto: "Relato de prueba con suficiente contenido para el reporte.",
                reporte: {
                    usuarioId: padre.id,
                    plataformaId: plataforma.id,
                    identificador: "cuenta_api_605",
                    fechaIncidente: new Date(),
                    estado: "PENDIENTE",
                    esAnonimo: false,
                    pais: "Colombia",
                    ciudad: "Bogotá",
                },
            })
        );
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        let res = await llamar(expediente.id);
        expect(res.status).toBe(200);
        let json = await res.json();
        expect(json.estadoReportes).toBe("EN_PROCESO");
        expect(json.procesando).toBe(1);
        expect(json.estadoExpediente).toBe("ACTIVO");
        expect(json.actualizadoEn).toEqual(expect.any(String));

        await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "CLASIFICADO" } });
        res = await llamar(expediente.id);
        json = await res.json();
        expect(json.estadoReportes).toBe("PROCESADO");
        expect(json.procesando).toBe(0);

        // Candado de blindaje: el texto del reporte nunca sale por esta ruta.
        expect(JSON.stringify(json)).not.toContain("Relato de prueba");
    });

    it("404 para expediente de otro padre y 403 para roles que no son PARENT", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-api-b-${Date.now()}@test.local`);
        const otro = await crearUsuario("PARENT", `padre-605-api-c-${Date.now()}@test.local`);
        const admin = await crearUsuario("ADMIN", `admin-605-api-${Date.now()}@test.local`);
        const expediente = await prisma.expediente.create({
            data: {
                padreUsuarioId: padre.id,
                identificadorReportado: "cuenta_ajena_605",
                fechaApertura: new Date(),
                estado: "ACTIVO",
            },
        });

        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        expect((await llamar(expediente.id)).status).toBe(404);

        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await llamar(expediente.id)).status).toBe(403);

        mockToken = undefined;
        expect((await llamar(expediente.id)).status).toBe(401);
    });
});
