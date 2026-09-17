/**
 * CANDADO de recorrido · SPEC-703 · El alta nueva ACEPTA EN PANTALLA y pasa a revisión sin 409.
 *
 * El hueco que cierra: el cutover de SPEC-686 hizo que `decidir` exija la aceptación en pantalla,
 * pero la completitud del alta seguía exigiendo el PDF. Un alta nueva subía el PDF, pasaba a
 * revisión y el verificador la rechazaba con 409. Ahora la completitud exige la ACEPTACIÓN.
 *
 * Prueba la CONDUCTA end-to-end golpeando los routes reales:
 *  1. CONTROL · alta completa SIN aceptar → el PUT NO la pasa a revisión (queda BORRADOR).
 *  2. alta completa + POST /aceptar → pasa a EN_REVISION (aceptar es el gate de completitud).
 *  3. «sin 409»: tras aceptar, la aceptación es PREVIA (`aceptacionAntesDe(now)` no es null) — es
 *     exactamente lo que la guarda de anterioridad de `decidir` (SPEC-686) exige para NO dar 409.
 *     El camino completo de `decidir` con aceptación lo cubren sus tests de SPEC-686.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { PUT as PUT_PERFIL } from "../perfil/route";
import { POST as POST_ACEPTAR } from "./aceptar/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { crearParametrosAutorizacionProfesional } from "@/lib/autorizacion-profesional-test-utils";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";

let activeToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && activeToken
                ? { name, value: activeToken }
                : undefined,
        set: vi.fn(),
    }),
}));

async function ciudadId(): Promise<string> {
    const c = await prisma.ciudad.findFirstOrThrow({ where: { nombre: "Bogotá" } });
    return c.id;
}

/** Un profesional autenticado con su ficha COMPLETA en BORRADOR (todo menos la autorización). */
async function altaCompletaEnBorrador(email: string) {
    const user = await crearUsuario("PROFESIONAL", email);
    activeToken = await crearTokenUsuario(user.id, "PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: user.id,
            nombreVisible: "Dra. Recorrido",
            tituloProfesional: "",
            especialidades: [],
            profesion: "psicologo",
            areasAtencion: ["ansiedad"],
            rangoEtario: ["6-11"],
            ciudadId: await ciudadId(),
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 6,
            presentacion: "Acompaño a familias con niñez y adolescencia.",
            duracionMinutos: 45,
            estado: "BORRADOR",
        },
    });
    return { user, perfil };
}

/** Re-guarda la ficha por el route real (dispara la evaluación de completitud del PUT). */
function guardarFicha(ciudad: string) {
    return PUT_PERFIL(
        new Request("http://localhost:5005/api/profesional/perfil", {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...(activeToken ? { cookie: `token=${activeToken}` } : {}) },
            body: JSON.stringify({
                nombreVisible: "Dra. Recorrido",
                profesion: "psicologo",
                areasAtencion: ["ansiedad"],
                rangoEtario: ["6-11"],
                ciudadId: ciudad,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 6,
                presentacion: "Acompaño a familias con niñez y adolescencia.",
                duracionMinutos: 45,
            }),
        }),
    );
}

function aceptar() {
    return POST_ACEPTAR(
        new Request("http://localhost:5005/api/profesional/autorizacion/aceptar", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(activeToken ? { cookie: `token=${activeToken}` } : {}) },
            body: JSON.stringify({}),
        }),
    );
}

describe("SPEC-703 · recorrido del alta: aceptar en pantalla pasa a revisión sin 409", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPaisCiudad();
        await crearParametrosAutorizacionProfesional();
        activeToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
    });
    afterAll(async () => prisma.$disconnect());

    it("CONTROL · alta completa SIN aceptar → el PUT NO la pasa a revisión (queda BORRADOR)", async () => {
        const { perfil } = await altaCompletaEnBorrador("sin-aceptar@test.local");
        const res = await guardarFicha(perfil.ciudadId);
        expect(res.status).toBeLessThan(400);
        expect((await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } })).estado).toBe("BORRADOR");
    });

    it("alta completa + aceptar en pantalla → pasa a EN_REVISION", async () => {
        const { perfil } = await altaCompletaEnBorrador("acepta@test.local");
        const res = await aceptar();
        expect(res.status).toBe(200);
        expect((await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } })).estado).toBe("EN_REVISION");
    });

    it("«sin 409»: la aceptación es PREVIA — la guarda de anterioridad de decidir la ve", async () => {
        const { user } = await altaCompletaEnBorrador("previa@test.local");
        await aceptar();
        // Es exactamente lo que `decidir` consulta para no dar 409 por falta de autorización previa.
        const previa = await new AutorizacionProfesionalService().aceptacionAntesDe(user.id, new Date());
        expect(previa).not.toBeNull();
    });
});
