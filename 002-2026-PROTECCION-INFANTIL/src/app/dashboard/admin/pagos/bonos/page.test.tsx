/**
 * SPEC-260 (002-PI-157): smoke test de la pantalla de Bonos.
 * Verifica que la página renderiza el nombre de un bono real sembrado en la BD.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import * as modulos from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    TipoBono,
    RolUsuario,
    TipoTitular,
    DuracionPlan,
} from "@prisma/client";
import BonosPage from "./page";

async function crearAdminUser() {
    return prisma.usuario.create({
        data: {
            email: `smoke-bonos-${Date.now()}@test.co`,
            passwordHash: "hash",
            rol: RolUsuario.ADMIN,
            estado: "activo",
        },
    });
}

describe("BonosPage — smoke (SPEC-260)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza el nombre de un bono sembrado", async () => {
        const admin = await crearAdminUser();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        vi.spyOn(modulos, "assertModulo").mockResolvedValue(admin);

        const planAdmin = await prisma.usuario.create({
            data: { email: `p-admin-${Date.now()}@test.co`, passwordHash: "h", rol: RolUsuario.ADMIN, estado: "activo" },
        });
        const plan = await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_3,
            anio: 2026,
            nombre: "Plan padre humo",
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: planAdmin.id,
        });
        void plan;

        await new PagosRepository().crearBonoPromocional({
            nombre: "Bono humo octubre",
            tipo: TipoBono.DESCUENTO_PCT,
            valor: 20,
            vigenciaInicio: new Date(Date.now() - 86400_000),
            vigenciaFin: new Date(Date.now() + 30 * 86400_000),
            creadoPorAdminId: admin.id,
        });

        const jsx = await BonosPage({ searchParams: Promise.resolve({}) });
        render(jsx as React.ReactElement);

        expect(screen.getByText("Bono humo octubre")).toBeTruthy();
    });
});
