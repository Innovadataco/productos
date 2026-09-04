/**
 * SPEC-442 (I-307) · Candado por CONDUCTA: cada camino que crea `Colegio`
 * en producción tiene que dejar los 11 cursos activos sembrados. Si mañana
 * alguien saca la llamada al helper de uno de los callers, uno de estos
 * tests se pone rojo — no vigila el nombre de la función, ejercita el flujo.
 *
 * Callers ejercitados:
 *   1. `POST /api/admin/colegios` (alta por administración global).
 *   2. `RegistroColegioService.registrarPublico` (registro público del rector).
 *   3. `crearColegioParaSmoke` (extraído de `smoke-prod-safe.ts` para no
 *      correr el smoke completo contra producción desde CI · CEO 04-09 13:31).
 *
 * Los tres tests SIEMPRE afirman `curso.count(activo) === 11`. Sacar la
 * llamada al helper de cualquier caller pone al test respectivo en rojo —
 * es candado por conducta, no vigila el nombre de la función.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearPaisCiudad,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearTiposDocumento,
} from "@/lib/reporte-test-utils";
import { POST as AdminColegiosPOST } from "@/app/api/admin/colegios/route";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";
import { crearColegioParaSmoke, PREFIJO_NOMBRE_SMOKE } from "../../../scripts/smoke-prod-safe";

declare global {
    var __testToken: string | undefined;
}

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && globalThis.__testToken
                ? { name: "token", value: globalThis.__testToken as string }
                : undefined,
    }),
}));

async function contarCursosActivos(colegioId: string): Promise<number> {
    return prisma.curso.count({ where: { colegioId, estado: "activo" } });
}

describe("SPEC-442 · candado por conducta: todo camino de alta siembra cursos", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
    });

    it("caller 1 · POST /api/admin/colegios crea el colegio con los 11 grados activos", async () => {
        const admin = await crearUsuario("ADMIN");
        const { pais, ciudad } = await crearPaisCiudad();
        globalThis.__testToken = await crearTokenUsuario(admin.id, "ADMIN");

        const ahora = Date.now();
        const inicio = new Date();
        const fin = new Date();
        fin.setFullYear(fin.getFullYear() + 1);
        const body = {
            nombre: `Colegio Alta Admin ${ahora}`,
            nit: `NIT-ALTA-${ahora}`,
            paisId: pais.id,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Repre Legal",
            representanteLegalIdentificacion: "1122334455",
            representanteLegalEmail: `rep-${ahora}@ejemplo.com`,
            adminNombre: "Rector Alta",
            adminEmail: `rector-${ahora}@ejemplo.com`,
            tipoPeriodo: "ANUAL" as const,
            inicioServicio: inicio.toISOString(),
            finServicio: fin.toISOString(),
        };

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost/api/admin/colegios",
            body,
            globalThis.__testToken,
        );
        const res = await AdminColegiosPOST(req);
        expect(res.status, `POST /api/admin/colegios: ${res.status} · body=${await res.clone().text().catch(() => "")}`).toBe(201);
        const json = (await res.json()) as { colegio: { id: string } };
        const cursos = await contarCursosActivos(json.colegio.id);
        // El helper SIEMPRE deja 11 grados. Sacar `sembrarSemillaColegio` de
        // `admin/colegios/route.ts` deja el conteo en 0 → este test rojo.
        expect(cursos).toBe(11);
    });

    it("caller 2 · RegistroColegioService.registrarPublico deja los 11 grados activos", async () => {
        await crearPaisCiudad(); // asegura CO+Bogotá para `resolverUbicacionDefault`.
        await crearTiposDocumento();

        const ahora = Date.now();
        const nit = `NIT-PUB-${ahora}`;
        const emailRector = `rector-pub-${ahora}@ejemplo.com`;
        const service = new RegistroColegioService();
        const resultado = await service.registrarPublico(
            emailRector,
            "SecretaTest123!",
            "Rector Público",
            `Colegio Público ${ahora}`,
            nit,
        );
        expect(resultado.ok, `registrarPublico no marcó ok: ${JSON.stringify(resultado)}`).toBe(true);

        const colegio = await prisma.colegio.findUnique({
            where: { nit },
            select: { id: true },
        });
        expect(colegio?.id, "colegio nuevo no encontrado por NIT").toBeTruthy();
        if (!colegio?.id) return;
        const cursos = await contarCursosActivos(colegio.id);
        // El helper SIEMPRE deja 11 grados. Sacar `sembrarSemillaColegio` de
        // `registro-colegio.ts` deja el conteo en 0 → este test rojo.
        expect(cursos).toBe(11);
    });

    it("caller 3 · crearColegioParaSmoke deja los 11 grados activos (bug I-307 originario del smoke)", async () => {
        const { pais, ciudad } = await crearPaisCiudad();
        const ts = Date.now();
        const inicio = new Date();
        const fin = new Date();
        fin.setFullYear(fin.getFullYear() + 1);
        const tenant = await prisma.tenant.create({
            data: { nombre: `smoke-test-${ts}`, estado: "activo" },
        });

        const colegio = await crearColegioParaSmoke({
            cliente: prisma,
            ts,
            paisId: pais.id,
            ciudadId: ciudad.id,
            tenantId: tenant.id,
            inicioServicio: inicio,
            finServicio: fin,
        });

        // Marcador estable — un huérfano del smoke se identifica por acá.
        expect(colegio.nombre.startsWith(PREFIJO_NOMBRE_SMOKE)).toBe(true);
        const cursos = await contarCursosActivos(colegio.id);
        // El helper SIEMPRE deja 11 grados. Sacar `sembrarSemillaColegio` de
        // `crearColegioParaSmoke` deja el conteo en 0 → este test rojo.
        expect(cursos).toBe(11);
    });
});
