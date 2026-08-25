/**
 * SPEC-246 (002-PI-149): tests de integración de entrega de cupones de recompensa.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, OrigenSuscripcion, OrigenBono, MetodoPagoManual } from "@prisma/client";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { prisma } from "@/lib/prisma";
import {
    entregarCuponesRecompensa,
    obtenerCuponesRecompensaDelUsuario,
} from "./entregar-cupones-recompensa.service";
import { activarSuscripcionManual } from "./admin-activacion-manual.service";
import { autorizarSolicitudPendiente } from "./admin-autorizar-solicitud.service";

async function crearPlanPadre(adminId: string, overrides: { esFreemium?: boolean; precioBaseUSD?: number } = {}) {
    const repo = new PagosRepository();
    return repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_3,
        anio: new Date().getFullYear(),
        nombre: `Plan Padre ${Date.now()}`,
        precioBaseUSD: overrides.precioBaseUSD ?? 10,
        precioBaseCOP: 100_000,
        precio: 0,
        esFreemium: overrides.esFreemium ?? false,
        creadoPorAdminId: adminId,
    });
}

async function seedParametrosRecompensa() {
    await prisma.parametroSistema.createMany({
        data: [
            { clave: "pagos.recompensa.cupones_por_pago", valor: "5", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false, descripcion: "" },
            { clave: "pagos.recompensa.vigencia_dias", valor: "90", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false, descripcion: "" },
            { clave: "pagos.recompensa.porcentaje_descuento", valor: "20", tipo: "FLOAT", categoria: "SYSTEM", esPublico: false, descripcion: "" },
            { clave: "pagos.freemium.duracion_dias", valor: "30", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false, descripcion: "" },
        ],
        skipDuplicates: true,
    });
}

describe("entregarCuponesRecompensa", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametrosRecompensa();
    });

    it("genera 5 cupones únicos de recompensa para un padre", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);

        const resultado = await entregarCuponesRecompensa({
            padreUsuarioId: padre.id,
            adminId: admin.id,
            email: padre.email,
            nombre: padre.nombre,
        });

        expect(resultado).not.toBeNull();
        expect(resultado?.entregados).toBe(5);
        expect(resultado?.codigos.length).toBe(5);
        expect(new Set(resultado?.codigos).size).toBe(5);
        resultado?.codigos.forEach((codigo) => expect(codigo).toMatch(/^CUP-[A-Z0-9]{6}$/));

        const cupones = await obtenerCuponesRecompensaDelUsuario(padre.id);
        expect(cupones.length).toBe(5);
        expect(cupones.every((c) => c.nombre.startsWith("CUP-"))).toBe(true);
        expect(cupones.every((c) => c.valor === 20)).toBe(true);
    });

    it("es idempotente: segunda entrega no genera más cupones", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);

        const primera = await entregarCuponesRecompensa({
            padreUsuarioId: padre.id,
            adminId: admin.id,
        });
        expect(primera?.entregados).toBe(5);

        const segunda = await entregarCuponesRecompensa({
            padreUsuarioId: padre.id,
            adminId: admin.id,
        });
        expect(segunda).toBeNull();

        const cupones = await obtenerCuponesRecompensaDelUsuario(padre.id);
        expect(cupones.length).toBe(5);
    });

    it("registra AuditLog BONO_CREADO por cada cupón", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);

        await entregarCuponesRecompensa({ padreUsuarioId: padre.id, adminId: admin.id });

        const audit = await prisma.auditLog.count({
            where: { accion: "BONO_CREADO", usuarioId: admin.id },
        });
        expect(audit).toBe(5);
    });

    it("se dispara automáticamente al activar una suscripción pagada de padre", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);

        await activarSuscripcionManual({
            adminId: admin.id,
            target: { tipoTitular: TipoTitular.PADRE, usuarioId: padre.id },
            planId: plan.id,
            metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
            referenciaPagoManual: "REF-246",
            montoRealPagado: 119_000,
        });

        const cupones = await obtenerCuponesRecompensaDelUsuario(padre.id);
        expect(cupones.length).toBe(5);
    });

    it("NO se dispara al activar una suscripción freemium", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: new Date().getFullYear(),
            nombre: `Freemium ${Date.now()}`,
            precioBaseUSD: 0,
            precioBaseCOP: 0,
            precio: 0,
            esFreemium: true,
            usosMaximosPorCliente: 1,
            creadoPorAdminId: admin.id,
        });

        const { activarFreemium } = await import("./freemium-activacion.service");
        await activarFreemium({
            usuario: {
                id: padre.id,
                rol: RolUsuario.PARENT,
                colegioId: null,
                email: padre.email,
                nombre: padre.nombre,
            },
            aceptaTerminos: true,
        });

        const cupones = await obtenerCuponesRecompensaDelUsuario(padre.id);
        expect(cupones.length).toBe(0);
    });

    it("NO se dispara al activar una suscripción de colegio", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const { colegio } = await import("@/lib/reporte-test-utils").then((m) => m.crearColegioConAdmin());
        const plan = await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.COLEGIO,
            duracion: DuracionPlan.MES_12,
            anio: new Date().getFullYear(),
            nombre: `Plan Colegio ${Date.now()}`,
            precioBaseUSD: 100,
            precioBaseCOP: 400_000,
            precio: 0,
            creadoPorAdminId: admin.id,
        });

        await activarSuscripcionManual({
            adminId: admin.id,
            target: { tipoTitular: TipoTitular.COLEGIO, colegioId: colegio.id },
            planId: plan.id,
            metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
            referenciaPagoManual: "REF-COLEGIO-246",
            montoRealPagado: 400_000,
        });

        const cupones = await prisma.bonoPromocional.count({
            where: { origen: OrigenBono.RECOMPENSA_PAGO },
        });
        expect(cupones).toBe(0);
    });

    it("se dispara al autorizar una solicitud pendiente pagada de padre", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);

        const solicitud = await prisma.suscripcion.create({
            data: {
                tipoTitular: TipoTitular.PADRE,
                usuarioId: padre.id,
                planActualId: plan.id,
                estado: EstadoSuscripcion.PENDIENTE_AUTORIZACION,
                origen: OrigenSuscripcion.SOLICITADA_CLIENTE,
                esFreemium: false,
                fechaInicio: new Date(),
                fechaFin: new Date(Date.now() + 24 * 60 * 60 * 1000),
                monedaLocal: "COP",
                paisCliente: "CO",
                codigoReferidoPropio: `ref-${Date.now()}`,
            },
        });

        await autorizarSolicitudPendiente({
            adminId: admin.id,
            suscripcionId: solicitud.id,
            metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
            referenciaPagoManual: "REF-AUTO-246",
            montoRealPagado: 119_000,
        });

        const cupones = await obtenerCuponesRecompensaDelUsuario(padre.id);
        expect(cupones.length).toBe(5);
    });
});
