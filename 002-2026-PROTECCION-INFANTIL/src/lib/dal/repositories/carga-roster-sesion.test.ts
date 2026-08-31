/**
 * SPEC-134 (E-1, O-4): tests del CargaRosterSesionRepository — guardas de tenant,
 * single-use dentro de tx (SPEC-132 O-2) y purga backstop.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { CargaRosterSesionRepository } from "./carga-roster-sesion";
import type { FilaCargaEstudiante } from "@/lib/colegio/carga/parser";

function filasPrueba(): FilaCargaEstudiante[] {
    return [
        {
            fila: 2,
            curso: { nombre: "6A", grado: "Sexto", anioLectivo: "2026" },
            alumno: { nombre: "María", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "ROS-1" },
            identificador: { tipo: "telefono", valor: "+573001234567", etiquetaRelacion: "ESTUDIANTE", plataformaId: null },
        },
    ];
}

describe("CargaRosterSesionRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crear persiste el roster con TTL y obtenerValida lo devuelve al MISMO colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new CargaRosterSesionRepository();

        const sesionId = await repo.crear(a.id, filasPrueba());
        const sesion = await repo.obtenerValida(sesionId, a.id);
        expect(sesion).not.toBeNull();
        expect(sesion!.colegioId).toBe(a.id);
        expect(sesion!.filas).toHaveLength(1);
        expect(sesion!.expiraEn.getTime()).toBeGreaterThan(Date.now());
    });

    it("obtenerValida devuelve null a OTRO colegio y la sesión queda intacta", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new CargaRosterSesionRepository();

        const sesionId = await repo.crear(a.id, filasPrueba());
        expect(await repo.obtenerValida(sesionId, b.id), "la sesión de A no es visible para B").toBeNull();
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: sesionId } }), "la sesión sigue ahí").not.toBeNull();
    });

    it("obtenerValida devuelve null para una sesión vencida", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new CargaRosterSesionRepository();

        const sesionId = await repo.crear(a.id, filasPrueba());
        await prisma.cargaRosterSesion.update({ where: { id: sesionId }, data: { expiraEn: new Date(Date.now() - 1000) } });
        expect(await repo.obtenerValida(sesionId, a.id)).toBeNull();
    });

    it("consumir borra la sesión dentro de la tx (single-use) y una segunda vez da 404", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const sesionId = await new CargaRosterSesionRepository().crear(a.id, filasPrueba());

        await prisma.$transaction(async (tx) => {
            await new CargaRosterSesionRepository(tx).consumir(a.id, sesionId);
        });
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: sesionId } }), "single-use: borrada").toBeNull();

        await expect(new CargaRosterSesionRepository().consumir(a.id, sesionId)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("O-4: consumir con otro colegioId lanza 404 y la sesión ajena queda intacta", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const sesionId = await new CargaRosterSesionRepository().crear(a.id, filasPrueba());

        await expect(new CargaRosterSesionRepository().consumir(b.id, sesionId)).rejects.toMatchObject({ statusCode: 404 });
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: sesionId } }), "la sesión de A no fue tocada").not.toBeNull();
    });

    it("purgarExpiradas borra solo las vencidas (excepción global documentada)", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new CargaRosterSesionRepository();
        const vencida = await repo.crear(a.id, filasPrueba());
        const vigente = await repo.crear(b.id, filasPrueba());
        await prisma.cargaRosterSesion.update({ where: { id: vencida }, data: { expiraEn: new Date(Date.now() - 1000) } });

        const borradas = await repo.purgarExpiradas();
        expect(borradas).toBe(1);
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: vigente } }), "la vigente sobrevive").not.toBeNull();
    });
});
