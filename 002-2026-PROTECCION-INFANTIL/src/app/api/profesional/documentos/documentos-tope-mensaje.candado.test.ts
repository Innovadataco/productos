/**
 * CANDADO · SPEC-726 + SPEC-727 · la subida de documentos, contra la base.
 *
 * SPEC-726 (el bug de Jelkin): subir un documento sobredimensionado devolvía el copy de
 * LA AUTORIZACIÓN («La autorización supera el tamaño máximo de 5 MB»). Ahora el mensaje
 * NOMBRA el requisito, en usted, con el {N} del PARÁMETRO — y NO contiene «autorización».
 * Control positivo: el texto viejo haría fallar estas aserciones.
 *
 * SPEC-727: un profesional NUEVO sin perfil abre «completar»; el GET de documentos ya NO
 * responde 4xx (ensuciaba consola/monitoreo) — 200 con `sinPerfil`. Control positivo: el
 * camino viejo devolvía 400.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { guardarDocumentoDeRequisito } from "@/lib/profesional/documentos.service";
import { GET } from "./route";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const REQUISITOS = [{ clave: "tarjeta", nombre: "Tarjeta profesional vigente", descripcion: "" }];

async function sembrarRequisitos() {
    await prisma.parametroSistema.upsert({
        where: { clave: "verificacion.requisitos" },
        update: { valor: JSON.stringify(REQUISITOS) },
        create: {
            clave: "verificacion.requisitos",
            valor: JSON.stringify(REQUISITOS),
            tipo: "JSON",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "Requisitos del Verificador (test)",
        },
    });
}

/** Fija el tope de documentos en 1 MB para no tener que fabricar un buffer de 10 MB. */
async function sembrarTopeDocumentos(mb: number) {
    await prisma.parametroSistema.upsert({
        where: { clave: "documentos.tamano_max_mb" },
        update: { valor: String(mb) },
        create: {
            clave: "documentos.tamano_max_mb",
            valor: String(mb),
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "Tope documentos (test)",
        },
    });
}

async function sembrarProfesionalConPerfil() {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.perfil.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Dra. Ramírez",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 5,
            presentacion: "Presentación de prueba, suficientemente larga.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            atiendeVirtual: true,
            estado: "BORRADOR",
        },
    });
    return { usuario, perfil };
}

describe("SPEC-726/727 · subida de documentos (mensaje + estado vacío)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("SPEC-726: un documento sobredimensionado → mensaje que NOMBRA el requisito, en usted, con el {N} del parámetro, SIN «autorización»", async () => {
        await sembrarTopeDocumentos(1); // 1 MB
        const { perfil } = await sembrarProfesionalConPerfil();
        // PDF válido por magia de bytes, pero > 1 MB.
        const grande = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(1024 * 1024 + 100, 0x20)]);

        let err: unknown;
        try {
            await guardarDocumentoDeRequisito(perfil.id, "tarjeta", grande);
        } catch (e) {
            err = e;
        }
        const msg = (err as { message?: string })?.message ?? "";
        expect(err, "subir > tope debe rechazar").toBeDefined();
        expect(msg, "nombra el requisito").toContain("tarjeta profesional vigente");
        expect(msg, "el {N} del parámetro, no 5 quemado").toContain("1 MB");
        expect(msg, "NO el copy de la autorización (el bug de Jelkin)").not.toContain("autorización");
        expect(msg, "usted, no tuteo").not.toContain("Sube ");
    });

    it("SPEC-726: un documento válido bajo el tope se guarda", async () => {
        await sembrarTopeDocumentos(10);
        const { perfil } = await sembrarProfesionalConPerfil();
        const ok = Buffer.concat([Buffer.from("%PDF-"), Buffer.from("\n1 0 obj\n<<>>\nendobj\n")]);
        await expect(guardarDocumentoDeRequisito(perfil.id, "tarjeta", ok)).resolves.toBeTruthy();
    });

    it("SPEC-727: profesional autenticado SIN perfil → GET 200 con `sinPerfil`, no 4xx", async () => {
        const usuario = await crearUsuario("PROFESIONAL", `psi.sinperfil.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");

        const res = await GET();
        expect(res.status, "sin perfil NO es un error (antes 400)").toBe(200);
        const json = (await res.json()) as { sinPerfil?: boolean; data?: unknown[]; tamanoMaxMb?: number };
        expect(json.sinPerfil).toBe(true);
        expect(json.data).toEqual([]);
        expect(typeof json.tamanoMaxMb).toBe("number"); // el cliente lee el mismo tope
    });
});
