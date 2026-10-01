/**
 * CANDADO · SPEC-816 (FUENTE ÚNICA) · lo que el directorio MUESTRA como rango etario sale de la MISMA fuente
 * que el profesional escribe (`PerfilProfesional.rangoEtario`), por su NOMBRE del catálogo — no un segundo
 * origen. El catálogo solo aporta la etiqueta; QUÉ bandas lo decide el campo. Control positivo POR MUTACIÓN:
 * cambiar el campo del perfil cambia lo mostrado (no hay valor fijo ni copia). Integración (BD).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { RANGO_ETARIO_DEFAULT } from "@/lib/profesional/catalogos";

/** El nombre de banda del catálogo DEFAULT para una clave (el test no siembra override → cae al default). */
const nombre = (clave: string) => RANGO_ETARIO_DEFAULT.find((o) => o.clave === clave)!.nombre;

let n = 0;
/** Profesional VISIBLE en el directorio (ACTIVO + verificación APROBADA vigente) con un rango declarado. */
async function profesionalVisible(ciudadId: string, rangoEtario: string[]): Promise<string> {
    const sufijo = `${Date.now()}.${n++}`;
    const usuario = await crearUsuario("PROFESIONAL", `pro.rango.${sufijo}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Dra. Visible",
            tituloProfesional: "Psicología",
            especialidades: ["Ansiedad"],
            ciudadId,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 5,
            presentacion: "Perfil de prueba.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 45,
            estado: "ACTIVO",
            rangoEtario,
        },
    });
    const revisor = await crearUsuario("ADMIN", `adm.rango.${sufijo}@ejemplo.local`);
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
    return perfil.id;
}

describe("SPEC-816 · fuente única · el rango mostrado sale del campo del perfil (por nombre del catálogo)", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("muestra las BANDAS declaradas por su nombre, resueltas de las claves del perfil", async () => {
        const { ciudad } = await crearPaisCiudad();
        const id = await profesionalVisible(ciudad.id, ["6-11", "12-17"]);
        const dto = await new PerfilProfesionalRepository().obtenerPublicoPorId(id, null);
        expect(dto).not.toBeNull();
        expect(dto!.rangoEtario).toEqual([nombre("6-11"), nombre("12-17")]);
    });

    it("control positivo: cambiar el campo del perfil cambia lo mostrado (refleja la fuente, no un valor fijo)", async () => {
        const { ciudad } = await crearPaisCiudad();
        const id = await profesionalVisible(ciudad.id, ["0-5"]);
        const repo = new PerfilProfesionalRepository();
        expect((await repo.obtenerPublicoPorId(id, null))!.rangoEtario).toEqual([nombre("0-5")]);
        await prisma.perfilProfesional.update({ where: { id }, data: { rangoEtario: ["12-17"] } });
        expect((await repo.obtenerPublicoPorId(id, null))!.rangoEtario).toEqual([nombre("12-17")]);
    });

    it("vacío: sin rango declarado, el DTO lo refleja vacío (el render dirá «sin indicar»/«no indicó»)", async () => {
        const { ciudad } = await crearPaisCiudad();
        const id = await profesionalVisible(ciudad.id, []);
        const dto = await new PerfilProfesionalRepository().obtenerPublicoPorId(id, null);
        expect(dto!.rangoEtario).toEqual([]);
    });
});
