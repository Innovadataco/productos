/**
 * CANDADO · SPEC-685 (PR3) · Solo el HABILITADO puede fijar tarifa — regla del SERVIDOR.
 *
 * Conducta (no se puede fingir): `PUT /api/profesional/perfil` con `tarifaConsultaCOP`
 * de un profesional NO habilitado se RECHAZA con 400. Esconder el campo en la UI no es
 * cerrarlo: un PUT directo lo intentaría igual. La compuerta vive en la ruta, contra la
 * habilitación real (obtenerHabilitacionProfesional), no contra el cliente.
 *
 * Control positivo (que no rechaza en bloque): el HABILITADO SÍ puede fijar tarifa; y un
 * NO habilitado que NO manda tarifa (edita otro campo) NO es rechazado por esta regla.
 * Mutación: quitar el guard → el rechazo del no habilitado se cae.
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

/** Profesional con perfil en el estado pedido; `habilitado` añade la verificación vigente. */
async function ponerProfesional(opts: { habilitado: boolean }) {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    globalThis.__testToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Uno",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["Ansiedad"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Acompaño a familias con niñez y adolescencia.",
            duracionMinutos: 50,
            estado: opts.habilitado ? "ACTIVO" : "BORRADOR",
        },
    });
    if (opts.habilitado) {
        const revisor = await crearUsuario("ADMIN");
        await prisma.verificacionProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                revisadoPorId: revisor.id,
                revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
                checklist: {},
                resultado: "APROBADO",
                autorizacionArchivoId: "archivo-de-prueba",
                venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            },
        });
    }
    return { usuario, perfil };
}

async function putPerfil(body: unknown) {
    const req = crearRequestAutenticado("PUT", "http://localhost/api/profesional/perfil", body, globalThis.__testToken);
    return PUT(req);
}

describe("SPEC-685 · solo el habilitado fija tarifa (servidor)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
    });

    it("NO habilitado (BORRADOR) + tarifa → RECHAZA 400 (no la guarda)", async () => {
        const { usuario } = await ponerProfesional({ habilitado: false });
        const res = await putPerfil({ tarifaConsultaCOP: 100_000 });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toContain("habilitado");
        const fila = await prisma.perfilProfesional.findUnique({ where: { usuarioId: usuario.id }, select: { tarifaConsultaCOP: true } });
        expect(fila?.tarifaConsultaCOP).toBeNull(); // no se guardó nada
    });

    it("control positivo: HABILITADO + tarifa → la acepta y la guarda", async () => {
        const { usuario } = await ponerProfesional({ habilitado: true });
        const res = await putPerfil({ tarifaConsultaCOP: 100_000 });
        expect(res.status, `respuesta: ${await res.clone().text().catch(() => "")}`).toBe(200);
        const fila = await prisma.perfilProfesional.findUnique({ where: { usuarioId: usuario.id }, select: { tarifaConsultaCOP: true } });
        expect(fila?.tarifaConsultaCOP).toBe(100_000);
    });

    it("control de especificidad: NO habilitado SIN tarifa (otro campo) NO se rechaza por esta regla", async () => {
        await ponerProfesional({ habilitado: false });
        const res = await putPerfil({ presentacion: "Actualizo mi presentación, sin tocar la tarifa." });
        expect(res.status).not.toBe(400);
    });
});
