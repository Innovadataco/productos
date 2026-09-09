/**
 * SPEC-603 (hotfix) · BUG REAL EN PROD: un navegador con JWT de un usuario YA
 * ELIMINADO de la BD (purga) tumbaba GET /reportar: el layout auditaba
 * `REPORTE_SIN_SUSCRIPCION` con ese `usuarioId` y AuditLog reventaba con
 * PrismaClientKnownRequestError P2003 (FK AuditLog_usuarioId_fkey) en medio del
 * render del Server Component.
 *
 * Candados por conducta contra BD real (sin mockear @/lib/auth ni @/lib/audit):
 *   · JWT huérfano → el layout renderiza children (la página pública NO cae) y
 *     NO escribe auditoría: la sesión huérfana se trata como anónima.
 *   · PARENT real sin suscripción → sigue auditando REPORTE_SIN_SUSCRIPCION con
 *     su usuarioId (SPEC-242 intacto).
 *   · Sin token → renderiza sin tocar auditoría.
 *
 * Verificado por mutación: si el layout vuelve a usar `payload.sub` sin pasar
 * por la BD, el primer test revienta con P2003.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
        set: vi.fn(),
    }),
    headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.10" }),
}));

import ReportarLayout from "./layout";

async function pintarLayout() {
    const arbol = await ReportarLayout({
        children: React.createElement("main", { "data-testid": "contenido" }, "contenido-reportar"),
    });
    return renderToStaticMarkup(arbol as React.ReactElement);
}

describe("/reportar layout · sesión huérfana (SPEC-603)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("JWT de usuario eliminado: renderiza como anónimo, sin crash P2003 y sin auditoría", async () => {
        const padre = await crearUsuario("PARENT", "huerfano-reportar@example.com");
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        // Purga del usuario: la cookie del navegador queda huérfana.
        await prisma.usuario.delete({ where: { id: padre.id } });

        const html = await pintarLayout();
        expect(html).toContain("contenido-reportar");
        expect(await prisma.auditLog.count()).toBe(0);
    });

    it("PARENT real sin suscripción: audita REPORTE_SIN_SUSCRIPCION con su usuarioId (SPEC-242)", async () => {
        const padre = await crearUsuario("PARENT", "padre-sin-suscripcion@example.com");
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });

        const html = await pintarLayout();
        expect(html).toContain("contenido-reportar");

        const filas = await prisma.auditLog.findMany({ where: { accion: "REPORTE_SIN_SUSCRIPCION" } });
        expect(filas).toHaveLength(1);
        expect(filas[0]!.usuarioId).toBe(padre.id);
    });

    it("sin token: renderiza sin escribir auditoría", async () => {
        const html = await pintarLayout();
        expect(html).toContain("contenido-reportar");
        expect(await prisma.auditLog.count()).toBe(0);
    });

    it("sesión de rol interno: renderiza sin escribir auditoría", async () => {
        const admin = await crearUsuario("ADMIN", "admin-reportar@example.com");
        mockToken = await createToken({ sub: admin.id, rol: "ADMIN" });

        const html = await pintarLayout();
        expect(html).toContain("contenido-reportar");
        expect(await prisma.auditLog.count()).toBe(0);
    });
});
