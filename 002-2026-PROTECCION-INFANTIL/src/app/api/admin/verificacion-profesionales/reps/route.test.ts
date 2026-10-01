/**
 * SPEC-790 (T6) · GET /api/admin/verificacion-profesionales/reps — la lista de carga manual:
 * profesionales ACTIVO + estado REPS DERIVADO de la ÚLTIMA fila (sin fila → SIN_VERIFICAR), y la
 * guardia de servidor (módulo admin_verificacion_profesionales).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
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

async function crearProfesional(nombreVisible: string, estado: "ACTIVO" | "EN_REVISION" = "ACTIVO"): Promise<string> {
    const { ciudad } = await crearPaisCiudad();
    const u = await crearUsuario("PROFESIONAL", `${nombreVisible.replace(/\s+/g, ".").toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@ejemplo.local`);
    const p = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible,
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            aniosExperiencia: 5,
            presentacion: "Perfil de prueba.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 45,
            estado,
        },
    });
    return p.id;
}

function pedir() {
    return GET();
}

describe("GET /api/admin/verificacion-profesionales/reps · SPEC-790 (T6)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });
    afterAll(async () => prisma.$disconnect());

    it("lista los ACTIVO con el estado REPS derivado: sin fila → SIN_VERIFICAR; con VIGENTE → VIGENTE + detalle", async () => {
        const sinFila = await crearProfesional("Ana Sin Fila");
        const conVigente = await crearProfesional("Beto Vigente");
        const admin = await crearUsuario("ADMIN", `admin.lista.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const vigenteHasta = new Date(Date.now() + 90 * DIA);
        await prisma.verificacionReps.create({
            data: {
                profesionalId: conVigente,
                verificadoEn: new Date(),
                fuente: "MANUAL_ADMIN",
                resultado: "VIGENTE",
                vigenteHasta,
                modalidades: ["PRESENCIAL", "TELEMEDICINA"],
            },
        });

        const res = await pedir();
        expect(res.status).toBe(200);
        const { data } = (await res.json()) as { data: Array<{ id: string; estadoReps: string; vigenteHasta: string | null; modalidades: string[] }> };

        const ana = data.find((d) => d.id === sinFila)!;
        const beto = data.find((d) => d.id === conVigente)!;
        expect(ana.estadoReps).toBe("SIN_VERIFICAR");
        expect(ana.vigenteHasta).toBeNull();
        expect(ana.modalidades).toEqual([]);
        expect(beto.estadoReps).toBe("VIGENTE");
        expect(beto.vigenteHasta).toBe(vigenteHasta.toISOString());
        expect(beto.modalidades).toEqual(expect.arrayContaining(["PRESENCIAL", "TELEMEDICINA"]));
    });

    it("append-only: con dos filas, el estado es el de la ÚLTIMA (una corrección es carga nueva, no un borrón)", async () => {
        const id = await crearProfesional("Carla Corrección");
        const admin = await crearUsuario("ADMIN", `admin.ult.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        // Primero VIGENTE (más vieja), luego una corrección NO_ENCONTRADA (más reciente).
        await prisma.verificacionReps.create({
            data: { profesionalId: id, verificadoEn: new Date(Date.now() - DIA), fuente: "MANUAL_ADMIN", resultado: "VIGENTE", vigenteHasta: new Date(Date.now() + 90 * DIA), modalidades: ["PRESENCIAL"] },
        });
        await prisma.verificacionReps.create({
            data: { profesionalId: id, verificadoEn: new Date(), fuente: "MANUAL_ADMIN", resultado: "NO_ENCONTRADA", vigenteHasta: null, modalidades: [] },
        });

        const res = await pedir();
        const { data } = (await res.json()) as { data: Array<{ id: string; estadoReps: string }> };
        expect(data.find((d) => d.id === id)!.estadoReps).toBe("NO_ENCONTRADA");
    });

    it("sin sesión → la guardia del servidor NO autoriza (≥ 401)", async () => {
        await crearProfesional("Quien Sea");
        mockToken = undefined;
        const res = await pedir();
        expect(res.status).toBeGreaterThanOrEqual(401);
    });
});
