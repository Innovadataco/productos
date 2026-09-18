/**
 * CANDADO de recorrido · SPEC-706 (+ SPEC-703 cutover) · El cierre de la ficha por el PUT del perfil.
 *
 * Enviar a revisión es un acto EXPLÍCITO (botón «Guardar y enviar a revisión» → PUT con
 * `enviarARevision`), NO una auto-transición al completarse. El PUT:
 *   · «Guardar borrador» (sin la bandera) guarda y NO transiciona, aunque esté completa + aceptada.
 *   · Enviar con la ficha INCOMPLETA → 400 FICHA_INCOMPLETA que NOMBRA los campos que faltan (antes
 *     la transición era silenciosa: un `rangoEtario` vacío dejaba el perfil en BORRADOR sin decir
 *     nada — el bug medido por Jelkin).
 *   · Enviar SIN aceptar la autorización → falta «Aceptar la autorización» (mismo mecanismo).
 *   · Enviar completa + aceptada → EN_REVISION, y la aceptación es PREVIA (sin 409 al decidir).
 *   · En EN_REVISION la ficha es de SOLO LECTURA EN EL SERVIDOR: el PUT rechaza toda edición (409).
 *   · Un VENCIDO reactiva por la MISMA ficha (editable) → PUT enviar → EN_REVISION.
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

/** Crea el profesional autenticado y su perfil en `estado` con todos los campos (menos los `over`). */
async function crearPerfil(email: string, estado: "BORRADOR" | "VENCIDO", over: Record<string, unknown> = {}) {
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
            estado,
            ...over,
        },
    });
    return { user, perfil };
}

/** PUT de la ficha. `enviar` dispara la transición; sin él, guarda borrador. `over` pisa campos. */
async function putFicha(enviar: boolean, over: Record<string, unknown> = {}) {
    return PUT_PERFIL(
        new Request("http://localhost:5005/api/profesional/perfil", {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...(activeToken ? { cookie: `token=${activeToken}` } : {}) },
            body: JSON.stringify({
                nombreVisible: "Dra. Recorrido",
                profesion: "psicologo",
                areasAtencion: ["ansiedad"],
                rangoEtario: ["6-11"],
                ciudadId: await ciudadId(),
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 6,
                presentacion: "Acompaño a familias con niñez y adolescencia.",
                ...(enviar ? { enviarARevision: true } : {}),
                ...over,
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

const estadoDe = (id: string) =>
    prisma.perfilProfesional.findUniqueOrThrow({ where: { id } }).then((p) => p.estado);

describe("SPEC-706 · el cierre de la ficha: enviar explícito, nombra lo que falta, bloquea en revisión", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPaisCiudad();
        await crearParametrosAutorizacionProfesional();
        activeToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
    });
    afterAll(async () => prisma.$disconnect());

    it("«Guardar borrador» (sin enviar) NO transiciona, aunque esté completa y aceptada", async () => {
        const { perfil } = await crearPerfil("borrador@test.local", "BORRADOR");
        await aceptar();
        const res = await putFicha(false);
        expect(res.status).toBeLessThan(400);
        expect(await estadoDe(perfil.id)).toBe("BORRADOR");
    });

    it("CANDADO · enviar con un obligatorio vacío (Edad que atiende) → 400 que NOMBRA el campo, queda BORRADOR", async () => {
        const { perfil } = await crearPerfil("incompleta@test.local", "BORRADOR");
        await aceptar();
        const res = await putFicha(true, { rangoEtario: [] });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe("FICHA_INCOMPLETA");
        expect(json.error.campos).toContain("Edad que atiende");
        expect(await estadoDe(perfil.id)).toBe("BORRADOR");
    });

    it("enviar SIN aceptar la autorización → falta «Aceptar la autorización», queda BORRADOR", async () => {
        const { perfil } = await crearPerfil("sin-aceptar@test.local", "BORRADOR");
        const res = await putFicha(true); // completa pero SIN aceptar
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.campos).toContain("Aceptar la autorización");
        expect(await estadoDe(perfil.id)).toBe("BORRADOR");
    });

    it("enviar completa + aceptada → EN_REVISION, y la aceptación es PREVIA (sin 409 al decidir)", async () => {
        const { user, perfil } = await crearPerfil("ok@test.local", "BORRADOR");
        await aceptar();
        const res = await putFicha(true);
        expect(res.status).toBeLessThan(400);
        expect(await estadoDe(perfil.id)).toBe("EN_REVISION");
        const previa = await new AutorizacionProfesionalService().aceptacionAntesDe(user.id, new Date());
        expect(previa).not.toBeNull();
    });

    it("CANDADO · en EN_REVISION la ficha es SOLO LECTURA en el servidor: el PUT rechaza la edición (409)", async () => {
        const { perfil } = await crearPerfil("en-revision@test.local", "BORRADOR", { estado: "EN_REVISION" });
        const res = await putFicha(false, { presentacion: "intento de editar en revisión" });
        expect(res.status).toBe(409);
        // No cambió nada.
        expect((await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } })).presentacion).toBe(
            "Acompaño a familias con niñez y adolescencia.",
        );
    });

    it("SUSPENDIDO: el PUT también rechaza la edición (409)", async () => {
        // SUSPENDIDO exige modalidad (CHECK); el perfil base ya tiene atiendeVirtual.
        const { perfil } = await crearPerfil("suspendido@test.local", "BORRADOR", { estado: "SUSPENDIDO" });
        // Cuerpo VÁLIDO (pasa el schema): así el 409 es la compuerta de estado, no un 400 de validación.
        const res = await putFicha(false, { presentacion: "Intento de editar mi ficha estando suspendida." });
        expect(res.status).toBe(409);
        expect(await estadoDe(perfil.id)).toBe("SUSPENDIDO");
    });

    it("reactivación del VENCIDO por la MISMA ficha: acepta + enviar → EN_REVISION", async () => {
        const { perfil } = await crearPerfil("vencido@test.local", "VENCIDO");
        await aceptar();
        const res = await putFicha(true);
        expect(res.status).toBeLessThan(400);
        expect(await estadoDe(perfil.id)).toBe("EN_REVISION");
    });
});
