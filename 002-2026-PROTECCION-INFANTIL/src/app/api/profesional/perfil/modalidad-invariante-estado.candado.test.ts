/**
 * SPEC-673 (I-398) · CANDADO de INVARIANTE DE ESTADO: un perfil profesional que
 * NO está en BORRADOR debe tener al menos una modalidad (`atiendeVirtual ||
 * atiendePresencial`). Se llegue por donde se llegue.
 *
 * El defecto (I-398, Calidad lo caminó en prod): `perfilCompletoParaRevision`
 * exige la modalidad SOLO en la transición BORRADOR→EN_REVISION del PUT/subida.
 * Pero hay OTROS caminos al mismo estado que NO la exigen:
 *   1. `reenviarParaVerificacion` desde **BORRADOR** (sin modalidad → EN_REVISION).
 *   2. `reenviarParaVerificacion` desde **VENCIDO** (ídem; `ORIGENES_QUE_PUEDEN_REENVIAR`).
 *   3. Editar un perfil **ACTIVO** y desmarcar ambas modalidades (queda ACTIVO
 *      con ambas en false: invisible a búsquedas filtradas + no puede crear franjas).
 * Un profesional aprobado e inservible, sin que él ni el admin lo sepan.
 *
 * Este candado va sobre el ESTADO, no sobre un endpoint ni una transición: para
 * CADA origen, tras la operación, el perfil NO puede quedar en (estado≠BORRADOR
 * ∧ ambas modalidades false). La aserción es sobre DATOS (relee la fila), así que
 * es indiferente al mecanismo que lo impida (guard de código hoy; CHECK NOT VALID
 * como refuerzo, radicado aparte). Muere con el defecto: sin el guard, los tres
 * orígenes producen la fila prohibida y los tres caen.
 *
 * Integración (BD de test, truncada por resetDatabase). NO toca prod: la fila
 * `E2E_PROFESIONAL` que Calidad dejó como evidencia vive en prod, no acá.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { reenviarParaVerificacion } from "@/lib/profesionales/verificador/vista-profesional";
import { PUT } from "./route";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function ciudadSemilla() {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    return (
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }))
    );
}

/** Siembra un perfil en `estado` con las modalidades dadas (por defecto ambas false). */
async function sembrarPerfil(
    estado: "BORRADOR" | "VENCIDO" | "ACTIVO",
    modalidades: { atiendeVirtual?: boolean; atiendePresencial?: boolean } = {},
) {
    const ciudad = await ciudadSemilla();
    const usuario = await crearUsuario("PROFESIONAL", `psi.${estado}.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Mariana Restrepo",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 8,
            presentacion: "Presentación de prueba.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            atiendeVirtual: modalidades.atiendeVirtual ?? false,
            atiendePresencial: modalidades.atiendePresencial ?? false,
            // reenviar exige autorización firmada; la ponemos para aislar la
            // modalidad como la única variable bajo prueba.
            autorizacionArchivoId: "autorizacion-de-prueba",
            estado,
        },
    });
    return { usuario, perfil };
}

async function releer(perfilId: string) {
    return prisma.perfilProfesional.findUnique({ where: { id: perfilId } });
}

describe("SPEC-673 (I-398) · un perfil ≠ BORRADOR nunca queda sin modalidad", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("origen BORRADOR: reenviar sin modalidad NO lo deja en EN_REVISION con ambas false", async () => {
        const { usuario, perfil } = await sembrarPerfil("BORRADOR");
        await reenviarParaVerificacion(usuario.id).catch(() => undefined); // el guard puede rechazar
        expect(
            (await releer(perfil.id))?.estado,
            "reenviar desde BORRADOR sin modalidad no debe promover a EN_REVISION",
        ).not.toBe("EN_REVISION");
    });

    it("origen VENCIDO: reenviar sin modalidad NO lo deja en EN_REVISION con ambas false", async () => {
        const { usuario, perfil } = await sembrarPerfil("VENCIDO");
        await reenviarParaVerificacion(usuario.id).catch(() => undefined);
        expect(
            (await releer(perfil.id))?.estado,
            "reenviar desde VENCIDO sin modalidad no debe promover a EN_REVISION",
        ).not.toBe("EN_REVISION");
    });

    it("origen ACTIVO: editar el perfil desmarcando ambas modalidades NO lo deja ACTIVO sin modalidad", async () => {
        const { usuario, perfil } = await sembrarPerfil("ACTIVO", { atiendeVirtual: true });
        mockToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");
        const req = new Request("http://localhost/api/profesional/perfil", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ atiendeVirtual: false, atiendePresencial: false }),
        });
        const res = await PUT(req);
        // 400 (no 403: auth/módulo abrieron; no 200: la edición se rechazó) con un
        // código que el cliente pueda usar para señalar el campo, no texto plano.
        expect(res.status, "editar un ACTIVO a ambas-false debe rechazarse con 400").toBe(400);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            "el 400 debe traer un código que el cliente use para señalar el campo modalidad",
        ).toBe("MODALIDAD_REQUERIDA");
        const p = await releer(perfil.id);
        expect(
            !!p && (p.atiendeVirtual || p.atiendePresencial),
            "editar un ACTIVO desmarcando ambas no debe dejarlo sin modalidad",
        ).toBe(true);
    });
});
