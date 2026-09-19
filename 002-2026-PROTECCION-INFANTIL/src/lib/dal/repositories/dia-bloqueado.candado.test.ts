/**
 * SPEC-714 (decisión CEO 18-09) · CANDADO del modelo DiaBloqueado.
 *
 * - ÚNICO REAL (profesionalId, fecha): la BD rechaza un segundo día igual (no
 *   depende de la app); `bloquear` es idempotente sobre ese único.
 * - REGLA 2 (CEO): bloquear NO borra una cita CONFIRMADA de ese día — `bloquear`
 *   solo inserta, jamás lee ni toca franjas/citas; se prueba con una cita real.
 * - REGLA 1 (dato): `estaBloqueado` distingue día cerrado de abierto (lo consume
 *   `franjas/route.ts`; el candado de RUTA —POST rechazado— vive en
 *   `franjas/route.test.ts`, junto a las otras cuatro validaciones).
 * - FK purge-safe: borrar el PerfilProfesional CASCADEA sus días y NO se traba.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { instanteDesdeHoraBogota, sumarMinutos, diaBogota } from "@/lib/fechas/formato-bogota";
import { DiaBloqueadoRepository } from "./dia-bloqueado";

async function sembrarProfesional() {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}.${Math.random()}@ejemplo.local`);
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Mariana Restrepo",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 8,
            presentacion: "Presentación.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            atiendeVirtual: true,
            estado: "ACTIVO",
        },
    });
}

/** Una cita CONFIRMADA real en `dia` (Bogotá), con su franja tomada. */
async function sembrarCitaConfirmada(perfilId: string, dia: string) {
    const inicio = instanteDesdeHoraBogota(dia, "10:00");
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: perfilId, inicio, fin: sumarMinutos(inicio, 45), modalidad: "VIRTUAL", tomada: true },
    });
    const padre = await crearUsuario("PARENT", `papa.${Date.now()}.${Math.random()}@ejemplo.local`);
    const cita = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: perfilId,
            franjaId: franja.id,
            presentacion: "Necesito orientación.",
            urgencia: "SIN_APURO",
            estado: "CONFIRMADA",
            venceEn: sumarMinutos(inicio, -60),
            pagoAprobadoEn: new Date(),
            montoConsulta: 180000,
            montoServicio: 27000,
            montoTotal: 207000,
            porcentajeServicio: 15,
        },
    });
    return { franja, cita };
}

const repo = () => new DiaBloqueadoRepository();
const DIA = "2027-05-20";

describe("SPEC-714 · DiaBloqueado — modelo, único e idempotencia", () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("ÚNICO REAL (profesionalId, fecha): la BD rechaza el segundo día igual", async () => {
        const perfil = await sembrarProfesional();
        await prisma.diaBloqueado.create({ data: { profesionalId: perfil.id, fecha: DIA } });
        await expect(
            prisma.diaBloqueado.create({ data: { profesionalId: perfil.id, fecha: DIA } }),
        ).rejects.toMatchObject({ code: "P2002" });
        expect(await prisma.diaBloqueado.count({ where: { profesionalId: perfil.id, fecha: DIA } })).toBe(1);
    });

    it("el MISMO día en OTRO profesional sí se puede (el único es POR profesional)", async () => {
        const a = await sembrarProfesional();
        const b = await sembrarProfesional();
        await repo().bloquear(a.id, DIA);
        await repo().bloquear(b.id, DIA);
        expect(await prisma.diaBloqueado.count({ where: { fecha: DIA } })).toBe(2);
    });

    it("bloquear es IDEMPOTENTE: dos veces = una fila, conserva el motivo original", async () => {
        const perfil = await sembrarProfesional();
        await repo().bloquear(perfil.id, DIA, "vacaciones");
        await repo().bloquear(perfil.id, DIA, "otro motivo");
        const filas = await prisma.diaBloqueado.findMany({ where: { profesionalId: perfil.id, fecha: DIA } });
        expect(filas).toHaveLength(1);
        expect(filas[0]!.motivo).toBe("vacaciones");
    });

    it("estaBloqueado / desbloquear reflejan el estado del día", async () => {
        const perfil = await sembrarProfesional();
        expect(await repo().estaBloqueado(perfil.id, DIA)).toBe(false);
        await repo().bloquear(perfil.id, DIA);
        expect(await repo().estaBloqueado(perfil.id, DIA)).toBe(true);
        expect(await repo().estaBloqueado(perfil.id, "2027-05-21")).toBe(false);
        expect(await repo().desbloquear(perfil.id, DIA)).toBe(1);
        expect(await repo().estaBloqueado(perfil.id, DIA)).toBe(false);
    });

    it("diasBloqueadosDe: devuelve los `yyyy-MM-dd` ordenados (formato del DTO)", async () => {
        const perfil = await sembrarProfesional();
        await repo().bloquear(perfil.id, "2027-05-22");
        await repo().bloquear(perfil.id, "2027-05-20");
        expect(await repo().diasBloqueadosDe(perfil.id)).toEqual(["2027-05-20", "2027-05-22"]);
    });

    it("rechaza un `fecha` que no es un día real (guarda del repositorio)", async () => {
        const perfil = await sembrarProfesional();
        await expect(repo().bloquear(perfil.id, "2027-13-40")).rejects.toThrow(/fecha/i);
        await expect(repo().bloquear(perfil.id, "20-05-2027")).rejects.toThrow(/fecha/i);
        expect(await prisma.diaBloqueado.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });
});

describe("SPEC-714 · DiaBloqueado — regla 2 (bloquear no borra citas) y FK", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("REGLA 2 (CEO): bloquear un día NO borra la cita CONFIRMADA de ese día", async () => {
        const perfil = await sembrarProfesional();
        const { franja, cita } = await sembrarCitaConfirmada(perfil.id, DIA);
        expect(diaBogota(franja.inicio), "la cita cae exactamente en el día a bloquear").toBe(DIA);

        await repo().bloquear(perfil.id, DIA, "no acepto más ese día");

        const citaDespues = await prisma.solicitudCita.findUnique({ where: { id: cita.id } });
        expect(citaDespues, "la cita confirmada sobrevive al bloqueo").not.toBeNull();
        expect(citaDespues!.estado).toBe("CONFIRMADA");
        expect(await prisma.franjaDisponible.count({ where: { id: franja.id } })).toBe(1);
    });

    it("FK purge-safe: borrar el PerfilProfesional CASCADEA sus días y no se traba", async () => {
        const perfil = await sembrarProfesional();
        await repo().bloquear(perfil.id, DIA);
        await expect(prisma.perfilProfesional.delete({ where: { id: perfil.id } })).resolves.toBeTruthy();
        expect(await prisma.diaBloqueado.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });
});
