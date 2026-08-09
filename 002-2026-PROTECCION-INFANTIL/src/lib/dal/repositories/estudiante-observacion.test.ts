/**
 * SPEC-150 (T002, FR-001/FR-002): tests del repo de observación especial.
 * Marcar es idempotente (dos marcas ⇒ UNA fila activa); desmarcar es soft
 * delete que CONSERVA la fila con quién/cuándo (histórico completo); A/B con
 * dos colegios: B nunca ve ni toca lo de A.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearEstudiante } from "@/lib/reporte-test-utils";
import { EstudianteObservacionRepository } from "./estudiante-observacion";

async function fixtureEstudiante(nombre = "María") {
    const { admin, colegio } = await crearColegioConAdmin();
    const curso = await crearCurso(colegio.id, { nombre: "6A", grado: "Sexto" });
    const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre, apellidos: "Gómez" });
    return { admin, colegio, estudiante };
}

describe("EstudianteObservacionRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("marcar crea la observación activa con motivo; re-marcar es idempotente (sin duplicar)", async () => {
        const { admin, colegio, estudiante } = await fixtureEstudiante();
        const repo = new EstudianteObservacionRepository();

        const primera = await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id, motivo: "Cambio de comportamiento" });
        expect(primera.creada).toBe(true);
        expect(primera.observacion.activa).toBe(true);
        expect(primera.observacion.motivo).toBe("Cambio de comportamiento");
        expect(primera.observacion.creadaPorId).toBe(admin.id);

        const segunda = await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id, motivo: "Otro motivo" });
        expect(segunda.creada).toBe(false);
        expect(segunda.observacion.id).toBe(primera.observacion.id);
        expect(segunda.observacion.motivo).toBe("Cambio de comportamiento");
        expect(await prisma.estudianteObservacion.count()).toBe(1);
    });

    it("desmarcar es soft delete: la fila se CONSERVA con fecha y actor; el histórico sigue completo", async () => {
        const { admin, colegio, estudiante } = await fixtureEstudiante();
        const repo = new EstudianteObservacionRepository();
        const { observacion } = await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id });

        const desactivada = await repo.desmarcar(colegio.id, estudiante.id, admin.id);
        expect(desactivada).not.toBeNull();
        expect(desactivada!.id).toBe(observacion.id);
        expect(desactivada!.activa).toBe(false);
        expect(desactivada!.desactivadaEn).toBeInstanceOf(Date);
        expect(desactivada!.desactivadaPorId).toBe(admin.id);

        // La fila NO se borra y ya no hay activa.
        expect(await prisma.estudianteObservacion.count()).toBe(1);
        expect(await repo.obtenerActiva(colegio.id, estudiante.id)).toBeNull();
        // Desmarcar sin activa es no-op (null), no error.
        expect(await repo.desmarcar(colegio.id, estudiante.id, admin.id)).toBeNull();

        const historial = await repo.historial(colegio.id, estudiante.id);
        expect(historial).toHaveLength(1);
        expect(historial[0]!.activa).toBe(false);
    });

    it("re-marcar tras desmarcar crea una fila NUEVA: histórico de 2 con una sola activa", async () => {
        const { admin, colegio, estudiante } = await fixtureEstudiante();
        const repo = new EstudianteObservacionRepository();

        const primera = await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id });
        await repo.desmarcar(colegio.id, estudiante.id, admin.id);
        const segunda = await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id, motivo: "Reincidencia" });

        expect(segunda.creada).toBe(true);
        expect(segunda.observacion.id).not.toBe(primera.observacion.id);
        const historial = await repo.historial(colegio.id, estudiante.id);
        expect(historial).toHaveLength(2);
        expect(historial.filter((o) => o.activa)).toHaveLength(1);
        expect(historial[0]!.id).toBe(segunda.observacion.id); // reciente primero
    });

    it("activasPorColegio devuelve solo estudiantes con observación ACTIVA del colegio", async () => {
        const { admin, colegio, estudiante } = await fixtureEstudiante();
        const curso = await prisma.curso.findFirstOrThrow({ where: { colegioId: colegio.id } });
        const otro = await crearEstudiante(curso.id, colegio.id, { nombre: "Juan", apellidos: "Pérez" });
        const repo = new EstudianteObservacionRepository();

        expect((await repo.activasPorColegio(colegio.id)).size).toBe(0);

        await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id });
        await repo.marcar(colegio.id, otro.id, { creadaPorId: admin.id });
        await repo.desmarcar(colegio.id, otro.id, admin.id);

        const activas = await repo.activasPorColegio(colegio.id);
        expect([...activas]).toEqual([estudiante.id]);
    });

    it("A/B: el colegio B no ve la activa ni el histórico del estudiante de A", async () => {
        const { admin, colegio: colegioA, estudiante } = await fixtureEstudiante();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const repo = new EstudianteObservacionRepository();

        await repo.marcar(colegioA.id, estudiante.id, { creadaPorId: admin.id });

        expect(await repo.obtenerActiva(colegioB.id, estudiante.id)).toBeNull();
        expect(await repo.historial(colegioB.id, estudiante.id)).toEqual([]);
        expect((await repo.activasPorColegio(colegioB.id)).size).toBe(0);
        // B tampoco puede desmarcar lo de A (no encuentra activa bajo su tenant).
        expect(await repo.desmarcar(colegioB.id, estudiante.id, admin.id)).toBeNull();
        expect(await prisma.estudianteObservacion.count()).toBe(1);
        expect((await repo.obtenerActiva(colegioA.id, estudiante.id))!.activa).toBe(true);
    });
});
