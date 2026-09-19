/**
 * SPEC-714 · Candado de CONDUCTA de la materialización en lote (repetir un patrón,
 * copiar un día). Afirma la fila en base, no el texto: `materializarFranjas` crea
 * EXACTAMENTE las que caben y ninguna pasa el muro de vigencia (SPEC-449) ni una
 * modalidad que el profesional no atiende (SPEC-447). «Las que no caben, no se
 * crean» (forma de Diseño).
 *
 * Mutación-verificado: si se quita el filtro `fin > venceEn` de la materialización,
 * (c1) crea 4 en vez de 2 y dos pasan el muro → rojo. Si se quita el chequeo de
 * modalidad, (c4) crea la presencial → rojo.
 *
 * c3 (borrar una reservada se rechaza en el servidor) y c4 en la ruta unitaria ya
 * viven en `app/api/profesional/franjas/route.test.ts` (borrarSiLibre + modalidad);
 * acá se cubre el camino NUEVO —el lote— sin duplicar aquéllos.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { instanteDesdeHoraBogota, sumarMinutos } from "@/lib/fechas/formato-bogota";
import { materializarFranjas } from "./franjas.service";

async function sembrar(opciones: { virtual?: boolean; presencial?: boolean; venceEn?: Date } = {}) {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id, nombreVisible: "Mariana Restrepo", tituloProfesional: "Psicología",
            especialidades: ["infantil"], ciudadId: ciudad.id, aniosExperiencia: 8, presentacion: "P.",
            tarifaConsultaCOP: 180000, duracionMinutos: 45,
            atiendeVirtual: opciones.virtual ?? true, atiendePresencial: opciones.presencial ?? false, estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN", `verif.${Date.now()}.${Math.random()}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id, revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000), checklist: {}, resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: opciones.venceEn ?? new Date("2027-06-01T00:00:00.000Z"),
        },
    });
    return { perfil };
}

function slot(dia: string, hora: string, modalidad: "VIRTUAL" | "PRESENCIAL", minutos = 60) {
    const inicio = instanteDesdeHoraBogota(dia, hora);
    return { inicio: inicio.toISOString(), fin: sumarMinutos(inicio, minutos).toISOString(), modalidad };
}

describe("SPEC-714 · materializar franjas en lote (repetir / copiar)", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("(c1) crea EXACTAMENTE las que caben y NINGUNA pasa el muro de vigencia", async () => {
        // venceEn = 2027-03-12 00:00 en Bogotá (UTC-5). Una franja de las 10:00 de Bogotá
        // del 03-12 y del 03-13 termina DESPUÉS del muro; las del 03-10 y 03-11, no.
        const venceEn = new Date("2027-03-12T05:00:00.000Z");
        const { perfil } = await sembrar({ virtual: true, venceEn });
        const entradas = ["2027-03-10", "2027-03-11", "2027-03-12", "2027-03-13"].map((d) => slot(d, "10:00", "VIRTUAL"));

        const r = await materializarFranjas(perfil.id, entradas);

        expect(r.creadas, "solo caben las dos anteriores al muro").toBe(2);
        expect(r.omitidas.filter((o) => o.motivo === "vigencia").length).toBe(2);
        const franjas = await prisma.franjaDisponible.findMany({ where: { profesionalId: perfil.id } });
        expect(franjas.length).toBe(2);
        for (const f of franjas) {
            expect(f.fin.getTime(), "ninguna franja materializada termina después del muro").toBeLessThanOrEqual(venceEn.getTime());
        }
    });

    it("(c1) dos entradas del lote que se cruzan no se duplican (no-solape)", async () => {
        const { perfil } = await sembrar({ virtual: true });
        const r = await materializarFranjas(perfil.id, [
            slot("2027-03-10", "10:00", "VIRTUAL", 120),
            slot("2027-03-10", "11:00", "VIRTUAL", 60), // se cruza con la anterior
        ]);
        expect(r.creadas).toBe(1);
        expect(r.omitidas.some((o) => o.motivo === "solape")).toBe(true);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("(c4) una modalidad que el profesional NO atiende se omite del lote", async () => {
        const { perfil } = await sembrar({ virtual: true, presencial: false });
        const r = await materializarFranjas(perfil.id, [slot("2027-03-10", "10:00", "PRESENCIAL")]);
        expect(r.creadas).toBe(0);
        expect(r.omitidas[0]?.motivo).toBe("modalidad");
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });
});
