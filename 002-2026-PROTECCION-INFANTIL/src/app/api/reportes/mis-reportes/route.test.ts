import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

let parentUser: Awaited<ReturnType<typeof crearUsuario>>;

async function setupParent() {
    parentUser = await crearUsuario("PARENT");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(parentUser);
}

async function crearReporteUsuario(
    identificador: string,
    estado: "PENDIENTE" | "CLASIFICADO" | "DUPLICADO",
    eliminado = false
) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para mis reportes.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: parentUser.id,
            numeroSeguimiento: `RPT-${identificador.replace(/\+/g, "")}`,
            estado,
            eliminado,
        },
    });
}

describe("GET /api/reportes/mis-reportes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await setupParent();
    });

    it("filtra reportes eliminados y mapea estados visuales", async () => {
        await crearReporteUsuario("+57300ACTIVO1", "PENDIENTE");
        await crearReporteUsuario("+57300ACTIVO2", "CLASIFICADO");
        await crearReporteUsuario("+57300BAJA", "PENDIENTE", true);

        const res = await GET(new Request("http://localhost:5005/api/reportes/mis-reportes?page=1&pageSize=25"));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.items).toHaveLength(2);
        expect(body.pagination.total).toBe(2);

        const pendiente = body.items.find((r: { estadoInterno: string }) => r.estadoInterno === "PENDIENTE");
        const procesado = body.items.find((r: { estadoInterno: string }) => r.estadoInterno === "CLASIFICADO");

        expect(pendiente.estadoVisual).toBe("En proceso");
        expect(pendiente.badge).toBe("warning");
        expect(pendiente.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 24 horas");
        expect(pendiente.slaHoras).toBe(24);

        expect(procesado.estadoVisual).toBe("Verificado");
        expect(procesado.badge).toBe("success");
        expect(procesado.mensaje).toBe("Tu reporte ha sido verificado y clasificado.");

        const eliminado = body.items.find((r: { identificador: string }) => r.identificador === "+57300BAJA");
        expect(eliminado).toBeUndefined();
    });

    it("refleja cambios en ui.sla_horas_procesamiento", async () => {
        await prisma.parametroSistema.updateMany({
            where: { clave: "ui.sla_horas_procesamiento" },
            data: { valor: "12" },
        });
        await crearReporteUsuario("+57300SLA", "PENDIENTE");

        const res = await GET(new Request("http://localhost:5005/api/reportes/mis-reportes"));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.items[0].slaHoras).toBe(12);
        expect(body.items[0].mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 12 horas");
    });

    it("mapea DUPLICADO a 'Procesado' con badge muted", async () => {
        await crearReporteUsuario("+57300DUP", "DUPLICADO");

        const res = await GET(new Request("http://localhost:5005/api/reportes/mis-reportes"));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.items[0].estadoVisual).toBe("En proceso");
        expect(body.items[0].badge).toBe("warning");
        expect(body.items[0].mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 24 horas");
    });
});
