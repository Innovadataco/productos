/**
 * SPEC-790 (T6) · POST /api/admin/verificacion-profesionales/[id]/reps
 * La ruta de carga manual REPS: guardia de servidor (ADMIN), compuerta de código ANTES del CHECK
 * (un VIGENTE sin fecha da 400, no el error crudo), y el actor en el snapshot durable.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

const DIA = 24 * 60 * 60 * 1000;
const FUT = new Date(Date.now() + 90 * DIA).toISOString();

async function sembrarProfesional(): Promise<string> {
    const { ciudad } = await crearPaisCiudad();
    const u = await crearUsuario("PROFESIONAL");
    const p = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: "Pro REPS",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            aniosExperiencia: 5,
            presentacion: "Perfil de prueba.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 45,
            estado: "ACTIVO",
        },
    });
    return p.id;
}

function pedir(id: string, body: unknown) {
    return POST(
        new Request(`http://localhost:5005/api/admin/verificacion-profesionales/${id}/reps`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) },
    );
}

describe("POST /api/admin/verificacion-profesionales/[id]/reps · SPEC-790 (T6)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });
    afterAll(async () => prisma.$disconnect());

    it("ADMIN carga un VIGENTE válido → 200, fila MANUAL_ADMIN con el actor en el snapshot durable", async () => {
        const id = await sembrarProfesional();
        const admin = await crearUsuario("ADMIN", `admin.reps.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await pedir(id, { resultado: "VIGENTE", vigenteHasta: FUT, modalidades: ["PRESENCIAL", "TELEMEDICINA"] });
        expect(res.status).toBe(200);
        const fila = await prisma.verificacionReps.findFirst({ where: { profesionalId: id } });
        expect(fila?.fuente).toBe("MANUAL_ADMIN");
        expect(fila?.resultado).toBe("VIGENTE");
        expect(fila?.verificadoPorSnapshot).toBe(admin.email);
    });

    it("VIGENTE sin fecha → 400 por la compuerta de código (no el error crudo de la base); cero filas", async () => {
        const id = await sembrarProfesional();
        const admin = await crearUsuario("ADMIN", `admin.reps2.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await pedir(id, { resultado: "VIGENTE", vigenteHasta: null, modalidades: ["PRESENCIAL"] });
        expect(res.status).toBe(400);
        expect(await prisma.verificacionReps.count({ where: { profesionalId: id } })).toBe(0);
    });

    it("sin sesión → NO autoriza y NO crea fila (la guardia es del servidor)", async () => {
        const id = await sembrarProfesional();
        mockToken = undefined;
        const res = await pedir(id, { resultado: "SIN_VERIFICAR", modalidades: [] });
        expect(res.status).toBeGreaterThanOrEqual(401);
        expect(await prisma.verificacionReps.count({ where: { profesionalId: id } })).toBe(0);
    });
});
