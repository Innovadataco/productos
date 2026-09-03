/**
 * I-277 (SPEC-383) · POST /api/colegio/alertas/[id]/asignar.
 *
 * Test que faltaba y por eso el bug pasó: `asignarAlerta` casteaba
 * `"COLEGIO_ALERTA_ASIGNADA" as AccionAudit` con un valor que no existía en el
 * enum. TS quedaba mudo por el cast, ningún test cubría esta ruta, y Prisma
 * tronaba con 500 la primera vez que un admin apretaba "Asignar" en prod.
 *
 * Este test afirma:
 *   · 200 con la alerta actualizada (asignada y desasignada).
 *   · fila AuditLog con `accion = COLEGIO_ALERTA_ASIGNADA` — el valor ahora
 *     vive en el enum (migration `20260903020000_i277_...`) y el cast se
 *     quitó, así que si algún día alguien lo cambia por un string inventado,
 *     el compilador rechaza.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearAlertaEstudiante } from "@/lib/comite-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/alertas/[id]/asignar (I-277 · SPEC-383)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function setup() {
        const { admin, colegio } = await crearColegioConAdmin();
        const { alerta } = await crearAlertaEstudiante(colegio.id);
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        return { admin, colegio, alerta };
    }

    it("asigna la alerta al admin, devuelve 200 y deja AuditLog COLEGIO_ALERTA_ASIGNADA", async () => {
        const { admin, alerta } = await setup();

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/asignar`,
                { asignadoAId: admin.id },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.alerta.id).toBe(alerta.id);
        expect(body.alerta.asignadoAId).toBe(admin.id);

        // Assert fuerte: la fila del audit existe con el valor CORRECTO del enum.
        // Antes de este SPEC, `logAudit` tronaba con "Invalid value for argument accion".
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ALERTA_ASIGNADA", recursoId: alerta.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(admin.id);
        expect(JSON.parse(audit!.valorNuevo!)).toEqual({ asignadoAId: admin.id });
    });

    it("desasigna la alerta cuando asignadoAId viene vacío, devuelve 200 y audita", async () => {
        const { admin, alerta } = await setup();
        // Primero asignada, después vacía → null.
        await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/asignar`,
                { asignadoAId: admin.id },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/asignar`,
                { asignadoAId: "" },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.alerta.asignadoAId).toBeNull();

        const audits = await prisma.auditLog.findMany({
            where: { accion: "COLEGIO_ALERTA_ASIGNADA", recursoId: alerta.id },
            orderBy: { creadoEn: "asc" },
        });
        expect(audits).toHaveLength(2);
        expect(JSON.parse(audits[1]!.valorNuevo!)).toEqual({ asignadoAId: null });
    });
});
