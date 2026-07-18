import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { hashPassword } from "@/lib/auth";
import { asignarOperadorAReporte, asignarOperadorAApelacion } from "./asignador";

async function crearAdmin() {
    return prisma.usuario.create({
        data: {
            email: `admin-${Date.now()}@test.local`,
            passwordHash: await hashPassword("Admin123!"),
            rol: "ADMIN",
            estado: "activo",
        },
    });
}

async function crearOperador(adminId: string, suffix: string, opts?: { revisorApelaciones?: boolean; cupoMaximo?: number }) {
    const user = await prisma.usuario.create({
        data: {
            email: `operador-${suffix}-${Date.now()}@test.local`,
            passwordHash: await hashPassword("Operador123!"),
            rol: "OPERADOR",
            estado: "activo",
        },
    });
    await prisma.perfilOperador.create({
        data: {
            usuarioId: user.id,
            cupoMaximo: opts?.cupoMaximo ?? 10,
            esRevisorDeApelaciones: opts?.revisorApelaciones ?? false,
            creadoPorId: adminId,
        },
    });
    return user;
}

async function crearReporteRevisionManual(identificador = "3000999999") {
    const plataforma = await prisma.plataforma.findFirst({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "texto de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
        },
    });
}

async function crearApelacion() {
    const plataforma = await prisma.plataforma.findFirst({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");
    const identificadorReportado = await prisma.identificadorReportado.create({
        data: {
            identificador: "3000999999",
            plataformaId: plataforma.id,
            esVisiblePublicamente: true,
        },
    });
    return prisma.apelacionIdentificador.create({
        data: {
            identificador: identificadorReportado.identificador,
            plataformaId: identificadorReportado.plataformaId,
            tokenAcceso: `token-${Date.now()}`,
            estado: "RECIBIDA",
            motivoSolicitud: "prueba",
            tipoVerificacion: "NICK",
        },
    });
}

describe("integración operadores", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("asigna reporte a operador y éste puede confirmar/gestionar", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "a");
        const otroOperador = await crearOperador(admin.id, "b");
        const reporte = await crearReporteRevisionManual();

        const asignacion = await asignarOperadorAReporte(reporte.id);
        expect(asignacion.asignado).toBe(true);
        if (!asignacion.asignado) return;
        expect(asignacion.operadorId).toBeOneOf([operador.id, otroOperador.id]);

        // Verificar que el reporte quedó asignado
        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(asignacion.operadorId);
    });

    it("asigna apelación a revisor de apelaciones", async () => {
        const admin = await crearAdmin();
        const revisor = await crearOperador(admin.id, "revisor", { revisorApelaciones: true });
        const noRevisor = await crearOperador(admin.id, "norevisor");
        const apelacion = await crearApelacion();

        const resultado = await asignarOperadorAApelacion(apelacion.id);
        expect(resultado.asignado).toBe(true);
        if (!resultado.asignado) return;
        expect(resultado.operadorId).toBe(revisor.id);

        const actualizada = await prisma.apelacionIdentificador.findUnique({ where: { id: apelacion.id } });
        expect(actualizada?.operadorId).toBe(revisor.id);
        expect(actualizada?.estado).toBe("EN_REVISION");
    });

    it("no asigna apelación si no hay revisores de apelaciones", async () => {
        const admin = await crearAdmin();
        await crearOperador(admin.id, "normal");
        const apelacion = await crearApelacion();

        const resultado = await asignarOperadorAApelacion(apelacion.id);
        expect(resultado.asignado).toBe(false);
        if (!resultado.asignado) {
            expect(resultado.razon).toContain("No hay revisores");
        }
    });
});
