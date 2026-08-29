/**
 * SPEC-260 (002-PI-157): smoke test de la pantalla Sin Suscripción.
 * Verifica que la página renderiza el nombre de un PADRE sin suscripción vigente.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import * as auth from "@/lib/auth";
import * as modulos from "@/lib/permisos-modulos";
import { RolUsuario } from "@prisma/client";
import SinSuscripcionPage from "./page";

describe("SinSuscripcionPage — smoke (SPEC-260)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza el email de un padre sin suscripción vigente", async () => {
        const admin = await prisma.usuario.create({
            data: {
                email: `smoke-admin-ss-${Date.now()}@test.co`,
                passwordHash: "hash",
                rol: RolUsuario.ADMIN,
                estado: "activo",
            },
        });
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        vi.spyOn(modulos, "assertModulo").mockResolvedValue(admin);

        const padre = await prisma.usuario.create({
            data: {
                email: `padre-sin-susc-${Date.now()}@familia.co`,
                passwordHash: "hash",
                rol: RolUsuario.PARENT,
                estado: "activo",
            },
        });

        const jsx = await SinSuscripcionPage({ searchParams: Promise.resolve({}) });
        render(jsx as React.ReactElement);

        expect(screen.getByText(padre.email)).toBeTruthy();
    });
});
