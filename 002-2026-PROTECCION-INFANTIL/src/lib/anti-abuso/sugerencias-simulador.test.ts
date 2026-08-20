import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { generarSugerenciasPorEscenario } from "./sugerencias-simulador";

describe("generarSugerenciasPorEscenario", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("robot_inundando: IP RFC 5737, N=50, whatsapp", async () => {
        const s = await generarSugerenciasPorEscenario("robot_inundando");
        expect(s.escenario).toBe("robot_inundando");
        expect(s.n).toBe(50);
        expect(s.plataforma).toBe("whatsapp");
        expect(s.ip).toMatch(/^192\.0\.2\.\d+$/);
        expect(s.descripcion).toContain("robot");
    });

    it("ataque_coordinado: rango de IPs, mismo identificador, N=30", async () => {
        const s = await generarSugerenciasPorEscenario("ataque_coordinado");
        expect(s.escenario).toBe("ataque_coordinado");
        expect(s.n).toBe(30);
        expect(s.ips).toHaveLength(30);
        expect(s.ips?.every((ip) => ip.startsWith("192.0.2."))).toBe(true);
        expect(s.identificador).toBeDefined();
        expect(s.plataforma).toBe("whatsapp");
    });

    it("bot_ips_rotativas: IPs de 198.51.100.0/24, identificadores distintos, N=20", async () => {
        const s = await generarSugerenciasPorEscenario("bot_ips_rotativas");
        expect(s.escenario).toBe("bot_ips_rotativas");
        expect(s.n).toBe(20);
        expect(s.ips?.length).toBe(20);
        expect(s.ips?.every((ip) => ip.startsWith("198.51.100."))).toBe(true);
        expect(s.identificadores?.length).toBe(20);
        expect(s.plataforma).toBe("telegram");
    });

    it("denunciante_spam: incluye usuarioId desde parámetro si existe", async () => {
        const admin = await crearUsuario("ADMIN");
        await prisma.parametroSistema.create({
            data: {
                clave: "simulacion.spam.usuario_id",
                valor: admin.id,
                tipo: "STRING",
                categoria: "SYSTEM",
                esPublico: false,
            },
        });
        const s = await generarSugerenciasPorEscenario("denunciante_spam");
        expect(s.escenario).toBe("denunciante_spam");
        expect(s.n).toBe(15);
        expect(s.usuarioId).toBe(admin.id);
        expect(s.plataforma).toBe("instagram");
        expect(s.identificadores?.length).toBe(15);
    });

    it("personalizado: no sugiere valores", async () => {
        const s = await generarSugerenciasPorEscenario("personalizado");
        expect(s.escenario).toBe("personalizado");
        expect(s.ip).toBeUndefined();
        expect(s.ips).toBeUndefined();
        expect(s.identificador).toBeUndefined();
    });

    it("excluye IPs usadas en las últimas 2 horas", async () => {
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
        const s = await generarSugerenciasPorEscenario("robot_inundando");
        expect(s.ip).not.toBe("192.0.2.10");
    });

    it("dos llamadas seguidas devuelven IPs distintas", async () => {
        const s1 = await generarSugerenciasPorEscenario("robot_inundando");
        const admin = await crearUsuario("ADMIN");
        await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 1,
                creadoPorId: admin.id,
                estado: "COMPLETADA",
                configJson: { n: 1, ipInyectada: s1.ip ?? "", identificador: "3000000001", plataforma: "whatsapp" },
            },
        });
        const s2 = await generarSugerenciasPorEscenario("robot_inundando");
        expect(s2.ip).not.toBe(s1.ip);
    });
});
