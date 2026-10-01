/**
 * SPEC-783 · END-TO-END del correo del PADRE: la plantilla REAL contiene la credencial.
 *
 * Para el padre el correo es el ÚNICO canal (002-PI-051): no tiene un admin al lado ni otra
 * vía. Si su credencial renderiza vacía, el padre no puede entrar de NINGUNA manera y no
 * vuelve. Por eso este camino —el de mayor consecuencia— exige la aserción de cuerpo, y con
 * la plantilla REAL committeada (no una sintética): así se prueba también que el placeholder
 * del correo del padre coincide con `tempPassword`. Si no coincidiera, renderizaría vacío.
 *
 * Como el reenvío del operador (reenviar-cuerpo.test.ts), la ruta regenera una contraseña
 * NUEVA (randomBytes) — NO reusa la persistida — así que el scrub del estado terminal no la
 * puede vaciar. NO se mockea el wrapper: se deja que la ruta programe la Notificacion real.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST } from "./route";
import { renderizarPlantilla } from "@/lib/notificaciones/renderer";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { RolUsuario } from "@prisma/client";

// src/app/api/admin/padres/[id]/reenviar-email → raíz del producto (7 niveles).
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..", "..");
const SEED_CMD = "npx tsx prisma/seed.ts";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function correrSeed() {
    execSync(SEED_CMD, {
        cwd: REPO_ROOT,
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
}

describe("padres/reenviar-email · cuerpo end-to-end del PADRE (SPEC-783 · canal único 002-PI-051)", () => {
    beforeAll(async () => {
        await resetDatabase();
        // Admin explícito antes del seed (el seed omite seeders sin admin); el seed provee la
        // regla + plantilla `usuario.credenciales.padre.email`.
        await prisma.usuario.create({
            data: {
                email: `padre-e2e-admin-${Date.now()}@test.local`,
                passwordHash: "hash",
                rol: RolUsuario.ADMIN,
                estado: "activo",
            },
        });
        correrSeed();
    }, 180_000);

    it("el cuerpo del correo de credenciales del padre (plantilla REAL) contiene la contraseña temporal real", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", `padre-reenviar-${Date.now()}@test.local`, "ClaveVieja123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/padres/${padre.id}/reenviar-email`,
            {},
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: padre.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.encolado).toBe(true);
        // Encolado ⇒ la ruta NO devuelve la contraseña (contrato Jelkin); el valor vive SOLO en
        // la Notificacion — que para el padre es el único canal.
        expect(data.passwordTemporal).toBeUndefined();

        const notif = await prisma.notificacion.findFirst({
            where: { evento: "usuario.credenciales.padre", destinatarioEmail: padre.email },
            orderBy: { createdAt: "desc" },
        });
        expect(notif, "la ruta debe haber programado la Notificacion de credenciales del padre").not.toBeNull();
        expect(notif?.plantillaClave).toBe("usuario.credenciales.padre.email");

        const vars = notif?.variables as { tempPassword?: string; _sensibles?: { tempPassword?: string } };
        const valor = vars?._sensibles?.tempPassword;
        expect(valor, "la credencial real generada por el reenvío vive en _sensibles").toMatch(/^[0-9a-f]{12}$/);
        expect(vars?.tempPassword, "la credencial no puede ir suelta en variables").toBeUndefined();

        // EL CUERPO con la PLANTILLA REAL committeada (usuario.credenciales.padre.email), tal
        // como la renderiza el procesador. Si su placeholder no fuera `{{tempPassword}}`, esto
        // vendría vacío y el padre quedaría afuera sin recurso.
        const plantilla = await prisma.notificacionPlantilla.findUnique({
            where: { clave: notif!.plantillaClave },
        });
        expect(plantilla, "la plantilla real del padre debe existir (seed)").not.toBeNull();
        const { cuerpo } = renderizarPlantilla(
            plantilla!.cuerpoMarkdown,
            plantilla!.asunto,
            (notif!.variables ?? {}) as Record<string, unknown>,
        );
        expect(cuerpo).toContain(valor);
    }, 30_000);
});
