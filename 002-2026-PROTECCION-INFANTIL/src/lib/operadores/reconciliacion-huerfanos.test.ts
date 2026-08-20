import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { reconciliarHuerfanos } from "./reconciliacion-huerfanos";
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

describe("reconciliarHuerfanos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
    });

    it("asigna operador a un reporte huérfano y registra audit agregado", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "a");
        const reporte = await crearReporteRevisionManual();

        const resumen = await reconciliarHuerfanos();

        expect(resumen.encontrados).toBe(1);
        expect(resumen.asignados).toBe(1);
        expect(resumen.fallidos).toBe(0);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(operador.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "RECONCILIACION_HUERFANOS" },
        });
        expect(audit).not.toBeNull();
        const valor = JSON.parse(audit?.valorNuevo ?? "{}");
        expect(valor.asignados).toBe(1);
    });

    it("no asigna si todos los operadores están al cupo máximo", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "lleno", 1);
        const reportePrevio = await crearReporteRevisionManual("3000111111");
        await prisma.reporte.update({ where: { id: reportePrevio.id }, data: { operadorId: operador.id } });

        const reporte = await crearReporteRevisionManual("3000222222");
        const resumen = await reconciliarHuerfanos();

        expect(resumen.encontrados).toBe(1);
        expect(resumen.asignados).toBe(0);
        expect(resumen.fallidos).toBe(1);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBeNull();
    });

    it("no procesa reportes que ya tienen operador", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "a");
        const reporte = await crearReporteRevisionManual();
        await prisma.reporte.update({ where: { id: reporte.id }, data: { operadorId: operador.id } });

        const resumen = await reconciliarHuerfanos();

        expect(resumen.encontrados).toBe(0);
        expect(resumen.asignados).toBe(0);
        expect(resumen.fallidos).toBe(0);
    });

    it("no hace nada cuando el parámetro está deshabilitado", async () => {
        await prisma.parametroSistema.update({
            where: { clave: "operadores.reconciliacion_enabled" },
            data: { valor: "false" },
        });

        const resumen = await reconciliarHuerfanos();

        expect(resumen.deshabilitado).toBe(true);
        expect(resumen.encontrados).toBe(0);
        expect(resumen.asignados).toBe(0);
        expect(resumen.fallidos).toBe(0);
    });
});
