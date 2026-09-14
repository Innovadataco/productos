/**
 * SPEC-603 (hotfix) · GET /api/me con sesión huérfana (JWT válido de un usuario
 * ya eliminado de la BD).
 *
 * Candados por conducta contra BD real:
 *   · usuario eliminado → 401 limpio (AppError, sin stack trace) y la respuesta
 *     EXPIRA ambas cookies de sesión (`__Host-token` y `token`): sin ese
 *     Set-Cookie el navegador conserva la cookie huérfana y reintenta en loop
 *     en cada carga de página (síntoma visto en producción).
 *   · usuario activo → 200 con su perfil (flujo sano intacto).
 *   · sin cookie → 401 y también expira cookies (idempotente, inocuo).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
        set: vi.fn(),
    }),
}));

import { GET } from "./route";

function cookiesExpiradas(res: Response): string[] {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    return setCookies.filter((c) => /^(token|__Host-token)=;/.test(c) && /Max-Age=0/.test(c));
}

describe("GET /api/me · sesión huérfana (SPEC-603)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("JWT de usuario eliminado → 401 limpio y cookies de sesión expiradas (corta el loop)", async () => {
        const padre = await crearUsuario("PARENT", "huerfano-me@example.com");
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await prisma.usuario.delete({ where: { id: padre.id } });

        const res = await GET();
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe("AUTH_INVALID");

        const expiradas = cookiesExpiradas(res);
        expect(expiradas.some((c) => c.startsWith("__Host-token="))).toBe(true);
        expect(expiradas.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("usuario activo → 200 con su perfil y sin expirar cookies", async () => {
        const padre = await crearUsuario("PARENT", "sano-me@example.com");
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });

        const res = await GET();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(padre.id);
        expect(json.email).toBe("sano-me@example.com");
        expect(cookiesExpiradas(res)).toHaveLength(0);
    });

    it("sin cookie → 401 con cookies expiradas", async () => {
        const res = await GET();
        expect(res.status).toBe(401);
        expect(cookiesExpiradas(res)).toHaveLength(2);
    });
});

// ── SPEC-690 (I-414) · contrato con Dev 2 (SPEC-691) ────────────────────────
// /api/me expone `profesional:{estado,habilitado}`, derivado EN EL SERVIDOR y
// CONTRA LA BASE en cada petición (no desde la cookie). El caso que define la
// seguridad: un profesional SUSPENDIDO con la MISMA sesión recibe habilitado:false
// en la llamada siguiente — la marca no vive en el token.
describe("GET /api/me · habilitación del profesional (SPEC-690)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    async function sembrarProfesional(estado: "ACTIVO" | "SUSPENDIDO") {
        const rnd = `${Date.now()}.${Math.random()}`;
        const usuario = await crearUsuario("PROFESIONAL", `psi.690.${rnd}@ejemplo.local`);
        const pais = await prisma.pais.create({
            data: { codigo: `X${Math.floor(Math.random() * 1e6)}`, nombre: "PaisPrueba690" },
        });
        const ciudad = await prisma.ciudad.create({
            data: { nombre: `Ciudad690-${rnd}`, nombreNormalizado: `ciudad690-${rnd}`, paisId: pais.id },
        });
        const perfil = await prisma.perfilProfesional.create({
            data: {
                usuarioId: usuario.id,
                nombreVisible: "Psi Prueba",
                tituloProfesional: "Psicóloga clínica",
                especialidades: ["ansiedad"],
                ciudadId: ciudad.id,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 8,
                presentacion: "Perfil de prueba SPEC-690.",
                tarifaConsultaCOP: 120000,
                duracionMinutos: 50,
                estado,
            },
        });
        const revisor = await crearUsuario("ADMIN", `admin.690.${rnd}@ejemplo.local`);
        await prisma.verificacionProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                revisadoPorId: revisor.id,
                revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
                checklist: {},
                resultado: "APROBADO",
                autorizacionArchivoId: "archivo-de-prueba-690",
                venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // vigente
            },
        });
        return { usuario, perfil };
    }

    it("ACTIVO + verificación vigente → profesional:{estado:'ACTIVO', habilitado:true}", async () => {
        const { usuario } = await sembrarProfesional("ACTIVO");
        mockToken = await createToken({ sub: usuario.id, rol: "PROFESIONAL" });
        const res = await GET();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.profesional).toEqual({ estado: "ACTIVO", habilitado: true });
    });

    it("suspender con la MISMA sesión → la llamada siguiente da habilitado:false (server-side, no cookie)", async () => {
        const { usuario, perfil } = await sembrarProfesional("ACTIVO");
        mockToken = await createToken({ sub: usuario.id, rol: "PROFESIONAL" });

        const antes = await (await GET()).json();
        expect(antes.profesional.habilitado).toBe(true);

        // El admin lo suspende — el token NO cambia.
        await prisma.perfilProfesional.update({ where: { id: perfil.id }, data: { estado: "SUSPENDIDO" } });

        const despues = await (await GET()).json();
        expect(despues.profesional).toEqual({ estado: "SUSPENDIDO", habilitado: false });
    });
});
