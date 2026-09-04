/**
 * SPEC-428 · GET /api/padre/citas/[id]
 * · sin sesión → 401
 * · otro padre → 404 (no revela existencia)
 * · el padre dueño → 200 con DTO CitaParaPadre (contacto sólo si
 *   `debeExponerContacto`; SPEC-388a).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearPaisCiudad,
    crearTokenUsuario,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import { GET } from "./route";

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && globalThis.__testToken
                ? { name: "token", value: globalThis.__testToken as string }
                : undefined,
    }),
}));

declare global {
    var __testToken: string | undefined;
}

async function seedProfesionalConFranja() {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Torres",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 5,
            presentacion: "Trabaja con niños y adolescentes.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const inicio = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    const franja = await prisma.franjaDisponible.create({
        data: {
            profesionalId: perfil.id,
            inicio,
            fin,
            modalidad: "VIRTUAL",
            tomada: true,
        },
    });
    return { perfil, franja };
}

async function seedSolicitud(padreId: string, perfilId: string, franjaId: string) {
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId: perfilId,
            franjaId,
            presentacion: "Buenas, mi hijo tiene ansiedad escolar.",
            urgencia: "SIN_APURO",
            estado: "PAGADA_PENDIENTE",
            venceEn: new Date(Date.now() + 48 * 60 * 60 * 1000),
            pagoAprobadoEn: new Date(),
            montoConsulta: 50000,
            montoServicio: 7500,
            montoTotal: 57500,
            porcentajeServicio: 15,
        },
    });
}

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("GET /api/padre/citas/[id] (SPEC-428)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
    });

    it("sin sesión → 401", async () => {
        const { perfil, franja } = await seedProfesionalConFranja();
        const padre = await crearUsuario("PARENT");
        const solicitud = await seedSolicitud(padre.id, perfil.id, franja.id);

        // Sin `__testToken`, el mock de cookies no devuelve token → verifyAuth
        // dispara 401 UNAUTHORIZED antes de tocar la BD.
        const req = crearRequestAutenticado("GET", `http://localhost/api/padre/citas/${solicitud.id}`, null);
        const res = await GET(req, ctx(solicitud.id));
        expect(res.status).toBe(401);
    });

    it("otro padre → 404 (no revela existencia)", async () => {
        const { perfil, franja } = await seedProfesionalConFranja();
        const padreDueño = await crearUsuario("PARENT");
        const otroPadre = await crearUsuario("PARENT");
        const solicitud = await seedSolicitud(padreDueño.id, perfil.id, franja.id);
        globalThis.__testToken = await crearTokenUsuario(otroPadre.id, "PARENT");

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost/api/padre/citas/${solicitud.id}`,
            null,
            globalThis.__testToken,
        );
        const res = await GET(req, ctx(solicitud.id));
        expect(res.status).toBe(404);
    });

    it("el padre dueño → 200 y DTO CitaParaPadre sin contacto (aún sin confirmar)", async () => {
        const { perfil, franja } = await seedProfesionalConFranja();
        const padre = await crearUsuario("PARENT");
        const solicitud = await seedSolicitud(padre.id, perfil.id, franja.id);
        globalThis.__testToken = await crearTokenUsuario(padre.id, "PARENT");

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost/api/padre/citas/${solicitud.id}`,
            null,
            globalThis.__testToken,
        );
        const res = await GET(req, ctx(solicitud.id));
        expect(res.status).toBe(200);

        const body = (await res.json()) as { data: { id: string; estado: string; contactoProfesional?: unknown } };
        expect(body.data.id).toBe(solicitud.id);
        expect(body.data.estado).toBe("PAGADA_PENDIENTE");
        // Candado H-2 (SPEC-388a): la cita NO está CONFIRMADA, así que el DTO
        // no expone email/teléfono del profesional.
        expect(body.data.contactoProfesional).toBeUndefined();
    });
});
