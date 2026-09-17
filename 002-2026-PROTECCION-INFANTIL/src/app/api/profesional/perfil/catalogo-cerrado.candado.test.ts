/**
 * CANDADO · SPEC-685 (PR2) · Las tres listas de la ficha son CERRADAS en el SERVIDOR.
 *
 * Conducta (lo que no se puede fingir): la API `PUT /api/profesional/perfil`
 * RECHAZA (400) cualquier clave de profesión / área / rango que no esté en el
 * catálogo vivo, y ACEPTA las que sí — guardando las claves en la BD. No basta
 * el `<select>` del cliente: un gate contra un valor del cliente falla ABIERTO,
 * así que la puerta vive en la ruta, contra el parámetro editable.
 *
 * Control positivo del LECTOR (no una lista a mano): si el admin agrega una
 * clave nueva al parámetro (`coach`, que NO está en el DEFAULT del código), la
 * API la acepta. Eso prueba que valida contra el PARÁMETRO sembrado, no contra
 * una constante hardcodeada — y de paso, que quitar la validación deja pasar
 * basura (mutación: borrar `validarClavesCatalogo` pone en rojo los rechazos).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import {
    SEMILLAS_CATALOGO_PROFESIONAL,
    CLAVE_CAT_PROFESION,
    PROFESION_DEFAULT,
} from "@/lib/profesional/catalogos";

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

async function sembrarCatalogosDefault() {
    for (const c of SEMILLAS_CATALOGO_PROFESIONAL) {
        await prisma.parametroSistema.upsert({
            where: { clave: c.clave },
            update: { valor: c.valor },
            create: { clave: c.clave, valor: c.valor, tipo: "JSON", categoria: "SYSTEM", esPublico: false },
        });
    }
}

async function sembrarProfesion(opciones: { clave: string; nombre: string }[]) {
    const valor = JSON.stringify(opciones);
    await prisma.parametroSistema.upsert({
        where: { clave: CLAVE_CAT_PROFESION },
        update: { valor },
        create: { clave: CLAVE_CAT_PROFESION, valor, tipo: "JSON", categoria: "SYSTEM", esPublico: false },
    });
}

/** Cuerpo completo y VÁLIDO salvo las claves de catálogo que cada test cambia. */
function bodyBase(ciudadId: string) {
    return {
        nombreVisible: "Dra. Ramírez",
        profesion: "psicologo",
        areasAtencion: ["ansiedad", "tdah"],
        rangoEtario: ["6-11"],
        ciudadId,
        atiendeVirtual: true,
        atiendePresencial: false,
        aniosExperiencia: 10,
        presentacion: "Acompaño a familias con niñez y adolescencia.",
        // SPEC-685 (PR3): la tarifa salió de la ficha y solo la fija el habilitado;
        // un PUT de borrador con tarifa lo rechaza el servidor. No se envía acá.
        duracionMinutos: 50,
    };
}

async function ponerProfesional() {
    const prof = await crearUsuario("PROFESIONAL");
    const { ciudad } = await crearPaisCiudad();
    globalThis.__testToken = await crearTokenUsuario(prof.id, "PROFESIONAL");
    return { prof, ciudad };
}

async function putPerfil(body: unknown) {
    const req = crearRequestAutenticado("PUT", "http://localhost/api/profesional/perfil", body, globalThis.__testToken);
    return PUT(req);
}

describe("SPEC-685 · PUT /api/profesional/perfil — listas cerradas en el servidor", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
        await sembrarCatalogosDefault();
    });

    it("ACEPTA claves del catálogo y las GUARDA (conducta, no el JSON de respuesta)", async () => {
        const { prof, ciudad } = await ponerProfesional();
        const res = await putPerfil(bodyBase(ciudad.id));
        expect(res.status, `respuesta: ${await res.clone().text().catch(() => "")}`).toBe(201);
        const fila = await prisma.perfilProfesional.findUnique({
            where: { usuarioId: prof.id },
            select: { profesion: true, areasAtencion: true, rangoEtario: true, tituloProfesional: true, especialidades: true },
        });
        expect(fila?.profesion).toBe("psicologo");
        expect(fila?.areasAtencion.sort()).toEqual(["ansiedad", "tdah"]);
        expect(fila?.rangoEtario).toEqual(["6-11"]);
        // Doble escritura (expandir-contraer): las columnas legado NOT NULL se llenan
        // DESDE las claves nuevas con las ETIQUETAS del catálogo — nunca cadena vacía.
        expect(fila?.tituloProfesional).toBe("Psicólogo/a");
        expect(fila?.tituloProfesional).not.toBe("");
        expect(fila?.especialidades).toEqual(["Ansiedad", "TDAH y atención"]);
    });

    it("RECHAZA (400) una profesión fuera de catálogo", async () => {
        const { ciudad } = await ponerProfesional();
        const res = await putPerfil({ ...bodyBase(ciudad.id), profesion: "charlatan" });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toContain("profesión");
    });

    it("RECHAZA (400) un área de atención fuera de catálogo", async () => {
        const { ciudad } = await ponerProfesional();
        const res = await putPerfil({ ...bodyBase(ciudad.id), areasAtencion: ["ansiedad", "inventada"] });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toContain("área");
    });

    it("RECHAZA (400) un rango de edad fuera de catálogo", async () => {
        const { ciudad } = await ponerProfesional();
        const res = await putPerfil({ ...bodyBase(ciudad.id), rangoEtario: ["99-100"] });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toContain("rango");
    });

    it("control positivo del LECTOR: una clave que el admin agrega al PARÁMETRO se acepta", async () => {
        const { prof, ciudad } = await ponerProfesional();
        // `coach` NO está en el DEFAULT del código; solo en el parámetro editado.
        expect(PROFESION_DEFAULT.some((o) => o.clave === "coach")).toBe(false);
        await sembrarProfesion([...PROFESION_DEFAULT, { clave: "coach", nombre: "Coach de crianza" }]);

        const res = await putPerfil({ ...bodyBase(ciudad.id), profesion: "coach" });
        expect(res.status, `respuesta: ${await res.clone().text().catch(() => "")}`).toBe(201);
        const fila = await prisma.perfilProfesional.findUnique({ where: { usuarioId: prof.id }, select: { profesion: true, tituloProfesional: true } });
        expect(fila?.profesion).toBe("coach");
        // La etiqueta legado también sale del PARÁMETRO (no de una constante).
        expect(fila?.tituloProfesional).toBe("Coach de crianza");
    });
});
