/**
 * SPEC-434 (I-302 · Jelkin vivo 04-09) · Candados server-side de la ficha
 * del profesional:
 *   · Ciudad válida (cuid del selector) → 201 y fila creada.
 *   · Ciudad inválida (cuid inexistente) → 400 con mensaje humano, NUNCA 500.
 *
 * Reproducción negativa: el bug histórico devolvía 500 «Error interno» al
 * pasar cualquier cadena que no fuese un cuid válido — Jelkin escribió
 * `bogota` y quedó bloqueado. El helper del route valida la existencia de la
 * ciudad ANTES del `connect` y responde 400 con mensaje entendible.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

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

function bodyBase() {
    return {
        nombreVisible: "Prof. Ejemplo",
        tituloProfesional: "Psicólogo clínico",
        especialidades: ["Terapia familiar"],
        atiendeVirtual: true,
        atiendePresencial: false,
        aniosExperiencia: 10,
        presentacion: "Experiencia con familias en Bogotá.",
        tarifaConsultaCOP: 120_000,
        duracionMinutos: 50,
    };
}

describe("SPEC-434 · PUT /api/profesional/perfil — candado de ciudad", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
    });

    it("crea la ficha cuando la ciudad existe (201) — conducta, no texto", async () => {
        const prof = await crearUsuario("PROFESIONAL");
        const { ciudad } = await crearPaisCiudad();
        globalThis.__testToken = await crearTokenUsuario(prof.id, "PROFESIONAL");

        const req = crearRequestAutenticado(
            "PUT",
            "http://localhost/api/profesional/perfil",
            { ...bodyBase(), ciudadId: ciudad.id },
            globalThis.__testToken,
        );
        const res = await PUT(req);
        expect(res.status, `respuesta: ${await res.clone().text().catch(() => "")}`).toBe(201);
        // Fila creada en BD con el ciudadId correcto — no es solo el JSON de respuesta.
        const fila = await prisma.perfilProfesional.findUnique({ where: { usuarioId: prof.id }, select: { ciudadId: true } });
        expect(fila?.ciudadId).toBe(ciudad.id);
    });

    it("rechaza con 400 cuando la ciudad no existe (I-302: antes daba 500)", async () => {
        const prof = await crearUsuario("PROFESIONAL");
        // NO creamos la ciudad — pasamos un cuid con formato válido pero inexistente.
        globalThis.__testToken = await crearTokenUsuario(prof.id, "PROFESIONAL");

        const req = crearRequestAutenticado(
            "PUT",
            "http://localhost/api/profesional/perfil",
            { ...bodyBase(), ciudadId: "ciudadinexistente1234567" },
            globalThis.__testToken,
        );
        const res = await PUT(req);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { message?: string; code?: string } };
        expect(body.error?.message).toContain("ciudad");
        // Contraprueba: NO devuelve 500 ni exhibe el stack de Prisma.
        expect(body.error?.message ?? "").not.toContain("Invalid `prisma");
    });
});
