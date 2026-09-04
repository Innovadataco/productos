/**
 * SPEC-436 (I-303 · I-304) · los documentos del profesional, contra la base.
 *
 * Prueba lo que el radicado exige y lo hace por CONDUCTA: que el documento se
 * pueda abrir de verdad (el 404 reproducido), que solo lo abra quien debe, que
 * **cada apertura deje su fila de auditoría leída EN BASE**, que no se pueda
 * marcar CUMPLE sin documento, y que la lista salga del parámetro.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { GET as verComoVerificador } from "@/app/api/admin/verificacion-profesionales/[id]/documentos/[clave]/route";
import { GET as verComoDueno } from "@/app/api/profesional/documentos/[clave]/route";
import {
    guardarDocumentoDeRequisito,
    estadoDeDocumentos,
} from "./documentos.service";
import { decidir } from "@/lib/profesionales/verificador/service";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));
vi.mock("@/lib/queue", () => ({ sendNotificacionEnvio: vi.fn(async () => undefined) }));

/** Un PDF mínimo VÁLIDO: la validación es por número mágico, no por extensión. */
const PDF = Buffer.concat([Buffer.from("%PDF-"), Buffer.from("\n1 0 obj\n<<>>\nendobj\n")]);

const REQUISITOS = [
    { clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "imagen o PDF" },
    { clave: "antecedentes", nombre: "Certificado de antecedentes", descripcion: "imagen o PDF" },
];

async function sembrarRequisitos(lista = REQUISITOS) {
    await prisma.parametroSistema.upsert({
        where: { clave: "verificacion.requisitos" },
        update: { valor: JSON.stringify(lista) },
        create: {
            clave: "verificacion.requisitos",
            valor: JSON.stringify(lista),
            tipo: "JSON",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "Requisitos del Verificador (test)",
        },
    });
}

async function sembrarProfesional(sufijo: string) {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.${sufijo}.${Date.now()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: `Profesional ${sufijo}`,
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 5,
            presentacion: "Presentación.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            estado: "EN_REVISION",
        },
    });
    return { usuario, perfil };
}

function pedirComoVerificador(perfilId: string, clave: string) {
    return verComoVerificador(new Request("http://localhost/x"), {
        params: Promise.resolve({ id: perfilId, clave }),
    });
}
function pedirComoDueno(clave: string) {
    return verComoDueno(new Request("http://localhost/x"), {
        params: Promise.resolve({ clave }),
    });
}

async function contarAperturas(perfilId: string): Promise<number> {
    return prisma.auditLog.count({
        where: { accion: "PROFESIONAL_AUTORIZACION_ACCESO", recursoId: perfilId },
    });
}

describe("SPEC-436 · los documentos del profesional", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        // El storage escribe en disco: se aísla por corrida.
        process.env.AUTORIZACIONES_PROFESIONALES_STORAGE_DIR = path.join(
            process.cwd(),
            "storage",
            `test-436-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("I-303 · el verificador ABRE el documento: responde el archivo, no una página", async () => {
        const { perfil } = await sembrarProfesional("a");
        await guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF);

        const admin = await crearUsuario("ADMIN", `verif.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await pedirComoVerificador(perfil.id, "tarjeta");
        expect(res.status).toBe(200);
        // Lo que se sirve es el ARCHIVO — antes el enlace caía en la app y daba 404.
        expect(res.headers.get("Content-Type")).toBe("application/pdf");
        const cuerpo = Buffer.from(await res.arrayBuffer());
        expect(cuerpo.subarray(0, 5).toString()).toBe("%PDF-");
        // Y nunca el cifrado crudo: el contenido descifrado es el original.
        expect(cuerpo.equals(PDF)).toBe(true);
    });

    it("H-2 · CADA apertura deja su fila de auditoría (leída en base)", async () => {
        const { perfil } = await sembrarProfesional("b");
        await guardarDocumentoDeRequisito(perfil.id, "antecedentes", PDF);
        const admin = await crearUsuario("ADMIN", `verif2.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        expect(await contarAperturas(perfil.id)).toBe(0);
        await pedirComoVerificador(perfil.id, "antecedentes");
        await pedirComoVerificador(perfil.id, "antecedentes");
        expect(await contarAperturas(perfil.id), "dos aperturas, dos filas").toBe(2);

        const fila = await prisma.auditLog.findFirst({
            where: { accion: "PROFESIONAL_AUTORIZACION_ACCESO", recursoId: perfil.id },
        });
        expect(JSON.stringify(fila?.metadatos ?? {})).toContain("antecedentes");
    });

    it("un PADRE no puede abrir documentos de un profesional (403)", async () => {
        const { perfil } = await sembrarProfesional("c");
        await guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF);
        const padre = await crearUsuario("PARENT", `papa.${Date.now()}@ejemplo.local`);
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await pedirComoVerificador(perfil.id, "tarjeta");
        expect(res.status).toBe(403);
        expect(await contarAperturas(perfil.id), "un 403 no puede dejar rastro de apertura").toBe(0);
    });

    it("un profesional NO alcanza los documentos de otro", async () => {
        const a = await sembrarProfesional("dueño");
        await guardarDocumentoDeRequisito(a.perfil.id, "tarjeta", PDF);
        const b = await sembrarProfesional("intruso");
        mockToken = await crearTokenUsuario(b.usuario.id, "PROFESIONAL");

        // Por la puerta del Verificador: no tiene el módulo → 403.
        expect((await pedirComoVerificador(a.perfil.id, "tarjeta")).status).toBe(403);
        // Y por su propia puerta solo ve LO SUYO: él no cargó nada → 404.
        expect((await pedirComoDueno("tarjeta")).status).toBe(404);
        expect(await contarAperturas(a.perfil.id), "nadie abrió el documento del otro").toBe(0);
    });

    it("el DUEÑO sí abre los suyos", async () => {
        const { usuario, perfil } = await sembrarProfesional("propio");
        await guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF);
        mockToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");

        const res = await pedirComoDueno("tarjeta");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("application/pdf");
        expect(await contarAperturas(perfil.id)).toBe(1);
    });

    it("I-304 · NO se puede marcar CUMPLE un requisito sin documento", async () => {
        const { perfil } = await sembrarProfesional("d");
        const admin = await crearUsuario("ADMIN", `verif3.${Date.now()}@ejemplo.local`);
        // `decidir` exige la autorización firmada antes que nada (regla previa);
        // se carga para que el test llegue de verdad a la guardia de SPEC-436.
        await prisma.perfilProfesional.update({
            where: { id: perfil.id },
            data: { autorizacionArchivoId: "archivo-de-prueba", autorizacionSubidaEn: new Date() },
        });
        // Solo un requisito tiene documento; el otro no.
        await guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF);

        await expect(
            decidir(perfil.id, { id: admin.id, email: admin.email }, {
                checklist: {
                    tarjeta: { estado: "CUMPLE", observacion: "" },
                    antecedentes: { estado: "CUMPLE", observacion: "" },
                },
            }),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("la lista sale del PARÁMETRO: un quinto requisito aparece sin tocar código", async () => {
        const { perfil } = await sembrarProfesional("e");
        expect((await estadoDeDocumentos(perfil.id)).map((d) => d.clave)).toEqual([
            "tarjeta",
            "antecedentes",
        ]);

        await sembrarRequisitos([
            ...REQUISITOS,
            { clave: "poliza", nombre: "Póliza de responsabilidad", descripcion: "imagen o PDF" },
        ]);
        const conNuevo = await estadoDeDocumentos(perfil.id);
        expect(conNuevo.map((d) => d.clave)).toContain("poliza");
        expect(conNuevo.find((d) => d.clave === "poliza")?.cargado).toBe(false);
    });
});
