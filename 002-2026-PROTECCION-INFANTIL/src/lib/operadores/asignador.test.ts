import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { asignarOperadorAReporte } from "./asignador";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes } from "@/lib/reporte-test-utils";
import { hashPassword } from "@/lib/auth";

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

async function crearOperador(
    adminId: string,
    suffix: string,
    cupoMaximo: number | null = 10,
    activo = true
) {
    const user = await prisma.usuario.create({
        data: {
            email: `operador-${suffix}-${Date.now()}@test.local`,
            passwordHash: await hashPassword("Operador123!"),
            rol: "OPERADOR",
            estado: activo ? "activo" : "inactivo",
        },
    });
    await prisma.perfilOperador.create({
        data: {
            usuarioId: user.id,
            cupoMaximo,
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

describe("asignarOperadorAReporte", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
    });

    it("no asigna si no hay operadores activos", async () => {
        const reporte = await crearReporteRevisionManual();
        const resultado = await asignarOperadorAReporte(reporte.id);
        expect(resultado.asignado).toBe(false);
        if (!resultado.asignado) {
            expect(resultado.razon).toContain("No hay operadores activos");
        }
    });

    it("no asigna si el reporte no está en REVISION_MANUAL", async () => {
        const admin = await crearAdmin();
        await crearOperador(admin.id, "a");
        const plataforma = await prisma.plataforma.findFirst({ where: { clave: "whatsapp" } });
        if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "3000999999",
                plataformaId: plataforma.id,
                texto: "texto",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                estado: "PENDIENTE",
                esAnonimo: true,
            },
        });
        const resultado = await asignarOperadorAReporte(reporte.id);
        expect(resultado.asignado).toBe(false);
    });

    it("asigna un operador activo y registra audit", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "a");
        const reporte = await crearReporteRevisionManual();

        const resultado = await asignarOperadorAReporte(reporte.id);

        expect(resultado.asignado).toBe(true);
        if (resultado.asignado) {
            expect(resultado.operadorId).toBe(operador.id);
        }

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(operador.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "OPERADOR_ASIGNADO", recursoId: reporte.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(operador.id);
    });

    it("respeta el cupo máximo", async () => {
        const admin = await crearAdmin();
        const operador1 = await crearOperador(admin.id, "lleno", 1);
        const operador2 = await crearOperador(admin.id, "disponible", 10);
        const reportePrevio = await crearReporteRevisionManual("3000111111");
        await prisma.reporte.update({ where: { id: reportePrevio.id }, data: { operadorId: operador1.id } });

        const reporte = await crearReporteRevisionManual("3000222222");
        const resultado = await asignarOperadorAReporte(reporte.id);

        expect(resultado.asignado).toBe(true);
        if (resultado.asignado) {
            expect(resultado.operadorId).toBe(operador2.id);
        }
    });

    it("no reasigna si el reporte ya tiene operador", async () => {
        const admin = await crearAdmin();
        const operador1 = await crearOperador(admin.id, "a");
        const operador2 = await crearOperador(admin.id, "b");
        const reporte = await crearReporteRevisionManual();
        await prisma.reporte.update({ where: { id: reporte.id }, data: { operadorId: operador1.id } });

        const resultado = await asignarOperadorAReporte(reporte.id);
        expect(resultado.asignado).toBe(false);
        if (!resultado.asignado) {
            expect(resultado.razon).toContain("ya tiene operador");
        }

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(operador1.id);
    });

    it("usa el cupo máximo explícito del operador por sobre el default", async () => {
        const admin = await crearAdmin();
        const operadorLleno = await crearOperador(admin.id, "lleno", 1);
        const operadorLibre = await crearOperador(admin.id, "libre", 10);
        const previo = await crearReporteRevisionManual("3000111111");
        await prisma.reporte.update({ where: { id: previo.id }, data: { operadorId: operadorLleno.id } });

        const reporte = await crearReporteRevisionManual("3000222222");
        const resultado = await asignarOperadorAReporte(reporte.id);

        expect(resultado.asignado).toBe(true);
        if (resultado.asignado) {
            expect(resultado.operadorId).toBe(operadorLibre.id);
        }
    });

    it("usa el cupo default configurable cuando el operador no tiene cupo explícito", async () => {
        const admin = await crearAdmin();
        // cupoMaximo null => debe usar el default configurable (10 en tests)
        const operador = await crearOperador(admin.id, "default", null);
        const reporte = await crearReporteRevisionManual();

        const resultado = await asignarOperadorAReporte(reporte.id);

        expect(resultado.asignado).toBe(true);
        if (resultado.asignado) {
            expect(resultado.operadorId).toBe(operador.id);
            expect(resultado.operador.cupoMaximo).toBe(10);
        }
    });

    it("respeta la estrategia aleatoria pura", async () => {
        await prisma.parametroSistema.update({
            where: { clave: "operadores.estrategia_asignacion" },
            data: { valor: "aleatorio_puro" },
        });

        const admin = await crearAdmin();
        const operador1 = await crearOperador(admin.id, "a", 10);
        const operador2 = await crearOperador(admin.id, "b", 10);
        const reporte = await crearReporteRevisionManual();

        const resultado = await asignarOperadorAReporte(reporte.id);
        expect(resultado.asignado).toBe(true);
        if (resultado.asignado) {
            expect([operador1.id, operador2.id]).toContain(resultado.operadorId);
        }
    });
});
