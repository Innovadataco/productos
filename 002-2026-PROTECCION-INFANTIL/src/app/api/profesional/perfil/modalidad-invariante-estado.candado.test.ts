/**
 * SPEC-673 (I-398) · CANDADO de INVARIANTE DE ESTADO: un perfil profesional que
 * NO está en BORRADOR debe tener al menos una modalidad (`atiendeVirtual ||
 * atiendePresencial`). Se llegue por donde se llegue.
 *
 * El defecto (I-398, Calidad lo caminó en prod): `perfilCompletoParaRevision`
 * exige la modalidad SOLO en la transición BORRADOR→EN_REVISION del PUT/subida.
 * Otros caminos al mismo estado NO la exigían: `reenviarParaVerificacion` (desde
 * BORRADOR o VENCIDO) y editar un ACTIVO desmarcando ambas modalidades → un
 * profesional aprobado, listado e inservible (invisible a búsquedas filtradas +
 * sin poder crear franjas).
 *
 * La invariante tiene DOS custodios, y este candado los vigila por separado —
 * porque un candado que solo mira el estado final quedaría verde tanto si la app
 * rechaza limpio (400) como si revienta contra la BD (500), y un 500 es PEOR para
 * el usuario que el defecto:
 *   · GUARD de código (`exigirModalidadParaEstado`), en los caminos CONOCIDOS
 *     (reenviar + PUT): debe RECHAZAR LIMPIO — `AppError` 400 `MODALIDAD_REQUERIDA`,
 *     antes de tocar la BD. Se afirma el error, no solo el estado final.
 *   · CHECK NOT VALID en la BD (SPEC-673), respaldo de fondo para los caminos que
 *     no conocemos: hace IRREPRESENTABLE la fila ilegal. Con el CHECK puesto, el
 *     estado «VENCIDO sin modalidad» ya no se puede ni construir; el candado deja
 *     de custodiar «no se llega» y pasa a custodiar dos cosas reales: (a) que la
 *     BD RECHAZA el insert ilegal (único custodio del CHECK: si alguien lo dropea,
 *     este test se pone rojo) y (b) que el camino LEGAL (con modalidad) funciona.
 *
 * Integración (BD de test, truncada por resetDatabase). NO toca prod: la fila
 * `E2E_PROFESIONAL` que Calidad dejó como evidencia vive en prod, no acá.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { reenviarParaVerificacion } from "@/lib/profesionales/verificador/vista-profesional";
import { ERROR_CODES } from "@/lib/errors";
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

/** Campos base de un perfil, sin `estado` ni modalidad (las variables bajo prueba). */
function datosPerfilBase(usuarioId: string, ciudadId: string) {
    return {
        usuarioId,
        nombreVisible: "Mariana Restrepo",
        tituloProfesional: "Psicología",
        especialidades: ["infantil"],
        ciudadId,
        aniosExperiencia: 8,
        presentacion: "Presentación de prueba.",
        tarifaConsultaCOP: 180000,
        duracionMinutos: 45,
        // reenviar exige autorización firmada; la ponemos para aislar la
        // modalidad como la única variable bajo prueba.
        autorizacionArchivoId: "autorizacion-de-prueba",
    };
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
            ...datosPerfilBase(usuario.id, ciudad.id),
            atiendeVirtual: modalidades.atiendeVirtual ?? false,
            atiendePresencial: modalidades.atiendePresencial ?? false,
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

    it("origen BORRADOR: reenviar sin modalidad RECHAZA LIMPIO (AppError 400 MODALIDAD_REQUERIDA) y no promueve", async () => {
        // BORRADOR sin modalidad es LEGAL (el CHECK exime a BORRADOR): el borrador
        // puede estar incompleto. Lo que no puede es SALIR de BORRADOR sin modalidad.
        const { usuario, perfil } = await sembrarPerfil("BORRADOR");
        // Rechazo LIMPIO del guard, ANTES de tocar la BD: no un 500 crudo del CHECK.
        // Si alguien quita el guard, reenviar escribiría y chocaría con el CHECK →
        // el error dejaría de ser MODALIDAD_REQUERIDA y este expect caería.
        await expect(reenviarParaVerificacion(usuario.id)).rejects.toMatchObject({
            code: ERROR_CODES.MODALIDAD_REQUERIDA,
            statusCode: 400,
        });
        expect(
            (await releer(perfil.id))?.estado,
            "reenviar desde BORRADOR sin modalidad no debe promover a EN_REVISION",
        ).toBe("BORRADOR");
    });

    it("VENCIDO sin modalidad es IRREPRESENTABLE: la BD RECHAZA el insert (CHECK) — único custodio del CHECK", async () => {
        // Insert de VERDAD (no mock): con el CHECK puesto, crear un VENCIDO con ambas
        // modalidades en false debe fallar en la base. Si mañana alguien dropea el
        // CHECK, este create tendrá éxito, `err` quedará undefined y el test se pone
        // ROJO. Es el único guardián del CHECK en la suite.
        const ciudad = await ciudadSemilla();
        const usuario = await crearUsuario("PROFESIONAL", `psi.chk.${Date.now()}.${Math.random()}@ejemplo.local`);
        let err: unknown;
        try {
            await prisma.perfilProfesional.create({
                data: {
                    ...datosPerfilBase(usuario.id, ciudad.id),
                    estado: "VENCIDO",
                    atiendeVirtual: false,
                    atiendePresencial: false,
                },
            });
        } catch (e) {
            err = e;
        }
        expect(
            err,
            "insertar VENCIDO sin modalidad DEBE fallar: si no falla, el CHECK ya no está en la BD",
        ).toBeDefined();
        // El rechazo tiene que ser ESTE check (SQLSTATE 23514 / el nombre de la
        // constraint), no otro error que pasaría de casualidad.
        const detalle = `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
        expect(
            detalle,
            "el rechazo debe ser el CHECK de modalidad (23514 / PerfilProfesional_modalidad_estado_check)",
        ).toMatch(/23514|PerfilProfesional_modalidad_estado_check/);
    });

    it("origen VENCIDO legal (con modalidad): reenviar SÍ promueve a EN_REVISION — el guard no sobre-bloquea", async () => {
        // Un VENCIDO ahora SIEMPRE tiene modalidad (CHECK); reenviar debe funcionar.
        // Si se le quita la modalidad al montaje, el seed choca con el CHECK y el
        // test cae — así este caso también custodia que el camino legal la lleve.
        const { usuario, perfil } = await sembrarPerfil("VENCIDO", { atiendeVirtual: true });
        await reenviarParaVerificacion(usuario.id);
        expect(
            (await releer(perfil.id))?.estado,
            "reenviar desde un VENCIDO con modalidad debe promover a EN_REVISION",
        ).toBe("EN_REVISION");
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
