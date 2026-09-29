/**
 * SPEC-783 · END-TO-END del reenvío: el CUERPO del correo contiene la credencial real.
 *
 * `reenviar-email` es el flujo que un admin usa cuando el operador NO PUDO ENTRAR: genera
 * una contraseña NUEVA (regenerarPassword → tempPassword, NO reusa la persistida — así que
 * el scrub del estado terminal no la puede vaciar) y la manda. Si el valor no se renderizara,
 * el operador recibiría un SEGUNDO correo inservible y nadie se enteraría — por eso este
 * camino, que se ejercita justo cuando algo ya salió mal, exige la misma prueba que el alta.
 *
 * Este test NO mockea el wrapper de email: deja que la RUTA programe la Notificacion real,
 * lee la credencial generada de `_sensibles`, y afirma que el cuerpo RENDERIZADO la contiene
 * (el flatten de `_sensibles` resuelve `{{tempPassword}}`). No que se llamó a la función.
 * (El alta tiene su gemelo en email.migracion.test.ts; éste cubre el reenvío.)
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

// src/app/api/admin/operadores/[id]/reenviar-email → raíz del producto (7 niveles).
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

describe("reenviar-email · cuerpo end-to-end (SPEC-783)", () => {
    beforeAll(async () => {
        await resetDatabase();
        // El seed omite algunos seeders sin admin; sembramos uno explícito (igual que
        // email.migracion). El seed provee la regla + plantilla de `usuario.bienvenida.operador`,
        // sin la cual `programar()` no crearía Notificacion y no habría cuerpo que medir.
        await prisma.usuario.create({
            data: {
                email: `reenviar-e2e-admin-${Date.now()}@test.local`,
                passwordHash: "hash",
                rol: RolUsuario.ADMIN,
                estado: "activo",
            },
        });
        correrSeed();
    }, 180_000);

    it("el cuerpo del correo de reenvío contiene la contraseña temporal real generada", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", `op-reenviar-${Date.now()}@test.local`);
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/operadores/${operador.id}/reenviar-email`,
            {},
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: operador.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.emailEnviado).toBe(true);
        // Email enviado ⇒ la ruta NO devuelve la contraseña (contrato Jelkin); el valor vive
        // SOLO en la Notificacion. De ahí lo leemos: es el valor que realmente viajó por la ruta.
        expect(data.passwordTemporal).toBeUndefined();

        const notif = await prisma.notificacion.findFirst({
            where: { evento: "usuario.bienvenida.operador", destinatarioEmail: operador.email },
            orderBy: { createdAt: "desc" },
        });
        expect(notif, "la ruta debe haber programado la Notificacion de bienvenida").not.toBeNull();
        expect(notif?.plantillaClave).toBe("usuario.bienvenida.operador.email");

        const vars = notif?.variables as { tempPassword?: string; _sensibles?: { tempPassword?: string } };
        const valor = vars?._sensibles?.tempPassword;
        // La credencial real que generó regenerarPassword (hex de 12) — NO la persistida, NO vacía.
        expect(valor, "la credencial real generada por el reenvío vive en _sensibles").toMatch(/^[0-9a-f]{12}$/);
        // No suelta en variables (para que el scrub del estado terminal pueda borrarla).
        expect(vars?.tempPassword, "la credencial no puede ir suelta en variables").toBeUndefined();

        // EL CUERPO: renderizado con las variables que persistió LA RUTA, contiene ESE valor.
        // Si el opaco saliera sin resolver, acá vendría "[object Object]"/vacío y el operador
        // recibiría un segundo correo inservible.
        const { cuerpo } = renderizarPlantilla(
            "Tu contraseña temporal es {{tempPassword}}.",
            null,
            (notif!.variables ?? {}) as Record<string, unknown>,
        );
        expect(cuerpo).toContain(valor);
    }, 30_000);
});
