import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { generarSugerenciasSimulacion } from "./sugerencias-simulador";

describe("generarSugerenciasSimulacion", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve IPs sugeridas del rango RFC 5737", async () => {
        const sugerencias = await generarSugerenciasSimulacion();
        expect(sugerencias.ipsSugeridas.length).toBeGreaterThan(0);
        expect(sugerencias.ipsSugeridas.every((ip) => ip.startsWith("192.0.2.") || ip.startsWith("198.51.100.") || ip.startsWith("203.0.113."))).toBe(true);
    });

    it("excluye IPs ya usadas en simulaciones previas", async () => {
        const admin = await crearUsuario("ADMIN");
        await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 1,
                creadoPorId: admin.id,
                estado: "COMPLETADA",
                configJson: { n: 1, ipInyectada: "192.0.2.10", identificador: "3000000001", plataforma: "whatsapp" },
            },
        });
        const sugerencias = await generarSugerenciasSimulacion();
        expect(sugerencias.ipsSugeridas).not.toContain("192.0.2.10");
    });

    it("devuelve identificadores y escenarios sugeridos", async () => {
        const sugerencias = await generarSugerenciasSimulacion();
        expect(sugerencias.identificadoresSugeridos.length).toBeGreaterThan(0);
        expect(sugerencias.escenariosSugeridos.length).toBeGreaterThan(0);
    });
});
