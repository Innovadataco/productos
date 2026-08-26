/**
 * SPEC-260 (002-PI-157): smoke test de la pantalla Pendientes.
 * Verifica que la página renderiza el email de un cliente con pago pendiente.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import * as auth from "@/lib/auth";
import * as modulos from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    EstadoPago,
    MetodoPago,
} from "@prisma/client";
import PendientesPage from "./page";

describe("PendientesPage — smoke (SPEC-260)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza el nombre de un padre con pago pendiente de autorización", async () => {
        const admin = await prisma.usuario.create({
            data: {
                email: `smoke-admin-pend-${Date.now()}@test.co`,
                passwordHash: "hash",
                rol: RolUsuario.ADMIN,
                estado: "activo",
            },
        });
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        vi.spyOn(modulos, "assertModulo").mockResolvedValue(admin);

        const padre = await prisma.usuario.create({
            data: {
                email: `padre-pend-${Date.now()}@familia.co`,
                nombre: "Carlos Pendiente",
                passwordHash: "hash",
                rol: RolUsuario.PARENT,
                estado: "activo",
            },
        });

        const repo = new PagosRepository();
        const plan = await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_3,
            anio: 2026,
            nombre: "Plan padre humo pendientes",
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        });

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 86400_000),
            codigoReferidoPropio: `REF-HUMO-${Date.now()}`,
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: DuracionPlan.MES_3,
            montoBaseUSD: 10,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4200,
            montoLocalPagado: 42000,
            monedaLocal: "COP",
            metodoDeclarado: MetodoPago.TRANSFERENCIA,
            comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
            comprobanteMimeType: "image/jpeg",
            comprobanteHashSha256: "sha256humo",
            fechaReporte: new Date(),
            estado: EstadoPago.PENDIENTE_AUTORIZACION,
        });

        const jsx = await PendientesPage({ searchParams: Promise.resolve({}) });
        render(jsx as React.ReactElement);

        expect(screen.getByText("Carlos Pendiente")).toBeTruthy();
    });
});
