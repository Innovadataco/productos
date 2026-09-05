/**
 * SPEC-496 · Candado de CONDUCTA: el módulo `profesional_*` GATEA el endpoint,
 * no solo el ítem del menú.
 *
 * El defecto que caza (degradación silenciosa, [[ceo-degradacion-silenciosa]]):
 * antes de este PR el área del profesional se gateaba SOLO por rol, así que
 * revocar un módulo `profesional_*` en el panel de permisos escondía el menú
 * pero el endpoint seguía respondiendo 200. Un admin que revoca cree que cortó
 * el acceso y no lo cortó.
 *
 * Se prueba sobre `GET /api/profesional/verificacion` (módulo
 * `profesional_verificacion`) porque su camino 200 pide setup mínimo (usuario +
 * perfil ACTIVO, sin parámetros del motor). Muere con el defecto: con el módulo
 * activo responde 200; tras revocarlo debe responder 403. Si se quita el
 * `assertModulo` del handler, el segundo caso vuelve a 200 y este test se pone
 * rojo. Usa TOKEN real (no mockea `verifyAuth`) para que la puerta del módulo se
 * ejecute de verdad.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function sembrarProfesionalConPerfil() {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}@ejemplo.local`);
    mockToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");
    await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Mariana Restrepo",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 8,
            presentacion: "Presentación.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            estado: "ACTIVO",
        },
    });
    return usuario;
}

async function revocarModulo(rol: string, clave: string) {
    const modulo = await prisma.moduloPermisible.findUniqueOrThrow({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo.id } },
        data: { activo: false },
    });
}

describe("SPEC-496 · `profesional_verificacion` gatea GET /api/profesional/verificacion (no solo el menú)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("con el módulo activo entra (200); revocado, el endpoint RECHAZA (403)", async () => {
        await sembrarProfesionalConPerfil();

        const antes = await GET();
        expect(antes.status, "con `profesional_verificacion` activo el profesional entra").toBe(200);

        await revocarModulo("PROFESIONAL", "profesional_verificacion");

        const despues = await GET();
        expect(
            despues.status,
            "revocado el módulo, el endpoint debe cortar el acceso (403), no responder 200"
        ).toBe(403);
    });
});
