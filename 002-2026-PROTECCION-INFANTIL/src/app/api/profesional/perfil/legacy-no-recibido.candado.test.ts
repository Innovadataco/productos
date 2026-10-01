/**
 * SPEC-786 · CANDADO: el PUT del perfil NO recibe las claves DERIVADAS.
 *
 * `tituloProfesional`/`especialidades` son SALIDA (las calcula el derivador NUEVO→legacy desde
 * `profesion`/`areasAtencion`), no entrada. Un endpoint no puede responder ÉXITO por un payload
 * sobre el que no puede actuar: un cuerpo SOLO-legacy respondía 200 sin derivar nada y el perfil
 * quedaba en BORRADOR para siempre, sin error. Acá se rechaza con motivo (qué mandar).
 *
 * Control positivo en las dos direcciones + el candado MUERE con el defecto (revertir el
 * superRefine del schema → el caso solo-legacy vuelve a pasar como 2xx y esto se pone rojo).
 * El dialecto NUEVO (aunque sea un guardado PARCIAL) sí se acepta — no confundir con el defecto.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { perfilProfesionalUpdateSchema } from "@/lib/profesional/perfil-schema";

declare global {
    var __testToken: string | undefined;
}

// El route lee el token de la cookie (next/headers); se inyecta el del test.
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && globalThis.__testToken
                ? { name: "token", value: globalThis.__testToken as string }
                : undefined,
    }),
}));

describe("SPEC-786 · el schema NO acepta las claves derivadas como entrada", () => {
    it("una clave legacy presente → error de validación con motivo (qué mandar)", () => {
        const r1 = perfilProfesionalUpdateSchema.safeParse({ tituloProfesional: "Psicólogo clínico" });
        expect(r1.success).toBe(false);
        if (!r1.success) expect(r1.error.issues[0]?.message).toMatch(/profesion/i);

        const r2 = perfilProfesionalUpdateSchema.safeParse({ especialidades: ["Terapia familiar"] });
        expect(r2.success).toBe(false);
        if (!r2.success) expect(r2.error.issues[0]?.message).toMatch(/areasAtencion/i);
    });

    it("el dialecto NUEVO (incl. parcial) sí valida — no es el defecto", () => {
        expect(perfilProfesionalUpdateSchema.safeParse({ profesion: "psicologo" }).success).toBe(true);
        expect(perfilProfesionalUpdateSchema.safeParse({ areasAtencion: ["duelo"] }).success).toBe(true);
        // guardado parcial legítimo (alguien salva progreso), sin claves derivadas
        expect(perfilProfesionalUpdateSchema.safeParse({ presentacion: "Trabajo con familias en Bogotá." }).success).toBe(true);
    });
});

describe("SPEC-786 · PUT /api/profesional/perfil — no responde ÉXITO por claves derivadas", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
    });

    it("payload SOLO-legacy → 400 con motivo, NUNCA 2xx (el perfil no se crea a medias en silencio)", async () => {
        const prof = await crearUsuario("PROFESIONAL");
        globalThis.__testToken = await crearTokenUsuario(prof.id, "PROFESIONAL");

        const req = crearRequestAutenticado(
            "PUT",
            "http://localhost/api/profesional/perfil",
            { tituloProfesional: "Psicólogo clínico", especialidades: ["Terapia familiar"] },
            globalThis.__testToken,
        );
        const res = await PUT(req);
        expect(res.status, "solo-legacy debe ser 400, no un 2xx silencioso").toBe(400);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message ?? "").toMatch(/profesion|areasAtencion/i); // dice QUÉ mandar
        // No dejó una fila a medias.
        expect(await prisma.perfilProfesional.count({ where: { usuarioId: prof.id } })).toBe(0);
    });

    it("dialecto NUEVO (parcial, sin claves derivadas) → 2xx y crea el borrador", async () => {
        const prof = await crearUsuario("PROFESIONAL");
        const { ciudad } = await crearPaisCiudad();
        globalThis.__testToken = await crearTokenUsuario(prof.id, "PROFESIONAL");

        const req = crearRequestAutenticado(
            "PUT",
            "http://localhost/api/profesional/perfil",
            { nombreVisible: "Prof. Nuevo", presentacion: "Trabajo con familias en Bogotá.", ciudadId: ciudad.id },
            globalThis.__testToken,
        );
        const res = await PUT(req);
        expect([200, 201]).toContain(res.status);
        expect(await prisma.perfilProfesional.count({ where: { usuarioId: prof.id } })).toBe(1);
    });
});
