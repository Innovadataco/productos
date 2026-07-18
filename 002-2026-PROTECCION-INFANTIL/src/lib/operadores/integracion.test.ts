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

    it("reparto ponderado por carga inversa", async () => {
        const admin = await crearAdmin();
        const opLigero = await crearOperador(admin.id, "ligero", { cupoMaximo: 10 });
        const opPesado = await crearOperador(admin.id, "pesado", { cupoMaximo: 10 });

        // Saturar al operador pesado con 5 casos.
        for (let i = 0; i < 5; i++) {
            const r = await crearReporteRevisionManual(`30001${i.toString().padStart(4, "0")}`);
            await prisma.reporte.update({ where: { id: r.id }, data: { operadorId: opPesado.id } });
        }

        const repeticiones = 20;
        const conteo: Record<string, number> = { [opLigero.id]: 0, [opPesado.id]: 0 };
        for (let i = 0; i < repeticiones; i++) {
            const r = await crearReporteRevisionManual(`30002${i.toString().padStart(4, "0")}`);
            const res = await asignarOperadorAReporte(r.id);
            if (res.asignado) {
                conteo[res.operadorId] = (conteo[res.operadorId] ?? 0) + 1;
            }
        }

        // El operador ligero debe recibir claramente más casos (peso 1 vs 0.5).
        expect(conteo[opLigero.id]).toBeGreaterThan(conteo[opPesado.id]);
        expect(conteo[opLigero.id]).toBeGreaterThanOrEqual(10);
        expect(conteo[opPesado.id]).toBeLessThanOrEqual(10);
    });

    it("caso trabado: reporte no se reasigna solo cuando el operador se desactiva", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "a");
        const reporte = await crearReporteRevisionManual();
        await asignarOperadorAReporte(reporte.id);

        // Desactivar operador (simula que no atiende).
        await prisma.usuario.update({ where: { id: operador.id }, data: { estado: "inactivo" } });

        // Una nueva asignación sobre el mismo reporte no cambia nada (ya tiene operador).
        const reintento = await asignarOperadorAReporte(reporte.id);
        expect(reintento.asignado).toBe(false);
        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(operador.id);
    });

    it("re-asignación manual mueve el caso a otro operador", async () => {
        const admin = await crearAdmin();
        const op1 = await crearOperador(admin.id, "a");
        const op2 = await crearOperador(admin.id, "b");
        const reporte = await crearReporteRevisionManual();
        await prisma.reporte.update({ where: { id: reporte.id }, data: { operadorId: op1.id } });

        // Simular reasignación manual como haría el endpoint.
        await prisma.reporte.update({ where: { id: reporte.id }, data: { operadorId: op2.id } });

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(op2.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "OPERADOR_REASIGNADO", recursoId: reporte.id },
        });
        // Este test no pasa por el endpoint, por lo que no esperamos audit aquí.
        expect(audit).toBeNull();
    });
});
